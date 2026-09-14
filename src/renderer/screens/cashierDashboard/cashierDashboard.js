import React, { useState, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  Spinner,
  Button,
  Dropdown,
  Option,
  Card,
  CardHeader,
  Text,
  Toaster,
  useId,
  useToastController,
} from '@fluentui/react-components';
import {
  LockClosed20Regular,
  LockOpen20Regular,
  Print20Regular,
} from '@fluentui/react-icons';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import { useCompany } from '../../contexts/companyContext';
import { useCurrentUser } from '../../contexts/userContext';
import { useAuthUser } from '../../contexts/allUsersContext';
import { showToast } from '../../common/toaster';
import PartyCard, { isPartyActioned, wasPartyRescheduled } from './partyCard';
import DayReportPrintView, { buildReportTotals } from './dayReportPrintView';
import {
  DEFAULT_PAYMENT_WINDOW_DAYS,
  MIN_LIST_BALANCE,
  PAYMENT_LOOKUP_DAYS,
  PAYMENT_MODES,
  buildAutoAttachJobs,
  cancelEntry,
  closeDay,
  endOfDay,
  entryHasLinkedPayments,
  fetchAllScheduledOrders,
  fetchClaimedPaymentIds,
  fetchEntriesForDate,
  fetchDayStatus,
  fetchOrdersRescheduledOnDate,
  fetchPartyDetails,
  fetchPaymentsInWindow,
  fetchRoutesForDay,
  snapshotPartiesForClose,
  updatePartyCreditAndRoute,
  formatCurrency,
  formatLongDate,
  parseDateKey,
  reopenDay,
  reschedulePartyOrders,
  saveEntry,
  startOfDay,
  toDateKey,
  billRescheduleDate,
} from './collectionService';
import '../reports/printA4.css';
import './style.css';

const INITIAL_VISIBLE_PARTIES = 40;
const VISIBLE_PARTIES_STEP = 40;

const billTime = (order) =>
  order.billCreationTime || order.creationTime || 0;

const sortOrdersByBillDate = (orders) =>
  [...(orders || [])].sort((a, b) => billTime(a) - billTime(b));

const recountParty = (party, dateObj) => {
  const dayStart = startOfDay(dateObj).getTime();
  const dayEnd = endOfDay(dateObj).getTime();
  let dueTodayAmount = 0;
  let overdueAmount = 0;
  let totalPending = 0;
  const orders = sortOrdersByBillDate(party.orders);
  orders.forEach((order) => {
    totalPending += order.balance || 0;
    const scheduled = order.schedulePaymentDate || 0;
    if (scheduled < dayStart) overdueAmount += order.balance || 0;
    else if (scheduled <= dayEnd) dueTodayAmount += order.balance || 0;
  });
  return { ...party, orders, dueTodayAmount, overdueAmount, totalPending };
};

const mergePartyOrders = (party, incoming, dateObj) => {
  const byId = new Map((party.orders || []).map((order) => [order.id, order]));
  incoming.forEach((order) => {
    if (!byId.has(order.id)) byId.set(order.id, order);
  });
  return recountParty({ ...party, orders: [...byId.values()] }, dateObj);
};

const addOrMergeParties = (parties, incoming, dateObj) => {
  const byParty = new Map(parties.map((party) => [party.partyId, party]));
  incoming.forEach((next) => {
    const existing = byParty.get(next.partyId);
    if (!existing) {
      byParty.set(next.partyId, recountParty(next, dateObj));
      return;
    }
    byParty.set(
      next.partyId,
      mergePartyOrders(existing, next.orders || [], dateObj),
    );
  });
  return [...byParty.values()];
};

