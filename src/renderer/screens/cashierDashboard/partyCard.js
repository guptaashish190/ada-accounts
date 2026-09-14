import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Text } from '@fluentui/react-components';
import {
  Call20Regular,
  ChevronDown20Regular,
  ChevronUp20Regular,
  Info16Regular,
} from '@fluentui/react-icons';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import CollectionEntryForm from './collectionEntryForm';
import PartyEditDialog from './partyEditDialog';
import {
  formatCurrency,
  formatDate,
  formatDateRel,
  isFutureDate,
  parseDateKey,
  startOfTomorrow,
  toDateKey,
  billRescheduleDate,
  wasRescheduledOnDate,
  weekdayIndexFromDate,
} from './collectionService';

/** Short label shown on the collapsed card so the list is scannable. */
export const entryChipLabel = (entry) => {
  const payments = (entry?.payments || []).filter((p) => (p.amount || 0) > 0);
  if (payments.length > 0) {
    const total =
      entry.totalAmount || payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const modes = [...new Set(payments.map((p) => p.mode))].join('+');
    return `${formatCurrency(total)} ${modes}`;
  }
  if (entry && entry.source !== 'CLOSE_SNAPSHOT') return 'NO PAYMENT';
  return null;
};

export const wasPartyRescheduled = (party, entry, collectionDate) =>
  (entry?.bills || []).some((bill) => billRescheduleDate(bill)) ||
  (party?.orders || []).some(
    (order) =>
      order.rescheduleDate ||
      order.rescheduledOnDate ||
      wasRescheduledOnDate(order, collectionDate),
  );

/** Same rule as the blue row: linked payment or rescheduled today. */
export const isPartyActioned = (party, entry, collectionDate) => {
  const paymentChip = entryChipLabel(entry);
  const hasPayment = !!(paymentChip && paymentChip !== 'NO PAYMENT');
  return hasPayment || wasPartyRescheduled(party, entry, collectionDate);
};

const scheduledKey = (order) =>
  order.schedulePaymentDate ? toDateKey(order.schedulePaymentDate) : '';

const pickerDateForOrder = (order, entry) => {
  const snap = (entry?.bills || []).find((bill) => bill.billId === order.id);
  const key = billRescheduleDate(snap) || order.rescheduleDate;
  if (!key) return null;
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}/.test(key)
    ? parseDateKey(key)
    : parseDateKey(toDateKey(key));
};

const datesFromOrders = (orders, entry) =>
  Object.fromEntries(
    (orders || []).map((order) => [order.id, pickerDateForOrder(order, entry)]),
  );

const sharedPartyDate = (orders, entry) => {
  const dates = (orders || []).map((order) => pickerDateForOrder(order, entry));
  if (!dates.length || dates.some((date) => !date)) return null;
  const key = toDateKey(dates[0]);
  return dates.every((date) => toDateKey(date) === key) ? dates[0] : null;
};

