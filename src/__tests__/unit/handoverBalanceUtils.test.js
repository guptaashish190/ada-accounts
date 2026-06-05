const {
  buildAssignmentDetails,
  mergeHandoverOntoBills,
  getBundleHandoverTotal,
  canCreateBundle,
  attachBillWithHandover,
  parseHandoverInput,
  getPrintBalance,
  getHandoverBalance,
  getDefaultHandoverBalance,
  getStoredLastHandover,
  filterBillsForBundlePrint,
} = require('../../renderer/services/handoverBalanceUtils');

describe('handoverBalanceUtils', () => {
  test('buildAssignmentDetails defaults handover to erp balance', () => {
    const details = buildAssignmentDetails([
      { id: 'a1', balance: 5000, handoverBalance: 4950 },
    ]);
    expect(details).toEqual([
      { billId: 'a1', erpBalance: 5000, handoverBalance: 4950 },
    ]);
  });

  test('mergeHandoverOntoBills uses assignmentDetails when present', () => {
    const merged = mergeHandoverOntoBills(
      [{ id: 'a1', balance: 5000 }],
      [{ billId: 'a1', erpBalance: 5000, handoverBalance: 4950 }],
    );
    expect(merged[0].handoverBalance).toBe(4950);
    expect(merged[0].displayBalance).toBe(4950);
  });

  test('mergeHandoverOntoBills falls back to order balance', () => {
    const merged = mergeHandoverOntoBills([{ id: 'a1', balance: 5000 }], []);
    expect(merged[0].handoverBalance).toBe(5000);
  });

  test('mergeHandoverOntoBills falls back to lastHandoverBalance', () => {
    const merged = mergeHandoverOntoBills(
      [{ id: 'a1', balance: 5000, lastHandoverBalance: 4950 }],
      [],
    );
    expect(merged[0].handoverBalance).toBe(4950);
  });

  test('attachBillWithHandover prefills from lastHandoverBalance', () => {
    const attached = attachBillWithHandover({
      id: 'x',
      balance: 5000,
      lastHandoverBalance: 4950,
    });
    expect(attached.handoverBalance).toBe(4950);
  });

  test('getDefaultHandoverBalance uses lastHandoverBalance', () => {
    expect(
      getDefaultHandoverBalance({ balance: 5000, lastHandoverBalance: 4950 }),
    ).toBe(4950);
    expect(getStoredLastHandover({ balance: 5000, lastHandoverBalance: 0 })).toBe(0);
  });

  test('getBundleHandoverTotal sums handover lines', () => {
    expect(
      getBundleHandoverTotal([
        { handoverBalance: 0 },
        { handoverBalance: 2000 },
      ]),
    ).toBe(2000);
  });

  test('canCreateBundle allows combined slip (zeros + one total)', () => {
    const result = canCreateBundle(
      [
        { id: '1', balance: 500, handoverBalance: 0 },
        { id: '2', balance: 500, handoverBalance: 2000 },
      ],
      [],
    );
    expect(result.canSubmit).toBe(true);
    expect(result.handoverTotal).toBe(2000);
  });

  test('canCreateBundle rejects bundle with zero handover total', () => {
    const result = canCreateBundle(
      [{ id: '1', balance: 500, handoverBalance: 0 }],
      [],
    );
    expect(result.canSubmit).toBe(false);
  });

  test('attachBillWithHandover sets initial handover', () => {
    const attached = attachBillWithHandover({ id: 'x', balance: 100 });
    expect(attached.handoverBalance).toBe(100);
  });

  test('attachBillWithHandover accepts override', () => {
    const attached = attachBillWithHandover({ id: 'x', balance: 100 }, '', 95);
    expect(attached.handoverBalance).toBe(95);
    expect(attached.erpBalance).toBe(100);
  });

  test('getPrintBalance uses handover for bundles', () => {
    expect(getPrintBalance({ balance: 5000, handoverBalance: 4950 }, true)).toBe(
      4950,
    );
    expect(getPrintBalance({ balance: 5000, handoverBalance: 4950 }, false)).toBe(
      5000,
    );
  });

  test('parseHandoverInput parses integers', () => {
    expect(parseHandoverInput('4950', 0)).toBe(4950);
    expect(parseHandoverInput('', 100)).toBe(100);
  });

  test('getHandoverBalance prefers handoverBalance field', () => {
    expect(getHandoverBalance({ balance: 500, handoverBalance: 2000 })).toBe(2000);
  });

  test('filterBillsForBundlePrint drops zero handover lines', () => {
    const filtered = filterBillsForBundlePrint([
      { balance: 500, handoverBalance: 0 },
      { balance: 500, handoverBalance: 2000 },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].handoverBalance).toBe(2000);
  });
});
