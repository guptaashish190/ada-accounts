/**
 * Delete bills (orders) that have no partyId field (missing, null, or empty).
 *
 * Usage:
 *   node scripts/delete-bills-without-party-id.js
 *   node scripts/delete-bills-without-party-id.js --dry-run
 *   node scripts/delete-bills-without-party-id.js --company-id ashish-drug-agencies
 *
 * Prerequisites:
 *   firebase login
 *   gcloud auth application-default login
 */

const admin = require('firebase-admin');

const DEFAULT_COMPANY_ID = 'ashish-drug-agencies';
const BATCH_LIMIT = 500;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const companyIdArg = args.find((arg) => arg.startsWith('--company-id='));
const companyId = companyIdArg
  ? companyIdArg.split('=')[1]
  : DEFAULT_COMPANY_ID;

function hasNoPartyId(data) {
  const { partyId } = data;
  return partyId == null || String(partyId).trim() === '';
}

async function deleteBillsWithoutPartyId() {
  admin.initializeApp({
    credential: admin.credential.cert(require('./serviceAccount.json')),
    projectId: 'ashishdrugagencies-e5b9a',
  });

  const db = admin.firestore();
  const ordersRef = db.collection('companies').doc(companyId).collection('orders').where('partyId', '==', '');

  console.log(`Company: ${companyId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletes)' : 'LIVE'}`);
  console.log('Fetching all orders to find bills without partyId...\n');

  const snapshot = await ordersRef.get();
  const billsToDelete = snapshot.docs;

  console.log(`Found ${billsToDelete.length} bills without partyId (of ${snapshot.size} total)\n`);

  let deletedCount = 0;

  for (let i = 0; i < billsToDelete.length; i += BATCH_LIMIT) {
    const chunk = billsToDelete.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();

    for (const docSnap of chunk) {
      const data = docSnap.data();
      console.log(
        `  ${docSnap.id} | billNumber: ${data.billNumber || '-'} | orderStatus: ${data.orderStatus || '-'}`,
      );

      if (!dryRun) {
        batch.delete(docSnap.ref);
      }
      deletedCount += 1;
    }

    if (!dryRun) {
      await batch.commit();
      console.log(`  Committed delete batch (${chunk.length} bills)\n`);
    }
  }

  console.log(
    dryRun
      ? `\nDry run complete. ${deletedCount} bills would be deleted.`
      : `\nDone. Deleted ${deletedCount} bills.`,
  );
}

deleteBillsWithoutPartyId().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
