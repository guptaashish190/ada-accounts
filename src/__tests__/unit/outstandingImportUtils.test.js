const {
  normalizeBillNumber,
  getMatchedOrderIds,
  getMatchedPartyIds,
  matchOutstandingRow,
  buildOrderUpdatePayload,
  buildMajorityPartyCorrections,
  buildNewOrderPayload,
  markCreateRowsWithoutParty,
  getOutstandingNotSyncedRows,
  getSectionsNeedingPartyAssignment,
  applySectionPartyAssignments,
  buildEffectiveSectionPartyIdMap,
  MAJORITY_RULES,
  parseOutstandingRows,
  selectZeroBalanceOrderIds,
  ZERO_MODE,
} = require('../../renderer/services/outstandingImportUtils');

describe('normalizeBillNumber', () => {
  test('normalizes T00001 into T-00001', () => {
    expect(normalizeBillNumber('T00001')).toBe('T-00001');
  });

  test('normalizes *T00001 into *T-00001', () => {
    expect(normalizeBillNumber('*T00001')).toBe('*T-00001');
  });

  test('keeps already-normalized old bill format', () => {
    expect(normalizeBillNumber('*T-00001')).toBe('*T-00001');
  });

  test('keeps non-T bill untouched (except trim/uppercase)', () => {
    expect(normalizeBillNumber(' cn120002 ')).toBe('CN120002');
  });
});

describe('matchOutstandingRow', () => {
  test('matches last-year bill by billCreationTime year when duplicates exist', () => {
    const row = {
      billNumber: 'T-00001',
      isOldBill: true,
      billYear: 2024,
    };
    const orders = [
      { id: 'o1', billCreationTime: new Date('2023-01-10').getTime() },
      { id: 'o2', billCreationTime: new Date('2024-02-20').getTime() },
    ];

    const result = matchOutstandingRow(row, orders);
    expect(result.status).toBe('matched');
    expect(result.matchedOrder.id).toBe('o2');
  });

  test('matches directly when exactly one order is found', () => {
    const row = {
      billNumber: 'T-00001',
      isOldBill: true,
      billYear: 2025,
    };
    const orders = [{ id: 'o1', billCreationTime: new Date('2024-05-11').getTime() }];

    const result = matchOutstandingRow(row, orders);
    expect(result.status).toBe('matched');
    expect(result.matchedOrder.id).toBe('o1');
  });

  test('returns unmatched for non-T bill when duplicate years do not resolve', () => {
    const row = {
      billNumber: 'CN120002',
      isOldBill: false,
      billYear: 2024,
    };
    const orders = [{ id: 'o1' }, { id: 'o2' }];

    const result = matchOutstandingRow(row, orders);
    expect(result.status).toBe('unmatched');
  });
});

describe('payload builders', () => {
  test('respects toggles and only includes changed fields', () => {
    const row = { orderAmount: 1200, balance: 450 };
    const matchedOrder = { orderAmount: 1200, balance: 400 };

    expect(
      buildOrderUpdatePayload(row, matchedOrder, {
        updateAmount: true,
        updateBalance: false,
      }),
    ).toEqual({});
    expect(
      buildOrderUpdatePayload(row, matchedOrder, {
        updateAmount: false,
        updateBalance: true,
      }),
    ).toEqual({ balance: 450 });
    expect(
      buildOrderUpdatePayload(row, matchedOrder, {
        updateAmount: true,
        updateBalance: true,
      }),
    ).toEqual({ balance: 450 });
  });

  test('returns empty payload when matched order already matches row values', () => {
    const row = { orderAmount: 1200, balance: 450 };
    const matchedOrder = { orderAmount: 1200, balance: 450 };

    expect(
      buildOrderUpdatePayload(row, matchedOrder, {
        updateAmount: true,
        updateBalance: true,
      }),
    ).toEqual({});
  });

  test('creates new-order payload with required bill fields', () => {
    const row = {
      billNumber: 'CN120002',
      orderAmount: 1200,
      balance: 450,
      billCreationTime: 1700000000000,
    };
    const payload = buildNewOrderPayload(row, 'new-order-id');

    expect(payload.id).toBe('new-order-id');
    expect(payload.billNumber).toBe('CN120002');
    expect(payload.orderAmount).toBe(1200);
    expect(payload.balance).toBe(450);
    expect(payload.billCreationTime).toBe(1700000000000);
    expect(payload.partyId).toBe('');
    expect(payload.with).toBe('');
  });
});

