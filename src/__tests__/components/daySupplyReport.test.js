/**
 * Component tests for daySupplyReport.js
 *
 * Strategy:
 *  - Mock Firebase (getDocs), contexts, react-router, electron, and
 *    third-party UI dependencies so jsdom can render the component.
 *  - Control returned docs to verify different UI states.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Firebase mocks ────────────────────────────────────────────────────────────
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  getDocs: (...args) => mockGetDocs(...args),
  query: jest.fn((...args) => args[0]),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  updateDoc: jest.fn(() => Promise.resolve()),
}));

// ─── Firestore helpers mock ────────────────────────────────────────────────────
jest.mock('../../renderer/services/firestoreHelpers', () => ({
  getCompanyCollection: jest.fn((cid, name) => `${cid}/${name}`),
  getCompanyDoc: jest.fn((cid, name, id) => `${cid}/${name}/${id}`),
  DB_NAMES: {
    SUPPLY_REPORTS: 'supplyReports',
    ORDERS: 'orders',
  },
}));

// ─── globalUtils mock ──────────────────────────────────────────────────────────
jest.mock('../../renderer/services/globalUtils', () => ({
  __esModule: true,
  default: {
    getCurrencyFormat: (n) => `₹${n ?? 0}`,
    getTimeFormat: () => '01/01/2024',
    getDayTime: () => '10:00 AM',
    dateDifferenceInDays: () => 0,
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

// ─── Electron IPC ─────────────────────────────────────────────────────────────
global.window = global.window || {};
global.window.electron = { ipcRenderer: { sendMessage: jest.fn() } };

// ─── react-to-print ───────────────────────────────────────────────────────────
jest.mock('react-to-print', () => ({
  useReactToPrint: () => jest.fn(),
}));

// ─── @fluentui/react-datepicker-compat ────────────────────────────────────────
jest.mock('@fluentui/react-datepicker-compat', () => ({
  DatePicker: ({ placeholder }) => <input placeholder={placeholder} />,
}));

// ─── mathjs ───────────────────────────────────────────────────────────────────
jest.mock('mathjs', () => ({ min: Math.min }));

// ─── defaulterPartyAlgo ───────────────────────────────────────────────────────
jest.mock(
  '../../renderer/screens/reports/daySupplyReport/defaulterPartyAlgo',
  () => ({ __esModule: true, default: jest.fn(() => false) }),
);

// ─── Component under test ──────────────────────────────────────────────────────
const DaySupplyReportPrint =
  require('../../renderer/screens/reports/daySupplyReport/daySupplyReport').default;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeDocs(rows) {
  return {
    docs: rows.map((data, i) => ({
      id: `doc${i}`,
      data: () => data,
    })),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('DaySupplyReportPrint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: empty supply reports and orders
    mockGetDocs.mockResolvedValue(makeDocs([]));
  });

  test('renders the Day Supply Report heading', async () => {
    await act(async () => {
      render(<DaySupplyReportPrint />);
    });
    expect(screen.getByText(/Day Supply Report/i)).toBeInTheDocument();
  });

  test('renders Search button', async () => {
    await act(async () => {
      render(<DaySupplyReportPrint />);
    });
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  test('shows "No Supply Reports found" when getDocs returns empty', async () => {
    await act(async () => {
      render(<DaySupplyReportPrint />);
    });
    expect(screen.getByText(/No Supply Reports found/i)).toBeInTheDocument();
  });

  test('shows "No Unsupplied Bills" when there are no unsupplied orders', async () => {
    await act(async () => {
      render(<DaySupplyReportPrint />);
    });
    expect(screen.getByText(/No Unsupplied Bills/i)).toBeInTheDocument();
  });

  test('shows "End of Report" footer', async () => {
    await act(async () => {
      render(<DaySupplyReportPrint />);
    });
    expect(screen.getByText(/End of Report/i)).toBeInTheDocument();
  });

  test('renders supply report rows when getDocs returns data', async () => {
    // First call = supply reports, second call = orders
    mockGetDocs
      .mockResolvedValueOnce(
        makeDocs([
          {
            receiptNumber: 'SR-001',
            status: 'Dispatched',
            dispatchTimestamp: Date.now(),
            supplymanId: 'u1',
            orders: [],
            items: [],
          },
        ]),
      )
      .mockResolvedValueOnce(makeDocs([]));

    await act(async () => {
      render(<DaySupplyReportPrint />);
    });

    expect(screen.getByText(/SR-001/)).toBeInTheDocument();
  });
});
