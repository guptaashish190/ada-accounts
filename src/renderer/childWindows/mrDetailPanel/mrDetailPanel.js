import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  documentId,
} from 'firebase/firestore';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import globalUtils from '../../services/globalUtils';
import './style.css';

function MrDetailPanel({ data }) {
  const { mrUid, mrName, assignedRoute, companyId, selectedDate } = data;

  const [loading, setLoading] = useState(true);
  const [routeName, setRouteName] = useState('');
  const [plannedPartyIds, setPlannedPartyIds] = useState([]);
  const [registerEntries, setRegisterEntries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [partyNames, setPartyNames] = useState({});
  const [partyData, setPartyData] = useState({});

  const partyNamesCacheRef = useRef({});
  const partyDataCacheRef = useRef({});
  const unsubRegisterRef = useRef(null);
  const unsubOrdersRef = useRef(null);
  const initialLoadDone = useRef(false);

  const getDateRange = (dateStr) => {
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return { startMs: start.getTime(), endMs: end.getTime() };
  };

  const getWeekdayIndex = (dateStr) => {
    const d = new Date(dateStr);
    return (d.getDay() + 6) % 7;
  };

  const fetchPartyNames = useCallback(async (partyIds) => {
    if (!partyIds || partyIds.length === 0) return;
    const missing = partyIds.filter((id) => !partyNamesCacheRef.current[id]);
    if (missing.length === 0) {
      setPartyNames({ ...partyNamesCacheRef.current });
      setPartyData({ ...partyDataCacheRef.current });
      return;
    }
    const chunks = [];
    for (let i = 0; i < missing.length; i += 10) {
      chunks.push(missing.slice(i, i + 10));
    }
    await Promise.all(
      chunks.map(async (chunk) => {
        const snap = await getDocs(
          query(
            getCompanyCollection(companyId, DB_NAMES.PARTIES),
            where(documentId(), 'in', chunk),
          ),
        );
        snap.docs.forEach((d) => {
          const pData = d.data();
          partyNamesCacheRef.current[d.id] = pData.name || pData.Name || d.id;
          partyDataCacheRef.current[d.id] = pData;
        });
      }),
    );
    setPartyNames({ ...partyNamesCacheRef.current });
    setPartyData({ ...partyDataCacheRef.current });
  }, [companyId]);

  const formatTime = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  useEffect(() => {
    if (!companyId || !mrUid) return;

    const { startMs, endMs } = getDateRange(selectedDate);
    const dayIndex = getWeekdayIndex(selectedDate);
    initialLoadDone.current = false;
    setLoading(true);

    // 1. One-time fetch: route doc for planned parties
    const initRoute = async () => {
      let planned = [];
      let rName = '';
      if (assignedRoute) {
        try {
          const routeSnap = await getDoc(
            getCompanyDoc(companyId, DB_NAMES.MR_ROUTES, assignedRoute),
          );
          if (routeSnap.exists()) {
            const routeData = routeSnap.data();
            rName = routeData.name || assignedRoute;
            const routeArray = routeData.route || [];
            const todayRoute = routeArray[dayIndex];
            if (todayRoute && todayRoute.parties) {
              planned = todayRoute.parties;
            }
          }
        } catch (err) {
          console.error('Error fetching route:', err);
        }
      }
      setRouteName(rName);
      setPlannedPartyIds(planned);
      return planned;
    };

    // 2. Real-time listener: orderRegister for this MR today
    const registerQuery = query(
      getCompanyCollection(companyId, DB_NAMES.ORDER_REGISTER),
      where('userId', '==', mrUid),
      where('timestamp', '>=', startMs),
      where('timestamp', '<', endMs),
    );

    unsubRegisterRef.current = onSnapshot(registerQuery, (snap) => {
      const entries = snap.docs.map((d) => d.data());
      setRegisterEntries(entries);

      // Fetch names for any new party IDs
      const pIds = entries.map((e) => e.partyId).filter(Boolean);
      if (pIds.length > 0) fetchPartyNames(pIds);
    });

    // 3. Real-time listener: orders for this MR today
    const ordersQuery = query(
      getCompanyCollection(companyId, DB_NAMES.ORDERS),
      where('createdById', '==', mrUid),
      where('creationTime', '>=', startMs),
      where('creationTime', '<', endMs),
    );

    unsubOrdersRef.current = onSnapshot(ordersQuery, (snap) => {
      setOrders(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });

    // Kick off the route fetch, then resolve party names for planned parties
    initRoute().then((planned) => {
      if (planned.length > 0) {
        fetchPartyNames(planned).then(() => {
          initialLoadDone.current = true;
          setLoading(false);
        });
      } else {
        initialLoadDone.current = true;
        setLoading(false);
      }
    });

    return () => {
      if (unsubRegisterRef.current) unsubRegisterRef.current();
      if (unsubOrdersRef.current) unsubOrdersRef.current();
    };
  }, [companyId, mrUid, selectedDate, assignedRoute, fetchPartyNames]);

  // Once initial load is done, clear loading whenever snapshot data arrives
  useEffect(() => {
    if (initialLoadDone.current && loading) {
      setLoading(false);
    }
  }, [registerEntries, orders]);

  // Derived state: compute visited and pending from live data
  const visitedPartyIds = new Set(
    registerEntries.map((e) => e.partyId).filter(Boolean),
  );

  const getPartyPhone = (partyId) => {
    const pd = partyData[partyId];
    if (!pd) return '';
    return pd.contact || pd.phone1 || pd.phone2 || pd.phone3 || pd.phone4 || '';
  };

  const visitedParties = registerEntries
    .filter((e) => e.partyId)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .map((e) => {
      const matchedOrder = e.orderId
        ? orders.find((o) => o.id === e.orderId || o.orderId === e.orderId)
        : null;
      return {
        partyId: e.partyId,
        partyName: partyNames[e.partyId] || e.partyId,
        partyPhone: getPartyPhone(e.partyId),
        status: e.status,
        reason: e.reason || '',
        timestamp: e.timestamp,
        orderId: e.orderId || '',
        orderAmount: matchedOrder
          ? matchedOrder.orderAmount || 0
          : 0,
        orderStatus: matchedOrder
          ? matchedOrder.orderStatus || ''
          : '',
      };
    });

  const pendingPartiesList = plannedPartyIds
    .filter((pid) => !visitedPartyIds.has(pid))
    .map((pid) => ({
      partyId: pid,
      partyName: partyNames[pid] || pid,
      partyPhone: getPartyPhone(pid),
    }));

  const orderCount = orders.length;
  const salesTotal = orders.reduce(
    (sum, o) => sum + (o.orderAmount || 0),
    0,
  );

  if (loading) {
    return (
      <div className="mr-detail-panel">
        <div className="mr-detail-loading">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  const dayNames = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday', 'Sunday',
  ];
  const dayIndex = getWeekdayIndex(selectedDate);
  const dayName = dayNames[dayIndex];

  return (
    <div className="mr-detail-panel">
      {/* Header */}
      <div className="mr-detail-header">
        <h1>
          {mrName}
          <span>
            — {routeName || 'No route'} ({dayName})
          </span>
        </h1>
      </div>

      {/* Stats */}
      <div className="mr-detail-stats">
        <div className="mr-stat-card stat-orders">
          <div className="stat-label">Orders</div>
          <div className="stat-value">{orderCount}</div>
        </div>
        <div className="mr-stat-card stat-sales">
          <div className="stat-label">Sales</div>
          <div className="stat-value">
            {globalUtils.getCurrencyFormat(salesTotal)}
          </div>
        </div>
        <div className="mr-stat-card stat-visits">
          <div className="stat-label">Visited</div>
          <div className="stat-value">
            {visitedParties.length} / {plannedPartyIds.length}
          </div>
        </div>
      </div>

      {/* Visited Parties */}
      <div className="visited-section">
        <h2>Visited Parties ({visitedParties.length})</h2>
        {visitedParties.length === 0 ? (
          <div className="no-data-message">No parties visited yet</div>
        ) : (
          <div className="visited-cards">
            {visitedParties.map((vp, i) => (
              <div
                key={`${vp.partyId}-${i}`}
                className={`visited-card ${
                  vp.status === 'Order' ? 'order-placed' : 'no-order'
                }`}
              >
                <div className="party-name">{vp.partyName}</div>
                {vp.partyPhone && (
                  <div className="party-phone">{vp.partyPhone}</div>
                )}
                {vp.status === 'Order' ? (
                  <>
                    <div className="visit-outcome order">
                      Order: {globalUtils.getCurrencyFormat(vp.orderAmount)}
                    </div>
                    {vp.orderStatus && (
                      <div className="order-status-badge">{vp.orderStatus}</div>
                    )}
                  </>
                ) : (
                  <div className="visit-outcome no-order">
                    No Order{vp.reason ? ` (${vp.reason})` : ''}
                  </div>
                )}
                <div className="visit-time">{formatTime(vp.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Parties */}
      <div className="pending-section">
        <h2>Pending Parties ({pendingPartiesList.length})</h2>
        {pendingPartiesList.length === 0 ? (
          <div className="no-data-message">All planned parties visited</div>
        ) : (
          <div className="pending-chips">
            {pendingPartiesList.map((pp) => (
              <div key={pp.partyId} className="pending-chip">
                {pp.partyName}
                {pp.partyPhone && (
                  <span className="pending-chip-tooltip">{pp.partyPhone}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MrDetailPanel;