describe('parseOutstandingRows', () => {
  test('extracts bill number/date/amount/balance using B,C,D,F columns', () => {
    const rows = [
      ['', 'Bill Number', 'Bill Date', 'Amount', '', 'Balance'],
      ['', 'CN120002', '11-Oct-2026', '1234', '', '777'],
    ];
    const parsed = parseOutstandingRows(rows);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].billNumber).toBe('CN120002');
    expect(parsed[0].orderAmount).toBe(1234);
    expect(parsed[0].balance).toBe(777);
    expect(parsed[0].billYear).toBe(2026);
  });

  test('attaches section metadata from party header rows', () => {
    const rows = [
      ['Party Name', 'Bill No.', 'Bill Date', 'Bill Amt.', 'Received', 'Balance'],
      ['AMAN MEDICAL STORE F-6', '', '', '', '', 12348],
      ['', 'T-001585', '23-May-26', '1320', '1000', '320'],
    ];
    const parsed = parseOutstandingRows(rows);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].sectionId).toBe('section-1');
    expect(parsed[0].sectionLabel).toContain('AMAN MEDICAL STORE');
    expect(parsed[0].sectionTotalBalance).toBe(12348);
  });

  test('marks last-year bill numbers with isOldBill', () => {
    const rows = [
      ['', 'Bill Number', 'Bill Date', 'Amount', '', 'Balance'],
      ['', '*T-001585', '23-May-25', '1320', '', '320'],
      ['', 'T-001586', '24-May-26', '500', '', '100'],
    ];
    const parsed = parseOutstandingRows(rows);

    expect(parsed[0].billNumber).toBe('*T-001585');
    expect(parsed[0].isOldBill).toBe(true);
    expect(parsed[1].billNumber).toBe('T-001586');
    expect(parsed[1].isOldBill).toBe(false);
  });
});

describe('zeroing helpers', () => {
  const rows = [
    {
      status: 'matched',
      matchedOrder: { id: 'm1', partyId: 'p1' },
    },
    {
      status: 'matched',
      matchedOrder: { id: 'm2', partyId: 'p2' },
    },
    {
      status: 'create',
      matchedOrder: null,
    },
  ];

  test('extracts matched order ids and party ids', () => {
    expect([...getMatchedOrderIds(rows)]).toEqual(['m1', 'm2']);
    expect([...getMatchedPartyIds(rows)]).toEqual(['p1', 'p2']);
  });

  test('party-only mode zeroes unmatched bills for matched parties only', () => {
    const eligibleOrders = [
      { id: 'm1', partyId: 'p1', balance: 100 }, // matched, should skip
      { id: 'u1', partyId: 'p1', balance: 50 }, // zero
      { id: 'u2', partyId: 'p2', balance: -75 }, // zero
      { id: 'u3', partyId: 'p3', balance: 120 }, // different party, skip
      { id: 'u4', partyId: 'p1', balance: 0 }, // zero balance, skip
    ];

    const ids = selectZeroBalanceOrderIds({
      rows,
      eligibleOrders,
      zeroMode: ZERO_MODE.PARTY_ONLY,
    });

    expect(ids).toEqual(['u1', 'u2']);
  });

  test('global mode zeroes all unmatched eligible bills', () => {
    const eligibleOrders = [
      { id: 'm1', partyId: 'p1', balance: 100 }, // matched, skip
      { id: 'u1', partyId: 'p1', balance: 10 }, // zero
      { id: 'u2', partyId: 'p3', balance: -20 }, // zero
      { id: 'u3', partyId: '', balance: 30 }, // zero
      { id: 'u4', partyId: 'p4', balance: 0 }, // skip
    ];

    const ids = selectZeroBalanceOrderIds({
      rows,
      eligibleOrders,
      zeroMode: ZERO_MODE.ALL_UNMATCHED,
    });

    expect(ids).toEqual(['u1', 'u2', 'u3']);
  });

  test('dedupes duplicate orders in eligible list', () => {
    const eligibleOrders = [
      { id: 'u1', partyId: 'p1', balance: 99 },
      { id: 'u1', partyId: 'p1', balance: 99 },
    ];

    const ids = selectZeroBalanceOrderIds({
      rows,
      eligibleOrders,
      zeroMode: ZERO_MODE.ALL_UNMATCHED,
    });

    expect(ids).toEqual(['u1']);
  });
});

