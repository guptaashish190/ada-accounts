/* eslint-disable no-nested-ternary */
/* eslint-disable no-restricted-syntax */
import { onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Tooltip,
} from '@fluentui/react-components';
import { ChevronDown16Regular, Dismiss16Regular } from '@fluentui/react-icons';
import globalUtils from '../../../services/globalUtils';
import {
  attachBillWithHandover,
  getDefaultHandoverBalance,
  getErpBalance,
  getHandoverBalance,
  parseHandoverInput,
} from '../../../services/handoverBalanceUtils';
import './style.css';
import { useCompany } from '../../../contexts/companyContext';
import {
  getCompanyCollection,
  DB_NAMES,
} from '../../../services/firestoreHelpers';

export default function PartySection({
  party,
  setAttachedBills,
  attachedBills,
  onRemoveParty,
  withPartyBillIds = [],
  onMarkWithParty,
  onUndoWithParty,
}) {
  const [oldBills, setOldBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const { currentCompanyId } = useCompany();

  useEffect(() => {
    const ordersCollection = getCompanyCollection(
      currentCompanyId,
      DB_NAMES.ORDERS,
    );
    const q = query(
      ordersCollection,
      where('partyId', '==', party.id),
      where('balance', '!=', 0),
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const ordersData = querySnapshot.docs.map((doc1) => ({
          id: doc1.id,
          ...doc1.data(),
          party,
        }));
        ordersData.sort((s1, s2) => s1.creationTime - s2.creationTime);
        setOldBills(ordersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to orders: ', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [party.id, currentCompanyId]);

  useEffect(() => {
    if (!loading && oldBills.length === 0) {
      onRemoveParty([]);
    }
  }, [loading, oldBills.length]);

  if (loading || oldBills.length === 0) {
    return null;
  }

  const partyBillIds = oldBills.map((b) => b.id);
  const attachedCount = oldBills.filter((b) =>
    attachedBills.some((ab) => ab.id === b.id),
  ).length;
  const withPartyCount = oldBills.filter((b) =>
    withPartyBillIds.includes(b.id),
  ).length;

  return (
    <div className={`assign-party-card${expanded ? ' expanded' : ''}`}>
      <div
        className="assign-party-card-header"
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="assign-party-info">
          <div className="assign-party-name-row">
            <span className="assign-party-name">{party.name}</span>
            <span className="assign-party-badge">
              {oldBills.length} bill{oldBills.length === 1 ? '' : 's'}
            </span>
            <span className="assign-party-meta">
              {party.fileNumber} · {party.area}
            </span>
          </div>
        </div>
        <div className="assign-party-actions">
          <span className="assign-party-total">
            {globalUtils.getCurrencyFormat(party.partyBalance || 0)}
          </span>
          {(attachedCount > 0 || withPartyCount > 0) && (
            <span className="assign-party-selection-hint">
              {attachedCount > 0 ? `${attachedCount} attached` : ''}
              {attachedCount > 0 && withPartyCount > 0 ? ' · ' : ''}
              {withPartyCount > 0 ? `${withPartyCount} w/ party` : ''}
            </span>
          )}
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss16Regular />}
            aria-label="Remove party"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveParty(partyBillIds);
            }}
          />
          <ChevronDown16Regular className="assign-party-chevron" />
        </div>
      </div>
      <div className="assign-party-bills-panel" aria-hidden={!expanded}>
        <div className="assign-party-bills-inner">
          <div className="assign-party-bills">
            <div className="app-table-wrapper">
              <table className="app-table compact assign-party-bills-table">
                <thead>
                  <tr>
                    <th>Bill No.</th>
                    <th>Date</th>
                    <th>Days</th>
                    <th>With</th>
                    <th>Amount</th>
                    <th>ERP Bal</th>
                    <th>Handover</th>
                    <th>Scheduled</th>
                    <th>Acc. Note</th>
                    <th colSpan={2}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {oldBills.map((ob) => (
                    <OldBillRow
                      key={`ob-${ob.id}`}
                      oldbill={ob}
                      attachedBill={attachedBills.find((ab) => ab.id === ob.id)}
                      attachBill={(mod) => {
                        setAttachedBills((ab) => [...ab, mod]);
                      }}
                      onHandoverChange={(billId, handoverBalance) => {
                        setAttachedBills((ab) =>
                          ab.map((b) =>
                            b.id === billId ? { ...b, handoverBalance } : b,
                          ),
                        );
                      }}
                      removeAttachedBill={() => {
                        setAttachedBills((ab) =>
                          ab.filter((x) => x.id !== ob.id),
                        );
                      }}
                      isAttached={
                        attachedBills.findIndex((fi) => fi.id === ob.id) !== -1
                      }
                      isWithParty={withPartyBillIds.includes(ob.id)}
                      onWithParty={() => onMarkWithParty?.(ob)}
                      onUndoWithParty={() => onUndoWithParty?.(ob.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OldBillRow({
  oldbill,
  attachedBill,
  attachBill,
  onHandoverChange,
  isAttached,
  removeAttachedBill,
  isWithParty,
  onWithParty,
  onUndoWithParty,
}) {
  const [newNotes, setNewNotes] = useState('');
  const [withUser, setWithUser] = useState('…');
  const erpBalance = getErpBalance(oldbill);
  const defaultHandover = getDefaultHandoverBalance(oldbill);
  const [handoverInput, setHandoverInput] = useState(String(defaultHandover));

  useEffect(() => {
    if (isAttached && attachedBill) {
      setHandoverInput(String(getHandoverBalance(attachedBill)));
    } else if (!isAttached) {
      setHandoverInput(String(getDefaultHandoverBalance(oldbill)));
    }
  }, [
    isAttached,
    attachedBill?.handoverBalance,
    oldbill.lastHandoverBalance,
    erpBalance,
  ]);

  const commitHandover = (rawValue) => {
    const parsed = parseHandoverInput(rawValue, erpBalance);
    if (isAttached) {
      onHandoverChange?.(oldbill.id, parsed);
    }
    return parsed;
  };

  const onAttachBill = () => {
    const handoverBalance = commitHandover(handoverInput);
    attachBill(attachBillWithHandover(oldbill, newNotes, handoverBalance));
  };

  useEffect(() => {
    const loadWithUser = async () => {
      if (oldbill.with && oldbill.with !== 'Accounts') {
        const user = await globalUtils.fetchUserById(oldbill.with);
        setWithUser(user?.username || '—');
      } else {
        setWithUser('Accounts');
      }
    };
    loadWithUser();
  }, [oldbill.with]);

  const disabled =
    isWithParty || ((isAttached || oldbill.with !== 'Accounts') && oldbill.with);

  const rowClass = [
    isAttached ? 'assign-bill-row-attached' : '',
    isWithParty ? 'assign-bill-row-with-party' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr className={rowClass || undefined}>
      <td className="assign-bill-num">{oldbill.billNumber}</td>
      <td>
        {oldbill.creationTime
          ? globalUtils.getTimeFormat(oldbill.creationTime, true)
          : '—'}
      </td>
      <td>{globalUtils.getDaysPassed(oldbill.creationTime) + 1}</td>
      <td className="assign-bill-with">{withUser}</td>
      <td className="assign-bill-amount">
        {globalUtils.getCurrencyFormat(oldbill.orderAmount)}
      </td>
      <td className="assign-bill-amount assign-bill-balance">
        {globalUtils.getCurrencyFormat(erpBalance)}
      </td>
      <td className="assign-bill-amount assign-bill-handover">
        <Input
          className="assign-bill-handover-input"
          size="small"
          type="number"
          appearance="underline"
          value={handoverInput}
          disabled={disabled || isWithParty}
          onChange={(_, t) => {
            setHandoverInput(t.value);
            if (isAttached) {
              commitHandover(t.value);
            }
          }}
          onBlur={() => {
            if (!isAttached) return;
            setHandoverInput(String(commitHandover(handoverInput)));
          }}
        />
      </td>
      <td>
        {globalUtils.getTimeFormat(oldbill.schedulePaymentDate, true, true) ||
          '—'}
      </td>
      <td className="assign-bill-notes-cell">
        <Tooltip content={oldbill.accountsNotes || 'No note'}>
          <Input
            disabled={disabled}
            className="assign-bill-notes-input"
            size="small"
            value={newNotes}
            appearance="underline"
            placeholder={oldbill.accountsNotes || '—'}
            onChange={(_, t) => setNewNotes(t.value)}
          />
        </Tooltip>
      </td>
      <td className="assign-bill-actions-cell">
        {isAttached ? (
          <Button
            appearance="subtle"
            size="small"
            disabled={isWithParty}
            onClick={() => removeAttachedBill()}
          >
            Remove
          </Button>
        ) : (
          <Tooltip
            content={
              isWithParty
                ? 'Marked as With Party'
                : withUser !== 'Accounts'
                  ? 'Bill is not in Accounts'
                  : 'Attach to bundle'
            }
          >
            <Button
              disabled={disabled}
              appearance="primary"
              size="small"
              onClick={() => onAttachBill()}
            >
              Attach
            </Button>
          </Tooltip>
        )}
      </td>
      <td className="assign-bill-actions-cell">
        {isWithParty ? (
          <Button
            appearance="subtle"
            size="small"
            onClick={() => onUndoWithParty?.()}
          >
            Undo
          </Button>
        ) : (
          <Button
            appearance="outline"
            size="small"
            disabled={isAttached}
            onClick={() => onWithParty?.()}
          >
            W/ Party
          </Button>
        )}
      </td>
    </tr>
  );
}
