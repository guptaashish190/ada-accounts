/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */

import React from 'react';
import { Button } from '@fluentui/react-components';

import globalUtils from '../../../services/globalUtils';
import './style.css';
import { getHandoverBalance, getErpBalance } from '../../../services/handoverBalanceUtils';

/**
 * BillRow — a single horizontal row showing bill info + action buttons.
 *
 * Payment inputs live at the party-group level in receiveSRScreen.
 */
export default function BillRow({
  data,
  supplyReport,
  useHandoverBalance = false,
  isOld,
  onReceive,
  isReceived,
  isReturned,
  onReturn,
  onUndo,
  allowReceiveReturned = false,
  isReturnReceived = false,
  onReceiveReturned,
  onUndoReturnReceived,
  isWithParty = false,
  onWithParty,
  onUndoWithParty,
}) {
  const displayBalance = useHandoverBalance
    ? getHandoverBalance(data)
    : getErpBalance(data);

  const disabled = isReceived || isReturned || isReturnReceived || isWithParty;

  const isReceivedIndex = supplyReport.orderDetails?.findIndex(
    (x) => x.billId === data.id,
  );
  const alreadyReceived = isReceivedIndex !== undefined && isReceivedIndex !== -1;

  return (
    <div
      className={[
        'bill-single-row',
        alreadyReceived ? 'bill-row-already-received' : '',
        isOld ? 'bill-row-old' : '',
        isReceived ? 'bill-row-received' : '',
        isReturned ? 'bill-row-returned' : '',
        isWithParty ? 'bill-row-with-party' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={alreadyReceived ? { opacity: 0.45, pointerEvents: 'none' } : {}}
    >
      {/* ── Bill number + date ── */}
      <span className="br-bill-number">
        {data.billNumber || '--'}
        {data.creationTime && (
          <span className="br-bill-date">
            {globalUtils.getTimeFormat(data.creationTime, true)}
          </span>
        )}
      </span>

      {/* ── Amount & balance ── */}
      <span className="br-chips">
        <span className="br-chip">
          <span className="br-chip-label">Amt</span>
          {globalUtils.getCurrencyFormat(data.orderAmount)}
        </span>
        <span className="br-chip br-chip-bal">
          <span className="br-chip-label">{useHandoverBalance ? 'Handover' : 'Bal'}</span>
          {globalUtils.getCurrencyFormat(displayBalance)}
        </span>
        {useHandoverBalance && data.erpBalance != null && displayBalance !== data.erpBalance && (
          <span className="br-chip br-chip-erp">
            <span className="br-chip-label">Bal</span>
            {globalUtils.getCurrencyFormat(data.erpBalance)}
          </span>
        )}
      </span>

      {/* ── Action buttons ── */}
      <span className="br-actions">
        {alreadyReceived ? (
          <span className="br-status-tag br-tag-received">Received</span>
        ) : isReturnReceived ? (
          <Button size="small" appearance="subtle" className="br-btn br-btn-undo"
            onClick={() => onUndoReturnReceived?.()}>
            Undo Return
          </Button>
        ) : isWithParty ? (
          <Button size="small" appearance="subtle" className="br-btn br-btn-undo"
            onClick={() => onUndoWithParty?.()}>
            Undo With Party
          </Button>
        ) : allowReceiveReturned ? (
          <Button size="small" appearance="primary" className="br-btn br-btn-receive-return"
            onClick={() => onReceiveReturned?.()}>
            Receive Return
          </Button>
        ) : disabled ? (
          <Button size="small" appearance="subtle" className="br-btn br-btn-undo"
            onClick={() => onUndo()}>
            Undo {isReceived ? 'Received' : 'Returned'}
          </Button>
        ) : (
          <>
            {!isOld && (
              <Button size="small" className="br-btn br-btn-return"
                onClick={onReturn}>
                Return
              </Button>
            )}
            <Button size="small" appearance="primary" className="br-btn br-btn-receive"
              onClick={() => onReceive(data)}>
              Receive
            </Button>
            <Button size="small" className="br-btn br-btn-with-party"
              onClick={() => onWithParty?.()}>
              With Party
            </Button>
          </>
        )}
      </span>
    </div>
  );
}