describe('getOutstandingNotSyncedRows', () => {
  test('lists blocked statuses and matched rows with no changes', () => {
    const rows = [
      {
        rowIndex: 2,
        billNumber: 'T-1',
        billDateDisplay: '01-Jan-2026',
        orderAmount: 100,
        balance: 50,
        status: 'ambiguous',
      },
      {
        rowIndex: 3,
        billNumber: 'T-2',
        billDateDisplay: '02-Jan-2026',
        orderAmount: 200,
        balance: 75,
        status: 'matched',
        matchedOrder: { id: 'o1', orderAmount: 200, balance: 75, partyId: 'p1' },
      },
      {
        rowIndex: 4,
        billNumber: '*T-3',
        billDateDisplay: '03-Jan-2026',
        orderAmount: 300,
        balance: 80,
        status: 'skipped_no_party',
        sectionId: 'section-1',
      },
    ];

    const notSynced = getOutstandingNotSyncedRows(rows, {
      updateAmount: true,
      updateBalance: true,
    });

    expect(notSynced).toHaveLength(3);
    expect(notSynced[0]).toMatchObject({
      billNumber: 'T-1',
      skipReason: 'ambiguous',
      skipReasonLabel: 'Multiple DB matches',
    });
    expect(notSynced[1]).toMatchObject({
      billNumber: 'T-2',
      skipReason: 'no_changes',
      skipReasonLabel: 'Already up to date',
    });
    expect(notSynced[2]).toMatchObject({
      billNumber: '*T-3',
      skipReason: 'skipped_no_party',
    });
  });

  test('excludes matched rows that will receive party transfer', () => {
    const rows = [
      {
        rowIndex: 5,
        billNumber: 'T-9',
        billDateDisplay: '09-Jan-2026',
        orderAmount: 500,
        balance: 100,
        status: 'matched',
        matchedOrder: { id: 'o9', orderAmount: 500, balance: 100, partyId: 'p2' },
      },
    ];

    const notSynced = getOutstandingNotSyncedRows(rows, {
      updateAmount: false,
      updateBalance: false,
      enablePartyMajorityFix: true,
      transferCandidates: [
        { orderId: 'o9', fromPartyId: 'p2', toPartyId: 'p1' },
      ],
    });

    expect(notSynced).toHaveLength(0);
  });
});

describe('markCreateRowsWithoutParty', () => {
  test('keeps create status when section has an inferred party', () => {
    const rows = [
      {
        sectionId: 'section-1',
        status: 'matched',
        matchedOrder: { id: 'o1', partyId: 'p1' },
      },
      {
        sectionId: 'section-1',
        status: 'create',
        matchedOrder: null,
        billNumber: '*T-00001',
      },
    ];

    const result = markCreateRowsWithoutParty(rows);
    expect(result[1].status).toBe('create');
  });

  test('marks create rows as skipped when no party can be inferred', () => {
    const rows = [
      {
        sectionId: 'section-1',
        status: 'create',
        matchedOrder: null,
        billNumber: '*T-00001',
      },
    ];

    const result = markCreateRowsWithoutParty(rows);
    expect(result[0].status).toBe('skipped_no_party');
  });
});

describe('section party assignment helpers', () => {
  const rowsWithoutParty = [
    {
      sectionId: 'section-1',
      sectionLabel: 'AMAN TRADERS',
      status: 'skipped_no_party',
      billNumber: '*T-00001',
    },
    {
      sectionId: 'section-1',
      sectionLabel: 'AMAN TRADERS',
      status: 'skipped_no_party',
      billNumber: '*T-00002',
    },
    {
      sectionId: 'section-2',
      sectionLabel: 'OTHER PARTY',
      status: 'skipped_no_party',
      billNumber: '*T-00003',
    },
  ];

  test('getSectionsNeedingPartyAssignment groups skipped rows by section', () => {
    const sections = getSectionsNeedingPartyAssignment(rowsWithoutParty);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      sectionId: 'section-1',
      sectionLabel: 'AMAN TRADERS',
      billCount: 2,
    });
    expect(sections[1]).toMatchObject({
      sectionId: 'section-2',
      billCount: 1,
    });
  });

  test('applySectionPartyAssignments restores create status for assigned sections', () => {
    const assignments = {
      'section-1': { id: 'p1', name: 'AMAN TRADERS' },
    };

    const result = applySectionPartyAssignments(rowsWithoutParty, assignments);

    expect(result[0].status).toBe('create');
    expect(result[1].status).toBe('create');
    expect(result[2].status).toBe('skipped_no_party');
  });

  test('buildEffectiveSectionPartyIdMap includes manual assignments', () => {
    const map = buildEffectiveSectionPartyIdMap(rowsWithoutParty, {
      'section-1': { id: 'p1', name: 'AMAN TRADERS' },
    });

    expect(map.get('section-1')).toBe('p1');
    expect(map.has('section-2')).toBe(false);
  });

  test('getOutstandingNotSyncedRows excludes rows with manual party assignment', () => {
    const notSynced = getOutstandingNotSyncedRows(rowsWithoutParty, {
      sectionPartyAssignments: {
        'section-1': { id: 'p1', name: 'AMAN TRADERS' },
      },
    });

    expect(notSynced).toHaveLength(1);
    expect(notSynced[0].sectionId).toBe('section-2');
  });
});