const buildPartiesData = (
  orders,
  partyCache,
  partyIdsOnRoute,
  partyToRouteMap,
  selectedDateObj,
) => {
  const dayStart = startOfDay(selectedDateObj).getTime();
  const dayEnd = endOfDay(selectedDateObj).getTime();
  const partyMap = {};

  orders.forEach((order) => {
    const { partyId } = order;
    if (!partyId) return;
    if ((order.balance || 0) <= MIN_LIST_BALANCE) return;

    if (!partyMap[partyId]) {
      const partyData = partyCache[partyId] || {};
      const routeInfo = partyToRouteMap[partyId] || null;
      partyMap[partyId] = {
        partyId,
        partyName: partyData.name || 'Unknown Party',
        contact: partyData.contact || '',
        creditDays: partyData.creditDays,
        routeId: routeInfo?.routeId || 'miscellaneous',
        routeName: routeInfo?.routeName || 'Miscellaneous',
        routeWeekday: routeInfo?.routeWeekday ?? null,
        isOnRoute: partyIdsOnRoute.has(partyId),
        orders: [],
        totalPending: 0,
        dueTodayAmount: 0,
        overdueAmount: 0,
      };
    }

    partyMap[partyId].orders.push(order);
    partyMap[partyId].totalPending += order.balance || 0;

    const scheduled = order.schedulePaymentDate || 0;
    if (scheduled < dayStart) {
      partyMap[partyId].overdueAmount += order.balance || 0;
    } else if (scheduled <= dayEnd) {
      partyMap[partyId].dueTodayAmount += order.balance || 0;
    }
  });

  Object.values(partyMap).forEach((party) => {
    party.orders = sortOrdersByBillDate(party.orders);
  });

  return Object.values(partyMap);
};

/** Rebuild a party from a saved entry's frozen bill snapshot. */
const partyFromEntry = (entry) => {
  const bills = (entry.bills || []).filter(
    (bill) => (bill.balance || 0) > MIN_LIST_BALANCE,
  );
  return {
    partyId: entry.partyId,
    partyName: entry.partyName || 'Unknown Party',
    contact: '',
    creditDays: undefined,
    routeId: entry.routeId || 'miscellaneous',
    routeName: entry.routeName || 'Miscellaneous',
    routeWeekday: entry.routeWeekday ?? null,
    isOnRoute: !!entry.routeId && entry.routeId !== 'miscellaneous',
    orders: bills.map((bill) => {
      const rescheduleDate = billRescheduleDate(bill);
      return {
        id: bill.billId,
        billNumber: bill.billNumber,
        billCreationTime: bill.billDate,
        orderAmount: bill.amount,
        balance: bill.balance,
        schedulePaymentDate: rescheduleDate
          ? parseDateKey(rescheduleDate).getTime()
          : bill.schedulePaymentDate,
        rescheduleDate,
      };
    }),
    totalPending: bills.reduce((sum, b) => sum + (b.balance || 0), 0),
    dueTodayAmount: 0,
    overdueAmount: 0,
  };
};

