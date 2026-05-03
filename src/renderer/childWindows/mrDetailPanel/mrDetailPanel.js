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
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import globalUtils from '../../services/globalUtils';
import './style.css';

// Fix leaflet default marker icons in webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const endpointIcon = new L.Icon({
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const orderIcon = new L.DivIcon({
  className: 'order-map-marker',
  html:
    '<div style="background:#107c10;width:14px;height:14px;border-radius:50%;' +
    'border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function AutoFitBounds({ positions }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (!hasFit.current && positions.length > 0) {
      map.fitBounds(positions, { padding: [30, 30] });
      hasFit.current = true;
    }
  }, [positions.length]);
  return null;
}

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

function MrDetailPanel({ data }) {
  const { mrUid, mrName, assignedRoute, companyId, selectedDate } = data;

  const [loading, setLoading] = useState(true);
  const [routeName, setRouteName] = useState('');
  const [plannedPartyIds, setPlannedPartyIds] = useState([]);
  const [registerEntries, setRegisterEntries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [partyNames, setPartyNames] = useState({});
  const [partyData, setPartyData] = useState({});
  const [locationPoints, setLocationPoints] = useState([]);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const partyNamesCacheRef = useRef({});
  const partyDataCacheRef = useRef({});
  const unsubRegisterRef = useRef(null);
  const unsubOrdersRef = useRef(null);
  const unsubLocationRef = useRef(null);
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

    // 4. Real-time listener: location tracking doc for this MR today
    const locationDocId = `${selectedDate}_${mrUid}`;
    const locationDocRef = getCompanyDoc(
      companyId,
      DB_NAMES.LOCATION_TRACKING,
      locationDocId,
    );
    unsubLocationRef.current = onSnapshot(
      locationDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const pts = (data.points || [])
            .filter((p) => p.lat && p.lng)
            .map((p) => ({
              lat: p.lat,
              lng: p.lng,
              timestamp: p.timestamp,
            }));
          setLocationPoints(pts);
        } else {
          setLocationPoints([]);
        }
      },
      (err) => {
        console.error('Error listening to location tracking:', err);
        setLocationPoints([]);
      },
    );

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
      if (unsubLocationRef.current) unsubLocationRef.current();
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

      // Derive photo URL: order selfie takes priority, then register visitImage.
      const photoUrl = (() => {
        if (
          matchedOrder &&
          Array.isArray(matchedOrder.mrImages) &&
          matchedOrder.mrImages.length > 0
        ) {
          return matchedOrder.mrImages[0];
        }
        return e.visitImage || '';
      })();

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
        photoUrl,
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

  const polylinePositions = locationPoints.map((p) => [p.lat, p.lng]);

  const totalDistanceKm = locationPoints.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const prev = locationPoints[i - 1];
    return sum + haversineKm(prev.lat, prev.lng, p.lat, p.lng);
  }, 0);

  const orderMarkers = registerEntries
    .filter((e) => e.status === 'Order' && e.location)
    .map((e) => ({
      lat: e.location.latitude ?? e.location._lat,
      lng: e.location.longitude ?? e.location._long,
      timestamp: e.timestamp,
      partyId: e.partyId || '',
    }))
    .filter((m) => m.lat && m.lng);

  const mapCenter = locationPoints.length > 0
    ? [locationPoints[0].lat, locationPoints[0].lng]
    : [20.5937, 78.9629];

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

      {/* Map */}
      <div className="mr-detail-map-section">
        {locationPoints.length === 0 ? (
          <div className="mr-detail-map-empty">
            No location data available for this date.
          </div>
        ) : (
          <div className="mr-detail-map">
            <MapContainer
              center={mapCenter}
              zoom={14}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom
            >
              <AutoFitBounds positions={polylinePositions} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline
                positions={polylinePositions}
                color="#0078d4"
                weight={3}
                opacity={0.8}
              />
              {locationPoints.length > 0 && (
                <Marker
                  position={[locationPoints[0].lat, locationPoints[0].lng]}
                  icon={endpointIcon}
                >
                  <Popup>
                    Start — {formatTime(locationPoints[0].timestamp)}
                  </Popup>
                </Marker>
              )}
              {locationPoints.length > 1 && (
                <Marker
                  position={[
                    locationPoints[locationPoints.length - 1].lat,
                    locationPoints[locationPoints.length - 1].lng,
                  ]}
                  icon={endpointIcon}
                >
                  <Popup>
                    Latest —{' '}
                    {formatTime(
                      locationPoints[locationPoints.length - 1].timestamp,
                    )}
                  </Popup>
                </Marker>
              )}
              {orderMarkers.map((om, idx) => (
                <Marker
                  key={`order-${idx}`}
                  position={[om.lat, om.lng]}
                  icon={orderIcon}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]}>
                    {partyNames[om.partyId] || om.partyId}{' '}
                    ({formatTime(om.timestamp)})
                  </Tooltip>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
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
        <div className="mr-stat-card stat-distance">
          <div className="stat-label">Distance</div>
          <div className="stat-value">{totalDistanceKm.toFixed(1)} km</div>
        </div>
      </div>

      {/* Visited Parties */}
      <div className="visited-section">
        <h2>Visited Parties ({visitedParties.length})</h2>
        {visitedParties.length === 0 ? (
          <div className="no-data-message">No parties visited yet</div>
        ) : (
          <div className="visited-cards">
            {visitedParties.map((vp, i) => {
              const photoPlaceholder =
                vp.status !== 'Order' && vp.reason === "DIDN'T REACH"
                  ? "Didn't reach"
                  : 'No photo';
              return (
                <div
                  key={`${vp.partyId}-${i}`}
                  className={`visited-card ${
                    vp.status === 'Order' ? 'order-placed' : 'no-order'
                  }`}
                >
                  {/* Visit selfie thumbnail */}
                  {vp.photoUrl ? (
                    <img
                      className="visited-card__photo"
                      src={vp.photoUrl}
                      alt="Visit selfie"
                      onClick={() => setLightboxUrl(vp.photoUrl)}
                    />
                  ) : (
                    <div className="visited-card__photo visited-card__photo--empty">
                      {photoPlaceholder}
                    </div>
                  )}

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
              );
            })}
          </div>
        )}
      </div>

      {/* Selfie lightbox */}
      {lightboxUrl && (
        <div
          className="visited-photo-lightbox"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Visit selfie full" />
        </div>
      )}

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
