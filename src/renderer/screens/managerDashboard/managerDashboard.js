import React, { useState, useEffect, useMemo } from 'react';
import {
  Spinner,
  Button,
  Text,
  Card,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Dropdown,
  Option,
  Input,
  Label,
} from '@fluentui/react-components';
import {
  Edit16Regular,
  Delete16Regular,
  Dismiss16Regular,
} from '@fluentui/react-icons';
import {
  query,
  where,
  getDocs,
  documentId,
  onSnapshot,
  doc,
  limit,
  writeBatch,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/companyContext';
import { useAuthUser } from '../../contexts/allUsersContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import { firebaseDB } from '../../firebaseInit';
import globalUtils, { useDebounce } from '../../services/globalUtils';
import constants from '../../constants';
import './style.css';

const MR_JOB_ID = constants.firebaseIds.JOBS.MR;
const SUPPLY_JOB_ID = constants.firebaseIds.JOBS.SUPPLY;

const formatTime = (ms) => {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

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

const computeTotalKm = (points) => {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    if (!p1 || !p2 || !p1.lat || !p1.lng || !p2.lat || !p2.lng) continue;
    total += haversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
  }
  return total;
};

function getSelectedMrLabel(mrUsers, uid) {
  if (!uid) return '';
  const mr = mrUsers.find((u) => u.uid === uid);
  if (!mr) return uid;
  return mr.username || mr.email || mr.uid;
}

function getSelectedRouteLabel(routes, routeId) {
  if (!routeId) return '';
  const route = routes.find((r) => r.routeId === routeId);
  if (!route) return routeId;
  return route.routeName || route.routeId;
}

function AssignMrDialog({
  open,
  onClose,
  routeName,
  mrUsers: mrList,
  assignRouteId,
  selectedMrUid,
  onSelectMr,
  onSave,
  saving,
}) {
  return (
    <Dialog open={open} onOpenChange={(e, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 420 }}>
        <DialogBody>
          <DialogTitle>Assign MR — {routeName}</DialogTitle>
          <DialogContent>
            <div style={{ marginTop: 12 }}>
              <Dropdown
                placeholder="Select MR"
                value={getSelectedMrLabel(mrList, selectedMrUid)}
                selectedOptions={selectedMrUid ? [selectedMrUid] : []}
                onOptionSelect={(e, d) => onSelectMr(d.optionValue || '')}
                style={{ width: '100%' }}
              >
                {mrList.map((mr) => {
                  const name = mr.username || mr.email || mr.uid;
                  const route = mr.assignedRoute || '';
                  const suffix =
                    route && route !== assignRouteId
                      ? ' (on another route)'
                      : '';
                  return (
                    <Option key={mr.uid} value={mr.uid}>
                      {name}
                      {suffix}
                    </Option>
                  );
                })}
              </Dropdown>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function AssignRouteDialog({
  open,
  onClose,
  mrName,
  routeOptions,
  selectedRouteId,
  onSelectRoute,
  onSave,
  saving,
}) {
  return (
    <Dialog open={open} onOpenChange={(e, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 420 }}>
        <DialogBody>
          <DialogTitle>Assign Route — {mrName}</DialogTitle>
          <DialogContent>
            <div style={{ marginTop: 12 }}>
              <Dropdown
                placeholder="Select route"
                value={getSelectedRouteLabel(routeOptions, selectedRouteId)}
                selectedOptions={selectedRouteId ? [selectedRouteId] : []}
                onOptionSelect={(e, d) => onSelectRoute(d.optionValue || '')}
                style={{ width: '100%' }}
              >
                <Option value="">No route</Option>
                {routeOptions.map((route) => (
                  <Option key={route.routeId} value={route.routeId}>
                    {route.routeName}
                  </Option>
                ))}
              </Dropdown>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function getBagQty(bags, type) {
  const bag = (bags || []).find(
    (b) => (b.bagType || '').toLowerCase() === type.toLowerCase(),
  );
  return bag ? bag.quantity || 0 : 0;
}

function EditOrderDialog({
  open,
  onClose,
  order,
  partyNames: pNames,
  mrUsers: mrList,
  userMap: uMap,
  companyId,
  onSaved,
}) {
  const [partyId, setPartyId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [partyResults, setPartyResults] = useState([]);
  const debouncedPartySearch = useDebounce(partySearch, 500);
  const [orderAmount, setOrderAmount] = useState(0);
  const [polybags, setPolybags] = useState(0);
  const [cases, setCases] = useState(0);
  const [packets, setPackets] = useState(0);
  const [mrId, setMrId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setPartyId(order.partyId || '');
      setPartySearch('');
      setPartyResults([]);
      setOrderAmount(order.orderAmount || 0);
      setPolybags(getBagQty(order.bags, 'polybags'));
      setCases(getBagQty(order.bags, 'cases'));
      setPackets(getBagQty(order.bags, 'packets'));
      setMrId(order.mrId || '');
    }
  }, [order]);

  useEffect(() => {
    if (!debouncedPartySearch || debouncedPartySearch.length < 3) {
      setPartyResults([]);
      return;
    }
    const fetchParties = async () => {
      const partiesRef = getCompanyCollection(companyId, DB_NAMES.PARTIES);
      const q = query(
        partiesRef,
        where('name', '>=', debouncedPartySearch.toUpperCase()),
        limit(5),
      );
      try {
        const snap = await getDocs(q);
        const results = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
        }));
        setPartyResults(results);
      } catch (err) {
        console.error('Party search error:', err);
      }
    };
    fetchParties();
  }, [debouncedPartySearch, companyId]);

  if (!order) return null;

  const orderRef = getCompanyDoc(companyId, DB_NAMES.ORDERS, order.id);

  const handleSave = async () => {
    setSaving(true);
    try {
      const bags = [];
      if (polybags > 0) bags.push({ bagType: 'polybags', quantity: polybags });
      if (cases > 0) bags.push({ bagType: 'cases', quantity: cases });
      if (packets > 0) bags.push({ bagType: 'packets', quantity: packets });
      await updateDoc(orderRef, {
        partyId,
        orderAmount: Number(orderAmount) || 0,
        bags,
        mrId,
      });
      onClose();
    } catch (err) {
      console.error('Error saving order:', err);
    }
    setSaving(false);
  };

  const handleCancel = async () => {
    setSaving(true);
    try {
      await updateDoc(orderRef, { orderStatus: 'Cancelled' });
      onClose();
    } catch (err) {
      console.error('Error cancelling order:', err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteDoc(orderRef);
      onClose();
    } catch (err) {
      console.error('Error deleting order:', err);
    }
    setSaving(false);
  };

  const selectedPartyName = pNames[partyId] || partyId || '';

  return (
    <Dialog open={open} onOpenChange={(e, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 500 }}>
        <DialogBody>
          <DialogTitle>Edit Order</DialogTitle>
          <DialogContent>
            <div className="edit-order-form">
              <div className="edit-order-field">
                <Label>Party</Label>
                <div className="party-selected-label">
                  Current: <strong>{selectedPartyName}</strong>
                </div>
                <Input
                  placeholder="Search party by name..."
                  value={partySearch}
                  onChange={(e, d) => setPartySearch(d.value)}
                  style={{ width: '100%' }}
                />
                {partyResults.length > 0 && (
                  <div className="party-search-results">
                    {partyResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`party-search-item${
                          p.id === partyId ? ' selected' : ''
                        }`}
                        onClick={() => {
                          setPartyId(p.id);
                          setPartySearch('');
                          setPartyResults([]);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="edit-order-field">
                <Label>Order Amount</Label>
                <Input
                  type="number"
                  value={String(orderAmount)}
                  onChange={(e, d) => setOrderAmount(d.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="edit-order-field">
                <Label>Goods</Label>
                <div className="edit-order-bags-row">
                  <div>
                    <Label size="small">Polybags</Label>
                    <Input
                      type="number"
                      size="small"
                      value={String(polybags)}
                      onChange={(e, d) => setPolybags(Number(d.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label size="small">Cases</Label>
                    <Input
                      type="number"
                      size="small"
                      value={String(cases)}
                      onChange={(e, d) => setCases(Number(d.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label size="small">Packets</Label>
                    <Input
                      type="number"
                      size="small"
                      value={String(packets)}
                      onChange={(e, d) => setPackets(Number(d.value) || 0)}
                    />
                  </div>
                </div>
              </div>
              <div className="edit-order-field">
                <Label>MR</Label>
                <Dropdown
                  placeholder="Select MR"
                  value={getSelectedMrLabel(mrList, mrId)}
                  selectedOptions={mrId ? [mrId] : []}
                  onOptionSelect={(e, d) => setMrId(d.optionValue || '')}
                  style={{ width: '100%' }}
                >
                  {mrList.map((mr) => (
                    <Option key={mr.uid} value={mr.uid}>
                      {mr.username || mr.email || mr.uid}
                    </Option>
                  ))}
                </Dropdown>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="subtle"
              icon={<Delete16Regular />}
              disabled={saving}
              onClick={handleDelete}
              style={{ color: '#c50f1f', marginRight: 'auto' }}
            >
              Delete
            </Button>
            <Button
              appearance="subtle"
              icon={<Dismiss16Regular />}
              disabled={saving}
              onClick={handleCancel}
              style={{ color: '#c50f1f' }}
            >
              Cancel Order
            </Button>
            <Button appearance="secondary" onClick={onClose} disabled={saving}>
              Close
            </Button>
            <Button appearance="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ManagerDashboard() {
  const { currentCompanyId } = useCompany();
  const { allUsers } = useAuthUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0],
  );

  const [mrRows, setMrRows] = useState([]);
  const [unassignedRoutes, setUnassignedRoutes] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalOrders: 0,
    totalSales: 0,
    totalVisits: 0,
    pipelineCount: 0,
  });

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignRouteId, setAssignRouteId] = useState(null);
  const [assignRouteName, setAssignRouteName] = useState('');
  const [assignSelectedMrUid, setAssignSelectedMrUid] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignRouteDialogOpen, setAssignRouteDialogOpen] = useState(false);
  const [assignRouteForMr, setAssignRouteForMr] = useState(null);
  const [assignSelectedRouteId, setAssignSelectedRouteId] = useState('');
  const [assignRouteSaving, setAssignRouteSaving] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);

  const [orderRows, setOrderRows] = useState([]);
  const [partyNames, setPartyNames] = useState({});
  const partyNamesCacheRef = React.useRef({});

  const [routesDocs, setRoutesDocs] = useState(null);
  const [registerDocs, setRegisterDocs] = useState(null);
  const [ordersDocs, setOrdersDocs] = useState(null);
  const [attendanceDocs, setAttendanceDocs] = useState(null);
  const [supplyReportsDocs, setSupplyReportsDocs] = useState(null);
  const [locationDocs, setLocationDocs] = useState(null);

  const [supplyRows, setSupplyRows] = useState([]);

  // Only include users belonging to the currently selected company.
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

  const supplyUsers = useMemo(
    () => companyUsers.filter((u) => u.jobs && u.jobs.includes(SUPPLY_JOB_ID)),
    [companyUsers],
  );

  const userMap = useMemo(() => {
    const map = {};
    companyUsers.forEach((u) => {
      map[u.uid] = u.username || u.email || u.uid;
    });
    return map;
  }, [companyUsers]);

  const routeOptions = useMemo(() => {
    if (!routesDocs) return [];
    const dayIndex = getWeekdayIndex(selectedDate);
    const options = routesDocs
      .map((d) => {
        const data = d.data();
        const routeArray = data.route || [];
        const todayRoute = routeArray[dayIndex];
        const todayParties =
          todayRoute && todayRoute.parties ? todayRoute.parties : [];
        return {
          routeId: d.id,
          routeName: data.name || d.id,
          plannedParties: todayParties.length,
        };
      })
      .filter((route) => route.plannedParties > 0)
      .sort((a, b) => a.routeName.localeCompare(b.routeName));
    return options;
  }, [routesDocs, selectedDate]);

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

  const getDateRange = (dateStr) => {
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
    };
  };

  function getWeekdayIndex(dateStr) {
    const d = new Date(dateStr);
    const jsDay = d.getDay(); // 0=Sunday
    return (jsDay + 6) % 7; // 0=Monday...6=Sunday
  }

  // Set up real-time Firestore listeners; re-subscribe when company or date changes
  useEffect(() => {
    if (!currentCompanyId) return;

    const { startMs, endMs } = getDateRange(selectedDate);

    setRoutesDocs(null);
    setRegisterDocs(null);
    setOrdersDocs(null);
    setAttendanceDocs(null);
    setSupplyReportsDocs(null);
    setLocationDocs(null);

    const unsubRoutes = onSnapshot(
      getCompanyCollection(currentCompanyId, DB_NAMES.MR_ROUTES),
      (snap) => setRoutesDocs(snap.docs),
    );

    const unsubRegister = onSnapshot(
      query(
        getCompanyCollection(currentCompanyId, DB_NAMES.ORDER_REGISTER),
        where('timestamp', '>=', startMs),
        where('timestamp', '<', endMs),
      ),
      (snap) => setRegisterDocs(snap.docs),
    );

    const unsubOrders = onSnapshot(
      query(
        getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS),
        where('creationTime', '>=', startMs),
        where('creationTime', '<', endMs),
      ),
      (snap) => setOrdersDocs(snap.docs),
    );

    const unsubAttendance = onSnapshot(
      query(
        getCompanyCollection(currentCompanyId, DB_NAMES.ATTENDANCE),
        where('isActive', '==', true),
      ),
      (snap) => setAttendanceDocs(snap.docs),
    );

    const unsubSupplyReports = onSnapshot(
      query(
        getCompanyCollection(currentCompanyId, DB_NAMES.SUPPLY_REPORTS),
        where('timestamp', '>=', startMs),
        where('timestamp', '<', endMs),
      ),
      (snap) => setSupplyReportsDocs(snap.docs),
    );

    const unsubLocation = onSnapshot(
      query(
        getCompanyCollection(currentCompanyId, DB_NAMES.LOCATION_TRACKING),
        where('date', '==', selectedDate),
      ),
      (snap) => setLocationDocs(snap.docs),
    );

    return () => {
      unsubRoutes();
      unsubRegister();
      unsubOrders();
      unsubAttendance();
      unsubSupplyReports();
      unsubLocation();
    };
  }, [currentCompanyId, selectedDate]);

  // Recompute all derived state whenever any snapshot or users update
  useEffect(() => {
    if (
      !routesDocs ||
      !registerDocs ||
      !ordersDocs ||
      !attendanceDocs ||
      !supplyReportsDocs ||
      !locationDocs ||
      !allUsers
    ) {
      setLoading(true);
      return;
    }

    const dayIndex = getWeekdayIndex(selectedDate);
    // Build route map: routeId -> { name, todayParties }
    const routeMap = {};
    routesDocs.forEach((d) => {
      const data = d.data();
      const routeArray = data.route || [];
      const todayRoute = routeArray[dayIndex];
      console.log("todayRoute: ", todayRoute);
      const todayParties =
        todayRoute && todayRoute.parties ? todayRoute.parties : [];
      routeMap[d.id] = { name: data.name || d.id, todayParties };
    });

    // Build register entries by userId
    const registerByUser = {};
    registerDocs.forEach((d) => {
      const data = d.data();
      const uid = data.userId || '';
      if (!registerByUser[uid]) registerByUser[uid] = [];
      registerByUser[uid].push(data);
    });

    // Build orders by userId (createdById)
    const ordersByUser = {};
    let pipelineCount = 0;
    ordersDocs.forEach((d) => {
      const data = d.data();
      const uid = data.createdById || '';
      if (!ordersByUser[uid]) ordersByUser[uid] = [];
      ordersByUser[uid].push(data);
      if (data.flowCompleted === false) pipelineCount++;
    });
    // Dashboard summary should represent all day orders, irrespective of route.
    const totalOrders = ordersDocs.length;
    const totalSales = ordersDocs.reduce(
      (sum, d) => sum + (d.data().orderAmount || 0),
      0,
    );

    // Currently-active (online) employee UIDs from attendance. Used by both
    // the MR and Supply Performance tables.
    const onlineEmployeeUids = new Set();
    attendanceDocs.forEach((d) => {
      const data = d.data();
      if (data.employeeId) onlineEmployeeUids.add(data.employeeId);
    });

    // Distance travelled per user from location tracking
    const distanceByUser = {};
    locationDocs.forEach((d) => {
      const data = d.data();
      const uid = data.userId || '';
      if (!uid) return;
      distanceByUser[uid] = computeTotalKm(data.points || []);
    });

    // Build a map: routeId -> MR user (one MR per route)
    const routeToMr = {};
    mrUsers.forEach((mr) => {
      if (mr.assignedRoute) {
        routeToMr[mr.assignedRoute] = mr;
      }
    });

    // Build MR-first rows for the primary table.
    const rows = mrUsers.map((mr) => {
      const mrUid = mr.uid;
      const assignedRouteId = mr.assignedRoute || '';
      const assignedRoute = assignedRouteId ? routeMap[assignedRouteId] : null;

      const entries = registerByUser[mrUid] || [];
      // Count distinct parties visited — multiple orders for the same party
      // in a single day count as one visit.
      const visitsDone = new Set(
        entries.map((e) => e.partyId).filter(Boolean),
      ).size;

      const mrOrders = ordersByUser[mrUid] || [];
      const orderCount = mrOrders.length;
      const salesTotal = mrOrders.reduce((sum, o) => sum + (o.orderAmount || 0), 0);

      return {
        mrUid,
        mrName: mr.username || mr.email || mr.uid,
        isOnline: onlineEmployeeUids.has(mrUid),
        orderCount,
        salesTotal,
        visitsDone,
        plannedParties: assignedRoute ? assignedRoute.todayParties.length : 0,
        distanceKm: distanceByUser[mrUid] || 0,
        assignedRouteId,
        assignedRouteName: assignedRoute ? assignedRoute.name : '',
      };
    });

    // Keep summary "visits done" behavior route-wise as before.
    const totalVisits = Object.entries(routeMap)
      .filter(([, route]) => route.todayParties.length > 0)
      .reduce((sum, [routeId]) => {
        const mr = routeToMr[routeId];
        if (!mr) return sum;
        const entries = registerByUser[mr.uid] || [];
        const visitsDone = new Set(entries.map((e) => e.partyId).filter(Boolean))
          .size;
        return sum + visitsDone;
      }, 0);

    rows.sort((a, b) => {
      const aRank = a.isOnline ? 0 : 1;
      const bRank = b.isOnline ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return a.mrName.localeCompare(b.mrName);
    });

    const scheduledRoutes = Object.entries(routeMap).filter(
      ([, route]) => route.todayParties.length > 0,
    );
    const missingAssignmentRows = scheduledRoutes
      .filter(([routeId]) => !routeToMr[routeId])
      .map(([routeId, route]) => ({
        routeId,
        routeName: route.name,
        plannedParties: route.todayParties.length,
      }))
      .sort((a, b) => a.routeName.localeCompare(b.routeName));

    setMrRows(rows);
    setUnassignedRoutes(missingAssignmentRows);
    setSummaryStats({ totalOrders, totalSales, totalVisits, pipelineCount });

    // Build order rows for the orders table
    const oRows = ordersDocs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        partyId: data.partyId || '',
        orderAmount: data.orderAmount || 0,
        mrId: data.mrId || '',
        orderStatus: data.orderStatus || '',
        creationTime: data.creationTime || 0,
        bags: data.bags || [],
        flow: data.flow || [],
      };
    });
    oRows.sort((a, b) => b.creationTime - a.creationTime);
    setOrderRows(oRows);

    const pIds = oRows.map((o) => o.partyId).filter(Boolean);
    if (pIds.length > 0) fetchPartyNames(pIds);

    // Build supply rows
    const srBySupplyman = {};
    supplyReportsDocs.forEach((d) => {
      const data = d.data();
      const uid = data.supplymanId || '';
      if (!srBySupplyman[uid]) srBySupplyman[uid] = [];
      srBySupplyman[uid].push({ id: d.id, ...data });
    });

    const supplyUidSet = new Set(supplyUsers.map((su) => su.uid));
    const allSupplyUids = new Set([
      ...supplyUidSet,
      ...Object.keys(srBySupplyman).filter(Boolean),
    ]);

    const SR_STATUS = constants.firebase.supplyReportStatus;
    const buildSupplyRow = (uid) => {
      const user = companyUsers.find((u) => u.uid === uid);
      const name = user ? user.username || user.email || uid : uid;
      const isOnline = onlineEmployeeUids.has(uid);
      const reports = srBySupplyman[uid] || [];
      const totalSRs = reports.length;
      // "Active" = anything that isn't yet delivered / completed / cancelled.
      // This covers in-flight SRs regardless of whether they've been dispatched
      // or are still waiting to be verified (status: TOACCOUNTS).
      const activeSR =
        reports.find(
          (r) =>
            r.status !== SR_STATUS.DELIVERED &&
            r.status !== SR_STATUS.COMPLETED &&
            r.status !== SR_STATUS.CANCELLED,
        ) || null;
      const completedSRs = reports.filter(
        (r) =>
          r.status === SR_STATUS.COMPLETED || r.status === SR_STATUS.DELIVERED,
      ).length;
      const dispatchTime = activeSR ? activeSR.dispatchTimestamp : null;
      const activeBillCount = activeSR ? (activeSR.orders || []).length : 0;

      return {
        uid,
        name,
        isOnline,
        activeSR,
        activeSRLabel: activeSR
          ? `${activeSR.receiptNumber} (${activeBillCount} bills)`
          : '—',
        totalSRs,
        completedSRs,
        dispatchTime,
        distanceKm: distanceByUser[uid] || 0,
      };
    };

    const sRows = [...allSupplyUids].map(buildSupplyRow);

    sRows.sort((a, b) => {
      const aRank = a.isOnline ? 0 : 1;
      const bRank = b.isOnline ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return a.name.localeCompare(b.name);
    });

    setSupplyRows(sRows);

    setLoading(false);
  }, [
    routesDocs,
    registerDocs,
    ordersDocs,
    attendanceDocs,
    supplyReportsDocs,
    locationDocs,
    allUsers,
    mrUsers,
    supplyUsers,
    selectedDate,
  ]);

  const handleRouteClick = (row) => {
    if (!row.mrUid) return;
    window.electron.ipcRenderer.sendMessage('new-window', {
      type: constants.windowConstants.MR_DETAIL,
      data: {
        mrUid: row.mrUid,
        mrName: row.mrName,
        assignedRoute: row.assignedRouteId || '',
        companyId: currentCompanyId,
        selectedDate,
      },
    });
  };

  const handleOpenAssignDialog = (row) => {
    setAssignRouteId(row.routeId);
    setAssignRouteName(row.routeName);
    setAssignSelectedMrUid(row.mrUid || '');
    setAssignDialogOpen(true);
  };

  const handleOpenAssignRouteDialog = (e, row) => {
    e.stopPropagation();
    setAssignRouteForMr({
      mrUid: row.mrUid,
      mrName: row.mrName,
    });
    setAssignSelectedRouteId(row.assignedRouteId || '');
    setAssignRouteDialogOpen(true);
  };

  const handleAssignSave = async () => {
    if (!assignRouteId) return;
    setAssignSaving(true);
    console.log('assignRouteId', assignRouteId);
    console.log('assignSelectedMrUid', assignSelectedMrUid);

    try {
      const batch = writeBatch(firebaseDB);
      const currentMrs = mrUsers.filter(
        (u) => u.assignedRoute === assignRouteId,
      );
      currentMrs.forEach((mr) => {
        if (mr.uid !== assignSelectedMrUid) {
          batch.update(doc(firebaseDB, 'users', mr.uid), {
            assignedRoute: '',
          });
        }
      });
      if (assignSelectedMrUid) {
        batch.update(doc(firebaseDB, 'users', assignSelectedMrUid), {
          assignedRoute: assignRouteId,
        });
      }
      await batch.commit();
      setAssignDialogOpen(false);
    } catch (err) {
      console.error('Error assigning MR:', err);
    }
    setAssignSaving(false);
  };

  const handleAssignRouteSave = async () => {
    if (!assignRouteForMr?.mrUid) return;
    setAssignRouteSaving(true);
    try {
      const targetMrUid = assignRouteForMr.mrUid;
      const selectedRouteId = assignSelectedRouteId || '';
      const batch = writeBatch(firebaseDB);

      if (selectedRouteId) {
        const currentHolder = mrUsers.find(
          (u) => u.assignedRoute === selectedRouteId && u.uid !== targetMrUid,
        );
        if (currentHolder) {
          batch.update(doc(firebaseDB, 'users', currentHolder.uid), {
            assignedRoute: '',
          });
        }
      }

      batch.update(doc(firebaseDB, 'users', targetMrUid), {
        assignedRoute: selectedRouteId,
      });

      await batch.commit();
      setAssignRouteDialogOpen(false);
      setAssignRouteForMr(null);
    } catch (err) {
      console.error('Error assigning route to MR:', err);
    }
    setAssignRouteSaving(false);
  };

  const handleOpenEditOrder = (e, order) => {
    e.stopPropagation();
    setEditOrder(order);
    setEditDialogOpen(true);
  };

  const handleActiveSRClick = (e, row) => {
    e.stopPropagation();
    if (!row.activeSR) return;
    navigate('/viewSupplyReport', {
      state: { prefillSupplyReport: row.activeSR },
    });
  };

  const handleSupplyRowClick = (row) => {
    if (!row.uid) return;
    window.electron.ipcRenderer.sendMessage('new-window', {
      type: constants.windowConstants.MR_DETAIL,
      data: {
        mrUid: row.uid,
        mrName: row.name,
        assignedRoute: '',
        companyId: currentCompanyId,
        selectedDate,
        isSupplyman: true,
      },
    });
  };

  if (loading) {
    return (
      <div className="manager-dashboard">
        <div className="manager-dashboard-loading">
          <Spinner size="large" label="Loading dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      <div className="manager-dashboard-header">
        <div className="dashboard-title-row">
          <h1>Manager Dashboard</h1>
          <span className="live-badge">● Live</span>
        </div>
        <div className="dashboard-header-actions">
          <input
            type="date"
            className="dashboard-date-picker"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-summary-cards">
        <Card className="dashboard-summary-card card-orders">
          <div className="summary-label">Total Orders</div>
          <div className="summary-value">{summaryStats.totalOrders}</div>
        </Card>
        <Card className="dashboard-summary-card card-sales">
          <div className="summary-label">Total Sales</div>
          <div className="summary-value">
            {globalUtils.getCurrencyFormat(summaryStats.totalSales)}
          </div>
        </Card>
        <Card className="dashboard-summary-card card-visits">
          <div className="summary-label">Visits Done</div>
          <div className="summary-value">{summaryStats.totalVisits}</div>
        </Card>
        <Card className="dashboard-summary-card card-pipeline">
          <div className="summary-label">Pipeline</div>
          <div className="summary-value">{summaryStats.pipelineCount}</div>
        </Card>
      </div>

      {/* MR Performance Table */}
      <div className="mr-table-section">
        <h2>MR Performance</h2>
        {mrRows.length === 0 && unassignedRoutes.length === 0 ? (
          <div className="empty-state">
            <Text>No MRs found and no routes scheduled today</Text>
          </div>
        ) : (
          <table className="app-table">
            <thead>
              <tr>
                <th>MR Name</th>
                <th>Assigned Route</th>
                <th>Status</th>
                <th>Orders</th>
                <th>Sales</th>
                <th>Visits / Planned</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {mrRows.map((row) => (
                <tr
                  key={row.mrUid}
                  className={row.isOnline ? 'row-online' : ''}
                  onClick={() => handleRouteClick(row)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{row.mrName}</td>
                  <td>
                    <div className="assigned-mr-cell">
                      <span>{row.assignedRouteName || row.assignedRouteId || '—'}</span>
                      <Button
                        appearance="subtle"
                        icon={<Edit16Regular />}
                        size="small"
                        onClick={(e) => handleOpenAssignRouteDialog(e, row)}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="mr-name-cell">
                      <div className={row.isOnline ? 'online-dot' : 'offline-dot'} />
                      {row.isOnline ? 'Online' : 'Offline'}
                    </div>
                  </td>
                  <td>{row.orderCount}</td>
                  <td>{globalUtils.getCurrencyFormat(row.salesTotal)}</td>
                  <td>
                    {row.visitsDone} / {row.plannedParties}
                  </td>
                  <td>
                    {row.distanceKm > 0
                      ? `${row.distanceKm.toFixed(1)} km`
                      : '—'}
                  </td>
                </tr>
              ))}
              {unassignedRoutes.map((route) => (
                <tr
                  key={`unassigned-${route.routeId}`}
                  className="unassigned-route-row"
                  onClick={() =>
                    handleOpenAssignDialog({
                      routeId: route.routeId,
                      routeName: route.routeName,
                      mrUid: '',
                    })
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <td>—</td>
                  <td>
                    <div className="assigned-mr-cell">
                      <span>{route.routeName}</span>
                      <Button
                        appearance="subtle"
                        size="small"
                        className="assign-route-inline-cta"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAssignDialog({
                            routeId: route.routeId,
                            routeName: route.routeName,
                            mrUid: '',
                          });
                        }}
                      >
                        Assign this route
                      </Button>
                    </div>
                  </td>
                  <td>
                    <span className="no-mr-badge">No MR</span>
                  </td>
                  <td>0</td>
                  <td>{globalUtils.getCurrencyFormat(0)}</td>
                  <td>0 / {route.plannedParties}</td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Supply Performance Table */}
      <div className="mr-table-section">
        <h2>Supply Performance</h2>
        {supplyRows.length === 0 ? (
          <div className="empty-state">
            <Text>No supplymen found</Text>
          </div>
        ) : (
          <table className="app-table">
            <thead>
              <tr>
                <th>Supplyman</th>
                <th>Status</th>
                <th>Active SR</th>
                <th>Total SRs</th>
                <th>Completed</th>
                <th>Dispatch Time</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {supplyRows.map((row) => (
                <tr
                  key={row.uid}
                  className={row.isOnline ? 'row-online' : ''}
                  onClick={() => handleSupplyRowClick(row)}
                  style={{ cursor: row.uid ? 'pointer' : 'default' }}
                >
                  <td>{row.name}</td>
                  <td>
                    <div className="mr-name-cell">
                      <div
                        className={row.isOnline ? 'online-dot' : 'offline-dot'}
                      />
                      {row.isOnline ? 'Online' : 'Offline'}
                    </div>
                  </td>
                  <td>
                    {row.activeSR ? (
                      <Button
                        appearance="subtle"
                        size="small"
                        className="active-sr-link"
                        onClick={(e) => handleActiveSRClick(e, row)}
                      >
                        {row.activeSRLabel}
                      </Button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{row.totalSRs}</td>
                  <td>{row.completedSRs}</td>
                  <td>{formatTime(row.dispatchTime)}</td>
                  <td>
                    {row.distanceKm > 0
                      ? `${row.distanceKm.toFixed(1)} km`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Today's Orders Table */}
      <div className="mr-table-section">
        <h2>Today&apos;s Orders ({orderRows.length})</h2>
        {orderRows.length === 0 ? (
          <div className="empty-state">
            <Text>No orders today</Text>
          </div>
        ) : (
          <table className="app-table">
            <thead>
              <tr>
                <th>Party Name</th>
                <th>Order Amount</th>
                <th>MR</th>
                <th>Status</th>
                <th>Creation Time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orderRows.map((o) => (
                <tr key={o.id} style={{ cursor: 'default' }}>
                  <td>{partyNames[o.partyId] || o.partyId || '—'}</td>
                  <td>{globalUtils.getCurrencyFormat(o.orderAmount)}</td>
                  <td>{userMap[o.mrId] || '—'}</td>
                  <td>
                    <span className="order-status-pill">
                      {o.orderStatus || '—'}
                      {o.flow.length > 0 && (
                        <span>
                          : {formatTime(o.flow[o.flow.length - 1].timestamp)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td>{formatTime(o.creationTime)}</td>
                  <td>
                    <Button
                      appearance="subtle"
                      icon={<Edit16Regular />}
                      size="small"
                      onClick={(e) => handleOpenEditOrder(e, o)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign MR Dialog */}
      <AssignMrDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        routeName={assignRouteName}
        mrUsers={mrUsers}
        assignRouteId={assignRouteId}
        selectedMrUid={assignSelectedMrUid}
        onSelectMr={setAssignSelectedMrUid}
        onSave={handleAssignSave}
        saving={assignSaving}
      />

      <AssignRouteDialog
        open={assignRouteDialogOpen}
        onClose={() => {
          setAssignRouteDialogOpen(false);
          setAssignRouteForMr(null);
        }}
        mrName={assignRouteForMr?.mrName || ''}
        routeOptions={routeOptions}
        selectedRouteId={assignSelectedRouteId}
        onSelectRoute={setAssignSelectedRouteId}
        onSave={handleAssignRouteSave}
        saving={assignRouteSaving}
      />

      {/* Edit Order Dialog */}
      <EditOrderDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditOrder(null);
        }}
        order={editOrder}
        partyNames={partyNames}
        mrUsers={mrUsers}
        userMap={userMap}
        companyId={currentCompanyId}
      />
    </div>
  );
}

export default ManagerDashboard;
