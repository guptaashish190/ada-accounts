/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable radix */
/* eslint-disable no-restricted-syntax */

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DatePicker, setMonth } from '@fluentui/react-datepicker-compat';
import {
  Button,
  Card,
  Field,
  Input,
  Text,
  Toast,
  Toaster,
  Tooltip,
  makeStyles,
  useId,
  useToastController,
} from '@fluentui/react-components';

import { Open12Filled, Dismiss12Filled } from '@fluentui/react-icons';
import math, { parse } from 'mathjs';
import Loader from '../../../common/loader';
import { VerticalSpace1 } from '../../../common/verticalSpace';
import globalUtils from '../../../services/globalUtils';
import { showToast } from '../../../common/toaster';
import './style.css';
import firebaseApp, { firebaseDB } from '../../../firebaseInit';
import AdjustAmountDialog from '../adjustAmountOnBills/adjustAmountDialog';
import constants from '../../../constants';

export default function BillRow({
  data,
  supplyReport,
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
  const [cash, setCash] = useState('');
  const [cheque, setCheque] = useState('');
  const [upi, setUpi] = useState('');
  const [otherPayment, setOtherPayment] = useState('');
  const [scheduleDate, setScheduleDate] = useState(() => {
    // Prefer an already-persisted schedule if one exists.
    if (data.schedulePaymentDate) {
      return new Date(data.schedulePaymentDate);
    }
    // Otherwise preset to (today + party's credit days) when credit days are
    // configured on the party, so accounts staff don't have to compute it.
    const creditDays = data.party?.creditDays;
    if (typeof creditDays === 'number' && creditDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + creditDays);
      return d;
    }
    return null;
  });
  const [notes, setNotes] = useState();

  const navigate = useNavigate();

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    const paytemp = data.flow
      ? data.flow[data.flow.length - 1]?.payload?.payments
      : false;
    if (paytemp) {
      paytemp.forEach((fetched) => {
        if (fetched.type === 'Cash') {
          setCash(fetched.amount);
        }
        if (fetched.type === 'Cheque') {
          setCheque(fetched.amount);
        }
        if (fetched.type === 'UPI') {
          setUpi(fetched.amount);
        }
      });
    }
  }, []);

  const receive = () => {
    let newPayments = data.payments || [];
    // Remove payment for current bi

    const totalBillPayament =
      parseInt(otherPayment || '0') +
      parseInt(cash || '0') +
      parseInt(upi || '0') +
      parseInt(cheque || '0');

    // if (!scheduleDate && totalBillPayament < data.balance) {
    //   showToast(dispatchToast, 'Select a schedule date', 'error');
    //   return;
    // }
    newPayments = [
      ...newPayments,
      cash > 0 && {
        type: 'cash',
        amount: cash,
      },
      cheque > 0 && {
        type: 'cheque',
        amount: cheque,
      },
      upi > 0 && {
        type: 'upi',
        amount: upi,
      },
      otherPayment > 0 && {
        type: 'other',
        amount: otherPayment,
      },
    ].filter(Boolean);
    const tempBill = {
      ...data,
      payments: newPayments,
      accountsNotes: notes,
      ...(scheduleDate && { schedulePaymentDate: scheduleDate.getTime() }),
      with: 'Accounts',
    };

    onReceive(tempBill);
  };
  const disabled = isReceived || isReturned || isReturnReceived || isWithParty;

  const isReceivedIndex = supplyReport.orderDetails?.findIndex(
    (x) => x.billId === data.id,
  );
  const isReceived1 = isReceivedIndex !== undefined && isReceivedIndex !== -1;

  return (
    <div
      style={
        isReceived1
          ? { pointerEvents: 'none', filter: 'grayscale(1)', opacity: 0.4 }
          : {}
      }
      className={`receivesr-bill-row ${isReceived1 ? 'received' : ''} ${
        isOld ? 'old-bill' : 'new-bill'
      }`}
    >
      <Toaster toasterId={toasterId} />

      <div className="bill-header">
        <div className="bill-info-compact">
          <div className="bill-number">
            <span className="bill-number-text">{data.billNumber || '--'}</span>
            {isReceived1 && <span className="received-badge">Received</span>}
          </div>
          <div className="bill-kpis">
            <span className="bill-chip">
              <span className="chip-label">Amt</span>{' '}
              {globalUtils.getCurrencyFormat(data.orderAmount)}
            </span>
            <span className="bill-chip bill-chip-primary">
              <span className="chip-label">Bal</span>{' '}
              {globalUtils.getCurrencyFormat(data.balance)}
            </span>
            <span className="bill-chip">
              <span className="chip-label">Date</span>{' '}
              {data.creationTime
                ? globalUtils.getTimeFormat(data.creationTime, true)
                : '--'}
            </span>
          </div>
        </div>
      </div>

      <div className="payment-section-compact">
        <div className="payment-compact-grid">
          <div className="payment-group">
            <div className="payment-label">Cash</div>
            <Input
              className={`payment-input ${disabled ? 'disabled' : ''}`}
              onChange={(_, e) => setCash(e.value)}
              placeholder="0"
              value={cash}
              contentBefore="₹"
              type="number"
              disabled={disabled}
              size="small"
              aria-label="Cash amount"
            />
          </div>

          <div className="payment-group">
            <div className="payment-label">Cheque</div>
            <Input
              className={`payment-input ${disabled ? 'disabled' : ''}`}
              onChange={(_, e) => setCheque(e.value)}
              placeholder="0"
              contentBefore="₹"
              value={cheque}
              type="number"
              disabled={disabled}
              size="small"
              aria-label="Cheque amount"
            />
          </div>

          <div className="payment-group">
            <div className="payment-label">UPI</div>
            <Input
              className={`payment-input ${disabled ? 'disabled' : ''}`}
              onChange={(_, e) => setUpi(e.value)}
              placeholder="0"
              value={upi}
              contentBefore="₹"
              type="number"
              disabled={disabled}
              size="small"
              aria-label="UPI amount"
            />
          </div>

          <div className="payment-group">
            <div className="payment-label">Other</div>
            <Input
              disabled={disabled}
              className={`payment-input ${disabled ? 'disabled' : ''}`}
              onChange={(_, e) => setOtherPayment(e.value)}
              placeholder="0"
              value={otherPayment}
              contentBefore="₹"
              type="number"
              size="small"
              aria-label="Other payment amount"
            />
          </div>
        </div>

        <div className="payment-secondary-row">
          <div className="input-group">
            <div className="input-label">Schedule Date</div>
            <DatePicker
              disabled={disabled}
              onSelectDate={setScheduleDate}
              placeholder="Select date"
              value={scheduleDate}
              size="small"
              aria-label="Schedule payment date"
            />
          </div>

          <div className="input-group">
            <div className="input-label">Notes</div>
            <Input
              disabled={disabled}
              value={notes}
              onChange={(_, e) => setNotes(e.value)}
              placeholder="Accounts notes..."
              size="small"
              aria-label="Accounts notes"
            />
          </div>
        </div>
      </div>
      <div className="bill-actions">
        {isReturnReceived ? (
          <Button
            onClick={() => onUndoReturnReceived?.()}
            appearance="subtle"
            size="medium"
            className="undo-button undo-danger-button"
          >
            Undo Return Received
          </Button>
        ) : isWithParty ? (
          <Button
            onClick={() => onUndoWithParty?.()}
            appearance="subtle"
            size="medium"
            className="undo-button undo-danger-button"
          >
            Undo With Party
          </Button>
        ) : allowReceiveReturned ? (
          <Button
            onClick={() => onReceiveReturned?.()}
            appearance="primary"
            size="medium"
            className="action-button receive-return-button"
          >
            Receive Return
          </Button>
        ) : disabled ? (
          <Button
            onClick={() => onUndo()}
            appearance="subtle"
            size="medium"
            className={`undo-button ${
              isReceived ? 'undo-neutral-button' : 'undo-danger-button'
            }`}
          >
            Undo {isReceived ? 'Received' : 'Returned'}
          </Button>
        ) : (
          <div className="bill-row-action-buttons">
            {!isOld && (
              <Button
                onClick={onReturn}
                appearance="secondary"
                size="medium"
                className="action-button return-action-button"
              >
                Return
              </Button>
            )}
            <Button
              onClick={() => receive()}
              appearance="primary"
              size="medium"
              className="action-button receive-button"
            >
              Receive
            </Button>
            <Button
              onClick={() => onWithParty?.()}
              appearance="secondary"
              size="medium"
              className="action-button with-party-button"
            >
              With Party
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
