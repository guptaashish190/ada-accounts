import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dropdown,
  Option,
  Spinner,
  Textarea,
} from '@fluentui/react-components';
import {
  PAYMENT_WINDOW_PRESETS,
  formatCurrency,
  formatDateRel,
  paymentsInWindow,
} from './collectionService';

const EMPTY_CLAIMED = new Map();

const paymentKey = (payment) => payment?.id || payment?.sourceRef || '';

const idsFromEntry = (entry) =>
  new Set(
    (entry?.sourceRefs || [])
      .concat((entry?.payments || []).map((p) => p.sourceRef).filter(Boolean))
      .concat((entry?.payments || []).map((p) => p.id).filter(Boolean)),
  );

export default function CollectionEntryForm({
  entry,
  partyId,
  collectionDate,
  readOnly,
  windowDays,
  onWindowDaysChange,
  paymentsCache,
  hasDateChanges,
  onSave,
  onClear,
}) {
  const [notes, setNotes] = useState(entry?.notes || '');
  const [saving, setSaving] = useState(false);
  const [pendingIds, setPendingIds] = useState(() => idsFromEntry(entry));
  const [pendingById, setPendingById] = useState(() => {
    const map = new Map();
    (entry?.payments || []).forEach((payment) => {
      const key = paymentKey(payment);
      if (key) map.set(key, payment);
    });
    return map;
  });

  useEffect(() => {
    setNotes(entry?.notes || '');
    setPendingIds(idsFromEntry(entry));
    const map = new Map();
    (entry?.payments || []).forEach((payment) => {
      const key = paymentKey(payment);
      if (key) map.set(key, payment);
    });
    setPendingById(map);
  }, [entry]);

  const loadingPayments = !readOnly && !paymentsCache;
  const claimedElsewhere = paymentsCache?.claimed || EMPTY_CLAIMED;
  const payments = useMemo(() => {
    if (readOnly || !paymentsCache) return [];
    return paymentsInWindow(
      paymentsCache.byParty.get(partyId) || [],
      collectionDate,
      windowDays,
    );
  }, [readOnly, paymentsCache, partyId, collectionDate, windowDays]);

  const savedIds = idsFromEntry(entry);

  const pendingPayments = useMemo(() => {
    const selected = [];
    pendingIds.forEach((id) => {
      const payment = pendingById.get(id);
      if (payment) selected.push(payment);
    });
    return selected;
  }, [pendingIds, pendingById]);

  const pendingTotal = pendingPayments.reduce(
    (sum, payment) => sum + (payment.amount || 0),
    0,
  );

  const paymentsChanged =
    pendingIds.size !== savedIds.size ||
    [...pendingIds].some((id) => !savedIds.has(id));
  const notesChanged = notes !== (entry?.notes || '');
  const dirty = paymentsChanged || notesChanged || !!hasDateChanges;

  const handleLink = (payment) => {
    if (readOnly) return;
    const key = paymentKey(payment);
    if (!key) return;
    setPendingIds((prev) => new Set(prev).add(key));
    setPendingById((prev) => new Map(prev).set(key, payment));
  };

  const handleUnlink = (payment) => {
    if (readOnly) return;
    const key = paymentKey(payment);
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(key);
      next.delete(payment.sourceRef);
      next.delete(payment.id);
      return next;
    });
  };

  const handleSave = async () => {
    if (readOnly || saving || !dirty) return;
    setSaving(true);
    try {
      await onSave({ notes, payments: pendingPayments });
    } finally {
      setSaving(false);
    }
  };

  const renderAction = (payment, linked, usedOn) => {
    if (linked) {
      return (
        <Button
          size="small"
          appearance="subtle"
          onClick={() => handleUnlink(payment)}
        >
          Unlink
        </Button>
      );
    }
    return (
      <Button
        size="small"
        appearance="primary"
        disabled={!!usedOn}
        onClick={() => handleLink(payment)}
      >
        Link
      </Button>
    );
  };

  const linkedPayments = (entry?.payments || []).filter(
    (p) => (p.amount || 0) > 0,
  );
  const rows = readOnly ? linkedPayments : payments;
  const emptyLabel = readOnly
    ? 'No payments received.'
    : 'No payments in this window.';

  return (
    <div className={`collection-entry-form${readOnly ? ' is-readonly' : ''}`}>
      <div className="app-table-wrapper payment-panel">
        <div className="payment-panel-toolbar">
          <span>{readOnly ? 'Received payments' : 'Recent payments'}</span>
          <span className="linked-total">
            {formatCurrency(readOnly ? entry?.totalAmount || 0 : pendingTotal)}
          </span>
          {!readOnly && (
            <Dropdown
              size="small"
              className="payment-window-dropdown"
              value={`±${windowDays}`}
              selectedOptions={[String(windowDays)]}
              style={{ minWidth: 58, width: 58 }}
              onOptionSelect={(_, data) =>
                onWindowDaysChange(parseInt(data.optionValue, 10))
              }
            >
              {PAYMENT_WINDOW_PRESETS.map((days) => (
                <Option key={days} value={String(days)}>
                  ± {days} days
                </Option>
              ))}
            </Dropdown>
          )}
        </div>
        <table className="app-table">
          <thead>
            <tr>
              <th>Amount</th>
              <th>Mode</th>
              <th>Date</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {loadingPayments && (
              <tr>
                <td colSpan={readOnly ? 3 : 4}>
                  <Spinner size="tiny" label="Loading..." />
                </td>
              </tr>
            )}
            {!loadingPayments && rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="cell-muted">
                  {emptyLabel}
                </td>
              </tr>
            )}
            {!loadingPayments &&
              rows.map((payment, index) => {
                const key = paymentKey(payment);
                const usedOn = claimedElsewhere.get(payment.id);
                const linked =
                  pendingIds.has(key) ||
                  pendingIds.has(payment.id) ||
                  pendingIds.has(payment.sourceRef);
                return (
                  <tr
                    key={key || index}
                    className={`${linked ? 'row-linked' : ''} ${
                      usedOn && !linked ? 'muted' : ''
                    }`}
                  >
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>{payment.mode}</td>
                    <td>
                      {payment.date
                        ? formatDateRel(payment.date, collectionDate)
                        : ''}
                      {usedOn && !linked
                        ? ` · Used ${formatDateRel(usedOn, collectionDate)}`
                        : ''}
                    </td>
                    {!readOnly && (
                      <td>{renderAction(payment, linked, usedOn)}</td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="app-table-wrapper payment-panel">
          <div className="payment-panel-toolbar">
            <span>Notes</span>
          </div>
          <div className="payment-notes-body">
            <Textarea
              size="small"
              resize="none"
              rows={3}
              value={notes}
              placeholder="Notes"
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="entry-form-actions">
              {entry && !saving && (
                <Button size="small" appearance="subtle" onClick={onClear}>
                  Clear
                </Button>
              )}
              {saving ? (
                <Spinner size="tiny" />
              ) : (
                <Button
                  size="small"
                  appearance="primary"
                  disabled={!dirty}
                  onClick={handleSave}
                >
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
