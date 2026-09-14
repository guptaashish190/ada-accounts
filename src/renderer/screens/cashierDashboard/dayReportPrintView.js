import React from 'react';
import {
  PAYMENT_MODES,
  billRescheduleDate,
  formatCurrency,
  formatDate,
  formatDateRel,
  formatLongDate,
  startOfDay,
  toDateKey,
  wasRescheduledOnDate,
} from './collectionService';
import { isPartyActioned } from './partyCard';

export const buildReportTotals = (entries = []) => {
  const totals = {
    total: 0,
    entryCount: entries.length,
    partyCount: new Set(entries.map((e) => e.partyId)).size,
  };
  PAYMENT_MODES.forEach((mode) => {
    totals[mode] = 0;
  });

  entries.forEach((entry) => {
    (entry.payments || []).forEach((payment) => {
      const amount = payment.amount || 0;
      totals[payment.mode] = (totals[payment.mode] || 0) + amount;
      totals.total += amount;
    });
  });

  return totals;
};

const rescheduleDateForOrder = (order, dateKey) => {
  const fromOrder = billRescheduleDate(order);
  if (fromOrder) return fromOrder;
  if (
    dateKey &&
    wasRescheduledOnDate(order, dateKey) &&
    order.schedulePaymentDate
  ) {
    return toDateKey(order.schedulePaymentDate);
  }
  return null;
};

const daysFromSelected = (value, selectedKey) => {
  if (!value || !selectedKey) return 0;
  return Math.round(
    (startOfDay(value).getTime() - startOfDay(selectedKey).getTime()) /
      86400000,
  );
};

const titleMode = (mode) => {
  const raw = (mode || '').toLowerCase();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
};

export const formatCollectionLine = (payments = [], dateKey) => {
  const parts = (payments || []).filter((p) => (p.amount || 0) > 0);
  if (!parts.length) return '--';
  return parts
    .map((p) => {
      const days = daysFromSelected(p.date || p.timestamp, dateKey);
      return `${p.amount} ${titleMode(p.mode)} (${days}d)`;
    })
    .join(', ');
};

const partyRescheduleLabel = (party, entry, dateKey) => {
  const keys = new Set();
  (entry?.bills || []).forEach((bill) => {
    const date = billRescheduleDate(bill);
    if (date) keys.add(date);
  });
  (party?.orders || []).forEach((order) => {
    const date = rescheduleDateForOrder(order, dateKey);
    if (date) keys.add(date);
  });
  return [...keys]
    .sort()
    .map((date) => formatDateRel(date, dateKey))
    .join(', ') || '--';
};

const userName = (user) => user?.username || user?.email || user?.uid || '';

/** "Ashish Gupta" -> "Ashish G" */
const withLastNameInitial = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed.includes('@')) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;
  const last = parts.pop();
  return `${parts.join(' ')} ${last.charAt(0).toUpperCase()}`;
};

export const mrNameForParty = (party, users = []) => {
  const counts = new Map();
  let named = '';
  (party?.orders || []).forEach((order) => {
    const id = order.createdById || order.createdByUserId;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
    if (!named && (order.createdByName || order.createdByPerson)) {
      named = order.createdByName || order.createdByPerson;
    }
  });
  let bestId = null;
  let bestCount = 0;
  counts.forEach((count, id) => {
    if (count > bestCount) {
      bestId = id;
      bestCount = count;
    }
  });
  const fromOrder = (users || []).find(
    (user) => user.uid === bestId || user.id === bestId,
  );
  const full = userName(fromOrder) || named;
  return full ? withLastNameInitial(full) : '--';
};

const compareByMr = (a, b) => {
  const mrCmp = (a.mrName || '').localeCompare(b.mrName || '');
  if (mrCmp) return mrCmp;
  if (a.actioned !== b.actioned) return a.actioned ? -1 : 1;
  return (a.partyName || '').localeCompare(b.partyName || '');
};

