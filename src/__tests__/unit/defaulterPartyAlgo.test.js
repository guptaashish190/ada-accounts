/**
 * Unit tests for the defaulterPartyAlgo.js pure function.
 *
 * The algo signature:
 *   isDefaulter(upis, cheques, cash, lastPayment, bill) → boolean
 */

jest.mock('../../renderer/services/globalUtils', () => ({
  __esModule: true,
  default: {
    dateDifferenceInDays: (d1, d2) => {
      const ms = Math.abs(new Date(d1).getTime() - new Date(d2).getTime());
      return ms / (1000 * 60 * 60 * 24);
    },
  },
}));

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
    expect(isDefaulter(upis, [], [], null, bill)).toBe(false);
  });

  test('not a defaulter when UPI payment exceeds the order amount', () => {
    const upis = [makeUpi(600)];
    expect(isDefaulter(upis, [], [], null, bill)).toBe(false);
  });

  test('is a defaulter when no payment has been made', () => {
    expect(isDefaulter([], [], [], null, bill)).toBe(true);
  });

  test('is a defaulter when partial payment made but less than order amount', () => {
    const upis = [makeUpi(100)];
    expect(isDefaulter(upis, [], [], null, bill)).toBe(true);
  });
});

describe('isDefaulter — Weekly payment terms', () => {
  const bill = makeBill('party1', 'Weekly', 300);

  test('is a defaulter when no payments and no last payment record', () => {
    expect(isDefaulter([], [], [], null, bill)).toBe(true);
  });

  test('not a defaulter when last payment was within 7 days', () => {
    // Bill creation time = 2024-01-15; last payment 3 days later = within 7 days
    const lastPayment = {
      type: 'upi',
      amount: 200,
      timestamp: new Date('2024-01-18').getTime(),
    };
    expect(isDefaulter([], [], [], lastPayment, bill)).toBe(false);
  });

  test('is a defaulter when last payment was more than 7 days ago', () => {
    const lastPayment = {
      type: 'upi',
      amount: 200,
      // 10 days after bill creation
      timestamp: new Date('2024-01-25').getTime(),
    };
    expect(isDefaulter([], [], [], lastPayment, bill)).toBe(true);
  });
});

describe('isDefaulter — Monthly payment terms', () => {
  const bill = makeBill('party1', 'Monthly', 1000);

  test('is a defaulter when no payments and no last payment record', () => {
    expect(isDefaulter([], [], [], null, bill)).toBe(true);
  });

  test('not a defaulter when last payment was within 30 days', () => {
    const lastPayment = {
      type: 'upi',
      amount: 500,
      // 15 days after bill creation
      timestamp: new Date('2024-01-30').getTime(),
    };
    expect(isDefaulter([], [], [], lastPayment, bill)).toBe(false);
  });

  test('is a defaulter when last payment was more than 30 days ago', () => {
    const lastPayment = {
      type: 'upi',
      amount: 500,
      // 35 days after bill creation
      timestamp: new Date('2024-02-19').getTime(),
    };
    expect(isDefaulter([], [], [], lastPayment, bill)).toBe(true);
  });
});

describe('isDefaulter — edge cases', () => {
  test('returns false when party paymentTerms is unrecognised and no payments', () => {
    const bill = makeBill('party1', 'Unknown', 100);
    // Falls through all if-branches → returns false
    expect(isDefaulter([], [], [], null, bill)).toBe(false);
  });

  test('handles UPI amounts that are strings', () => {
    const bill = makeBill('party1', 'Cash', 100);
    const upis = [{ amount: '100' }];
    expect(isDefaulter(upis, [], [], null, bill)).toBe(false);
  });
});
