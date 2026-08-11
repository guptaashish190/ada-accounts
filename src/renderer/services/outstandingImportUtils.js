const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export const ZERO_MODE = {
  OFF: 'off',
  PARTY_ONLY: 'party_only',
  ALL_UNMATCHED: 'all_unmatched',
};

export const MAJORITY_RULES = {
  MIN_MATCHED_BILLS: 3,
  MIN_MAJORITY_RATIO: 0.7,
  MIN_MAJORITY_MARGIN: 2,
};

const HEADER_HINTS_REGEX = /(bill|number|amount|date|balance|outstanding)/i;

export const DEFAULT_ORDER_FIELDS = {
  creationTime: 0,
  hasOrder: true,
  reasonNoOrder: '',
  billCreationTime: 0,
  mrId: '',
  createdById: '',
  flowCompleted: false,
  partyId: '',
  type: '',
  bags: [],
  challanNumber: '',
  mrImages: [],
  billImages: [],
  supplyReportId: '',
  flow: [],
  margUpdated: false,
  itemWiseDetail: [],
  orderStatus: '',
  payments: [],
  with: '',
  accountsNotes: '',
  isCallOrder: false,
};

export const normalizeBillNumber = (rawBillNumber) => {
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

export const isOldBillNumber = (billNumber) => {
  const normalized = normalizeBillNumber(billNumber);
  return normalized.startsWith('*');
};

export const isBill = (billNumber) => {
  const normalized = normalizeBillNumber(billNumber);
  return normalized.startsWith('T-') || normalized.startsWith('*T-');
};

export const parseAmountValue = (rawValue) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') return 0;

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return Math.round(rawValue);
  }

  const cleaned = String(rawValue).replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
};

const parseDateString = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const strictMatch = normalized.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (strictMatch) {
    const day = parseInt(strictMatch[1], 10);
    const monthIndex = MONTHS[String(strictMatch[2]).toLowerCase()];
    const year = parseInt(strictMatch[3], 10);
    if (monthIndex !== undefined) {
      return new Date(year, monthIndex, day).getTime();
    }
  }

  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.getTime();
  }
  return null;
};

const parseExcelSerialDate = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  // Excel day 1 is 1899-12-31 (with leap year quirk around 1900).
  const epoch = new Date(Date.UTC(1899, 11, 30)).getTime();
  const timestamp = epoch + Math.round(value * 24 * 60 * 60 * 1000);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const parseBillDate = (rawDate) => {
  const timestamp =
    parseDateString(rawDate)
    || parseExcelSerialDate(rawDate)
    || null;

  if (!timestamp) {
    return {
      timestamp: 0,
      year: null,
      isValid: false,
      displayDate: '--',
    };
  }

  const parsedDate = new Date(timestamp);
  return {
    timestamp,
    year: parsedDate.getFullYear(),
    isValid: true,
    displayDate: parsedDate.toLocaleDateString('en-GB'),
  };
};

const isLikelyHeaderRow = (row) => {
  const rowText = row.map((cell) => String(cell || '')).join(' ');
  return HEADER_HINTS_REGEX.test(rowText);
};

const isSectionHeaderRow = (row) => {
  const hasPartyText = String(row?.[0] || '').trim().length > 0;
  if (!hasPartyText) return false;
  const hasBillNumberInB = !!normalizeBillNumber(row?.[1]);
  return !hasBillNumberInB;
};

export const parseOutstandingRows = (sheetRows) => {
  const parsed = [];
  let sectionCounter = 0;
  let currentSection = null;

  sheetRows.forEach((row, index) => {
    if (!Array.isArray(row)) return;

    if (index === 0 && isLikelyHeaderRow(row)) {
      return;
    }


    if (isSectionHeaderRow(row)) {
      sectionCounter += 1;
      currentSection = {
        sectionId: `section-${sectionCounter}`,
        sectionLabel: String(row[0] || '').trim(),
        sectionTotalBalance: parseAmountValue(row[5]),
        sectionRowIndex: index + 1,
      };
      return;
    }

    const billRaw = row[1];
    const normalizedBillNumber = normalizeBillNumber(billRaw);
    if (!normalizedBillNumber) return;

    const amount = parseAmountValue(row[3]);
    const balance = parseAmountValue(row[5]);
    const parsedDate = parseBillDate(row[2]);

    parsed.push({
      rowIndex: index + 1,
      billRaw: String(billRaw || '').trim(),
      billNumber: normalizedBillNumber,
      isOldBill: isOldBillNumber(normalizedBillNumber),
      billCreationTime: parsedDate.timestamp,
      billYear: parsedDate.year,
      billDateDisplay: parsedDate.displayDate,
      hasValidBillDate: parsedDate.isValid,
      orderAmount: amount,
      balance,
      sectionId: currentSection?.sectionId || null,
      sectionLabel: currentSection?.sectionLabel || '',
      sectionTotalBalance: currentSection?.sectionTotalBalance ?? null,
      sectionRowIndex: currentSection?.sectionRowIndex || null,
    });
  });

  return parsed;
};

