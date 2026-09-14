import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { ChevronDown16Regular, Edit16Regular } from '@fluentui/react-icons';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import {
  documentId,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useAuthUser } from '../../contexts/allUsersContext';
import { useCompany } from '../../contexts/companyContext';
import PartySelector from '../../common/partySelector';
import SelectUserDropdown from '../../common/selectUser';
import constants from '../../constants';
import {
  DB_NAMES,
  getCompanyCollection,
} from '../../services/firestoreHelpers';
import globalUtils from '../../services/globalUtils';
import { searchOrders } from '../../services/searchOrders';
import './style.css';

const MR_JOB_ID = constants.firebaseIds.JOBS.MR;
const FLOW = constants.firebase.billFlowTypes;
const PENDING_FLOW_TYPES = [
  FLOW.ORDER_CREATED,
  FLOW.BILL_CREATED,
  FLOW.MODIFY_ORDER_REQUEST,
  FLOW.BILL_MODIFIED,
  FLOW.DISPATCH_REPORT,
];

const formatTime = (ms) => {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDate = (ms) => {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN');
};

const toDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateString = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

function mapOrderDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    partyId: data.partyId || '',
    billNumber: data.billNumber || '',
    with: data.with || '',
    orderAmount: data.orderAmount || 0,
    mrId: data.mrId || '',
    orderStatus: data.orderStatus || '',
    creationTime: data.creationTime || 0,
    billCreationTime: data.billCreationTime || 0,
    flow: data.flow || [],
    flowCompleted: data.flowCompleted,
  };
}

function currentFlowType(order) {
  const flow = order.flow || [];
  if (flow.length > 0) return flow[flow.length - 1].type;
  return order.orderStatus;
}

function isPendingOrder(order) {
  return PENDING_FLOW_TYPES.includes(currentFlowType(order));
}

