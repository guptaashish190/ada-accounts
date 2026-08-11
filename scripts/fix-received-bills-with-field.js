/**
 * Fix bills that have orderStatus "Received Bill" but with !== "Accounts".
 *
 * Usage:
 *   node scripts/fix-received-bills-with-field.js
 *   node scripts/fix-received-bills-with-field.js --dry-run
 *   node scripts/fix-received-bills-with-field.js --company-id ashish-drug-agencies
 *
 * Prerequisites:
 *   firebase login
 *   gcloud auth application-default login
 */

const admin = require('firebase-admin');

const DEFAULT_COMPANY_ID = 'ashish-drug-agencies';
const RECEIVED_BILL_STATUS = 'Received Bill';
const ACCOUNTS_WITH = 'Accounts';
const BATCH_LIMIT = 500;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const companyIdArg = args.find((arg) => arg.startsWith('--company-id='));
const companyId = companyIdArg
  ? companyIdArg.split('=')[1]
  : DEFAULT_COMPANY_ID;

async function fixReceivedBillsWithField() {
  admin.initializeApp({
    credential: admin.credential.cert(require('./serviceAccount.json')),
    projectId: 'ashishdrugagencies-e5b9a',
  });

  const db = admin.firestore();
  const ordersRef = db.collection('companies').doc(companyId).collection('orders');

  console.log(`Company: ${companyId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(
    `Fetching bills with orderStatus "${RECEIVED_BILL_STATUS}" and with !== "${ACCOUNTS_WITH}"...\n`,
  );

  const snapshot = await ordersRef
    .where('with', '!=', ACCOUNTS_WITH)
    .get();

  let updatedCount = 0;

  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();

    for (const docSnap of chunk) {
      const data = docSnap.data();
      if(data.orderStatus !== RECEIVED_BILL_STATUS) {  continue; }
      console.log(
        `  ${docSnap.id} | billNumber: ${data.billNumber || '-'} | with: ${data.with || '(empty)'} -> ${ACCOUNTS_WITH}`,
      );

      if (!dryRun) {
        batch.update(docSnap.ref, { with: ACCOUNTS_WITH });
      }
      updatedCount += 1;
    }

    if (!dryRun) {
      await batch.commit();
      console.log(`  Committed batch (${chunk.length} bills)\n`);
    }
  }

  console.log(
    dryRun
      ? `\nDry run complete. ${updatedCount} bills would be updated.`
      : `\nDone. Updated ${updatedCount} bills.`,
  );
}

fixReceivedBillsWithField().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
