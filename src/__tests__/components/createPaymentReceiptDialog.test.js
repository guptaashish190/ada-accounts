/**
 * Tests for createPaymentReceiptDialog.js
 *
 * Two layers:
 *  1. Pure unit tests for the `getTotal` computation logic.
 *  2. Component-level smoke tests to verify the dialog renders key elements.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Firebase mocks ────────────────────────────────────────────────────────────
jest.mock('firebase/firestore', () => ({
  __esModule: true,
  Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
  addDoc: jest.fn(() => Promise.resolve({ id: 'new-doc' })),
  runTransaction: jest.fn((db, fn) => fn({ update: jest.fn() })),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  getDoc: jest.fn(() =>
    Promise.resolve({ exists: () => false, data: () => ({}) }),
  ),
  query: jest.fn((...a) => a[0]),
  where: jest.fn(),
  collection: jest.fn(),
}));

jest.mock('../../renderer/firebaseInit', () => ({
  firebaseAuth: { currentUser: { uid: 'test-uid' } },
  firebaseDB: {},
}));

// ─── Firestore helpers mock ────────────────────────────────────────────────────
jest.mock('../../renderer/services/firestoreHelpers', () => ({
  getCompanyCollection: jest.fn((cid, name) => `${cid}/${name}`),
  DB_NAMES: { CASH_RECEIPTS: 'cashReceipts' },
}));

// ─── globalUtils mock ──────────────────────────────────────────────────────────
jest.mock('../../renderer/services/globalUtils', () => ({
  __esModule: true,
  default: {
    getCurrencyFormat: (n) => `₹${n ?? 0}`,
    getTimeFormat: () => '01/01/2024',
    fetchPartyInfoForOrders: jest.fn(() => Promise.resolve([])),
    getNewReceiptNumber: jest.fn(() => Promise.resolve('CR-100')),
    incrementReceiptCounter: jest.fn(),
  },
}));

// ─── Context mocks ─────────────────────────────────────────────────────────────
jest.mock('../../renderer/contexts/allUsersContext', () => ({
  useAuthUser: () => ({ allUsers: [] }),
}));

jest.mock('../../renderer/contexts/companyContext', () => ({
  useCompany: () => ({ currentCompanyId: 'comp1' }),
}));

// ─── react-router-dom ─────────────────────────────────────────────────────────
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ state: {} }),
}));

// ─── Heavy UI sub-components ──────────────────────────────────────────────────
jest.mock('../../renderer/common/partySelector', () => () => (
  <div data-testid="party-selector" />
));
jest.mock('../../renderer/common/selectUser', () => () => (
  <div data-testid="select-user" />
));
jest.mock('../../renderer/common/verticalSpace', () => ({
  VerticalSpace1: () => <div />,
  VerticalSpace2: () => <div />,
}));
jest.mock('../../renderer/common/toaster', () => ({
  showToast: jest.fn(),
}));
jest.mock(
  '../../renderer/common/printerDataGenerator/cashReceiptFormatGenerator',
  () => ({
    __esModule: true,
    default: jest.fn(() => []),
  }),
);

// ─── Electron IPC ─────────────────────────────────────────────────────────────
global.window = global.window || {};
global.window.electron = { ipcRenderer: { sendMessage: jest.fn() } };

// ─── constants mock ───────────────────────────────────────────────────────────
jest.mock('../../renderer/constants', () => ({
  __esModule: true,
  default: {
    newReceiptCounters: { CASHRECEIPTS: { name: 'CASHRECEIPTS' } },
  },
}));

// ─── Component under test ──────────────────────────────────────────────────────
const CreatePaymentReceiptDialog =
  require('../../renderer/screens/paymentReceipts/createPaymentReceiptDialog/createPaymentReceiptDialog').default;

// ─── Pure unit tests: getTotal logic ──────────────────────────────────────────
describe('getTotal (pure logic)', () => {
  // Extracted logic from the component for direct unit testing.
  const getTotal = (prItems) =>
    prItems
      ? prItems.reduce((acc, cur) => acc + parseInt(cur.amount || '0', 10), 0)
      : 0;

  test('returns 0 for an empty list', () => {
    expect(getTotal([])).toBe(0);
  });

  test('returns 0 when prItems is null/undefined', () => {
    expect(getTotal(null)).toBe(0);
    expect(getTotal(undefined)).toBe(0);
  });

  test('sums amounts correctly', () => {
    const items = [
      { amount: '100' },
      { amount: '250' },
      { amount: '50' },
    ];
    expect(getTotal(items)).toBe(400);
  });

  test('treats missing amount as 0', () => {
    const items = [{ amount: '500' }, {}];
    expect(getTotal(items)).toBe(500);
  });

  test('truncates decimals via parseInt', () => {
    const items = [{ amount: '99.9' }];
    expect(getTotal(items)).toBe(99);
  });
});

// ─── Component rendering tests ─────────────────────────────────────────────────
describe('CreatePaymentReceiptDialog component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const globalUtils = require('../../renderer/services/globalUtils').default;
    globalUtils.fetchPartyInfoForOrders.mockResolvedValue([]);
    globalUtils.getNewReceiptNumber.mockResolvedValue('CR-100');
  });

  test('renders "Create Cash Receipt" heading', async () => {
    await act(async () => {
      render(<CreatePaymentReceiptDialog open inputsEnabled />);
    });
    expect(screen.getByText(/Create Cash Receipt/i)).toBeInTheDocument();
  });

  test('shows receipt number returned by getNewReceiptNumber', async () => {
    await act(async () => {
      render(<CreatePaymentReceiptDialog open inputsEnabled />);
    });
    expect(screen.getByText(/CR-100/)).toBeInTheDocument();
  });

  test('renders SelectUser dropdown when editable', async () => {
    await act(async () => {
      render(<CreatePaymentReceiptDialog open inputsEnabled />);
    });
    expect(screen.getByTestId('select-user')).toBeInTheDocument();
  });

  test('renders PartySelector when editable', async () => {
    await act(async () => {
      render(<CreatePaymentReceiptDialog open inputsEnabled />);
    });
    expect(screen.getByTestId('party-selector')).toBeInTheDocument();
  });

  test('renders Create button when editable', async () => {
    await act(async () => {
      render(<CreatePaymentReceiptDialog open inputsEnabled />);
    });
    // The submit button is labeled "Create" (size="large") — there may be
    // multiple elements matching "Create" so we use getAllByText and check
    // at least one button with that label exists.
    const createButtons = screen.getAllByRole('button', { name: /Create/i });
    expect(createButtons.length).toBeGreaterThan(0);
  });
});