export const matchOutstandingRow = (row, orders) => {
  if (orders.length === 1) {
    return { status: 'matched', matchedOrder: orders[0] };
  }

  if (orders.length > 1) {
    if (!row.billYear) {
      return { status: 'ambiguous', matchedOrder: null };
    }

    const yearMatches = orders.filter((order) => {
      const billCreationTime = Number(order.billCreationTime || 0);
      if (!billCreationTime) return false;
      return new Date(billCreationTime).getFullYear() === row.billYear;
    });

    if (yearMatches.length === 1) {
      return { status: 'matched', matchedOrder: yearMatches[0] };
    }

    if (yearMatches.length > 1) {
      return { status: 'ambiguous', matchedOrder: null };
    }
  }

  return { status: 'unmatched', matchedOrder: null };
};

export const buildOrderUpdatePayload = (
  row,
  matchedOrder,
  { updateAmount, updateBalance } = {},
) => {
  const payload = {};
  if (
    updateAmount
    && Number(row.orderAmount || 0) !== Number(matchedOrder?.orderAmount || 0)
  ) {
    payload.orderAmount = row.orderAmount;
  }
  if (
    updateBalance
    && Number(row.balance || 0) !== Number(matchedOrder?.balance || 0)
  ) {
    payload.balance = row.balance;
  }
  console.log('payload', payload);
  console.log(updateAmount, updateBalance);
  console.log(row, matchedOrder);
  return payload;
};

export const buildNewOrderPayload = (row, docId) => {
  const billTimestamp = row.billCreationTime || 0;
  return {
    ...DEFAULT_ORDER_FIELDS,
    id: docId,
    billNumber: row.billNumber,
    orderAmount: row.orderAmount,
    balance: row.balance,
    creationTime: billTimestamp,
    billCreationTime: billTimestamp,
  };
};

export const getMatchedOrderIds = (rows) => {
  const matchedIds = new Set();
  rows.forEach((row) => {
    if (row.status === 'matched' && row.matchedOrder?.id) {
      matchedIds.add(row.matchedOrder.id);
    }
  });
  return matchedIds;
};

export const getMatchedPartyIds = (rows) => {
  const matchedPartyIds = new Set();
  rows.forEach((row) => {
    if (row.status === 'matched' && row.matchedOrder?.partyId) {
      matchedPartyIds.add(row.matchedOrder.partyId);
    }
  });
  return matchedPartyIds;
};

export const selectZeroBalanceOrderIds = ({ rows, eligibleOrders, zeroMode }) => {
  if (zeroMode === ZERO_MODE.OFF) return [];

  const matchedOrderIds = getMatchedOrderIds(rows);
  const matchedPartyIds = getMatchedPartyIds(rows);

  const zeroableOrderIds = eligibleOrders
    .filter((order) => Number(order.balance || 0) !== 0)
    .filter((order) => !matchedOrderIds.has(order.id))
    .filter((order) => {
      if (zeroMode === ZERO_MODE.ALL_UNMATCHED) return true;
      if (zeroMode === ZERO_MODE.PARTY_ONLY) {
        return !!order.partyId && matchedPartyIds.has(order.partyId);
      }
      return false;
    })
    .map((order) => order.id);

  return [...new Set(zeroableOrderIds)];
};

const getTopTwoParties = (partyCountMap) => {
  const sorted = [...partyCountMap.entries()].sort((a, b) => b[1] - a[1]);
  const [top = [null, 0], second = [null, 0]] = sorted;
  return {
    topPartyId: top[0],
    topCount: top[1] || 0,
    secondPartyId: second[0],
    secondCount: second[1] || 0,
  };
};

const getSectionMapKey = (row) => {
  const sectionLabel = String(row?.sectionLabel || '').trim();
  if (sectionLabel) return sectionLabel;
  return row?.sectionId || null;
};

export const buildSectionBillMap = (rows) => {
  const sectionBillMap = {};

  rows.forEach((row) => {
    const sectionKey = getSectionMapKey(row);
    if (!sectionKey) return;

    if (!sectionBillMap[sectionKey]) {
      sectionBillMap[sectionKey] = {
        sectionId: row.sectionId || null,
        partyName: row.sectionLabel || '',
        partyBalance: row.sectionTotalBalance ?? null,
        bills: [],
      };
    }

    sectionBillMap[sectionKey].bills.push(row);
  });

  return sectionBillMap;
};