function CashierDashboard() {
  const { currentCompanyId, getCurrentCompanyName } = useCompany();
  const { user } = useCurrentUser();
  const { allUsers } = useAuthUser();
  const toasterId = useId('cashier-toaster');
  const { dispatchToast } = useToastController(toasterId);
  const [printKind, setPrintKind] = useState('collection');

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadedBillCount, setLoadedBillCount] = useState(0);
  const [partiesData, setPartiesData] = useState([]);
  const [expandedParty, setExpandedParty] = useState(null);
  const [routeList, setRouteList] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('all');
  const [visibleDue, setVisibleDue] = useState(INITIAL_VISIBLE_PARTIES);
  const [visibleCarryOver, setVisibleCarryOver] = useState(
    INITIAL_VISIBLE_PARTIES,
  );

  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));

  const [entriesByParty, setEntriesByParty] = useState({});
  const [paymentWindowDays, setPaymentWindowDays] = useState(
    DEFAULT_PAYMENT_WINDOW_DAYS,
  );
  const [dayStatus, setDayStatus] = useState(null);
  const [closing, setClosing] = useState(false);
  const [paymentsCache, setPaymentsCache] = useState(null);
  const attachRequestRef = useRef(0);
  const entriesByPartyRef = useRef({});

  const dayClosed = dayStatus?.status === 'CLOSED';

  const clearDashboard = () => {
    attachRequestRef.current += 1;
    setHasLoaded(false);
    setLoading(false);
    setLoadedBillCount(0);
    setPartiesData([]);
    setEntriesByParty({});
    entriesByPartyRef.current = {};
    setDayStatus(null);
    setPaymentsCache(null);
    setRouteList([]);
    setExpandedParty(null);
    setSelectedRoute('all');
  };

  useEffect(() => {
    clearDashboard();
  }, [currentCompanyId, selectedDate]);

  useEffect(() => {
    setVisibleDue(INITIAL_VISIBLE_PARTIES);
    setVisibleCarryOver(INITIAL_VISIBLE_PARTIES);
  }, [selectedRoute, partiesData]);

  useEffect(() => {
    entriesByPartyRef.current = entriesByParty;
  }, [entriesByParty]);

  const autoAttachUnlinkedPayments = async ({
    requestId,
    companyId,
    dateKey,
    parties,
    entriesByParty: loadedEntries,
  }) => {
    try {
      const [paymentsByParty, claimed] = await Promise.all([
        fetchPaymentsInWindow(companyId, dateKey, PAYMENT_LOOKUP_DAYS),
        fetchClaimedPaymentIds(companyId, dateKey, PAYMENT_LOOKUP_DAYS),
      ]);
      if (requestId !== attachRequestRef.current) return;

      setPaymentsCache({ byParty: paymentsByParty, claimed });

      const jobs = buildAutoAttachJobs(
        parties,
        loadedEntries,
        paymentsByParty,
        claimed,
        dateKey,
      );
      if (!jobs.length) return;

      const saved = (
        await Promise.allSettled(
          jobs.map(async ({ party, payments, existing }) => {
            const latest = entriesByPartyRef.current[party.partyId] || existing;
            if (entryHasLinkedPayments(latest)) return null;
            return saveEntry(companyId, dateKey, party, {
              payments,
              notes: latest?.notes || '',
              rescheduleByBill: {},
              existingBills: latest?.bills || [],
            });
          }),
        )
      )
        .filter((result) => result.status === 'fulfilled' && result.value)
        .map((result) => result.value);
      if (requestId !== attachRequestRef.current || !saved.length) return;

      setEntriesByParty((prev) => {
        const next = { ...prev };
        saved.forEach((entry) => {
          if (entryHasLinkedPayments(prev[entry.partyId])) return;
          next[entry.partyId] = entry;
        });
        entriesByPartyRef.current = next;
        return next;
      });

      showToast(
        dispatchToast,
        `Linked recent payments for ${saved.length} parties`,
        'success',
      );
    } catch (error) {
      console.error('Error auto-linking recent payments:', error);
      if (requestId === attachRequestRef.current) {
        setPaymentsCache({ byParty: new Map(), claimed: new Map() });
        showToast(dispatchToast, 'Could not auto-link recent payments', 'error');
      }
    }
  };

  const fetchDashboard = async () => {
    const requestId = ++attachRequestRef.current;

    try {
      setLoading(true);
      setLoadedBillCount(0);
      setPaymentsCache(null);

      const selectedDateObj = parseDateKey(selectedDate);
      const windowEnd = endOfDay(selectedDate).getTime();

      const [{ partyIdsOnRoute, partyToRouteMap, routes }, orders] =
        await Promise.all([
          fetchRoutesForDay(currentCompanyId, selectedDateObj),
          fetchAllScheduledOrders(
            currentCompanyId,
            windowEnd,
            setLoadedBillCount,
          ),
        ]);

      const partyCache = await fetchPartyDetails(
        currentCompanyId,
        orders.map((o) => o.partyId),
      );

      let parties = buildPartiesData(
        orders,
        partyCache,
        partyIdsOnRoute,
        partyToRouteMap,
        selectedDateObj,
      );

      const [entries, status, moved] = await Promise.all([
        fetchEntriesForDate(currentCompanyId, selectedDate),
        fetchDayStatus(currentCompanyId, selectedDate),
        fetchOrdersRescheduledOnDate(currentCompanyId, selectedDate).catch(
          (error) => {
            console.error('Error recovering rescheduled bills:', error);
            return [];
          },
        ),
      ]);

      const byParty = {};
      entries.forEach((entry) => {
        byParty[entry.partyId] = entry;
      });

      const extraCache = await fetchPartyDetails(currentCompanyId, [
        ...moved.map((order) => order.partyId),
        ...entries.map((entry) => entry.partyId),
      ]);
      const cache = { ...partyCache, ...extraCache };

      parties = addOrMergeParties(
        parties,
        buildPartiesData(
          moved,
          cache,
          partyIdsOnRoute,
          partyToRouteMap,
          selectedDateObj,
        ),
        selectedDateObj,
      );
      parties = addOrMergeParties(
        parties,
        entries
          .filter((entry) => (entry.bills || []).length > 0)
          .map(partyFromEntry),
        selectedDateObj,
      );

      parties.sort((a, b) => {
        if (a.isOnRoute && !b.isOnRoute) return -1;
        if (!a.isOnRoute && b.isOnRoute) return 1;
        return (
          b.overdueAmount - a.overdueAmount || b.totalPending - a.totalPending
        );
      });

      if (requestId !== attachRequestRef.current) return;
      setEntriesByParty(byParty);
      entriesByPartyRef.current = byParty;
      setDayStatus(status);
      setPartiesData(parties);
      setRouteList(routes || []);
      setHasLoaded(true);
      setLoading(false);

      if (status?.status === 'CLOSED') {
        setPaymentsCache({ byParty: new Map(), claimed: new Map() });
        return;
      }
      void autoAttachUnlinkedPayments({
        requestId,
        companyId: currentCompanyId,
        dateKey: selectedDate,
        parties,
        entriesByParty: byParty,
      });
    } catch (error) {
      console.error('Error loading cashier dashboard:', error);
      if (requestId !== attachRequestRef.current) return;
      showToast(dispatchToast, 'Could not load the dashboard', 'error');
      setLoading(false);
    }
  };

  const persistEntry = async (
    party,
    payments,
    notes,
    rescheduleByBill = {},
  ) => {
    const existing = entriesByParty[party.partyId];
    const hasPayments = (payments || []).length > 0;
    const hasNotes = !!(notes || '').trim();
    const hasReschedule =
      Object.keys(rescheduleByBill).length > 0 ||
      (existing?.bills || []).some((bill) => billRescheduleDate(bill));

    if (!hasPayments && !hasNotes && !hasReschedule) {
      if (existing) {
        await cancelEntry(currentCompanyId, selectedDate, party.partyId);
      }
      setEntriesByParty((prev) => {
        const next = { ...prev };
        delete next[party.partyId];
        return next;
      });
      return null;
    }
    const entry = await saveEntry(currentCompanyId, selectedDate, party, {
      payments,
      notes: notes || '',
      rescheduleByBill,
      existingBills: existing?.bills || [],
    });
    setEntriesByParty((prev) => ({ ...prev, [party.partyId]: entry }));
    return entry;
  };

  const applyLocalReschedule = (orderIds, newDate) => {
    const ids = new Set(orderIds);
    const newTime = newDate.getTime();
    const dateObj = parseDateKey(selectedDate);
    setPartiesData((prev) =>
      prev.map((party) => {
        if (!party.orders.some((order) => ids.has(order.id))) return party;
        return recountParty(
          {
            ...party,
            orders: party.orders.map((order) =>
              ids.has(order.id)
                ? {
                    ...order,
                    schedulePaymentDate: newTime,
                    lastRescheduledAt: Date.now(),
                  }
                : order,
            ),
          },
          dateObj,
        );
      }),
    );
  };

  const filteredParties = useMemo(() => {
    if (selectedRoute === 'all') return partiesData;
    if (selectedRoute === 'miscellaneous') {
      return partiesData.filter((p) => p.routeId === 'miscellaneous');
    }
    return partiesData.filter((p) => p.routeId === selectedRoute);
  }, [selectedRoute, partiesData]);

  const stats = useMemo(
    () => ({
      dueToday: filteredParties.reduce((sum, p) => sum + p.dueTodayAmount, 0),
      overdue: filteredParties.reduce((sum, p) => sum + p.overdueAmount, 0),
      partyCount: filteredParties.length,
    }),
    [filteredParties],
  );

  // A closed day is rendered wholly from snapshots, so everything belongs in
  // the main section - splitting it would hide entries for parties that only
  // ever had overdue bills.
  const rescheduledToday = (party) =>
    wasPartyRescheduled(party, entriesByParty[party.partyId], selectedDate);

  const dueParties = useMemo(
    () =>
      dayClosed
        ? filteredParties
        : filteredParties.filter(
            (p) => p.dueTodayAmount > 0 || rescheduledToday(p),
          ),
    [filteredParties, dayClosed, selectedDate, entriesByParty],
  );
  const carryOverParties = useMemo(
    () =>
      dayClosed
        ? []
        : filteredParties.filter(
            (p) => p.dueTodayAmount <= 0 && !rescheduledToday(p),
          ),
    [filteredParties, dayClosed, selectedDate, entriesByParty],
  );

  const attendedCount = dueParties.filter((p) =>
    isPartyActioned(p, entriesByParty[p.partyId], selectedDate),
  ).length;
  const pendingCount = dueParties.length - attendedCount;
  const canClose = !dayClosed && pendingCount === 0;

  const collectedTotals = useMemo(() => {
    const allowed = new Set(filteredParties.map((p) => p.partyId));
    const entries = Object.values(entriesByParty);
    return buildReportTotals(
      selectedRoute === 'all'
        ? entries
        : entries.filter((entry) => allowed.has(entry.partyId)),
    );
  }, [entriesByParty, filteredParties, selectedRoute]);

  const handleUpdateParty = async (
    party,
    { creditDays, contact, routeId, routeWeekday },
  ) => {
    try {
      const dateObj = parseDateKey(selectedDate);
      const updated = await updatePartyCreditAndRoute(
        currentCompanyId,
        party.partyId,
        { creditDays, contact, routeId, routeWeekday },
        dateObj,
      );
      setPartiesData((prev) =>
        prev.map((item) =>
          item.partyId === party.partyId ? { ...item, ...updated } : item,
        ),
      );
      showToast(dispatchToast, `Updated ${party.partyName}`, 'success');
    } catch (error) {
      console.error('Error updating party:', error);
      showToast(dispatchToast, 'Could not update the party', 'error');
      throw error;
    }
  };

  const handleSaveParty = async (
    party,
    { notes, payments, rescheduleByBill },
  ) => {
    try {
      await persistEntry(
        party,
        payments || [],
        notes,
        rescheduleByBill || {},
      );
      showToast(dispatchToast, `Saved ${party.partyName}`, 'success');
    } catch (error) {
      console.error('Error saving party collection:', error);
      showToast(dispatchToast, 'Could not save', 'error');
    }
  };

  const handleClearEntry = async (party) => {
    try {
      await cancelEntry(currentCompanyId, selectedDate, party.partyId);
      setEntriesByParty((prev) => {
        const next = { ...prev };
        delete next[party.partyId];
        return next;
      });
      showToast(dispatchToast, `Cleared ${party.partyName}`, 'success');
    } catch (error) {
      console.error('Error clearing collection entry:', error);
      showToast(dispatchToast, 'Could not clear the entry', 'error');
    }
  };

  const handleCloseDay = async () => {
    if (!canClose || closing) return;
    setClosing(true);
    try {
      const snapshots = await snapshotPartiesForClose(
        currentCompanyId,
        selectedDate,
        partiesData,
        entriesByParty,
      );
      const byParty = {};
      snapshots.forEach((entry) => {
        byParty[entry.partyId] = entry;
      });
      setEntriesByParty(byParty);
      const marker = await closeDay(currentCompanyId, selectedDate);
      setDayStatus(marker);
      showToast(dispatchToast, 'Day closed', 'success');
    } catch (error) {
      console.error('Error closing day:', error);
      showToast(dispatchToast, 'Could not close the day', 'error');
    }
    setClosing(false);
  };

  const handleReopenDay = async () => {
    if (closing) return;
    setClosing(true);
    try {
      await reopenDay(currentCompanyId, selectedDate);
      showToast(dispatchToast, 'Day reopened', 'success');
      await fetchDashboard();
    } catch (error) {
      console.error('Error reopening day:', error);
      showToast(dispatchToast, 'Could not reopen the day', 'error');
    }
    setClosing(false);
  };

  const handlePrint = (kind) => {
    flushSync(() => setPrintKind(kind));
    window.print();
  };

  const handlePartyReschedule = async (orders, newDate) => {
    try {
      await reschedulePartyOrders(currentCompanyId, orders, newDate);
      applyLocalReschedule(
        orders.map((order) => order.id),
        newDate,
      );
    } catch (error) {
      console.error('Error rescheduling party bills:', error);
      showToast(dispatchToast, 'Could not reschedule the bills', 'error');
    }
  };

  const handleCall = (contact) => {
    if (contact) window.open(`tel:${contact}`);
  };

  const getBillStatus = (order) => {
    const dayStart = startOfDay(selectedDate).getTime();
    const scheduled = order.schedulePaymentDate;
    if (!scheduled) return 'NOT_SCHEDULED';
    const scheduledStart = startOfDay(new Date(scheduled)).getTime();
    if (scheduledStart < dayStart) return 'OVERDUE';
    if (scheduledStart === dayStart) return 'DUE_TODAY';
    return 'UPCOMING';
  };

  const getRouteFilterLabel = () => {
    if (selectedRoute === 'all') return 'All Routes';
    if (selectedRoute === 'miscellaneous') return 'Miscellaneous';
    return routeList.find((r) => r.id === selectedRoute)?.name || 'Unknown';
  };

  const hasMiscellaneous = partiesData.some(
    (p) => p.routeId === 'miscellaneous',
  );

  let closeButtonLabel = 'Close day';
  if (closing) closeButtonLabel = 'Closing...';
  else if (pendingCount > 0) {
    closeButtonLabel = `Close day (${pendingCount} pending)`;
  }

  const dueSectionTitle = dayClosed
    ? `Collections on ${formatLongDate(selectedDate)}`
    : `Due ${formatLongDate(selectedDate)}`;

  const renderPartyCard = (party) => (
    <PartyCard
      key={party.partyId}
      party={party}
      expanded={expandedParty === party.partyId}
      onToggle={() =>
        setExpandedParty(expandedParty === party.partyId ? null : party.partyId)
      }
      onCall={handleCall}
      onPartyReschedule={handlePartyReschedule}
      getBillStatus={getBillStatus}
      entry={entriesByParty[party.partyId]}
      locked={dayClosed}
      collectionDate={selectedDate}
      windowDays={paymentWindowDays}
      onWindowDaysChange={setPaymentWindowDays}
      paymentsCache={paymentsCache}
      onSaveParty={(payload) => handleSaveParty(party, payload)}
      onClearEntry={handleClearEntry}
      routes={routeList}
      onUpdateParty={handleUpdateParty}
    />
  );

  const loadingPayments = hasLoaded && !paymentsCache;

  const renderSection = (title, parties, count, setCount) => (
    <div className="parties-section">
      <Text weight="semibold" size={400}>
        {title} ({parties.length})
      </Text>
      <div className="parties-list">
        {parties.length === 0 ? (
          <div className="empty-state">
            <Text size={200}>Nothing here.</Text>
          </div>
        ) : (
          parties.slice(0, count).map(renderPartyCard)
        )}
        {parties.length > count && (
          <div className="parties-list-more">
            <Text size={200}>
              Showing {count} of {parties.length} parties
            </Text>
            <Button onClick={() => setCount(count + VISIBLE_PARTIES_STEP)}>
              Show more
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Toaster toasterId={toasterId} />

      <div className="cashier-dashboard no-print">
        <div className="cashier-dashboard-header">
          <h1>Payment Dashboard</h1>
        </div>

        <div className="date-controls">
          <DatePicker
            className="date-picker"
            value={parseDateKey(selectedDate)}
            onSelectDate={(d) => {
              if (!d) return;
              const next = toDateKey(d);
              if (next !== selectedDate) setSelectedDate(next);
            }}
          />
          <Button
            appearance={hasLoaded ? 'secondary' : 'primary'}
            disabled={loading || !currentCompanyId}
            onClick={fetchDashboard}
          >
            {loading ? 'Loading...' : hasLoaded ? 'Refresh' : 'Load'}
          </Button>
          {loadingPayments && (
            <span className="payments-loading">
              <Spinner size="tiny" />
              Loading payments...
            </span>
          )}

          {hasLoaded && (
            <>
              <div className="date-controls-spacer" />

              <Button
                icon={<Print20Regular />}
                onClick={() => handlePrint('collection')}
              >
                Print report
              </Button>
              <Button
                icon={<Print20Regular />}
                onClick={() => handlePrint('bills')}
              >
                Print bills
              </Button>

              {!dayClosed && (
                <Button
                  appearance="primary"
                  icon={<LockClosed20Regular />}
                  disabled={!canClose || closing}
                  onClick={handleCloseDay}
                >
                  {closeButtonLabel}
                </Button>
              )}

              {dayClosed && user?.isManager && (
                <Button
                  icon={<LockOpen20Regular />}
                  disabled={closing}
                  onClick={handleReopenDay}
                >
                  Reopen day
                </Button>
              )}
            </>
          )}
        </div>

        {loading ? (
          <div className="cashier-dashboard-loading">
            <Spinner
              label={
                loadedBillCount
                  ? `Loaded ${loadedBillCount} bills...`
                  : 'Loading payment dashboard...'
              }
            />
          </div>
        ) : !hasLoaded ? (
          <Card appearance="outline">
            <div className="empty-state">
              <Text>Select a date and click Load.</Text>
            </div>
          </Card>
        ) : (
          <>
            <div className="summary-cards">
              <Card appearance="outline" className="summary-card due-today-card">
                <CardHeader header={<Text weight="semibold">Due</Text>} />
                <div className="summary-value">
                  {formatCurrency(stats.dueToday)}
                </div>
              </Card>

              <Card appearance="outline" className="summary-card overdue-card">
                <CardHeader header={<Text weight="semibold">Overdue</Text>} />
                <div className="summary-value">
                  {formatCurrency(stats.overdue)}
                </div>
              </Card>

              <Card appearance="outline" className="summary-card count-card">
                <CardHeader header={<Text weight="semibold">Parties</Text>} />
                <div className="summary-value">{stats.partyCount}</div>
              </Card>

              <Card appearance="outline" className="summary-card collected-card">
                <CardHeader header={<Text weight="semibold">Collected</Text>} />
                <div className="summary-value">
                  {formatCurrency(collectedTotals.total)}
                </div>
                <div className="summary-breakdown">
                  {PAYMENT_MODES.filter((mode) => collectedTotals[mode] > 0).map(
                    (mode) => (
                      <span key={mode}>
                        {mode} {formatCurrency(collectedTotals[mode])}
                      </span>
                    ),
                  )}
                </div>
                {dueParties.length > 0 && (
                  <div className="summary-progress">
                    {attendedCount} of {dueParties.length} due parties attended
                  </div>
                )}
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

            {filteredParties.length === 0 ? (
              <Card appearance="outline">
                <div className="empty-state">
                  <Text>
                    No scheduled payments found for{' '}
                    {formatLongDate(selectedDate)}
                  </Text>
                </div>
              </Card>
            ) : (
              <>
                {renderSection(
                  dueSectionTitle,
                  dueParties,
                  visibleDue,
                  setVisibleDue,
                )}

                {!dayClosed &&
                  carryOverParties.length > 0 &&
                  renderSection(
                    'Overdue',
                    carryOverParties,
                    visibleCarryOver,
                    setVisibleCarryOver,
                  )}
              </>
            )}
          </>
        )}
      </div>

      <div className={`print-only print-kind-${printKind}`}>
        <DayReportPrintView
          printKind={printKind}
          dateKey={selectedDate}
          parties={filteredParties}
          entriesByParty={entriesByParty}
          dayStatus={dayStatus}
          companyName={getCurrentCompanyName()}
          users={allUsers}
        />
      </div>
    </>
  );
}

export default CashierDashboard;
