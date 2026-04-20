import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Spinner,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { query, where, getDocs, documentId, onSnapshot } from 'firebase/firestore';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCompanyDoc, getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';

// Fix leaflet default marker icons in webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const startIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const orderIcon = new L.DivIcon({
  className: 'order-map-marker',
  html: '<div style="background:#107c10;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function AutoFitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [30, 30] });
    }
  }, [positions.length]);
  return null;
}

function LocationDialog({
  open,
  onClose,
  userId,
  userName,
  companyId,
  selectedDate,
}) {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState([]);
  const [orderMarkers, setOrderMarkers] = useState([]);
  const [partyNames, setPartyNames] = useState({});
  const [noData, setNoData] = useState(false);
  const partyNamesCacheRef = useRef({});

  const fetchPartyNames = async (partyIds) => {
    const validIds = partyIds.filter((id) => id);
    if (validIds.length === 0) return;
    await Promise.all(
      validIds.map(async (id) => {
        const snap = await getDocs(
          query(
            getCompanyCollection(companyId, DB_NAMES.PARTIES),
            where(documentId(), 'in', [id]),
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
    if (!open || !userId) return;

    setLoading(true);
    setNoData(false);

    const docId = `${selectedDate}_${userId}`;
    const docRef = getCompanyDoc(
      companyId,
      DB_NAMES.LOCATION_TRACKING,
      docId,
    );

    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const pts = (data.points || [])
          .filter((p) => p.lat && p.lng)
          .map((p) => ({
            lat: p.lat,
            lng: p.lng,
            timestamp: p.timestamp,
          }));

        if (pts.length === 0) {
          setNoData(true);
          setPoints([]);
        } else {
          setNoData(false);
          setPoints(pts);
        }
      } else {
        setNoData(true);
        setPoints([]);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error listening to location:', err);
      setNoData(true);
      setLoading(false);
    });

    const d = new Date(selectedDate);
    const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endMs = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();

    const registerQuery = query(
      getCompanyCollection(companyId, DB_NAMES.ORDER_REGISTER),
      where('userId', '==', userId),
      where('timestamp', '>=', startMs),
      where('timestamp', '<', endMs),
    );

    const unsubRegister = onSnapshot(registerQuery, (snap) => {
      const markers = snap.docs
        .map((d) => d.data())
        .filter((e) => e.status === 'Order' && e.location)
        .map((e) => ({
          lat: e.location.latitude ?? e.location._lat,
          lng: e.location.longitude ?? e.location._long,
          timestamp: e.timestamp,
          partyId: e.partyId || '',
        }))
        .filter((m) => m.lat && m.lng);
      setOrderMarkers(markers);

      const pIds = markers.map((m) => m.partyId).filter(Boolean);
      if (pIds.length > 0) fetchPartyNames(pIds);
    });

    return () => {
      unsub();
      unsubRegister();
    };
  }, [open, userId, selectedDate, companyId]);

  const polylinePositions = points.map((p) => [p.lat, p.lng]);
  const center =
    points.length > 0
      ? [points[0].lat, points[0].lng]
      : [20.5937, 78.9629];

  // Haversine formula for distance between two lat/lng points in km
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

  const totalDistanceKm = points.reduce((sum, p, i) => {
    if (i === 0) return 0;
    return sum + haversineKm(points[i - 1].lat, points[i - 1].lng, p.lat, p.lng);
  }, 0);

  const formatTime = (ms) => {
    if (!ms) return '';
    return new Date(ms).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(e, data) => !data.open && onClose()}>
      <DialogSurface style={{ maxWidth: '750px', width: '90vw' }}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={onClose}
              />
            }
          >
            Location — {userName} ({selectedDate})
          </DialogTitle>
          <DialogContent>
            {loading ? (
              <div className="location-loading">
                <Spinner size="large" label="Loading location data..." />
              </div>
            ) : noData ? (
              <div className="location-loading">
                No location data available for this date.
              </div>
            ) : (
              <>
                <div className="location-stats-bar">
                  <span>
                    <strong>Distance:</strong>{' '}
                    {totalDistanceKm.toFixed(1)} km
                  </span>
                  {points.length > 0 && (
                    <span>
                      <strong>Start:</strong> {formatTime(points[0].timestamp)}
                    </span>
                  )}
                  {points.length > 1 && (
                    <span>
                      <strong>Latest:</strong>{' '}
                      {formatTime(points[points.length - 1].timestamp)}
                    </span>
                  )}
                </div>
                <div className="location-dialog-map">
                  <MapContainer
                    center={center}
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
                    {points.length > 0 && (
                      <Marker
                        position={[points[0].lat, points[0].lng]}
                        icon={startIcon}
                      >
                        <Popup>
                          Start — {formatTime(points[0].timestamp)}
                        </Popup>
                      </Marker>
                    )}
                    {points.length > 1 && (
                      <Marker
                        position={[
                          points[points.length - 1].lat,
                          points[points.length - 1].lng,
                        ]}
                        icon={startIcon}
                      >
                        <Popup>
                          Latest —{' '}
                          {formatTime(points[points.length - 1].timestamp)}
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
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export default LocationDialog;
