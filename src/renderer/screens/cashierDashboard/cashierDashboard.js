import React, { useState, useEffect } from 'react';
import {
  Spinner,
  Button,
  Dropdown,
  Option,
  Card,
  CardHeader,
  Text,
  Input,
} from '@fluentui/react-components';
import {
  ChevronDown20Regular,
  ChevronUp20Regular,
  Call20Regular,
  CalendarLtr20Regular,
} from '@fluentui/react-icons';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection } from '../../services/firestoreHelpers';
import './style.css';

function CashierDashboard() {
  const { currentCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [partiesData, setPartiesData] = useState([]);
  const [filteredParties, setFilteredParties] = useState([]);
  const [expandedParty, setExpandedParty] = useState(null);
  const [routeList, setRouteList] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('all');

  // Date selector - default to today
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());

  // Summary stats
  const [stats, setStats] = useState({
    totalCritical: 0,
    totalOverdue: 0,
    partyCount: 0,
  });

  useEffect(() => {
    if (currentCompanyId) {
      fetchOverduePayments();
    }
  }, [currentCompanyId, selectedDate]);

  useEffect(() => {
    filterParties();
  }, [selectedRoute, partiesData]);

  const fetchOverduePayments = async () => {
    try {
      setLoading(true);

      // Step 1: Get weekday index for selected date
      const selectedDateObj = new Date(selectedDate);
      const jsDay = selectedDateObj.getDay(); // 0=Sunday, 1=Monday, etc.
      // Convert to route array index: 0=Monday, 1=Tuesday, ..., 6=Sunday
      const routeIndex = (jsDay + 6) % 7;
      const dayNames = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];
      console.log(
        `Selected date ${selectedDate} is ${dayNames[routeIndex]} (index ${routeIndex})`,
      );

      // Step 2: Fetch all mr_routes and extract parties for the selected weekday
      const routesRef = getCompanyCollection(currentCompanyId, 'mr_routes');
      const routesSnapshot = await getDocs(routesRef);

      const selectedDatePartyIds = new Set();
      const partyToRouteMap = {}; // Map partyId -> { routeId, routeName }

      routesSnapshot.docs.forEach((doc) => {
        const route = doc.data();
        const routeId = doc.id;
        const routeName = route.name || routeId;
        const routeArray = route.route || [];

        // Get parties for the selected weekday from the route array
        if (routeArray[routeIndex] && routeArray[routeIndex].parties) {
          const { parties } = routeArray[routeIndex];

          parties.forEach((partyId) => {
            selectedDatePartyIds.add(partyId);
            partyToRouteMap[partyId] = { routeId, routeName };
          });
        }
      });

      if (selectedDatePartyIds.size === 0) {
        // No routes for selected date
        setPartiesData([]);
        setStats({ totalCritical: 0, totalOverdue: 0, partyCount: 0 });
        setLoading(false);
        return;
      }

      // Step 2: Fetch orders with CRITICAL or OVERDUE status for selected date's route parties
      const ordersRef = getCompanyCollection(currentCompanyId, 'orders');
      const q = query(
        ordersRef,
        where('paymentStatus', 'in', ['CRITICAL', 'OVERDUE']),
      );

      const ordersSnapshot = await getDocs(q);

      // Step 3: Group orders by party (only for parties in today's routes)
      const partyMap = {};

      for (const doc of ordersSnapshot.docs) {
        const order = { id: doc.id, ...doc.data() };
        const { partyId } = order;

        // Skip if this party is not in selected date's routes
        if (!selectedDatePartyIds.has(partyId)) {
          continue;
        }

        if (!partyMap[partyId]) {
          // Fetch party details
          const partyDoc = await getDocs(
            query(
              getCompanyCollection(currentCompanyId, 'parties'),
              where('__name__', '==', partyId),
            ),
          );

          const partyData = partyDoc.docs[0]?.data() || {};

          // Get route info for this party
          const routeInfo = partyToRouteMap[partyId] || {
            routeId: 'unknown',
            routeName: 'Unknown Route',
          };

          partyMap[partyId] = {
            partyId,
            partyName: partyData.name || 'Unknown Party',
            contact: partyData.contact || '',
            creditDays: partyData.creditDays,
            routeId: routeInfo.routeId,
            routeName: routeInfo.routeName,
            orders: [],
            totalPending: 0,
            maxDaysOverdue: 0,
            lastPaymentDate: null,
            status: 'OVERDUE',
          };
        }

        // Add order to party (will be sorted later)
        partyMap[partyId].orders.push(order);
        partyMap[partyId].totalPending += order.balance || 0;

        // Calculate days overdue
        const daysOverdue = order.daysOverdue || 0;
        if (daysOverdue > partyMap[partyId].maxDaysOverdue) {
          partyMap[partyId].maxDaysOverdue = daysOverdue;
        }

        // Update status to CRITICAL if any order is critical
        if (order.paymentStatus === 'CRITICAL') {
          partyMap[partyId].status = 'CRITICAL';
        }

        // Track last payment date (placeholder - would need payment records)
        // For now, we'll leave it null
      }

      // Sort each party's orders by date (oldest first)
      Object.values(partyMap).forEach((party) => {
        party.orders.sort((a, b) => {
          const dateA = a.billCreationTime || a.creationTime || 0;
          const dateB = b.billCreationTime || b.creationTime || 0;
          return dateA - dateB;
        });
      });

      // Convert to array and sort: CRITICAL first, then OVERDUE
      const partiesArray = Object.values(partyMap).sort((a, b) => {
        if (a.status === 'CRITICAL' && b.status !== 'CRITICAL') return -1;
        if (a.status !== 'CRITICAL' && b.status === 'CRITICAL') return 1;
        return b.maxDaysOverdue - a.maxDaysOverdue;
      });

      // Calculate stats
      const critical = partiesArray.filter((p) => p.status === 'CRITICAL');
      const overdue = partiesArray.filter((p) => p.status === 'OVERDUE');

      setStats({
        totalCritical: critical.reduce((sum, p) => sum + p.totalPending, 0),
        totalOverdue: overdue.reduce((sum, p) => sum + p.totalPending, 0),
        partyCount: partiesArray.length,
      });

      setPartiesData(partiesArray);

      // Extract unique routes for filter
      const routes = [
        ...new Set(
          partiesArray.map((p) =>
            JSON.stringify({ id: p.routeId, name: p.routeName }),
          ),
        ),
      ]
        .map((str) => JSON.parse(str))
        .filter((route) => route.id !== 'unknown');
      setRouteList(routes);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching overdue payments:', error);
      setLoading(false);
    }
  };

  const filterParties = () => {
    if (selectedRoute === 'all') {
      setFilteredParties(partiesData);
    } else {
      setFilteredParties(
        partiesData.filter((p) => p.routeId === selectedRoute),
      );
    }
  };

  const toggleExpanded = (partyId) => {
    setExpandedParty(expandedParty === partyId ? null : partyId);
  };

  const handleCall = (contact) => {
    if (contact) {
      window.open(`tel:${contact}`);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date =
      timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN');
  };

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
        <h1>Payment Follow-up Dashboard</h1>
        <div className="header-actions">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            contentBefore={<CalendarLtr20Regular />}
            className="date-picker"
          />
          <Button onClick={fetchOverduePayments}>Refresh</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <Card className="summary-card critical-card">
          <CardHeader header={<Text weight="semibold">Critical Amount</Text>} />
          <div className="summary-value">
            {formatCurrency(stats.totalCritical)}
          </div>
        </Card>

        <Card className="summary-card overdue-card">
          <CardHeader header={<Text weight="semibold">Overdue Amount</Text>} />
          <div className="summary-value">
            {formatCurrency(stats.totalOverdue)}
          </div>
        </Card>

        <Card className="summary-card count-card">
          <CardHeader header={<Text weight="semibold">Parties</Text>} />
          <div className="summary-value">{stats.partyCount}</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="dashboard-filters">
        <Dropdown
          placeholder="Filter by Route"
          value={
            selectedRoute === 'all'
              ? 'All Routes'
              : routeList.find((r) => r.id === selectedRoute)?.name || 'Unknown'
          }
          onOptionSelect={(_, data) => setSelectedRoute(data.optionValue)}
        >
          <Option value="all">All Routes</Option>
          {routeList.map((route) => (
            <Option key={route.id} value={route.id}>
              {route.name}
            </Option>
          ))}
        </Dropdown>
      </div>

      {/* Parties List */}
      <div className="parties-list">
        {filteredParties.length === 0 ? (
          <Card>
            <div className="empty-state">
              <Text>
                No overdue or critical parties found for{' '}
                {new Date(selectedDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                {partiesData.length === 0 &&
                  ' (No routes scheduled for this date)'}
              </Text>
            </div>
          </Card>
        ) : (
          filteredParties.map((party) => (
            <Card
              key={party.partyId}
              className={`party-card ${party.status.toLowerCase()}-status`}
            >
              <div
                className="party-card-header"
                onClick={() => toggleExpanded(party.partyId)}
              >
                <div className="party-info">
                  <div className="party-name-row">
                    <Text weight="semibold" size={500}>
                      {party.partyName}
                    </Text>
                    <div
                      className={`status-badge ${party.status.toLowerCase()}`}
                    >
                      {party.status}
                    </div>
                  </div>
                  <div className="party-details-row">
                    <Text size={300}>
                      {party.orders.length} bill
                      {party.orders.length > 1 ? 's' : ''} •{' '}
                      {formatCurrency(party.totalPending)} pending •{' '}
                      {party.maxDaysOverdue} days overdue • Credit:{' '}
                      {party.creditDays || 'Not Set'} days
                    </Text>
                  </div>
                  <div className="party-details-row">
                    <Text size={200}>
                      Route: {party.routeName} • Contact:{' '}
                      {party.contact || 'N/A'}
                    </Text>
                  </div>
                </div>

                <div className="party-actions">
                  {party.contact && (
                    <Button
                      appearance="subtle"
                      icon={<Call20Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCall(party.contact);
                      }}
                    >
                      Call
                    </Button>
                  )}
                  {expandedParty === party.partyId ? (
                    <ChevronUp20Regular />
                  ) : (
                    <ChevronDown20Regular />
                  )}
                </div>
              </div>

              {/* Expanded Bill Breakdown */}
              {expandedParty === party.partyId && (
                <div className="bill-breakdown">
                  <table className="bills-table">
                    <thead>
                      <tr>
                        <th>Bill Number</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Balance</th>
                        <th>Due Date</th>
                        <th>Days Overdue</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {party.orders.map((order) => (
                        <tr key={order.id}>
                          <td>{order.billNumber || order.id}</td>
                          <td>{formatDate(order.billCreationTime)}</td>
                          <td>{formatCurrency(order.orderAmount || 0)}</td>
                          <td>{formatCurrency(order.balance || 0)}</td>
                          <td>{formatDate(order.dueDate)}</td>
                          <td>{order.daysOverdue || 0}</td>
                          <td>
                            <span
                              className={`status-pill ${order.paymentStatus.toLowerCase()}`}
                            >
                              {order.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default CashierDashboard;
