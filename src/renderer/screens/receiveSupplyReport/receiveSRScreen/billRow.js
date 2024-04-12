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
}) {
  const [cash, setCash] = useState('');
  const [cheque, setCheque] = useState('');
  const [upi, setUpi] = useState('');
  const [otherPayment, setOtherPayment] = useState('');
  const [scheduleDate, setScheduleDate] = useState(
    data.schedulePaymentDate ? new Date(data.schedulePaymentDate) : null,
  );
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
  const disabled = isReceived || isReturned;

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
      className="bill-row"
    >
      <Toaster toasterId={toasterId} />
      <center>
        <div className="bill-row-top">
          <Text>
            {!isOld ? '*NEW* ' : ''}
            {data.billNumber}
            <b>{isReceived1 ? '  (Received)' : null}</b>
          </Text>
          <Text>{data.fileNumber}</Text>
          <Text>
            BILL AMT: {globalUtils.getCurrencyFormat(data.orderAmount)}
          </Text>
          <Text>BAL: {globalUtils.getCurrencyFormat(data.balance)}</Text>
          {disabled ? (
            <Button onClick={() => onUndo()} appearance="subtle" size="large">
              <Text
                className={`undo-button ${
                  isReceived ? 'received' : 'returned'
                }`}
              >
                UNDO ({isReceived ? 'Received' : 'Returned'})
              </Text>
            </Button>
          ) : (
            <div className="receive-return-container">
              {isOld ? (
                <div />
              ) : (
                <Button onClick={onReturn} appearance="subtle">
                  RETURN
                </Button>
              )}

              <Button
                onClick={() => receive()}
                appearance="subtle"
                size="large"
              >
                <Text className="receive-button">RECEIVE</Text>
              </Button>
            </div>
          )}
        </div>
        <div className="bill-row-bottom">
          <Input
            className={`input ${disabled ? '' : 'payment'}`}
            onChange={(_, e) => setCash(e.value)}
            placeholder="Cash"
            value={cash}
            contentBefore="₹"
            type="number"
          />
          <Input
            className={`input ${disabled ? '' : 'payment'}`}
            onChange={(_, e) => setCheque(e.value)}
            placeholder="Cheque"
            contentBefore="₹"
            value={cheque}
            type="number"
          />
          <Input
            className={`input ${disabled ? '' : 'payment'}`}
            onChange={(_, e) => setUpi(e.value)}
            placeholder="UPI"
            value={upi}
            contentBefore="₹"
            type="number"
          />
          <Input
            disabled={disabled}
            className={`input ${disabled ? '' : 'other'}`}
            onChange={(_, e) => setOtherPayment(e.value)}
            placeholder="Other Payment"
            value={otherPayment}
            contentBefore="₹"
            type="number"
          />
          <Tooltip content="Scheduled for payment">
            <DatePicker
              disabled={disabled}
              onSelectDate={setScheduleDate}
              placeholder="Schedule"
              value={scheduleDate}
            />
          </Tooltip>
          <Tooltip content={data.accountsNotes}>
            <Input
              disabled={disabled}
              value={notes}
              onChange={(_, e) => setNotes(e.value)}
              className="input"
              placeholder="Accounts Notes"
            />
          </Tooltip>
        </div>
      </center>
      <VerticalSpace1 />
    </div>
  );
}
