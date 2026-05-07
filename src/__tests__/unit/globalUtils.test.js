/**
 * Unit tests for pure helper methods in globalUtils.js.
 *
 * Only pure methods are tested here (no Firebase, no React hooks).
 */

// globalUtils imports firebase/firestore at module level, so we mock that out.
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
}));
jest.mock('../../renderer/firebaseInit', () => ({
  default: {},
  firebaseDB: {},
}));
jest.mock('../../renderer/services/firestoreHelpers', () => ({
  getCompanyCollection: jest.fn(),
  getCompanyDoc: jest.fn(),
  DEFAULT_COMPANY_ID: 'test-company',
  DB_NAMES: { COUNTERS: 'counters', ORDERS: 'orders', PARTIES: 'parties' },
}));

const globalUtils = require('../../renderer/services/globalUtils').default;

describe('globalUtils.getCurrencyFormat', () => {
  test('returns "--" for null', () => {
    expect(globalUtils.getCurrencyFormat(null)).toBe('--');
  });

  test('returns "--" for undefined', () => {
    expect(globalUtils.getCurrencyFormat(undefined)).toBe('--');
  });

  test('returns "--" for empty string', () => {
    expect(globalUtils.getCurrencyFormat('')).toBe('--');
  });

  test('formats zero as ₹0', () => {
    const result = globalUtils.getCurrencyFormat(0);
    expect(result).toContain('0');
    // Indian rupee symbol
    expect(result).toContain('₹');
  });

  test('formats 1000 in Indian number system', () => {
    const result = globalUtils.getCurrencyFormat(1000);
    expect(result).toContain('1,000');
    expect(result).toContain('₹');
  });

  test('formats 1234567 with Indian comma grouping', () => {
    const result = globalUtils.getCurrencyFormat(1234567);
    // Indian format: 12,34,567
    expect(result).toContain('12,34,567');
  });

  test('formats 100 correctly', () => {
    const result = globalUtils.getCurrencyFormat(100);
    expect(result).toContain('100');
    expect(result).toContain('₹');
  });
});

describe('globalUtils.dateDifferenceInDays', () => {
  test('returns 0 for identical dates', () => {
    const now = new Date('2024-01-15').getTime();
    const result = globalUtils.dateDifferenceInDays(now, now);
    expect(result).toBeCloseTo(0, 2);
  });

  test('returns ~1 for dates exactly 1 day apart', () => {
    const d1 = new Date('2024-01-14').getTime();
    const d2 = new Date('2024-01-15').getTime();
    const result = globalUtils.dateDifferenceInDays(d1, d2);
    expect(result).toBeCloseTo(1, 2);
  });

  test('returns ~7 for dates 1 week apart', () => {
    const d1 = new Date('2024-01-08').getTime();
    const d2 = new Date('2024-01-15').getTime();
    const result = globalUtils.dateDifferenceInDays(d1, d2);
    expect(result).toBeCloseTo(7, 2);
  });

  test('returns ~30 for dates ~1 month apart', () => {
    const d1 = new Date('2024-01-01').getTime();
    const d2 = new Date('2024-01-31').getTime();
    const result = globalUtils.dateDifferenceInDays(d1, d2);
    expect(result).toBeCloseTo(30, 2);
  });

  test('is symmetric — order of arguments does not affect the result', () => {
    const d1 = new Date('2024-01-01').getTime();
    const d2 = new Date('2024-01-10').getTime();
    const forward = globalUtils.dateDifferenceInDays(d1, d2);
    const reverse = globalUtils.dateDifferenceInDays(d2, d1);
    expect(forward).toBeCloseTo(reverse, 5);
  });
});

describe('globalUtils.getDaysPassed', () => {
  test('returns a non-negative number for a past timestamp', () => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const result = globalUtils.getDaysPassed(oneDayAgo);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('returns approximately 1 for a timestamp 1 day in the past', () => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const result = globalUtils.getDaysPassed(oneDayAgo);
    expect(result).toBe(1);
  });
});
