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
  Location24Regular,
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
import LocationDialog from './locationDialog';
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

function getSelectedMrLabel(mrUsers, uid) {
  if (!uid) return '';
  const mr = mrUsers.find((u) => u.uid === uid);
  if (!mr) return uid;
  return mr.username || mr.email || mr.uid;
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

  const [routeRows, setRouteRows] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalOrders: 0,
    totalSales: 0,
    totalVisits: 0,
    pipelineCount: 0,
  });

  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationUserId, setLocationUserId] = useState(null);
  const [locationUserName, setLocationUserName] = useState('');

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignRouteId, setAssignRouteId] = useState(null);
  const [assignRouteName, setAssignRouteName] = useState('');
  const [assignSelectedMrUid, setAssignSelectedMrUid] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

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

  const [supplyRows, setSupplyRows] = useState([]);

  const mrUsers = useMemo(
    () =>
      (allUsers || []).filter(
        (u) => u.jobs && u.jobs.includes(MR_JOB_ID) && !u.isDeactivated,
      ),
    [allUsers],
  );

  const supplyUsers = useMemo(
    () =>
      (allUsers || []).filter(
        (u) => u.jobs && u.jobs.includes(SUPPLY_JOB_ID) && !u.isDeactivated,
      ),
    [allUsers],
  );

  const userMap = useMemo(() => {
    const map = {};
    (allUsers || []).forEach((u) => {
      map[u.uid] = u.username || u.email || u.uid;
    });
    return map;
  }, [allUsers]);

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

  const getWeekdayIndex = (dateStr) => {
    const d = new Date(dateStr);
    const jsDay = d.getDay(); // 0=Sunday
    return (jsDay + 6) % 7; // 0=Monday...6=Sunday
  };

  // Set up real-time Firestore listeners; re-subscribe when company or date changes
  useEffect(() => {
    if (!currentCompanyId) return;

    const { startMs, endMs } = getDateRange(selectedDate);

    setRoutesDocs(null);
    setRegisterDocs(null);
    setOrdersDocs(null);
    setAttendanceDocs(null);
    setSupplyReportsDocs(null);

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
        where('timeIn', '>=', startMs),
        where('timeIn', '<', endMs),
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

    return () => {
      unsubRoutes();
      unsubRegister();
      unsubOrders();
      unsubAttendance();
      unsubSupplyReports();
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

    // Online MR UIDs from attendance
    const onlineMrUids = new Set();
    attendanceDocs.forEach((d) => {
      const data = d.data();
      if (data.employeeId) onlineMrUids.add(data.employeeId);
    });

    // Build a map: routeId -> MR user (one MR per route)
    const routeToMr = {};
    mrUsers.forEach((mr) => {
      if (mr.assignedRoute) {
        routeToMr[mr.assignedRoute] = mr;
      }
    });

    // Build route rows
    let totalOrders = 0;
    let totalSales = 0;
    let totalVisits = 0;

    const rows = Object.entries(routeMap)
      .filter(([, route]) => route.todayParties.length > 0)
      .map(([routeId, route]) => {
        const mr = routeToMr[routeId] || null;
        const mrUid = mr ? mr.uid : null;
        const mrName = mr ? mr.username || mr.email || mr.uid : null;
        const isOnline = mrUid ? onlineMrUids.has(mrUid) : false;

        const entries = mrUid ? registerByUser[mrUid] || [] : [];
        const visitsDone = entries.length;

        const mrOrders = mrUid ? ordersByUser[mrUid] || [] : [];
        const orderCount = mrOrders.length;
        const salesTotal = mrOrders.reduce(
          (sum, o) => sum + (o.orderAmount || 0),
          0,
        );

        totalOrders += orderCount;
        totalSales += salesTotal;
        totalVisits += visitsDone;

        return {
          routeId,
          routeName: route.name,
          mrUid,
          mrName,
          isOnline,
          orderCount,
          salesTotal,
          visitsDone,
          plannedParties: route.todayParties.length,
        };
      });

    // Sort: online first, then offline with MR, then unassigned; within group by route name
    rows.sort((a, b) => {
      const aRank = a.mrUid ? (a.isOnline ? 0 : 1) : 2;
      const bRank = b.mrUid ? (b.isOnline ? 0 : 1) : 2;
      if (aRank !== bRank) return aRank - bRank;
      return a.routeName.localeCompare(b.routeName);
    });

    setRouteRows(rows);
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

    const buildSupplyRow = (uid) => {
      const user = (allUsers || []).find((u) => u.uid === uid);
      const name = user ? user.username || user.email || uid : uid;
      const isOnline = onlineMrUids.has(uid);
      const reports = srBySupplyman[uid] || [];
      const totalSRs = reports.length;
      const activeSR = reports.find((r) => r.status === 'Dispatched') || null;
      const completedSRs = reports.filter(
        (r) => r.status === 'Completed' || r.status === 'Delivered',
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
    allUsers,
    mrUsers,
    supplyUsers,
    selectedDate,
  ]);

  const handleRouteClick = (row) => {
    if (!row.mrUid || !row.isOnline) return;
    window.electron.ipcRenderer.sendMessage('new-window', {
      type: constants.windowConstants.MR_DETAIL,
      data: {
        mrUid: row.mrUid,
        mrName: row.mrName,
        assignedRoute: row.routeId,
        companyId: currentCompanyId,
        selectedDate,
      },
    });
  };

  const handleShowLocation = (e, row) => {
    e.stopPropagation();
    if (!row.mrUid || !row.isOnline) return;
    setLocationUserId(row.mrUid);
    setLocationUserName(row.mrName);
    setLocationDialogOpen(true);
  };

  const handleOpenAssignDialog = (e, row) => {
    e.stopPropagation();
    setAssignRouteId(row.routeId);
    setAssignRouteName(row.routeName);
    setAssignSelectedMrUid(row.mrUid || '');
    setAssignDialogOpen(true);
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

  const handleOpenEditOrder = (e, order) => {
    e.stopPropagation();
    setEditOrder(order);
    setEditDialogOpen(true);
  };

  const handleShowSupplyLocation = (e, row) => {
    e.stopPropagation();
    if (!row.uid || !row.isOnline) return;
    setLocationUserId(row.uid);
    setLocationUserName(row.name);
    setLocationDialogOpen(true);
  };

  const handleActiveSRClick = (e, row) => {
    e.stopPropagation();
    if (!row.activeSR) return;
    navigate('/viewSupplyReport', {
      state: { prefillSupplyReport: row.activeSR },
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

      {/* Route Performance Table */}
      <div className="mr-table-section">
        <h2>Route Performance</h2>
        {routeRows.length === 0 ? (
          <div className="empty-state">
            <Text>No routes scheduled today</Text>
          </div>
        ) : (
          <table className="mr-performance-table">
            <thead>
              <tr>
                <th>Route Name</th>
                <th>Assigned MR</th>
                <th>Status</th>
                <th>Orders</th>
                <th>Sales</th>
                <th>Visits / Planned</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {routeRows.map((row) => (
                <tr
                  key={row.routeId}
                  className={row.isOnline ? 'row-online' : ''}
                  onClick={() => handleRouteClick(row)}
                  style={{
                    cursor: row.mrUid && row.isOnline ? 'pointer' : 'default',
                  }}
                >
                  <td>{row.routeName}</td>
                  <td>
                    <div className="assigned-mr-cell">
                      <span>{row.mrName || '—'}</span>
                      <Button
                        appearance="subtle"
                        icon={<Edit16Regular />}
                        size="small"
                        onClick={(e) => handleOpenAssignDialog(e, row)}
                      />
                    </div>
                  </td>
                  <td>
                    {row.mrUid ? (
                      <div className="mr-name-cell">
                        <div
                          className={
                            row.isOnline ? 'online-dot' : 'offline-dot'
                          }
                        />
                        {row.isOnline ? 'Online' : 'Offline'}
                      </div>
                    ) : (
                      <span className="no-mr-badge">No MR</span>
                    )}
                  </td>
                  <td>{row.orderCount}</td>
                  <td>{globalUtils.getCurrencyFormat(row.salesTotal)}</td>
                  <td>
                    {row.visitsDone} / {row.plannedParties}
                  </td>
                  <td>
                    <Button
                      appearance="subtle"
                      icon={<Location24Regular />}
                      size="small"
                      disabled={!row.mrUid || !row.isOnline}
                      onClick={(e) => handleShowLocation(e, row)}
                    />
                  </td>
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
          <table className="mr-performance-table">
            <thead>
              <tr>
                <th>Supplyman</th>
                <th>Status</th>
                <th>Active SR</th>
                <th>Total SRs</th>
                <th>Completed</th>
                <th>Dispatch Time</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {supplyRows.map((row) => (
                <tr key={row.uid} className={row.isOnline ? 'row-online' : ''}>
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
                    <Button
                      appearance="subtle"
                      icon={<Location24Regular />}
                      size="small"
                      disabled={!row.isOnline}
                      onClick={(e) => handleShowSupplyLocation(e, row)}
                    />
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
          <table className="mr-performance-table">
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

      {/* Location Dialog */}
      {locationDialogOpen && (
        <LocationDialog
          open={locationDialogOpen}
          onClose={() => setLocationDialogOpen(false)}
          userId={locationUserId}
          userName={locationUserName}
          companyId={currentCompanyId}
          selectedDate={selectedDate}
        />
      )}

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