/** Every bill on the day's parties, grouped by MR. */
export const collectPartyBills = (
  parties = [],
  entriesByParty = {},
  dateKey,
  users = [],
) => {
  const rows = [];
  (parties || []).forEach((party) => {
    const entry = entriesByParty[party.partyId];
    const mrName = mrNameForParty(party, users);
    (party.orders || []).forEach((order) => {
      const rescheduleDate =
        billRescheduleDate(
          (entry?.bills || []).find((bill) => bill.billId === order.id),
        ) || rescheduleDateForOrder(order, dateKey);
      rows.push({
        billId: order.id,
        billNumber: order.billNumber || order.id,
        billDate: order.billCreationTime || order.creationTime,
        partyId: party.partyId,
        partyName: party.partyName,
        creditDays: party.creditDays,
        mrName,
        balance: order.balance,
        collection: formatCollectionLine(entry?.payments, dateKey),
        notes: entry?.notes || '--',
        rescheduleDate,
        collectionDate: entry?.collectionDate || dateKey,
        actioned: !!rescheduleDate || isPartyActioned(party, entry, dateKey),
      });
    });
  });
  return rows.sort((a, b) => {
    const mrCmp = compareByMr(a, b);
    if (mrCmp) return mrCmp;
    return (a.billDate || 0) - (b.billDate || 0);
  });
};

const ReportHeader = ({
  companyName,
  title,
  periodLabel,
  dateKey,
  dayStatus,
  extra,
}) => {
  const closed = dayStatus?.status === 'CLOSED';
  return (
    <>
      <h2>{companyName || title}</h2>
      <h3>
        {title} - {periodLabel || formatLongDate(dateKey)}
      </h3>
      <div className="cashier-day-report-meta">
        {periodLabel ? (
          <span className="report-stamp draft">SUMMARY</span>
        ) : (
          <>
            <span className={`report-stamp ${closed ? 'closed' : 'draft'}`}>
              {closed ? 'CLOSED' : 'DRAFT'}
            </span>
            {closed ? (
              <span>
                Closed {formatDate(dayStatus.closedAt)} by{' '}
                {dayStatus.closedByName || '--'}
              </span>
            ) : (
              <span>Not yet closed - figures may still change</span>
            )}
          </>
        )}
        {extra}
      </div>
    </>
  );
};

