/**
 * Copy products collection between companies (full overwrite).
 *
 * Usage:
 *   node scripts/copy-products-between-companies.js --dry-run
 *   node scripts/copy-products-between-companies.js
 *   node scripts/copy-products-between-companies.js --from=ashish-drug-agencies --to=mg-pharma
 *
 * Overwrite behavior:
 *   - Writes every source product to target with the same document ID
 *   - Deletes target products that do not exist in source
 */

const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_FROM = 'mg-pharma';
const DEFAULT_TO = 'ashish-drug-agencies';
const BATCH_LIMIT = 400;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fromArg = args.find((arg) => arg.startsWith('--from='));
const toArg = args.find((arg) => arg.startsWith('--to='));
const sourceCompanyId = fromArg ? fromArg.split('=')[1] : DEFAULT_FROM;
const targetCompanyId = toArg ? toArg.split('=')[1] : DEFAULT_TO;

const serviceAccountPath = path.resolve(
  __dirname,
  '../../AshishDrugAgencies-App/functions/serviceAccountKey.json',
);

async function commitBatches(ops, label) {
  if (ops.length === 0) {
    console.log(`  ${label}: nothing to do`);
    return;
  }

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = admin.firestore().batch();
    for (const apply of chunk) {
      apply(batch);
    }
    if (!dryRun) {
      await batch.commit();
    }
    console.log(
      `  ${label}: batch ${Math.floor(i / BATCH_LIMIT) + 1} (${chunk.length} ops)`,
    );
  }
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    projectId: 'ashishdrugagencies-e5b9a',
  });

  const db = admin.firestore();
  const sourceRef = db
    .collection('companies')
    .doc(sourceCompanyId)
    .collection('products');
  const targetRef = db
    .collection('companies')
    .doc(targetCompanyId)
    .collection('products');

  const [sourceCompany, targetCompany, sourceSnap, targetSnap] =
    await Promise.all([
      db.collection('companies').doc(sourceCompanyId).get(),
      db.collection('companies').doc(targetCompanyId).get(),
      sourceRef.get(),
      targetRef.get(),
    ]);

  if (!sourceCompany.exists) {
    throw new Error(`Source company "${sourceCompanyId}" not found`);
  }
  if (!targetCompany.exists) {
    throw new Error(`Target company "${targetCompanyId}" not found`);
  }

  const sourceIds = new Set(sourceSnap.docs.map((docSnap) => docSnap.id));
  const toDelete = targetSnap.docs.filter((docSnap) => !sourceIds.has(docSnap.id));

  console.log(
    `Source: companies/${sourceCompanyId}/products (${sourceCompany.data().name}) → ${sourceSnap.size} docs`,
  );
  console.log(
    `Target: companies/${targetCompanyId}/products (${targetCompany.data().name}) → ${targetSnap.size} docs`,
  );
  console.log(`Will write/overwrite: ${sourceSnap.size}`);
  console.log(`Will delete extras: ${toDelete.length}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  const writeOps = sourceSnap.docs.map(
    (docSnap) => (batch) => batch.set(targetRef.doc(docSnap.id), docSnap.data()),
  );
  const deleteOps = toDelete.map(
    (docSnap) => (batch) => batch.delete(targetRef.doc(docSnap.id)),
  );

  await commitBatches(writeOps, 'write');
  await commitBatches(deleteOps, 'delete');

  if (!dryRun) {
    const verifySnap = await targetRef.get();
    console.log(`\nVerify: target now has ${verifySnap.size} products`);
  }

  console.log(dryRun ? '\nDry run complete.' : '\nOverwrite complete.');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