export const buildSectionPartyIdMap = (rows) => {
  const sectionBillMap = buildSectionBillMap(rows);

  const sectionPartyMap = new Map();
  Object.values(sectionBillMap).forEach((section) => {
    const partyCountMap = new Map();
    section.bills.forEach((row) => {
      const partyId = row.matchedOrder?.partyId;
      if (row.status !== 'matched' || !partyId) return;
      partyCountMap.set(partyId, (partyCountMap.get(partyId) || 0) + 1);
    });

    const { topPartyId, topCount, secondCount } = getTopTwoParties(partyCountMap);
    if (!topPartyId) return;
    // Require a strict majority winner to avoid assigning on ties.
    if (topCount <= secondCount) return;
    if (section.sectionId) {
      sectionPartyMap.set(section.sectionId, topPartyId);
    }
  });

  return sectionPartyMap;
};

export const getInferredPartyIdForRow = (row, sectionPartyIdMap) => {
  if (!row?.sectionId) return null;
  return sectionPartyIdMap.get(row.sectionId) || null;
};

export const mergeSectionPartyIdMap = (inferredMap, sectionPartyAssignments = {}) => {
  const merged = new Map(inferredMap);
  Object.entries(sectionPartyAssignments).forEach(([sectionId, party]) => {
    if (party?.id) merged.set(sectionId, party.id);
  });
  return merged;
};

export const buildEffectiveSectionPartyIdMap = (rows, sectionPartyAssignments = {}) => (
  mergeSectionPartyIdMap(buildSectionPartyIdMap(rows), sectionPartyAssignments)
);

export const getSectionsNeedingPartyAssignment = (rows) => {
  const sectionMap = new Map();

  rows.forEach((row) => {
    if (row.status !== 'skipped_no_party' || !row.sectionId) return;

    if (!sectionMap.has(row.sectionId)) {
      sectionMap.set(row.sectionId, {
        sectionId: row.sectionId,
        sectionLabel: row.sectionLabel || '',
        bills: [],
      });
    }
    sectionMap.get(row.sectionId).bills.push(row);
  });

  return [...sectionMap.values()].map((section) => ({
    ...section,
    billCount: section.bills.length,
  }));
};

export const applySectionPartyAssignments = (rows, sectionPartyAssignments = {}) => {
  const mergedMap = buildEffectiveSectionPartyIdMap(rows, sectionPartyAssignments);

  return rows.map((row) => {
    if (row.status !== 'skipped_no_party' && row.status !== 'create') return row;

    const partyId = getInferredPartyIdForRow(row, mergedMap);
    if (!partyId) {
      if (row.status === 'create') return { ...row, status: 'skipped_no_party' };
      return row;
    }
    if (row.status === 'skipped_no_party') return { ...row, status: 'create' };
    return row;
  });
};

export const OUTSTANDING_SKIP_REASONS = {
  ambiguous: 'Multiple DB matches',
  invalid: 'Invalid bill date',
  skipped_no_party: 'No party found',
  skipped_old_unmatched: 'T-bill not in DB',
  no_changes: 'Already up to date',
};

const OUTSTANDING_BLOCKED_STATUSES = new Set([
  'ambiguous',
  'invalid',
  'skipped_no_party',
  'skipped_old_unmatched',
]);

export const getOutstandingNotSyncedRows = (
  rows,
  {
    updateAmount = true,
    updateBalance = true,
    enablePartyMajorityFix = false,
    transferCandidates = [],
    sectionPartyIdMap = null,
    sectionPartyAssignments = null,
    assignedPartyId = null,
  } = {},
) => {
  const partyIdMap = sectionPartyIdMap
    || (sectionPartyAssignments
      ? buildEffectiveSectionPartyIdMap(rows, sectionPartyAssignments)
      : buildSectionPartyIdMap(rows));
  const transferByOrderId = new Map(
    transferCandidates.map((item) => [item.orderId, item]),
  );
  const notSynced = [];

  rows.forEach((row) => {
    let skipReason = null;

    if (OUTSTANDING_BLOCKED_STATUSES.has(row.status)) {
      if (
        row.status === 'skipped_no_party'
        && getInferredPartyIdForRow(row, partyIdMap)
      ) {
        skipReason = null;
      } else {
        skipReason = row.status;
      }
    }

    if (!skipReason && row.status === 'create') {
      const partyId = assignedPartyId || getInferredPartyIdForRow(row, partyIdMap);
      if (!partyId) {
        skipReason = 'skipped_no_party';
      }
    } else if (row.status === 'matched' && row.matchedOrder?.id) {
      const updatePayload = buildOrderUpdatePayload(row, row.matchedOrder, {
        updateAmount,
        updateBalance,
      });
      const transferCandidate = enablePartyMajorityFix
        ? transferByOrderId.get(row.matchedOrder.id)
        : null;
      const hasPartyChange = !!(
        transferCandidate?.toPartyId
        && transferCandidate.toPartyId !== row.matchedOrder.partyId
      );

      if (!Object.keys(updatePayload).length && !hasPartyChange) {
        skipReason = 'no_changes';
      }
    }

    if (skipReason) {
      notSynced.push({
        ...row,
        skipReason,
        skipReasonLabel: OUTSTANDING_SKIP_REASONS[skipReason] || skipReason,
      });
    }
  });

  return notSynced;
};

