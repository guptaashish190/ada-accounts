const {
  normalizeBillNumber,
  getMatchedOrderIds,
  getMatchedPartyIds,
  matchOutstandingRow,
  buildOrderUpdatePayload,
  buildMajorityPartyCorrections,
  buildNewOrderPayload,
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
  test('respects toggles for update payload', () => {
    const row = { orderAmount: 1200, balance: 450 };
    expect(
      buildOrderUpdatePayload(row, { updateAmount: true, updateBalance: false }),
    ).toEqual({ orderAmount: 1200 });
    expect(
      buildOrderUpdatePayload(row, { updateAmount: false, updateBalance: true }),
    ).toEqual({ balance: 450 });
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

