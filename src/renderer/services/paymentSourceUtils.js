import { getDoc } from 'firebase/firestore';
import globalUtils from './globalUtils';
import { getCompanyDoc, DB_NAMES } from './firestoreHelpers';

export function formatSourceRefLabel(ref, docData = {}) {
  const number =
    docData.receiptNumber || ref.receiptNumber || ref.sourceId || '--';
  const timestamp = docData.timestamp ?? ref.timestamp;
  const date = timestamp ? globalUtils.getTimeFormat(timestamp, true) : '';
  return date ? `${number} (${date})` : `${prefix} ${number}`;
}

export async function resolvePaymentSourceRefs(
  currentCompanyId,
  partyId,
  sourceRefs = [],
) {
  if (!currentCompanyId || !sourceRefs?.length) return [];

  const entries = await Promise.all(
    sourceRefs.map(async (ref) => {
      try {
        const dbName =
          ref.sourceType === 'bundle'
            ? DB_NAMES.BILL_BUNDLES
            : DB_NAMES.SUPPLY_REPORTS;
        const snap = await getDoc(
          getCompanyDoc(currentCompanyId, dbName, ref.sourceId),
        );
        const docData = snap.exists() ? snap.data() : {};
        const partyPayment = (docData.partyPayments || []).find(
          (pp) => pp.partyId === partyId,
        );
        return {
          ...ref,
          receiptNumber: docData.receiptNumber || ref.receiptNumber || '',
          timestamp: docData.timestamp,
          notes: partyPayment?.notes || '',
          label: formatSourceRefLabel(ref, docData),
        };
      } catch (error) {
        console.error('Error resolving payment source ref:', error);
        return {
          ...ref,
          notes: '',
          label: formatSourceRefLabel(ref),
        };
      }
    }),
  );

  return entries;
}

export async function resolveSupplyReportSourceLabel(
  currentCompanyId,
  supplyReportId,
) {
  if (!currentCompanyId || !supplyReportId) return '--';

  try {
    const snap = await getDoc(
      getCompanyDoc(currentCompanyId, DB_NAMES.SUPPLY_REPORTS, supplyReportId),
    );
    if (!snap.exists()) return '--';
    const data = snap.data();
    return formatSourceRefLabel(
      { sourceType: 'supplyReport', sourceId: supplyReportId },
      data,
    );
  } catch (error) {
    console.error('Error resolving supply report source label:', error);
    return '--';
  }
}

export async function enrichPaymentItems(currentCompanyId, items = []) {
  return Promise.all(
    items.map(async (item) => {
      const sources = await resolvePaymentSourceRefs(
        currentCompanyId,
        item.partyId,
        item.sourceRefs,
      );
      const notes = sources
        .map((s) => s.notes)
        .filter((n) => n && String(n).trim().length > 0);
      return {
        ...item,
        resolvedSources: sources,
        sourceLabels: sources.length
          ? sources.map((s) => s.label).join(', ')
          : '--',
        accountsNotes: notes.length ? notes.join('; ') : '--',
      };
    }),
  );
}

export function aggregatePrItemNotes(prItems = []) {
  const notes = prItems
    .map((item) => item.accountsNotes)
    .filter((n) => n && String(n).trim().length > 0);
  return notes.length ? notes.join('; ') : '--';
}

export async function enrichCashReceipts(currentCompanyId, receipts = []) {
  return Promise.all(
    receipts.map(async (receipt) => {
      const sourceLabel = await resolveSupplyReportSourceLabel(
        currentCompanyId,
        receipt.supplyReportId,
      );
      return {
        ...receipt,
        sourceLabel,
        accountsNotes: aggregatePrItemNotes(receipt.prItems),
      };
    }),
  );
}
