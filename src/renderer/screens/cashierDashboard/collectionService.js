/**
 * Firestore access for the cashier collection dashboard.
 *
 * Nothing here writes to `orders` except the reschedule helpers, which only
 * touch scheduling fields. Bill balances are owned by the ERP outstanding
 * import, so collection entries are standalone records.
 */

import {
  arrayUnion,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import { firebaseAuth, firebaseDB } from '../../firebaseInit';

const ORDERS_PAGE_SIZE = 500;
const MAX_ORDERS_FOR_TESTING = 2000;
const PARTY_CHUNK_SIZE = 10;
const RESCHEDULE_CHUNK_SIZE = 500;
const ENTRY_BATCH_SIZE = 400;

export const PAYMENT_MODES = ['CASH', 'CHEQUE', 'UPI', 'NEFT'];

export const PAYMENT_WINDOW_PRESETS = [2, 7, 10, 30];
export const DEFAULT_PAYMENT_WINDOW_DAYS = 7;
export const AUTO_ATTACH_WINDOW_DAYS = 4;
export const PAYMENT_LOOKUP_DAYS = Math.max(...PAYMENT_WINDOW_PRESETS);
export const MIN_LIST_BALANCE = 4;

export const ROUTE_WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const weekdayIndexFromDate = (dateObj) =>
  (dateObj.getDay() + 6) % 7;

/** `YYYY-MM-DD` in local time. `toISOString()` would shift the day. */
export const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Parse `YYYY-MM-DD` as local midnight. `new Date(key)` would parse as UTC. */
export const parseDateKey = (key) => {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const startOfDay = (value) => {
  const date = value instanceof Date ? new Date(value) : parseDateKey(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const startOfTomorrow = () => {
  const date = startOfDay(new Date());
  date.setDate(date.getDate() + 1);
  return date;
};

export const isFutureDate = (value) =>
  !!value && startOfDay(value).getTime() >= startOfTomorrow().getTime();

export const endOfDay = (value) => {
  const date = value instanceof Date ? new Date(value) : parseDateKey(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const windowBounds = (dateKey, windowDays) => {
  const center = parseDateKey(dateKey);
  const from = new Date(center);
  from.setDate(from.getDate() - windowDays);
  const to = new Date(center);
  to.setDate(to.getDate() + windowDays);
  return { fromMs: startOfDay(from).getTime(), toMs: endOfDay(to).getTime() };
};

const inWindow = (timestamp, fromMs, toMs) =>
  timestamp >= fromMs && timestamp <= toMs;

export const paymentsInWindow = (payments, dateKey, windowDays) => {
  const { fromMs, toMs } = windowBounds(dateKey, windowDays);
  return (payments || []).filter((payment) =>
    inWindow(payment.timestamp || 0, fromMs, toMs),
  );
};

export const isPastDate = (dateKey) => dateKey < toDateKey(new Date());

export const wasRescheduledOnDate = (order, dateKey) => {
  if (!order || !dateKey) return false;
  const from = startOfDay(dateKey).getTime();
  const to = endOfDay(dateKey).getTime();
  if (
    order.lastRescheduledAt &&
    order.lastRescheduledAt >= from &&
    order.lastRescheduledAt <= to
  ) {
    return true;
  }
  return (order.rescheduleHistory || []).some((event) => {
    const at = event?.at || 0;
    return at >= from && at <= to;
  });
};

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);

export const formatDate = (value) => {
  if (!value) return 'N/A';
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
      ? parseDateKey(value)
      : value instanceof Date
        ? value
        : new Date(value);
  return date.toLocaleDateString('en-IN');
};

/** `29/7/2026 (2d)` relative to the dashboard selected date. */
export const formatDateRel = (value, selectedKey) => {
  if (!value) return 'N/A';
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
      ? parseDateKey(value)
      : value instanceof Date
        ? value
        : new Date(value);
  const label = formatDate(date);
  if (!selectedKey) return label;
  const days = Math.round(
    (startOfDay(date).getTime() - startOfDay(selectedKey).getTime()) /
      86400000,
  );
  return `${label} (${days}d)`;
};

export const formatLongDate = (dateKey) =>
  parseDateKey(dateKey).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const currentUser = () => ({
  uid: firebaseAuth.currentUser?.uid || 'unknown',
  name:
    firebaseAuth.currentUser?.displayName ||
    firebaseAuth.currentUser?.email ||
    firebaseAuth.currentUser?.uid ||
    'Unknown',
});

/* ------------------------------------------------------------------ orders */

/**
 * Page through every unpaid bill scheduled on or before the given day.
 * The orderBy pair must stay in this order to match the composite index
 * on orders (schedulePaymentDate ASC, balance ASC).
 */
export const fetchAllScheduledOrders = async (
  companyId,
  endOfDayMs,
  onProgress,
) => {
  const ordersRef = getCompanyCollection(companyId, DB_NAMES.ORDERS);
  const orders = [];
  let cursor = null;

  for (;;) {
    const constraints = [
      where('schedulePaymentDate', '<=', endOfDayMs),
      where('balance', '>', MIN_LIST_BALANCE),
      orderBy('schedulePaymentDate'),
      orderBy('balance'),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const pageSize = Math.min(
      ORDERS_PAGE_SIZE,
      MAX_ORDERS_FOR_TESTING - orders.length,
    );
    constraints.push(limit(pageSize));

    // eslint-disable-next-line no-await-in-loop
    const snapshot = await getDocs(query(ordersRef, ...constraints));
    snapshot.docs.forEach((d) => orders.push({ id: d.id, ...d.data() }));

    if (onProgress) onProgress(orders.length);
    if (orders.length >= MAX_ORDERS_FOR_TESTING) break;
    if (snapshot.docs.length < pageSize) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return orders;
};

export const fetchPartyDetails = async (companyId, partyIds) => {
  const cache = {};
  const unique = [...new Set(partyIds.filter(Boolean))];
  const chunks = [];
  for (let i = 0; i < unique.length; i += PARTY_CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + PARTY_CHUNK_SIZE));
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      const snap = await getDocs(
        query(
          getCompanyCollection(companyId, DB_NAMES.PARTIES),
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

export const fetchRoutesForDay = async (companyId, dateObj) => {
  const routeIndex = (dateObj.getDay() + 6) % 7;
  const snapshot = await getDocs(
    getCompanyCollection(companyId, DB_NAMES.MR_ROUTES),
  );

  const partyIdsOnRoute = new Set();
  const partyToRouteMap = {};
  const routes = [];

  snapshot.docs.forEach((docSnap) => {
    const route = docSnap.data();
    const routeName = route.name || docSnap.id;
    routes.push({ id: docSnap.id, name: routeName });
    const days = route.route || [];
    const todayParties = days[routeIndex]?.parties || [];
    todayParties.forEach((partyId) => {
      partyIdsOnRoute.add(partyId);
      partyToRouteMap[partyId] = {
        routeId: docSnap.id,
        routeName,
        routeWeekday: routeIndex,
      };
    });
    days.forEach((routeDay, index) => {
      (routeDay?.parties || []).forEach((partyId) => {
        if (!partyToRouteMap[partyId]) {
          partyToRouteMap[partyId] = {
            routeId: docSnap.id,
            routeName,
            routeWeekday: index,
          };
        }
      });
    });
  });

  return { partyIdsOnRoute, partyToRouteMap, routes };
};

export const fetchPartyRouteAssignment = async (companyId, partyId) => {
  if (!companyId || !partyId) return null;
  const snapshot = await getDocs(
    getCompanyCollection(companyId, DB_NAMES.MR_ROUTES),
  );
  let found = null;
  snapshot.docs.forEach((docSnap) => {
    const route = docSnap.data();
    (route.route || []).forEach((day, index) => {
      if (found || !(day.parties || []).includes(partyId)) return;
      found = {
        routeId: docSnap.id,
        routeName: route.name || docSnap.id,
        routeWeekday: index,
      };
    });
  });
  return found;
};

export const updatePartyCreditAndRoute = async (
  companyId,
  partyId,
  { creditDays, contact, routeId, routeWeekday },
  dateObj,
) => {
  const parsed =
    creditDays === '' || creditDays == null
      ? null
      : parseInt(creditDays, 10);
  const creditValue =
    Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const contactValue = (contact || '').trim();

  await updateDoc(getCompanyDoc(companyId, DB_NAMES.PARTIES, partyId), {
    creditDays: creditValue,
    contact: contactValue,
  });

  if (routeId === undefined) {
    return { creditDays: creditValue, contact: contactValue };
  }

  const todayIndex = weekdayIndexFromDate(dateObj || new Date());
  const parsedWeekday = parseInt(routeWeekday, 10);
  const routeIndex = Number.isInteger(parsedWeekday)
    ? parsedWeekday
    : todayIndex;
  const snapshot = await getDocs(
    getCompanyCollection(companyId, DB_NAMES.MR_ROUTES),
  );
  const batch = writeBatch(firebaseDB);
  let writes = 0;
  let routeName = 'Miscellaneous';
  let isOnRoute = false;

  snapshot.docs.forEach((docSnap) => {
    const route = docSnap.data();
    const days = route.route || [];
    let changed = false;
    const nextDays = days.map((day, index) => {
      const parties = [...(day.parties || [])];
      const had = parties.includes(partyId);
      const shouldHave =
        routeId &&
        routeId !== 'miscellaneous' &&
        docSnap.id === routeId &&
        index === routeIndex;
      if (had && !shouldHave) {
        changed = true;
        return {
          ...day,
          parties: parties.filter((id) => id !== partyId),
        };
      }
      if (!had && shouldHave) {
        changed = true;
        return { ...day, parties: [...parties, partyId] };
      }
      return day;
    });
    if (docSnap.id === routeId) {
      routeName = route.name || docSnap.id;
      isOnRoute =
        routeIndex === todayIndex &&
        (nextDays[routeIndex]?.parties || []).includes(partyId);
    }
    if (changed) {
      batch.update(docSnap.ref, { route: nextDays });
      writes += 1;
    }
  });

  if (writes > 0) await batch.commit();
  return {
    creditDays: creditValue,
    contact: contactValue,
    routeId: routeId || 'miscellaneous',
    routeName:
      routeId && routeId !== 'miscellaneous' ? routeName : 'Miscellaneous',
    routeWeekday:
      routeId && routeId !== 'miscellaneous' ? routeIndex : null,
    isOnRoute,
  };
};

const rescheduleUpdate = (order, newDate) => {
  const now = Date.now();
  const newTime = newDate.getTime();
  const update = { schedulePaymentDate: newTime, lastRescheduledAt: now };
  if (order.schedulePaymentDate) {
    update.rescheduleHistory = arrayUnion({
      from: order.schedulePaymentDate,
      to: newTime,
      by: currentUser().uid,
      at: now,
    });
  }
  return update;
};

export const rescheduleOrder = async (companyId, orderId, newDate, oldDate) => {
  if (!isFutureDate(newDate)) {
    throw new Error('Reschedule date must be after today');
  }
  return updateDoc(
    getCompanyDoc(companyId, DB_NAMES.ORDERS, orderId),
    rescheduleUpdate({ schedulePaymentDate: oldDate }, newDate),
  );
};

export const reschedulePartyOrders = async (companyId, orders, newDate) => {
  if (!isFutureDate(newDate)) {
    throw new Error('Reschedule date must be after today');
  }
  const pending = orders.filter(
    (order) =>
      !order.schedulePaymentDate ||
      new Date(order.schedulePaymentDate).toDateString() !==
        newDate.toDateString(),
  );
  if (pending.length === 0) return;

  for (let i = 0; i < pending.length; i += RESCHEDULE_CHUNK_SIZE) {
    const batch = writeBatch(firebaseDB);
    pending.slice(i, i + RESCHEDULE_CHUNK_SIZE).forEach((order) => {
      batch.update(
        getCompanyDoc(companyId, DB_NAMES.ORDERS, order.id),
        rescheduleUpdate(order, newDate),
      );
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
};

/* ------------------------------------------------------- collection entries */

export const entryDocId = (dateKey, partyId) => `${dateKey}_${partyId}`;

export const sumPayments = (payments = []) =>
  payments.reduce((total, p) => total + (parseInt(p.amount, 10) || 0), 0);

/** `YYYY-MM-DD` the cashier moved this bill to, if they did it on this entry. */
export const billRescheduleDate = (bill) => {
  if (!bill) return null;
  if (bill.rescheduleDate) {
    return typeof bill.rescheduleDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}/.test(bill.rescheduleDate)
      ? bill.rescheduleDate
      : toDateKey(bill.rescheduleDate);
  }
  if (bill.rescheduledOnDate && bill.schedulePaymentDate) {
    return toDateKey(bill.schedulePaymentDate);
  }
  return null;
};

const asDateKey = (value) => {
  if (!value) return null;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : toDateKey(value);
};

/**
 * Freeze the party's bills at save time. `rescheduleDate` is the only
 * scheduling field on the collection bill: the day they moved it to.
 */
export const buildBillsSnapshot = (
  orders,
  rescheduleByBill = {},
  existingBills = [],
  collectionDate = null,
) => {
  const existingById = {};
  (existingBills || []).forEach((bill) => {
    if (bill?.billId) existingById[bill.billId] = bill;
  });

  return (orders || []).map((order) => {
    const billTime = order.billCreationTime || order.creationTime || 0;
    const existing = existingById[order.id] || {};
    const fromForm = rescheduleByBill[order.id];
    const rescheduleDate = fromForm
      ? asDateKey(fromForm)
      : billRescheduleDate(existing) ||
        asDateKey(order.rescheduleDate) ||
        (collectionDate &&
        wasRescheduledOnDate(order, collectionDate) &&
        order.schedulePaymentDate
          ? toDateKey(order.schedulePaymentDate)
          : null);
    return {
      billId: order.id,
      billNumber: order.billNumber || order.id,
      billDate: billTime,
      amount: order.orderAmount || 0,
      balance: order.balance || 0,
      rescheduleDate,
    };
  });
};

export const fetchEntriesForDate = async (companyId, dateKey) => {
  const snapshot = await getDocs(
    query(
      getCompanyCollection(companyId, DB_NAMES.COLLECTION_ENTRIES),
      where('collectionDate', '==', dateKey),
    ),
  );
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((entry) => entry.status !== 'CANCELLED');
};

export const fetchEntriesForRange = async (companyId, fromKey, toKey) => {
  const snapshot = await getDocs(
    query(
      getCompanyCollection(companyId, DB_NAMES.COLLECTION_ENTRIES),
      where('collectionDate', '>=', fromKey),
      where('collectionDate', '<=', toKey),
    ),
  );
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((entry) => entry.status !== 'CANCELLED');
};

const paymentDateKey = (payment, fallback) => {
  if (payment?.date) return payment.date;
  if (payment?.timestamp) return toDateKey(payment.timestamp);
  return fallback || '';
};

export const paymentToEntryRow = (payment, dateKey) => ({
  mode: payment.mode,
  amount: parseInt(payment.amount, 10) || 0,
  date: payment.date || paymentDateKey(payment, dateKey),
  sourceRef: payment.sourceRef || payment.id || null,
});

export const entryHasLinkedPayments = (entry) => {
  if (!entry || entry.status === 'CANCELLED') return false;
  if ((entry.sourceRefs || []).some(Boolean)) return true;
  return (entry.payments || []).some(
    (payment) => (parseInt(payment.amount, 10) || 0) > 0,
  );
};

/** Unlinked ±4-day payments for parties that have no saved links yet. */
export const buildAutoAttachJobs = (
  parties,
  entriesByParty,
  paymentsByParty,
  claimed,
  dateKey,
) => {
  const jobs = [];
  (parties || []).forEach((party) => {
    const existing = entriesByParty?.[party.partyId];
    if (entryHasLinkedPayments(existing)) return;
    const payments = paymentsInWindow(
      paymentsByParty?.get(party.partyId) || [],
      dateKey,
      AUTO_ATTACH_WINDOW_DAYS,
    ).filter((payment) => {
      const id = payment?.id || payment?.sourceRef;
      return id && !claimed.has(id) && (parseInt(payment.amount, 10) || 0) > 0;
    });
    if (payments.length) jobs.push({ party, payments, existing });
  });
  return jobs;
};

export const saveEntry = async (companyId, dateKey, party, form) => {
  const user = currentUser();
  const payments = (form.payments || [])
    .filter((p) => p.mode && (parseInt(p.amount, 10) || 0) > 0)
    .map((p) => paymentToEntryRow(p, dateKey));
  const sourceRefs = payments.map((p) => p.sourceRef).filter(Boolean);

  const entry = {
    partyId: party.partyId,
    partyName: party.partyName || '',
    routeId: party.routeId || '',
    routeName: party.routeName || '',
    payments,
    totalAmount: sumPayments(payments),
    notes: form.notes || '',
    bills: buildBillsSnapshot(
      party.orders || [],
      form.rescheduleByBill || {},
      form.existingBills || [],
      dateKey,
    ),
    sourceRefs,
    source: 'LINKED',
    collectionDate: dateKey,
    timestamp: Date.now(),
    createdByUserId: user.uid,
    createdByName: user.name,
    status: 'ACTIVE',
  };

  await setDoc(
    getCompanyDoc(
      companyId,
      DB_NAMES.COLLECTION_ENTRIES,
      entryDocId(dateKey, party.partyId),
    ),
    entry,
  );

  return entry;
};

/**
 * Payments already attached to a different collection date inside the window.
 * Key is the payment sourceRef, value is that other date.
 */
export const fetchClaimedPaymentIds = async (
  companyId,
  dateKey,
  windowDays = DEFAULT_PAYMENT_WINDOW_DAYS,
) => {
  const { fromMs, toMs } = windowBounds(dateKey, windowDays);
  const entries = await fetchEntriesForRange(
    companyId,
    toDateKey(fromMs),
    toDateKey(toMs),
  );

  const claimed = new Map();
  entries.forEach((entry) => {
    if (entry.collectionDate === dateKey) return;
    (entry.sourceRefs || []).forEach((id) => {
      claimed.set(id, entry.collectionDate);
    });
  });
  return claimed;
};

/**
 * Write a bills snapshot for every party still on the list at close time.
 * Payments and notes on an existing entry are kept. Without this, a day that
 * was closed after rescheduling (and with no linked payments) has nothing to
 * rebuild from, because those bills no longer match the live query.
 */
export const snapshotPartiesForClose = async (
  companyId,
  dateKey,
  parties,
  existingByParty = {},
) => {
  const user = currentUser();
  const now = Date.now();
  const docs = (parties || []).map((party) => {
    const existing = existingByParty[party.partyId];
    return {
      partyId: party.partyId,
      partyName: party.partyName || existing?.partyName || '',
      routeId: party.routeId || existing?.routeId || '',
      routeName: party.routeName || existing?.routeName || '',
      payments: existing?.payments || [],
      totalAmount: existing?.totalAmount || 0,
      notes: existing?.notes || '',
      bills: buildBillsSnapshot(
        party.orders || [],
        {},
        existing?.bills || [],
        dateKey,
      ),
      sourceRefs: existing?.sourceRefs || [],
      source: existing?.source || 'CLOSE_SNAPSHOT',
      collectionDate: dateKey,
      timestamp: existing?.timestamp || now,
      createdByUserId: existing?.createdByUserId || user.uid,
      createdByName: existing?.createdByName || user.name,
      status: 'ACTIVE',
    };
  });

  for (let i = 0; i < docs.length; i += ENTRY_BATCH_SIZE) {
    const batch = writeBatch(firebaseDB);
    docs.slice(i, i + ENTRY_BATCH_SIZE).forEach((entry) => {
      batch.set(
        getCompanyDoc(
          companyId,
          DB_NAMES.COLLECTION_ENTRIES,
          entryDocId(dateKey, entry.partyId),
        ),
        entry,
      );
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }

  return docs;
};

export const fetchOrdersRescheduledOnDate = async (companyId, dateKey) => {
  const snapshot = await getDocs(
    query(
      getCompanyCollection(companyId, DB_NAMES.ORDERS),
      where('lastRescheduledAt', '>=', startOfDay(dateKey).getTime()),
      where('lastRescheduledAt', '<=', endOfDay(dateKey).getTime()),
    ),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const cancelEntry = async (companyId, dateKey, partyId) =>
  updateDoc(
    getCompanyDoc(
      companyId,
      DB_NAMES.COLLECTION_ENTRIES,
      entryDocId(dateKey, partyId),
    ),
    { status: 'CANCELLED', cancelledAt: Date.now() },
  );

/* ------------------------------------------------ payments already recorded */

const normalizeOnlineType = (item) =>
  (item?.type || 'upi').toString().toUpperCase();

/**
 * Payments already in the system around a business date, keyed by party.
 *
 * Only cashReceipts and ONLINE_PAYMENTS are read. supplyReports.partyPayments
 * is a staging record that later becomes one of these two, so including it
 * would show the same money twice.
 */
export const fetchPaymentsInWindow = async (
  companyId,
  dateKey,
  windowDays = DEFAULT_PAYMENT_WINDOW_DAYS,
) => {
  const { fromMs, toMs } = windowBounds(dateKey, windowDays);

  const [cashSnap, onlineSnap] = await Promise.all([
    getDocs(
      query(
        getCompanyCollection(companyId, DB_NAMES.CASH_RECEIPTS),
        where('timestamp', '>=', fromMs),
        where('timestamp', '<=', toMs),
      ),
    ),
    getDocs(
      query(
        getCompanyCollection(companyId, DB_NAMES.ONLINE_PAYMENTS),
        where('timestamp', '>=', fromMs),
        where('timestamp', '<=', toMs),
      ),
    ),
  ]);

  const byParty = new Map();
  const push = (partyId, payment) => {
    if (!partyId) return;
    if (!byParty.has(partyId)) byParty.set(partyId, []);
    byParty.get(partyId).push(payment);
  };

  cashSnap.docs.forEach((docSnap) => {
    const receipt = docSnap.data();
    if (receipt.status === 'CANCELLED') return;
    // One receipt can cover several parties, so the index is part of the id.
    (receipt.prItems || []).forEach((item, index) => {
      push(item.partyId, {
        id: `cash:${docSnap.id}#${index}`,
        mode: 'CASH',
        amount: item.amount || 0,
        timestamp: receipt.timestamp,
        date: toDateKey(receipt.timestamp),
        label: receipt.cashReceiptNumber || docSnap.id,
      });
    });
  });

  onlineSnap.docs.forEach((docSnap) => {
    const payment = docSnap.data();
    if (payment.status === 'CANCELLED') return;
    push(payment.partyId, {
      id: `online:${docSnap.id}`,
      mode: normalizeOnlineType(payment),
      amount: payment.amount || 0,
      timestamp: payment.timestamp,
      date: toDateKey(payment.timestamp),
      label:
        payment.chequeNumber ||
        payment.billNumber ||
        payment.comment ||
        docSnap.id,
    });
  });

  byParty.forEach((list) => list.sort((a, b) => b.timestamp - a.timestamp));
  return byParty;
};

/* ---------------------------------------------------------- day open/closed */

export const fetchDayStatus = async (companyId, dateKey) => {
  const snapshot = await getDoc(
    getCompanyDoc(companyId, DB_NAMES.COLLECTION_DAYS, dateKey),
  );
  return snapshot.exists() ? snapshot.data() : null;
};

export const closeDay = async (companyId, dateKey) => {
  const user = currentUser();
  const marker = {
    collectionDate: dateKey,
    status: 'CLOSED',
    closedAt: Date.now(),
    closedByUserId: user.uid,
    closedByName: user.name,
  };
  await setDoc(
    getCompanyDoc(companyId, DB_NAMES.COLLECTION_DAYS, dateKey),
    marker,
  );
  return marker;
};

export const reopenDay = async (companyId, dateKey) => {
  const user = currentUser();
  await setDoc(getCompanyDoc(companyId, DB_NAMES.COLLECTION_DAYS, dateKey), {
    collectionDate: dateKey,
    status: 'OPEN',
    reopenedAt: Date.now(),
    reopenedByUserId: user.uid,
    reopenedByName: user.name,
  });
};
