/* eslint-disable no-console */
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./private_key.json');

const TARGET_COMPANY_ID = 'ashish-drug-agencies';
const DEFAULT_SOURCE_COLLECTION = 'orders';
const MIGRATION_MARKER = 'isImportedPreviousFy';
const IMPORTED_FROM_FIELD = 'importedFromFy';
const DEFAULT_IMPORT_LABEL = 'FY 25-26';
const BATCH_WRITE_LIMIT = 400;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const parseArgs = () => {
  const rawArgs = process.argv.slice(2);
  const argMap = {};
  rawArgs.forEach((arg) => {
    if (!arg.startsWith('--')) return;
    const trimmed = arg.replace(/^--/, '');
    const [key, value] = trimmed.split('=');
    argMap[key] = value === undefined ? true : value;
  });
  return argMap;
};

const getRuntimeConfig = () => {
  const argMap = parseArgs();
  const sourceDatabaseId = String(
    argMap.sourceDb || process.env.SOURCE_DB_ID || '',
  ).trim();
  const targetDatabaseId = String(
    argMap.targetDb || process.env.TARGET_DB_ID || '',
  ).trim();
  const sourceCollection = String(
    argMap.sourceCollection ||
      process.env.SOURCE_ORDERS_COLLECTION ||
      DEFAULT_SOURCE_COLLECTION,
  ).trim();
  const importLabel = String(
    argMap.importLabel || process.env.IMPORT_FY_LABEL || DEFAULT_IMPORT_LABEL,
  ).trim();
  const dryRun =
    argMap.execute !== true &&
    String(process.env.EXECUTE_IMPORT || '').toLowerCase() !== 'true';
  const overwriteExisting =
    argMap.overwriteExisting === true ||
    String(process.env.OVERWRITE_EXISTING || '').toLowerCase() === 'true';

  if (!sourceDatabaseId) {
    throw new Error(
      'Missing source DB id. Pass --sourceDb=<database-id> or SOURCE_DB_ID env.',
    );
  }

  return {
    sourceDatabaseId,
    targetDatabaseId,
    sourceCollection,
    importLabel,
    dryRun,
    overwriteExisting,
  };
};

const buildDb = (databaseId) => {
  if (!databaseId || databaseId === '(default)') {
    return getFirestore(admin.app());
  }
  return getFirestore(admin.app(), databaseId);
};

const toStarBillNumber = (billNumber) => {
  const normalized = String(billNumber || '').trim();
  if (!normalized) return normalized;
  if (normalized.startsWith('*')) return normalized;
  return `*${normalized}`;
};

const isAlreadyImported = (targetDocData = {}) => {
  if (targetDocData[MIGRATION_MARKER] === true) return true;
  const billNumber = String(targetDocData.billNumber || '').trim();
  return billNumber.startsWith('*');
};

const buildTargetData = (sourceId, sourceData, importLabel) => {
  const cloned = { ...sourceData };
  cloned.billNumber = toStarBillNumber(cloned.billNumber);
  cloned.id = sourceId;
  cloned[MIGRATION_MARKER] = true;
  cloned[IMPORTED_FROM_FIELD] = importLabel;
  return cloned;
};

const commitInBatches = async (targetDb, writes) => {
  let committed = 0;
  for (let index = 0; index < writes.length; index += BATCH_WRITE_LIMIT) {
    const chunk = writes.slice(index, index + BATCH_WRITE_LIMIT);
    const batch = targetDb.batch();
    chunk.forEach(({ docPath, payload }) => {
      batch.set(targetDb.doc(docPath), payload, { merge: true });
    });
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${writes.length}`);
  }
};

const runMigration = async () => {
  const config = getRuntimeConfig();
  const sourceDb = buildDb(config.sourceDatabaseId);
  const targetDb = buildDb(config.targetDatabaseId);
  const sourceRef = sourceDb.collection(config.sourceCollection);
  const targetOrdersRef = targetDb.collection(
    `companies/${TARGET_COMPANY_ID}/orders`,
  );

  console.log('Starting previous FY import with config:');
  console.log(
    JSON.stringify(
      {
        sourceDatabaseId: config.sourceDatabaseId,
        targetDatabaseId: config.targetDatabaseId || '(default)',
        sourceCollection: config.sourceCollection,
        targetCollection: `companies/${TARGET_COMPANY_ID}/orders`,
        importLabel: config.importLabel,
        dryRun: config.dryRun,
        overwriteExisting: config.overwriteExisting,
      },
      null,
      2,
    ),
  );

  const sourceSnapshot = await sourceRef.get();
  console.log(`Source documents found: ${sourceSnapshot.size}`);

  const writes = [];
  let skippedExisting = 0;
  let skippedMissingData = 0;
  let alreadyStarred = 0;
  let skippedExistingNonMigrated = 0;

  for (const sourceDoc of sourceSnapshot.docs) {
    const sourceData = sourceDoc.data();
    if (!sourceData || typeof sourceData !== 'object') {
      skippedMissingData += 1;
      continue;
    }

    const targetDocRef = targetOrdersRef.doc(sourceDoc.id);
    const existingTarget = await targetDocRef.get();

    if (existingTarget.exists) {
      if (isAlreadyImported(existingTarget.data())) {
        skippedExisting += 1;
        continue;
      }
      if (!config.overwriteExisting) {
        skippedExistingNonMigrated += 1;
        continue;
      }
    }

    const payload = buildTargetData(sourceDoc.id, sourceData, config.importLabel);
    if (String(sourceData.billNumber || '').trim().startsWith('*')) {
      alreadyStarred += 1;
    }
    writes.push({
      docPath: `companies/${TARGET_COMPANY_ID}/orders/${sourceDoc.id}`,
      payload,
    });
  }

  console.log(`Prepared writes: ${writes.length}`);
  console.log(`Skipped existing imported docs: ${skippedExisting}`);
  console.log(
    `Skipped existing non-imported docs (safe no-overwrite): ${skippedExistingNonMigrated}`,
  );
  console.log(`Skipped invalid source docs: ${skippedMissingData}`);
  console.log(`Source docs already having * billNumber: ${alreadyStarred}`);

  if (writes.length > 0) {
    const sample = writes.slice(0, 5).map((entry) => ({
      id: entry.payload.id,
      billNumber: entry.payload.billNumber || '',
      importedFromFy: entry.payload[IMPORTED_FROM_FIELD],
    }));
    console.log('Sample transformed docs:', sample);
  }

  if (config.dryRun) {
    console.log(
      'Dry run complete. No writes were executed. Pass --execute=true to apply writes.',
    );
    return;
  }

  await commitInBatches(targetDb, writes);
  console.log(`Import complete. Total docs written: ${writes.length}`);
};

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Previous FY import failed:', error);
    process.exit(1);
  });