function OrdersTable({
  orders,
  partyNames,
  userMap,
  showBillNumber,
  showDate,
  showCreationTime,
  onOpen,
}) {
  return (
    <table className="app-table">
      <thead>
        <tr>
          <th>Party Name</th>
          {showBillNumber && <th>Bill No.</th>}
          {showDate && <th>Date</th>}
          <th>Order Amount</th>
          <th>MR</th>
          <th>Status</th>
          {showCreationTime && <th>Creation Time</th>}
          <th />
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr
            key={o.id}
            style={{ cursor: 'pointer' }}
            onClick={() => onOpen(null, o)}
          >
            <td>{partyNames[o.partyId] || o.partyId || '—'}</td>
            {showBillNumber && <td>{o.billNumber?.toUpperCase() || '—'}</td>}
            {showDate && (
              <td>{formatDate(o.billCreationTime || o.creationTime)}</td>
            )}
            <td>{globalUtils.getCurrencyFormat(o.orderAmount)}</td>
            <td>{userMap[o.mrId] || '—'}</td>
            <td>
              <span className="order-status-pill">
                {o.orderStatus || '—'}
                {(o.flow || []).length > 0 && (
                  <span>
                    : {formatTime(o.flow[o.flow.length - 1].timestamp)}
                  </span>
                )}
              </span>
            </td>
            {showCreationTime && <td>{formatTime(o.creationTime)}</td>}
            <td>
              <Button
                appearance="subtle"
                icon={<Edit16Regular />}
                size="small"
                onClick={(e) => onOpen(e, o)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AllBillsScreen() {
  const { currentCompanyId } = useCompany();
  const { allUsers } = useAuthUser();

  const [selectedDate, setSelectedDate] = useState(() =>
    toDateString(new Date()),
  );
  const selectedDateValue = useMemo(
    () => parseDateString(selectedDate),
    [selectedDate],
  );

  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [orderRows, setOrderRows] = useState([]);
  const [pendingRows, setPendingRows] = useState([]);
  const [pendingCollapsed, setPendingCollapsed] = useState(true);
  const [partyNames, setPartyNames] = useState({});
  const partyNamesCacheRef = React.useRef({});

  const [queryPartyId, setQueryPartyId] = useState('');
  const [queryWith, setQueryWith] = useState('');
  const [queryBillNumber, setQueryBillNumber] = useState('');
  const [queryMR, setQueryMR] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const companyUsers = useMemo(
    () =>
      (allUsers || []).filter(
        (u) => u.companyId === currentCompanyId && !u.isDeactivated,
      ),
    [allUsers, currentCompanyId],
  );

  const mrUsers = useMemo(
    () => companyUsers.filter((u) => u.jobs && u.jobs.includes(MR_JOB_ID)),
    [companyUsers],
  );

  const userMap = useMemo(() => {
    const map = {};
    companyUsers.forEach((u) => {
      map[u.uid] = u.username || u.email || u.uid;
    });
    return map;
  }, [companyUsers]);

  const fetchPartyNames = async (partyIds) => {
    const missing = partyIds.filter(
      (id) => id && !partyNamesCacheRef.current[id],
    );
    if (missing.length === 0) return;
    const chunks = [];
    for (let i = 0; i < missing.length; i += 10) {
      chunks.push(missing.slice(i, i + 10));
    }
    await Promise.all(
      chunks.map(async (chunk) => {
        const snap = await getDocs(
          query(
            getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES),
            where(documentId(), 'in', chunk),
          ),
        );
        snap.docs.forEach((d) => {
          const pData = d.data();
          partyNamesCacheRef.current[d.id] = pData.name || pData.Name || d.id;
        });
      }),
    );
    setPartyNames({ ...partyNamesCacheRef.current });
  };

  useEffect(() => {
    if (!currentCompanyId) return undefined;

    const d = new Date(selectedDate);
    const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endMs = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();

    setLoading(true);
    const unsub = onSnapshot(
      query(
        getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS),
        where('creationTime', '>=', startMs),
        where('creationTime', '<', endMs),
      ),
      (snap) => {
        const rows = snap.docs.map(mapOrderDoc);
        rows.sort((a, b) => b.creationTime - a.creationTime);
        setOrderRows(rows);
        const pIds = rows.map((o) => o.partyId).filter(Boolean);
        if (pIds.length > 0) fetchPartyNames(pIds);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading bills:', err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [currentCompanyId, selectedDate]);

  useEffect(() => {
    if (!currentCompanyId) return undefined;

    setPendingLoading(true);
    const unsub = onSnapshot(
      query(
        getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS),
        where('orderStatus', 'in', PENDING_FLOW_TYPES),
      ),
      (snap) => {
        const rows = snap.docs
          .map(mapOrderDoc)
          .filter(isPendingOrder)
          .sort((a, b) => b.creationTime - a.creationTime);
        setPendingRows(rows);
        const pIds = rows.map((o) => o.partyId).filter(Boolean);
        if (pIds.length > 0) fetchPartyNames(pIds);
        setPendingLoading(false);
      },
      (err) => {
        console.error('Error loading pending orders:', err);
        setPendingLoading(false);
      },
    );

    return () => unsub();
  }, [currentCompanyId]);

  const handleOpenBillDetail = (e, order) => {
    if (e) e.stopPropagation();
    if (!order?.id) return;
    window.electron.ipcRenderer.sendMessage('new-window', {
      type: constants.windowConstants.BILL_DETAIL,
      data: {
        orderId: order.id,
        companyId: currentCompanyId,
      },
    });
  };

  const handleSearchOrders = async () => {
    const hasFilter = queryPartyId || queryWith || queryBillNumber || queryMR;
    if (!hasFilter) return;

    setSearchLoading(true);
    try {
      const results = await searchOrders(currentCompanyId, {
        partyId: queryPartyId,
        with: queryWith,
        mrId: queryMR,
        billNumber: queryBillNumber,
      });
      setSearchResults(results);
      setIsSearchActive(true);
      const pIds = results.map((o) => o.partyId).filter(Boolean);
      if (pIds.length > 0) fetchPartyNames(pIds);
    } catch (err) {
      console.error('Error searching orders:', err);
    }
    setSearchLoading(false);
  };

  const handleClearSearch = () => {
    setQueryPartyId('');
    setQueryWith('');
    setQueryBillNumber('');
    setQueryMR('');
    setSearchResults([]);
    setIsSearchActive(false);
  };

  const displayedOrders = isSearchActive ? searchResults : orderRows;
  const sectionTitle = isSearchActive
    ? `Search Results (${searchResults.length})`
    : `Orders (${orderRows.length})`;

  return (
    <div className="all-bills-screen">
      <div className="all-bills-header">
        <h1>All Orders</h1>
        <DatePicker
          className="all-bills-date-picker"
          value={selectedDateValue}
          onSelectDate={(date) => {
            if (!date) return;
            setSelectedDate(toDateString(date));
            setIsSearchActive(false);
          }}
          placeholder="Select date"
        />
      </div>

      <div className="orders-filter-panel">
        <div className="orders-filter-row">
          <div className="orders-filter-field">
            <Label>Party</Label>
            <PartySelector
              onPartySelected={(p) => setQueryPartyId(p?.id || '')}
            />
          </div>
          <div className="orders-filter-field">
            <Label>With</Label>
            <SelectUserDropdown
              user={queryWith}
              setUser={(value) => setQueryWith(value || '')}
              valueKey="uid"
              placeholder="Who has the bill"
              showProfilePicture={false}
              extraOptions={[
                {
                  text: 'Accounts',
                  value: 'Accounts',
                  key: 'accounts-with-dropdown',
                },
                { text: 'None', value: '', key: 'accounts-none-dropdown' },
              ]}
            />
          </div>
          <div className="orders-filter-field">
            <Label htmlFor="all-orders-bill-no">Bill number</Label>
            <Input
              id="all-orders-bill-no"
              onChange={(_, e) => setQueryBillNumber(e.value)}
              contentBefore="T-"
              type="number"
              placeholder="e.g. 12345"
              value={queryBillNumber}
            />
          </div>
          <div className="orders-filter-field">
            <Label>MR</Label>
            <SelectUserDropdown
              user={queryMR}
              setUser={(value) => setQueryMR(value || '')}
              valueKey="uid"
              users={mrUsers}
              placeholder="Select MR"
              showProfilePicture={false}
            />
          </div>
          <div className="orders-filter-actions">
            <Button
              appearance="primary"
              onClick={handleSearchOrders}
              disabled={searchLoading}
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </Button>
            {isSearchActive && (
              <Button appearance="secondary" onClick={handleClearSearch}>
                Clear search
              </Button>
            )}
          </div>
        </div>
      </div>

      {!isSearchActive && (
        <div className="orders-section">
          <button
            type="button"
            className="orders-section-toggle"
            onClick={() => setPendingCollapsed((collapsed) => !collapsed)}
            aria-expanded={!pendingCollapsed}
          >
            <ChevronDown16Regular
              className={`orders-section-chevron${
                pendingCollapsed ? ' collapsed' : ''
              }`}
            />
            <h2>Pending Orders ({pendingRows.length})</h2>
          </button>
          {!pendingCollapsed &&
            (pendingLoading ? (
              <div className="all-bills-empty">
                <Spinner label="Loading pending orders..." />
              </div>
            ) : pendingRows.length === 0 ? (
              <div className="all-bills-empty compact">
                <Text>No pending orders</Text>
              </div>
            ) : (
              <OrdersTable
                orders={pendingRows}
                partyNames={partyNames}
                userMap={userMap}
                showBillNumber
                showDate
                onOpen={handleOpenBillDetail}
              />
            ))}
        </div>
      )}

      <div className="orders-section">
        <h2>{sectionTitle}</h2>
        {loading || searchLoading ? (
          <div className="all-bills-empty">
            <Spinner
              label={searchLoading ? 'Searching orders...' : 'Loading orders...'}
            />
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="all-bills-empty compact">
            <Text>
              {isSearchActive
                ? 'No matching orders found'
                : 'No orders for this date'}
            </Text>
          </div>
        ) : (
          <OrdersTable
            orders={displayedOrders}
            partyNames={partyNames}
            userMap={userMap}
            showBillNumber={isSearchActive}
            showDate={isSearchActive}
            showCreationTime={!isSearchActive}
            onOpen={handleOpenBillDetail}
          />
        )}
      </div>
    </div>
  );
}

export default AllBillsScreen;