export default function PartyCard({
  party,
  expanded,
  onToggle,
  onCall,
  onPartyReschedule,
  getBillStatus,
  entry,
  locked,
  showEntryForm = true,
  collectionDate,
  windowDays,
  onWindowDaysChange,
  paymentsCache,
  onSaveParty,
  onClearEntry,
  routes,
  onUpdateParty,
}) {
  const [partyRescheduleDate, setPartyRescheduleDate] = useState(() =>
    sharedPartyDate(party.orders, entry),
  );
  const [billDates, setBillDates] = useState(() =>
    datesFromOrders(party.orders, entry),
  );
  const [editOpen, setEditOpen] = useState(false);

  const orderIdsKey = (party.orders || []).map((order) => order.id).join('|');
  const entryRescheduleKey = (entry?.bills || [])
    .map((bill) => `${bill.billId}:${billRescheduleDate(bill) || ''}`)
    .join('|');

  useEffect(() => {
    setBillDates(datesFromOrders(party.orders, entry));
    setPartyRescheduleDate(sharedPartyDate(party.orders, entry));
  }, [orderIdsKey, entryRescheduleKey]);

  const hasOverdue = party.overdueAmount > 0;
  const paymentChip = entryChipLabel(entry);
  const hasPayment = !!(paymentChip && paymentChip !== 'NO PAYMENT');
  const wasRescheduled = wasPartyRescheduled(party, entry, collectionDate);
  const isActioned = isPartyActioned(party, entry, collectionDate);

  const dateChanges = useMemo(
    () =>
      (party.orders || []).filter((order) => {
        const next = billDates[order.id];
        if (!isFutureDate(next)) return false;
        return toDateKey(next) !== scheduledKey(order);
      }),
    [party.orders, billDates],
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  const handlePartyDate = (date) => {
    setPartyRescheduleDate(date);
    if (!isFutureDate(date)) return;
    setBillDates((prev) => {
      const next = { ...prev };
      (party.orders || []).forEach((order) => {
        next[order.id] = date;
      });
      return next;
    });
  };

  const handleBillDate = (orderId, date) => {
    setBillDates((prev) => ({ ...prev, [orderId]: date }));
  };

  const handleSaveAll = async ({ notes, payments }) => {
    const groups = new Map();
    dateChanges.forEach((order) => {
      const key = toDateKey(billDates[order.id]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(order);
    });
    await Promise.all(
      [...groups.entries()].map(([, orders]) =>
        onPartyReschedule(orders, billDates[orders[0].id]),
      ),
    );
    const rescheduleByBill = {};
    dateChanges.forEach((order) => {
      rescheduleByBill[order.id] = toDateKey(billDates[order.id]);
    });
    await onSaveParty({ notes, payments, rescheduleByBill });
  };

  return (
    <Card
      size="small"
      appearance="subtle"
      className={`party-card${isActioned ? ' actioned' : ''}${
        expanded ? ' expanded' : ''
      }`}
    >
      <div
        className="party-card-header"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
        <div className="party-name-cell">
          <Text weight="semibold" size={400} className="party-name">
            {party.partyName}
          </Text>
          <Button
            appearance="subtle"
            size="small"
            icon={<Info16Regular />}
            aria-label="Edit party"
            onClick={(e) => {
              e.stopPropagation();
              setEditOpen(true);
            }}
          />
        </div>
        <span className="party-col-credit">
          {party.creditDays != null
            ? `${party.creditDays} Days Credit`
            : '-- Days Credit'}
        </span>
        <span className="party-col-flag">
          {hasOverdue && <span className="status-label overdue">Overdue</span>}
        </span>
        <span className="party-col-flag">
          {party.isOnRoute && (
            <span className="status-label on-route">On today's route</span>
          )}
        </span>
        <span className="party-col-amount">
          {formatCurrency(party.totalPending)}
        </span>
        <span className="party-col-bills">
          {party.orders.length} bill{party.orders.length > 1 ? 's' : ''}
        </span>
        <span className="party-col-flag">
          {wasRescheduled && (
            <span className="status-badge rescheduled">Rescheduled</span>
          )}
        </span>
        <span className="party-col-flag">
          {hasPayment && (
            <span className="status-badge collected">{paymentChip}</span>
          )}
        </span>
        <div className="party-actions">
          {party.contact ? (
            <Button
              appearance="subtle"
              size="small"
              icon={<Call20Regular />}
              onClick={(e) => {
                e.stopPropagation();
                onCall(party.contact);
              }}
            />
          ) : (
            <span className="party-action-slot" aria-hidden="true" />
          )}
          {expanded ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
        </div>
      </div>

      {expanded && (
        <div className="bill-breakdown">
          <div className="party-detail">
            <div className="app-table-wrapper">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Bill No.</th>
                    <th>Bill Date</th>
                    <th>Days</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Scheduled For</th>
                    <th>Status</th>
                    {!locked && (
                      <th className="reschedule-header">
                        <span>Reschedule</span>
                        <DatePicker
                          minDate={startOfTomorrow()}
                          size="small"
                          onSelectDate={handlePartyDate}
                          placeholder="Reschedule"
                          value={partyRescheduleDate}
                        />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {party.orders.map((order) => (
                    <BillRow
                      key={order.id}
                      order={order}
                      getBillStatus={getBillStatus}
                      locked={locked}
                      collectionDate={collectionDate}
                      savedRescheduleDate={billRescheduleDate(
                        (entry?.bills || []).find(
                          (bill) => bill.billId === order.id,
                        ),
                      )}
                      rescheduleDate={billDates[order.id] || null}
                      onRescheduleDate={(date) => handleBillDate(order.id, date)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {showEntryForm && (
              <CollectionEntryForm
                entry={entry}
                partyId={party.partyId}
                collectionDate={collectionDate}
                windowDays={windowDays}
                onWindowDaysChange={onWindowDaysChange}
                paymentsCache={paymentsCache}
                readOnly={locked}
                hasDateChanges={dateChanges.length > 0}
                onSave={handleSaveAll}
                onClear={() => onClearEntry(party)}
              />
            )}
          </div>
        </div>
      )}
      <PartyEditDialog
        open={editOpen}
        party={party}
        routes={routes || []}
        defaultWeekday={
          collectionDate
            ? weekdayIndexFromDate(parseDateKey(collectionDate))
            : weekdayIndexFromDate(new Date())
        }
        onClose={() => setEditOpen(false)}
        onSave={(payload) => onUpdateParty(party, payload)}
      />
    </Card>
  );
}

function BillRow({
  order,
  getBillStatus,
  locked,
  collectionDate,
  savedRescheduleDate,
  rescheduleDate,
  onRescheduleDate,
}) {
  const rescheduledOnDay =
    !!savedRescheduleDate ||
    !!order.rescheduleDate ||
    order.rescheduledOnDate ||
    wasRescheduledOnDate(order, collectionDate);
  const rawStatus = getBillStatus(order);
  const status =
    locked && (rescheduledOnDay || rawStatus === 'UPCOMING')
      ? 'RESCHEDULED'
      : rawStatus;
  const statusLabel =
    status === 'RESCHEDULED'
      ? `Rescheduled ${formatDateRel(
          savedRescheduleDate || order.schedulePaymentDate,
          collectionDate,
        )}`
      : status.replace('_', ' ');

  const daysSinceBilling = (() => {
    const billTime = order.billCreationTime || order.creationTime;
    if (!billTime) return '--';
    return Math.max(0, Math.floor((Date.now() - billTime) / 86400000));
  })();

  return (
    <tr>
      <td>{order.billNumber || order.id}</td>
      <td>{formatDate(order.billCreationTime)}</td>
      <td>{daysSinceBilling}</td>
      <td>{formatCurrency(order.orderAmount || 0)}</td>
      <td>{formatCurrency(order.balance || 0)}</td>
      <td>{formatDateRel(order.schedulePaymentDate, collectionDate)}</td>
      <td>
        <span className={`status-pill ${status.toLowerCase()}`}>
          {statusLabel}
        </span>
      </td>
      {!locked && (
        <td className="reschedule-cell">
          <DatePicker
            minDate={startOfTomorrow()}
            size="small"
            onSelectDate={onRescheduleDate}
            placeholder="Reschedule"
            value={rescheduleDate}
          />
        </td>
      )}
    </tr>
  );
}