function CollectionReport({
  dateKey,
  periodLabel,
  parties,
  entriesByParty,
  dayStatus,
  companyName,
  users,
}) {
  const entries = Object.values(entriesByParty || {});
  const totals = buildReportTotals(entries);
  const rows = [...(parties || [])]
    .map((party) => {
      const entry = entriesByParty[party.partyId];
      return {
        party,
        entry,
        mrName: mrNameForParty(party, users),
        actioned: isPartyActioned(party, entry, dateKey),
      };
    })
    .sort((a, b) =>
      compareByMr(
        { ...a, partyName: a.party.partyName },
        { ...b, partyName: b.party.partyName },
      ),
    );

  return (
    <div className="print-a4-container cashier-day-report print-collection-report">
      <ReportHeader
        companyName={companyName}
        title="Collection Report"
        periodLabel={periodLabel}
        dateKey={dateKey}
        dayStatus={dayStatus}
        extra={
          <span>
            {rows.length} parties &bull; {totals.partyCount} collected
          </span>
        }
      />

      <table className="app-table cashier-day-report-rows">
        <colgroup>
          <col class="col-sno" />
          <col class="col-party" />
          <col class="col-credit" />
          <col class="col-outstanding" />
          <col class="col-bills" />
          <col class="col-route" />
          <col class="col-mr" />
          <col class="col-collection" />
          <col class="col-reschedule" />
          <col class="col-notes" />
        </colgroup>
        <thead>
          <tr>
            <th>S No.</th>
            <th>Party name</th>
            <th>Credit</th>
            <th>Outstanding</th>
            <th>Bills</th>
            <th>Route</th>
            <th>MR</th>
            <th>Collection</th>
            <th>Rescheduled</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10}>No parties for this period.</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.party.partyId}
                className={row.actioned ? 'row-actioned' : undefined}
              >
                <td>{index + 1}</td>
                <td>{row.party.partyName}</td>
                <td>
                  {row.party.creditDays != null ? row.party.creditDays : '--'}
                </td>
                <td>{formatCurrency(row.party.totalPending || 0)}</td>
                <td>{(row.party.orders || []).length}</td>
                <td>{row.party.isOnRoute ? 'Yes' : '--'}</td>
                <td>{row.mrName}</td>
                <td>{formatCollectionLine(row.entry?.payments, dateKey)}</td>
                <td>{partyRescheduleLabel(row.party, row.entry, dateKey)}</td>
                <td>{row.entry?.notes || '--'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <table className="app-table cashier-day-report-totals">
        <thead>
          <tr>
            {PAYMENT_MODES.map((mode) => (
              <th key={mode}>{mode}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {PAYMENT_MODES.map((mode) => (
              <td key={mode}>{formatCurrency(totals[mode])}</td>
            ))}
            <td>
              <b>{formatCurrency(totals.total)}</b>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BillWiseReport({
  dateKey,
  periodLabel,
  parties,
  entriesByParty,
  dayStatus,
  companyName,
  users,
}) {
  const bills = collectPartyBills(parties, entriesByParty, dateKey, users);
  return (
    <div className="print-a4-container cashier-day-report print-bill-report">
      <ReportHeader
        companyName={companyName}
        title="Bill Report"
        periodLabel={periodLabel}
        dateKey={dateKey}
        dayStatus={dayStatus}
        extra={<span>{bills.length} bills</span>}
      />

      <table className="app-table cashier-day-report-rows">
        <colgroup>
          <col class="col-sno" />
          <col class="col-party" />
          <col class="col-credit" />
          <col class="col-mr" />
          <col class="col-billno" />
          <col class="col-billdate" />
          <col class="col-balance" />
          <col class="col-collection" />
          <col class="col-reschedule" />
          <col class="col-notes" />
        </colgroup>
        <thead>
          <tr>
            <th>S No.</th>
            <th>Party name</th>
            <th>Credit</th>
            <th>MR</th>
            <th>Bill No.</th>
            <th>Bill Date</th>
            <th>Balance</th>
            <th>Collection</th>
            <th>Rescheduled</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {bills.length === 0 ? (
            <tr>
              <td colSpan={10}>No bills for this period.</td>
            </tr>
          ) : (
            bills.map((bill, index) => (
              <tr
                key={bill.billId}
                className={bill.actioned ? 'row-actioned' : undefined}
              >
                <td>{index + 1}</td>
                <td>{bill.partyName}</td>
                <td>{bill.creditDays != null ? bill.creditDays : '--'}</td>
                <td>{bill.mrName}</td>
                <td>{bill.billNumber}</td>
                <td>{formatDate(bill.billDate)}</td>
                <td>{formatCurrency(bill.balance || 0)}</td>
                <td>{bill.collection}</td>
                <td>
                  {bill.rescheduleDate
                    ? formatDateRel(
                        bill.rescheduleDate,
                        bill.collectionDate || dateKey,
                      )
                    : '--'}
                </td>
                <td>{bill.notes}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A4 reports for a business date. `printKind` chooses which table
 * `window.print()` will show: collection (party rows) or bills.
 */
export default function DayReportPrintView({
  printKind = 'collection',
  dateKey,
  periodLabel,
  parties,
  entriesByParty,
  dayStatus,
  companyName,
  users,
}) {
  const shared = {
    dateKey,
    periodLabel,
    parties,
    entriesByParty,
    dayStatus,
    companyName,
    users,
  };

  return (
    <div className={`print-kind-${printKind}`}>
      <CollectionReport {...shared} />
      <BillWiseReport {...shared} />
    </div>
  );
}
