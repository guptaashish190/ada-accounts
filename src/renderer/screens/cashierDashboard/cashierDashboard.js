import React, { useState, useEffect, useCallback } from 'react';
import {
  Spinner,
  Button,
  Dropdown,
  Option,
  Card,
  CardHeader,
  Text,
  Input,
  Tab,
  TabList,
} from '@fluentui/react-components';
import {
  ChevronDown20Regular,
  ChevronUp20Regular,
  Call20Regular,
  CalendarLtr20Regular,
  Save20Regular,
} from '@fluentui/react-icons';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import {
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { useCompany } from '../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import { firebaseAuth } from '../../firebaseInit';
import './style.css';

function CashierDashboard() {
  const { currentCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [partiesData, setPartiesData] = useState([]);
  const [filteredParties, setFilteredParties] = useState([]);
  const [expandedParty, setExpandedParty] = useState(null);
  const [routeList, setRouteList] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('all');
  const [viewMode, setViewMode] = useState('daily');

  const getTodayDateString = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [rangeFrom, setRangeFrom] = useState(new Date());
  const [rangeTo, setRangeTo] = useState(new Date());

  const [stats, setStats] = useState({
    dueToday: 0,
    overdue: 0,
    partyCount: 0,
  });

  useEffect(() => {
    if (currentCompanyId) {
      fetchScheduledPayments();
    }
  }, [currentCompanyId, selectedDate, viewMode]);

  useEffect(() => {
    filterParties();
  }, [selectedRoute, partiesData]);

  const fetchPartyDetails = async (partyIds) => {
    const cache = {};
    const unique = [...new Set(partyIds.filter(Boolean))];
    const chunks = [];
    for (let i = 0; i < unique.length; i += 10) {
      chunks.push(unique.slice(i, i + 10));
    }
    await Promise.all(
      chunks.map(async (chunk) => {
        const snap = await getDocs(
          query(
            getCompanyCollection(currentCompanyId, 'parties'),
            where('__name__', 'in', chunk),
          ),
        );
        snap.docs.forEach((d) => {
          cache[d.id] = d.data();
        });
      }),
    );
    return cache;
  };

  const fetchScheduledPayments = async () => {
    try {
      setLoading(true);

      const selectedDateObj = new Date(selectedDate);
      const jsDay = selectedDateObj.getDay();
      const routeIndex = (jsDay + 6) % 7;

      const routesRef = getCompanyCollection(currentCompanyId, 'mr_routes');
      const routesSnapshot = await getDocs(routesRef);

      const todayPartyIds = new Set();
      const partyToRouteMap = {};

      routesSnapshot.docs.forEach((doc) => {
        const route = doc.data();
        const routeId = doc.id;
        const routeName = route.name || routeId;
        const routeArray = route.route || [];

        if (routeArray[routeIndex] && routeArray[routeIndex].parties) {
          routeArray[routeIndex].parties.forEach((partyId) => {
            todayPartyIds.add(partyId);
            partyToRouteMap[partyId] = { routeId, routeName };
          });
        }
      });

      const endOfDay =
        viewMode === 'daily' ? new Date(selectedDate) : new Date(rangeTo);
      endOfDay.setHours(23, 59, 59, 999);

      const ordersRef = getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS);
      const q = query(
        ordersRef,
        where('schedulePaymentDate', '<=', endOfDay.getTime()),
        where('balance', '>', 0),
        orderBy('schedulePaymentDate', 'asc'),
        limit(2000),
      );

      const ordersSnapshot = await getDocs(q);

      let ordersList;
      if (viewMode === 'range') {
        const startOfFrom = new Date(rangeFrom);
        startOfFrom.setHours(0, 0, 0, 0);
        const rangeFromMs = startOfFrom.getTime();
        ordersList = ordersSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((o) => o.schedulePaymentDate >= rangeFromMs);
      } else {
        ordersList = ordersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      await buildPartiesData(
        ordersList,
        todayPartyIds,
        partyToRouteMap,
        selectedDateObj,
      );

      setLoading(false);
    } catch (error) {
      console.error('Error fetching scheduled payments:', error);
      setLoading(false);
    }
  };

  const buildPartiesData = async (
    orders,
    todayPartyIds,
    partyToRouteMap,
    selectedDateObj,
  ) => {
    const startOfDay = new Date(selectedDateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const allPartyIds = orders.map((o) => o.partyId).filter(Boolean);
    const partyCache = await fetchPartyDetails(allPartyIds);

    const partyMap = {};
    orders.forEach((order) => {
      const { partyId } = order;
      if (!partyId) return;

      if (!partyMap[partyId]) {
        const partyData = partyCache[partyId] || {};
        const routeInfo = partyToRouteMap[partyId] || null;
        const isOnRoute = todayPartyIds.has(partyId);

        partyMap[partyId] = {
          partyId,
          partyName: partyData.name || 'Unknown Party',
          contact: partyData.contact || '',
          creditDays: partyData.creditDays,
          routeId: routeInfo?.routeId || 'miscellaneous',
          routeName: routeInfo?.routeName || 'Miscellaneous',
          isOnRoute,
          orders: [],
          totalPending: 0,
          dueTodayAmount: 0,
          overdueAmount: 0,
          oldestBillTime: Infinity,
        };
      }

      partyMap[partyId].orders.push(order);
      partyMap[partyId].totalPending += order.balance || 0;

      const billTime = order.billCreationTime || order.creationTime || 0;
      if (billTime && billTime < partyMap[partyId].oldestBillTime) {
        partyMap[partyId].oldestBillTime = billTime;
      }

      const schedDate = order.schedulePaymentDate || 0;
      if (schedDate < startOfDay.getTime()) {
        partyMap[partyId].overdueAmount += order.balance || 0;
      } else if (schedDate <= endOfDay.getTime()) {
        partyMap[partyId].dueTodayAmount += order.balance || 0;
      }
    });

    const now = Date.now();
    Object.values(partyMap).forEach((party) => {
      party.oldestBillDays =
        party.oldestBillTime < Infinity
          ? Math.floor((now - party.oldestBillTime) / (1000 * 60 * 60 * 24))
          : 0;
      party.orders.sort((a, b) => {
        const dateA = a.schedulePaymentDate || a.billCreationTime || 0;
        const dateB = b.schedulePaymentDate || b.billCreationTime || 0;
        return dateA - dateB;
      });
    });

    const partiesArray = Object.values(partyMap).sort((a, b) => {
      if (a.isOnRoute && !b.isOnRoute) return -1;
      if (!a.isOnRoute && b.isOnRoute) return 1;
      return (
        b.overdueAmount - a.overdueAmount || b.totalPending - a.totalPending
      );
    });

    let totalDueToday = 0;
    let totalOverdue = 0;
    partiesArray.forEach((p) => {
      totalDueToday += p.dueTodayAmount;
      totalOverdue += p.overdueAmount;
    });

    setStats({
      dueToday: totalDueToday,
      overdue: totalOverdue,
      partyCount: partiesArray.length,
    });

    setPartiesData(partiesArray);

    const routes = [
      ...new Set(
        partiesArray
          .filter((p) => p.isOnRoute)
          .map((p) => JSON.stringify({ id: p.routeId, name: p.routeName })),
      ),
    ]
      .map((str) => JSON.parse(str))
      .filter((route) => route.id !== 'miscellaneous');
    setRouteList(routes);
  };

  const filterParties = useCallback(() => {
    if (selectedRoute === 'all') {
      setFilteredParties(partiesData);
    } else if (selectedRoute === 'miscellaneous') {
      setFilteredParties(partiesData.filter((p) => !p.isOnRoute));
    } else {
      setFilteredParties(
        partiesData.filter((p) => p.routeId === selectedRoute),
      );
    }
  }, [selectedRoute, partiesData]);

  const toggleExpanded = (partyId) => {
    setExpandedParty(expandedParty === partyId ? null : partyId);
  };

  const handleCall = (contact) => {
    if (contact) window.open(`tel:${contact}`);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date =
      timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN');
  };

  const getBillStatus = (order) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sched = order.schedulePaymentDate;
    if (!sched) return 'NOT_SCHEDULED';
    const schedDate = new Date(sched);
    schedDate.setHours(0, 0, 0, 0);
    if (schedDate.getTime() < today.getTime()) return 'OVERDUE';
    if (schedDate.getTime() === today.getTime()) return 'DUE_TODAY';
    return 'UPCOMING';
  };

  const handleReschedule = async (orderId, newDate, oldDate) => {
    try {
      const orderRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.ORDERS,
        orderId,
      );
      const updateData = {
        schedulePaymentDate: newDate.getTime(),
      };
      if (oldDate) {
        updateData.rescheduleHistory = arrayUnion({
          from: oldDate,
          to: newDate.getTime(),
          by: firebaseAuth.currentUser?.uid || 'unknown',
          at: Date.now(),
        });
      }
      await updateDoc(orderRef, updateData);
      await fetchScheduledPayments();
    } catch (error) {
      console.error('Error rescheduling:', error);
    }
  };

  const getRouteFilterLabel = () => {
    if (selectedRoute === 'all') return 'All Routes';
    if (selectedRoute === 'miscellaneous') return 'Miscellaneous';
    return routeList.find((r) => r.id === selectedRoute)?.name || 'Unknown';
  };

  const hasMiscellaneous = partiesData.some((p) => !p.isOnRoute);

  if (loading) {
    return (
      <div className="cashier-dashboard-loading">
        <Spinner label="Loading payment dashboard..." />
      </div>
    );
  }

  return (
    <div className="cashier-dashboard">
      <div className="cashier-dashboard-header">
        <h1>Payment Dashboard</h1>
        <div className="header-actions">
          <TabList
            selectedValue={viewMode}
            onTabSelect={(_, d) => setViewMode(d.value)}
          >
            <Tab value="daily">Daily View</Tab>
            <Tab value="range">Date Range</Tab>
          </TabList>
        </div>
      </div>

      <div className="date-controls">
        {viewMode === 'daily' ? (
          <>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              contentBefore={<CalendarLtr20Regular />}
              className="date-picker"
            />
            <Button onClick={fetchScheduledPayments}>Refresh</Button>
          </>
        ) : (
          <>
            <DatePicker
              className="date-picker"
              onSelectDate={(d) => setRangeFrom(d)}
              placeholder="From"
              value={rangeFrom}
            />
            <DatePicker
              className="date-picker"
              onSelectDate={(d) => setRangeTo(d)}
              placeholder="To"
              value={rangeTo}
            />
            <Button onClick={fetchScheduledPayments}>Search</Button>
          </>
        )}
      </div>

      <div className="summary-cards">
        <Card className="summary-card due-today-card">
          <CardHeader header={<Text weight="semibold">Due Today</Text>} />
          <div className="summary-value">{formatCurrency(stats.dueToday)}</div>
        </Card>

        <Card className="summary-card overdue-card">
          <CardHeader header={<Text weight="semibold">Overdue</Text>} />
          <div className="summary-value">{formatCurrency(stats.overdue)}</div>
        </Card>

        <Card className="summary-card count-card">
          <CardHeader header={<Text weight="semibold">Parties</Text>} />
          <div className="summary-value">{stats.partyCount}</div>
        </Card>
      </div>

      <div className="dashboard-filters">
        <Dropdown
          placeholder="Filter by Route"
          value={getRouteFilterLabel()}
          onOptionSelect={(_, data) => setSelectedRoute(data.optionValue)}
        >
          <Option value="all">All Routes</Option>
          {routeList.map((route) => (
            <Option key={route.id} value={route.id}>
              {route.name}
            </Option>
          ))}
          {hasMiscellaneous && (
            <Option value="miscellaneous">Miscellaneous</Option>
          )}
        </Dropdown>
      </div>

      <div className="parties-list">
        {filteredParties.length === 0 ? (
          <Card>
            <div className="empty-state">
              <Text>
                No scheduled payments found for{' '}
                {viewMode === 'daily'
                  ? new Date(selectedDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : [
                      rangeFrom.toLocaleDateString('en-IN'),
                      rangeTo.toLocaleDateString('en-IN'),
                    ].join(' - ')}
              </Text>
            </div>
          </Card>
        ) : (
          filteredParties.map((party) => (
            <PartyCard
              key={party.partyId}
              party={party}
              expanded={expandedParty === party.partyId}
              onToggle={() => toggleExpanded(party.partyId)}
              onCall={handleCall}
              onReschedule={handleReschedule}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getBillStatus={getBillStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PartyCard({
  party,
  expanded,
  onToggle,
  onCall,
  onReschedule,
  formatCurrency,
  formatDate,
  getBillStatus,
}) {
  const hasOverdue = party.overdueAmount > 0;
  const statusClass = hasOverdue ? 'overdue-status' : 'due-today-status';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <Card className={`party-card ${statusClass}`}>
      <div
        className="party-card-header"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        <div className="party-info">
          <div className="party-name-row">
            <Text weight="semibold" size={400}>
              {party.partyName}
            </Text>
            {!party.isOnRoute && (
              <div className="status-badge miscellaneous">MISC</div>
            )}
            {hasOverdue && <div className="status-badge overdue">OVERDUE</div>}
            <Text size={200} className="party-meta">
              {party.orders.length} bill
              {party.orders.length > 1 ? 's' : ''} &bull;{' '}
              {formatCurrency(party.totalPending)} &bull; {party.oldestBillDays}
              d old &bull; {party.routeName} &bull; {party.creditDays || '--'}d
              credit
            </Text>
          </div>
        </div>
        <div className="party-actions">
          {party.contact && (
            <Button
              appearance="subtle"
              size="small"
              icon={<Call20Regular />}
              onClick={(e) => {
                e.stopPropagation();
                onCall(party.contact);
              }}
            />
          )}
          {expanded ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
        </div>
      </div>

      {expanded && (
        <div className="bill-breakdown">
          <table className="bills-table">
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Bill Date</th>
                <th>Days</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Scheduled For</th>
                <th>Status</th>
                <th>Reschedule</th>
              </tr>
            </thead>
            <tbody>
              {party.orders.map((order) => (
                <BillRow
                  key={order.id}
                  order={order}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  getBillStatus={getBillStatus}
                  onReschedule={onReschedule}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BillRow({
  order,
  formatCurrency,
  formatDate,
  getBillStatus,
  onReschedule,
}) {
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [saving, setSaving] = useState(false);
  const status = getBillStatus(order);

  const daysSinceBilling = (() => {
    console.log(order.billCreationTime);
    const billTime = order.billCreationTime || order.creationTime;
    if (!billTime) return '--';
    const diff = Date.now() - billTime;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  })();

  const handleSave = async () => {
    if (!rescheduleDate) return;
    setSaving(true);
    await onReschedule(order.id, rescheduleDate, order.schedulePaymentDate);
    setRescheduleDate(null);
    setSaving(false);
  };

  return (
    <tr>
      <td>{order.billNumber || order.id}</td>
      <td>{formatDate(order.billCreationTime)}</td>
      <td>{daysSinceBilling}</td>
      <td>{formatCurrency(order.orderAmount || 0)}</td>
      <td>{formatCurrency(order.balance || 0)}</td>
      <td>{formatDate(order.schedulePaymentDate)}</td>
      <td>
        <span className={`status-pill ${status.toLowerCase()}`}>
          {status.replace('_', ' ')}
        </span>
      </td>
      <td className="reschedule-cell">
        <DatePicker
          minDate={new Date()}
          size="small"
          onSelectDate={setRescheduleDate}
          placeholder="New date"
          value={rescheduleDate}
        />
        {saving ? (
          <Spinner size="tiny" />
        ) : (
          <Button
            size="small"
            icon={<Save20Regular />}
            disabled={!rescheduleDate}
            onClick={handleSave}
          >
            Save
          </Button>
        )}
      </td>
    </tr>
  );
}

export default CashierDashboard;