export const markCreateRowsWithoutParty = (rows) => {
  const sectionPartyIdMap = buildSectionPartyIdMap(rows);

  return rows.map((row) => {
    if (row.status !== 'create') return row;

    const inferredPartyId = getInferredPartyIdForRow(row, sectionPartyIdMap);
    if (inferredPartyId) return row;

    return { ...row, status: 'skipped_no_party' };
  });
};

export const buildMajorityPartyCorrections = (
  rows,
  {
    minMatchedBills = MAJORITY_RULES.MIN_MATCHED_BILLS,
    minMajorityRatio = MAJORITY_RULES.MIN_MAJORITY_RATIO,
    minMajorityMargin = MAJORITY_RULES.MIN_MAJORITY_MARGIN,
    syncPartyBalance = true,
  } = {},
) => {
  const sectionBillMap = buildSectionBillMap(rows);

  const transferCandidates = [];
  const partyBalanceUpdates = [];
  const sectionSummaries = [];
  const partyBalanceById = new Map();

  Object.values(sectionBillMap).forEach((section) => {
    const matchedRowsWithParty = section.bills.filter(
      (row) => row.status === 'matched' && row.matchedOrder?.partyId && row.matchedOrder?.id,
    );
    const matchedRowsMissingParty = section.bills.filter(
      (row) => row.status === 'matched' && row.matchedOrder?.id && !row.matchedOrder?.partyId,
    );
    if (!matchedRowsWithParty.length) return;

    const partyCount = new Map();
    matchedRowsWithParty.forEach((row) => {
      const pid = row.matchedOrder.partyId;
      partyCount.set(pid, (partyCount.get(pid) || 0) + 1);
    });

    const { topPartyId, topCount, secondCount } = getTopTwoParties(partyCount);
    const matchedCount = matchedRowsWithParty.length;
    const majorityRatio = matchedCount ? topCount / matchedCount : 0;
    const majorityMargin = topCount - secondCount;
    const qualifies =
      !!topPartyId
      && matchedCount >= minMatchedBills
      && majorityRatio >= minMajorityRatio
      && majorityMargin >= minMajorityMargin;

    const sectionTransfers = qualifies
      ? [
          ...matchedRowsWithParty
            .filter((row) => row.matchedOrder.partyId !== topPartyId)
            .map((row) => ({
              orderId: row.matchedOrder.id,
              fromPartyId: row.matchedOrder.partyId,
              toPartyId: topPartyId,
              billNumber: row.billNumber,
              sectionId: section.sectionId,
              sectionLabel: section.partyName,
            })),
          ...matchedRowsMissingParty.map((row) => ({
            orderId: row.matchedOrder.id,
            fromPartyId: '',
            toPartyId: topPartyId,
            billNumber: row.billNumber,
            sectionId: section.sectionId,
            sectionLabel: section.partyName,
          })),
        ]
      : [];

    transferCandidates.push(...sectionTransfers);

    if (
      qualifies
      && syncPartyBalance
      && Number.isFinite(section.partyBalance)
      && section.partyBalance >= 0
    ) {
      const existing = partyBalanceById.get(topPartyId);
      if (!existing) {
        partyBalanceById.set(topPartyId, {
          partyId: topPartyId,
          partyBalance: section.partyBalance,
          sectionId: section.sectionId,
          sectionLabel: section.partyName,
        });
      } else if (existing.partyBalance !== section.partyBalance) {
        partyBalanceById.delete(topPartyId);
      }
    }

    sectionSummaries.push({
      sectionId: section.sectionId,
      sectionLabel: section.partyName,
      matchedCount,
      majorityPartyId: topPartyId,
      majorityCount: topCount,
      majorityRatio,
      qualifies,
      transferCount: sectionTransfers.length,
      sectionTotalBalance: section.partyBalance,
    });
  });

  const dedupedTransferCandidates = [
    ...new Map(transferCandidates.map((item) => [item.orderId, item])).values(),
  ];

  partyBalanceUpdates.push(...partyBalanceById.values());

  return {
    transferCandidates: dedupedTransferCandidates,
    partyBalanceUpdates,
    sectionSummaries,
  };
};

