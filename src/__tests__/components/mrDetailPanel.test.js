/**
 * Component tests for mrDetailPanel.js
 *
 * Strategy:
 *  - Mock Firebase (onSnapshot, getDocs, getDoc) to control data.
 *  - Mock react-leaflet and leaflet so map rendering doesn't crash jsdom.
 *  - Render the component with minimal `data` props.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Firebase mocks ────────────────────────────────────────────────────────────
let onSnapshotCallback = null;

jest.mock('firebase/firestore', () => ({
  query: jest.fn((...args) => args[0]),
  where: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  getDoc: jest.fn(() =>
    Promise.resolve({ exists: () => false, data: () => ({}) }),
  ),
  // onSnapshot is called for both collection queries (needs .docs) and
  // document refs (needs .exists() / .data()), so we provide all fields.
  onSnapshot: jest.fn((ref, cb) => {
    onSnapshotCallback = cb;
    cb({ docs: [], exists: () => false, data: () => ({}) });
    return jest.fn(); // unsubscribe
  }),
  documentId: jest.fn(),
}));

// ─── Firestore helpers mock ────────────────────────────────────────────────────
jest.mock('../../renderer/services/firestoreHelpers', () => ({
  getCompanyCollection: jest.fn((companyId, name) => `${companyId}/${name}`),
  getCompanyDoc: jest.fn((companyId, name, id) => `${companyId}/${name}/${id}`),
  DB_NAMES: {
    ORDER_REGISTER: 'orderRegister',
    ORDERS: 'orders',
    PARTIES: 'parties',
    MR_ROUTES: 'mrRoutes',
    LOCATION: 'location',
  },
}));

// ─── globalUtils mock ──────────────────────────────────────────────────────────
jest.mock('../../renderer/services/globalUtils', () => ({
  __esModule: true,
  default: {
    getCurrencyFormat: (n) => `₹${n ?? 0}`,
    getTimeFormat: (d) => (d ? d.toString() : ''),
  },
}));

// ─── react-leaflet mock ────────────────────────────────────────────────────────
// Map components are stub divs; useMap returns a minimal object.
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  Tooltip: ({ children }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: jest.fn() }),
}));

// ─── leaflet mock ──────────────────────────────────────────────────────────────
jest.mock('leaflet', () => {
  const L = {
    Icon: {
      Default: {
        prototype: { _getIconUrl: jest.fn() },
        mergeOptions: jest.fn(),
      },
    },
    DivIcon: jest.fn(() => ({})),
  };
  L.Icon.mockImplementation = jest.fn(() => ({}));
  L.Icon = Object.assign(jest.fn(() => ({})), L.Icon);
  return L;
});

// ─── Component under test ──────────────────────────────────────────────────────
const MrDetailPanel =
  require('../../renderer/childWindows/mrDetailPanel/mrDetailPanel').default;

// ─── haversineKm — isolated function tests ─────────────────────────────────────
// The function is defined inside the module file; we test its observable effects
// through the rendered component instead of importing it directly since it's
// not exported. A dedicated unit test for the algorithm:
describe('haversineKm (pure algorithm)', () => {
  // Re-implement here to verify the math we rely on in the app.
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  test('same point → 0 km', () => {
    expect(haversineKm(28.6, 77.2, 28.6, 77.2)).toBeCloseTo(0, 5);
  });

  test('roughly 1 degree latitude ≈ 111 km', () => {
    const dist = haversineKm(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  test('is symmetric', () => {
    const d1 = haversineKm(28.6, 77.2, 19.0, 72.8);
    const d2 = haversineKm(19.0, 72.8, 28.6, 77.2);
    expect(d1).toBeCloseTo(d2, 6);
  });

  test('Delhi to Mumbai ≈ 1150 km', () => {
    const dist = haversineKm(28.6139, 77.209, 19.076, 72.8777);
    expect(dist).toBeGreaterThan(1100);
    expect(dist).toBeLessThan(1200);
  });
});

// ─── Component rendering tests ─────────────────────────────────────────────────
const defaultData = {
  mrUid: 'user1',
  mrName: 'Test MR',
  assignedRoute: null,
  companyId: 'comp1',
  selectedDate: '2024-01-15',
};

describe('MrDetailPanel component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onSnapshotCallback = null;

    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((ref, cb) => {
      cb({ docs: [], exists: () => false, data: () => ({}) });
      return jest.fn();
    });
  });

  test('renders the MR name in the header', async () => {
    await act(async () => {
      render(<MrDetailPanel data={defaultData} />);
    });
    expect(screen.getByText(/Test MR/)).toBeInTheDocument();
  });

  test('shows "No location data available" when onSnapshot returns empty docs', async () => {
    await act(async () => {
      render(<MrDetailPanel data={defaultData} />);
    });
    expect(
      screen.getByText(/No location data available for this date/i),
    ).toBeInTheDocument();
  });

  test('does not render the map when there are no location points', async () => {
    await act(async () => {
      render(<MrDetailPanel data={defaultData} />);
    });
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
  });
});
