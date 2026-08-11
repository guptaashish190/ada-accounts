/**
 * Remove duplicate bills created by running outstanding import more than once.
 * Keeps bills that have bags; deletes duplicates with empty bags.
 * Duplicates are grouped by bill number + bill date (billCreationTime).
 *
 * Usage:
 *   node scripts/remove-duplicate-import-bills.js --dry-run
 *   node scripts/remove-duplicate-import-bills.js --company-id=ashish-drug-agencies
 *
 * Prerequisites:
 *   scripts/serviceAccount.json (same as other scripts)
 */

const admin = require('firebase-admin');

const DEFAULT_COMPANY_ID = 'ashish-drug-agencies';
const BATCH_LIMIT = 450;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const companyIdArg = args.find((arg) => arg.startsWith('--company-id='));
const companyId = companyIdArg
  ? companyIdArg.split('=')[1]
  : DEFAULT_COMPANY_ID;

const normalizeBillNumber = (rawBillNumber) => {
  const normalized = String(rawBillNumber || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  if (!normalized) return '';

  if (normalized.startsWith('*T')) {
    const body = normalized.slice(2).replace(/^-/, '');
    return `*T-${body}`;
  }

  if (normalized.startsWith('T')) {
    const body = normalized.slice(1).replace(/^-/, '');
    return `T-${body}`;
  }

  return normalized;
};

function getBillDateKey(data) {
  const timestamp = Number(data.billCreationTime || data.creationTime || 0);
  if (!timestamp) return 'no-date';

  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDuplicateKey(data) {
  const billNumber = normalizeBillNumber(data.billNumber);
  if (!billNumber) return null;
  return `${billNumber}|${getBillDateKey(data)}`;
}

function hasBags(data) {
  return Array.isArray(data.bags) && data.bags.length > 0;
}

function pickKeeper(bills) {
  return [...bills].sort((a, b) => {
    const aHas = hasBags(a.data) ? 1 : 0;
    const bHas = hasBags(b.data) ? 1 : 0;
    if (bHas !== aHas) return bHas - aHas;

    const aTime = Number(a.data.billCreationTime || a.data.creationTime || 0);
    const bTime = Number(b.data.billCreationTime || b.data.creationTime || 0);
    return aTime - bTime;
  })[0];
}

async function removeDuplicateImportBills() {
  admin.initializeApp({
    credential: admin.credential.cert(require('./serviceAccount.json')),
    projectId: 'ashishdrugagencies-e5b9a',
  });

  const db = admin.firestore();
  const ordersRef = db.collection('companies').doc(companyId).collection('orders');

  console.log(`Company: ${companyId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletes)' : 'LIVE'}\n`);

  console.log('Loading orders...');
  const ordersSnap = await ordersRef.get();
  console.log(`Loaded ${ordersSnap.size} orders\n`);

  const byBillKey = new Map();

  ordersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const key = getDuplicateKey(data);
    if (!key) return;

    if (!byBillKey.has(key)) byBillKey.set(key, []);
    byBillKey.get(key).push({ id: docSnap.id, ref: docSnap.ref, data });
  });

  const duplicateGroups = [...byBillKey.entries()].filter(([, bills]) => bills.length > 1);
  console.log(`Duplicate billNumber + billDate groups: ${duplicateGroups.length}\n`);

  const toDelete = [];
  const skipped = [];

  duplicateGroups.forEach(([groupKey, bills]) => {
    const [billNumber, billDate] = groupKey.split('|');
    const withBags = bills.filter((b) => hasBags(b.data));
    const withoutBags = bills.filter((b) => !hasBags(b.data));

    if (withBags.length >= 1 && withoutBags.length >= 1) {
      withoutBags.forEach((bill) => {
        toDelete.push({ billNumber, billDate, bill, reason: 'No bags (empty import bill)' });
      });
      return;
    }

    if (withBags.length === 0 && withoutBags.length > 1) {
      const keeper = pickKeeper(withoutBags);
      withoutBags
        .filter((b) => b.id !== keeper.id)
        .forEach((bill) => {
          toDelete.push({
            billNumber,
            billDate,
            bill,
            reason: 'Duplicate with no bags',
            keeperId: keeper.id,
          });
        });
      return;
    }

    if (withBags.length > 1) {
      skipped.push({
        billNumber,
        billDate,
        ids: withBags.map((b) => b.id),
        reason: 'Multiple bills with bags — manual review required',
      });
    }
  });

  console.log(`Will delete: ${toDelete.length}`);
  console.log(`Skipped: ${skipped.length}\n`);

  toDelete.forEach(({ billNumber, billDate, bill, reason, keeperId }) => {
    const d = bill.data;
    console.log(
      `  DELETE ${bill.id} | ${billNumber} | date: ${billDate} | balance: ${d.balance ?? '-'} | `
      + `partyId: ${d.partyId || '-'} | reason: ${reason}`
      + (keeperId ? ` | keeper: ${keeperId}` : ''),
    );
  });

  if (skipped.length) {
    console.log('\nSkipped:');
    skipped.forEach((item) => {
      console.log(
        `  ${item.billNumber || '-'} | date: ${item.billDate || '-'} | ${item.reason} | `
        + `${JSON.stringify(item.ids || item.id)}`,
      );
    });
  }

  if (!dryRun && toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
      const chunk = toDelete.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      chunk.forEach(({ bill }) => batch.delete(bill.ref));
      await batch.commit();
      console.log(`\nCommitted delete batch (${chunk.length})`);
    }
  }

  console.log(
    dryRun
      ? `\nDry run complete. ${toDelete.length} bills would be deleted.`
      : `\nDone. Deleted ${toDelete.length} bills.`,
  );
}

removeDuplicateImportBills().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
