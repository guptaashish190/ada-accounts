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
import { Call24Regular } from '@fluentui/react-icons';
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

const createRouteEndpointIcon = (bgColor) => new L.DivIcon({
  className: 'route-endpoint-marker',
  html:
    `<div style="background:${bgColor};width:12px;height:12px;border-radius:50%;` +
    'border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.35)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const startIcon = createRouteEndpointIcon('#16a34a');
const currentIcon = createRouteEndpointIcon('#2563eb');
const endIcon = createRouteEndpointIcon('#dc2626');

const orderIcon = new L.DivIcon({
  className: 'order-map-marker',
  html:
    '<button type="button" aria-label="Visited party" ' +
    'style="background:#107c10;width:10px;height:10px;border-radius:50%;' +
    'border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.35);cursor:pointer;' +
    'padding:0;display:block"></button>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
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

const MAX_TRACKING_GAP_MS = 5 * 60 * 1000;

const buildContinuousSegments = (points, maxGapMs = MAX_TRACKING_GAP_MS) => {
  if (!points || points.length === 0) return [];
  const sorted = [...points].sort(
    (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
  );
  const segments = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const gapMs = (next.timestamp || 0) - (prev.timestamp || 0);

    if (gapMs > maxGapMs) {
      segments.push(current);
      current = [next];
    } else {
      current.push(next);
    }
  }

  segments.push(current);
  return segments;
};

function MrDetailPanel({ data }) {
  const {
    mrUid,
    mrName,
    assignedRoute,
    companyId,
    selectedDate,
    isSupplyman = false,
  } = data;

  const [loading, setLoading] = useState(true);
  const [routeName, setRouteName] = useState('');
  const [plannedPartyIds, setPlannedPartyIds] = useState([]);
  const [registerEntries, setRegisterEntries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [partyNames, setPartyNames] = useState({});
  const [partyData, setPartyData] = useState({});
  const [locationPoints, setLocationPoints] = useState([]);
  const [trackingIsActive, setTrackingIsActive] = useState(false);
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

    const subscribeToLocation = () => {
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
            const lData = snap.data();
            setTrackingIsActive(!!lData.isActive);
            const pts = (lData.points || [])
              .filter((p) => p.lat && p.lng)
              .map((p) => ({
                lat: p.lat,
                lng: p.lng,
                timestamp: p.timestamp,
              }));
            setLocationPoints(pts);
          } else {
            setTrackingIsActive(false);
            setLocationPoints([]);
          }
        },
        (err) => {
          console.error('Error listening to location tracking:', err);
          setTrackingIsActive(false);
          setLocationPoints([]);
        },
      );
    };

    if (isSupplyman) {
      setRouteName('');
      setPlannedPartyIds([]);
      setRegisterEntries([]);
      setOrders([]);
      subscribeToLocation();
      initialLoadDone.current = true;
      setLoading(false);
      return () => {
        if (unsubLocationRef.current) unsubLocationRef.current();
      };
    }

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
    subscribeToLocation();

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
  }, [
    companyId,
    mrUid,
    selectedDate,
    assignedRoute,
    fetchPartyNames,
    isSupplyman,
  ]);

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
        isCallOrder: matchedOrder ? !!matchedOrder.isCallOrder : false,
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

  const sortedLocationPoints = [...locationPoints].sort(
    (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
  );
  const locationSegments = buildContinuousSegments(sortedLocationPoints);
  const polylineSegments = locationSegments
    .filter((segment) => segment.length > 1)
    .map((segment) => segment.map((p) => [p.lat, p.lng]));
  const allRoutePositions = sortedLocationPoints.map((p) => [p.lat, p.lng]);

  const totalDistanceKm = locationSegments.reduce((sum, segment) => {
    let segmentDistance = 0;
    for (let i = 1; i < segment.length; i += 1) {
      const prev = segment[i - 1];
      const point = segment[i];
      segmentDistance += haversineKm(prev.lat, prev.lng, point.lat, point.lng);
    }
    return sum + segmentDistance;
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

  const mapCenter = sortedLocationPoints.length > 0
    ? [sortedLocationPoints[0].lat, sortedLocationPoints[0].lng]
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
              <AutoFitBounds positions={allRoutePositions} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {polylineSegments.map((segmentPositions, index) => (
                <Polyline
                  // eslint-disable-next-line react/no-array-index-key
                  key={`route-segment-${index}`}
                  positions={segmentPositions}
                  color="#0078d4"
                  weight={3}
                  opacity={0.8}
                />
              ))}
              {sortedLocationPoints.length > 0 && (
                <Marker
                  position={[sortedLocationPoints[0].lat, sortedLocationPoints[0].lng]}
                  icon={startIcon}
                >
                  <Popup>
                    Start — {formatTime(sortedLocationPoints[0].timestamp)}
                  </Popup>
                </Marker>
              )}
              {sortedLocationPoints.length > 1 && (
                <Marker
                  position={[
                    sortedLocationPoints[sortedLocationPoints.length - 1].lat,
                    sortedLocationPoints[sortedLocationPoints.length - 1].lng,
                  ]}
                  icon={trackingIsActive ? currentIcon : endIcon}
                >
                  <Popup>
                    {trackingIsActive ? 'Current' : 'End'} —{' '}
                    {formatTime(
                      sortedLocationPoints[sortedLocationPoints.length - 1].timestamp,
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
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
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
      {!isSupplyman && (
        <>
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
                  let photoPlaceholder = 'No photo';
                  if (vp.status !== 'Order' && vp.reason === "DIDN'T REACH") {
                    photoPlaceholder = "Didn't reach";
                  }
                  const showCallIcon =
                    vp.status === 'Order' && vp.isCallOrder;
                  return (
                    <div
                      key={`${vp.partyId}-${i}`}
                      className={`visited-card ${
                        vp.status === 'Order' ? 'order-placed' : 'no-order'
                      }`}
                    >
                      {/* Visit selfie thumbnail (call orders use icon only) */}
                      {showCallIcon ? (
                        <div
                          className="visited-card__photo visited-card__photo--call"
                          aria-label="Call order"
                        >
                          <Call24Regular />
                        </div>
                      ) : vp.photoUrl ? (
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
                          <div
                            className={`visit-type-badge ${
                              vp.isCallOrder ? 'call' : 'physical'
                            }`}
                          >
                            {vp.isCallOrder
                              ? '\u260E Call order'
                              : '\u{1F6B6} Physical visit'}
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
        </>
      )}
    </div>
  );
}

export default MrDetailPanel;
