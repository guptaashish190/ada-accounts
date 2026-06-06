/**
 * Unit tests for the defaulterPartyAlgo.js pure function.
 *
 * The algo signature:
 *   isDefaulter(upis, cheques, cash, bill) → boolean
 */

const isDefaulter = require('../../renderer/screens/reports/daySupplyReport/defaulterPartyAlgo').default;

// Shared helpers
const makeUpi = (amount) => ({ amount: String(amount) });
const makeBill = (partyId, paymentTerms, orderAmount) => ({
  partyId,
  party: { paymentTerms },
  orderAmount,
  billCreationTime: new Date('2024-01-15').getTime(),
});

describe('isDefaulter — Cash payment terms', () => {
  const bill = makeBill('party1', 'Cash', 500);

  test('not a defaulter when UPI payment covers the order amount', () => {
    const upis = [makeUpi(500)];
    expect(isDefaulter(upis, [], [], bill)).toBe(false);
  });

  test('not a defaulter when UPI payment exceeds the order amount', () => {
    const upis = [makeUpi(600)];
    expect(isDefaulter(upis, [], [], bill)).toBe(false);
  });

  test('is a defaulter when no payment has been made', () => {
    expect(isDefaulter([], [], [], bill)).toBe(true);
  });

  test('is a defaulter when partial payment made but less than order amount', () => {
    const upis = [makeUpi(100)];
    expect(isDefaulter(upis, [], [], bill)).toBe(true);
  });
});

describe('isDefaulter — Weekly payment terms', () => {
  const bill = makeBill('party1', 'Weekly', 300);

  test('is a defaulter when no payments have been made', () => {
    expect(isDefaulter([], [], [], bill)).toBe(true);
  });

  test('not a defaulter when a payment has been made', () => {
    const upis = [makeUpi(100)];
    expect(isDefaulter(upis, [], [], bill)).toBe(false);
  });
});

describe('isDefaulter — Monthly payment terms', () => {
  const bill = makeBill('party1', 'Monthly', 1000);

  test('is a defaulter when no payments have been made', () => {
    expect(isDefaulter([], [], [], bill)).toBe(true);
  });

  test('not a defaulter when a payment has been made', () => {
    const upis = [makeUpi(500)];
    expect(isDefaulter(upis, [], [], bill)).toBe(false);
  });
});

describe('isDefaulter — edge cases', () => {
  test('returns false when party paymentTerms is unrecognised and no payments', () => {
    const bill = makeBill('party1', 'Unknown', 100);
    expect(isDefaulter([], [], [], bill)).toBe(false);
  });

  test('handles UPI amounts that are strings', () => {
    const bill = makeBill('party1', 'Cash', 100);
    const upis = [{ amount: '100' }];
    expect(isDefaulter(upis, [], [], bill)).toBe(false);
  });
});