describe('majority correction helpers', () => {
  test('builds transfer candidates from section-majority party', () => {
    const rows = [
      {
        sectionId: 'section-1',
        sectionLabel: 'AMAN',
        sectionTotalBalance: 5000,
        status: 'matched',
        billNumber: 'T-1',
        matchedOrder: { id: 'o1', partyId: 'p1' },
      },
      {
        sectionId: 'section-1',
        sectionLabel: 'AMAN',
        sectionTotalBalance: 5000,
        status: 'matched',
        billNumber: 'T-2',
        matchedOrder: { id: 'o2', partyId: 'p1' },
      },
      {
        sectionId: 'section-1',
        sectionLabel: 'AMAN',
        sectionTotalBalance: 5000,
        status: 'matched',
        billNumber: 'T-3',
        matchedOrder: { id: 'o3', partyId: 'p1' },
      },
      {
        sectionId: 'section-1',
        sectionLabel: 'AMAN',
        sectionTotalBalance: 5000,
        status: 'matched',
        billNumber: 'T-4',
        matchedOrder: { id: 'o4', partyId: 'p2' },
      },
    ];

    const result = buildMajorityPartyCorrections(rows, {
      syncPartyBalance: true,
      minMatchedBills: MAJORITY_RULES.MIN_MATCHED_BILLS,
      minMajorityRatio: MAJORITY_RULES.MIN_MAJORITY_RATIO,
      minMajorityMargin: MAJORITY_RULES.MIN_MAJORITY_MARGIN,
    });

    expect(result.transferCandidates).toHaveLength(1);
    expect(result.transferCandidates[0]).toMatchObject({
      orderId: 'o4',
      fromPartyId: 'p2',
      toPartyId: 'p1',
    });
    expect(result.partyBalanceUpdates).toHaveLength(1);
    expect(result.partyBalanceUpdates[0]).toMatchObject({
      partyId: 'p1',
      partyBalance: 5000,
    });
  });

  test('assigns partyId to matched bills missing party when section qualifies', () => {
    const rows = [
      {
        sectionId: 'section-1',
        sectionLabel: 'AMAN',
        sectionTotalBalance: 5000,
        status: 'matched',
        billNumber: 'T-1',
        matchedOrder: { id: 'o1', partyId: 'p1' },
      },
      {
        sectionId: 'section-1',
        sectionLabel: 'AMAN',
        sectionTotalBalance: 5000,
        status: 'matched',
        billNumber: 'T-2',
        matchedOrder: { id: 'o2', partyId: 'p1' },
      },
      {
        sectionId: 'section-1',
        sectionLabel: 'AMAN',
        sectionTotalBalance: 5000,
        status: 'matched',
        billNumber: 'T-3',
        matchedOrder: { id: 'o3', partyId: 'p1' },
      },
      {
        sectionId: 'section-1',
        sectionLabel: 'AMAN',
        sectionTotalBalance: 5000,
        status: 'matched',
        billNumber: 'T-4',
        matchedOrder: { id: 'o4', partyId: '' },
      },
    ];

    const result = buildMajorityPartyCorrections(rows, {
      syncPartyBalance: false,
      minMatchedBills: MAJORITY_RULES.MIN_MATCHED_BILLS,
      minMajorityRatio: MAJORITY_RULES.MIN_MAJORITY_RATIO,
      minMajorityMargin: MAJORITY_RULES.MIN_MAJORITY_MARGIN,
    });

    expect(result.transferCandidates).toHaveLength(1);
    expect(result.transferCandidates[0]).toMatchObject({
      orderId: 'o4',
      fromPartyId: '',
      toPartyId: 'p1',
    });
  });

  test('skips sections not meeting confidence thresholds', () => {
    const rows = [
      {
        sectionId: 'section-1',
        sectionLabel: 'LOW CONF',
        sectionTotalBalance: 1000,
        status: 'matched',
        billNumber: 'A1',
        matchedOrder: { id: 'o1', partyId: 'p1' },
      },
      {
        sectionId: 'section-1',
        sectionLabel: 'LOW CONF',
        sectionTotalBalance: 1000,
        status: 'matched',
        billNumber: 'A2',
        matchedOrder: { id: 'o2', partyId: 'p2' },
      },
    ];

    const result = buildMajorityPartyCorrections(rows, { syncPartyBalance: true });
    expect(result.transferCandidates).toHaveLength(0);
    expect(result.partyBalanceUpdates).toHaveLength(0);
  });
});

