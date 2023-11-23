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
  Toaster,
  Tooltip,
  makeStyles,
  useId,
  useToastController,
} from '@fluentui/react-components';

import { Open12Filled, Dismiss12Filled } from '@fluentui/react-icons';
import { getAuth } from 'firebase/auth';
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
  openAdjustDialog,
  otherAdjustedBills,
  setOtherAdjustedBills,
}) {
  const [cash, setCash] = useState('');
  const [cheque, setCheque] = useState('');
  const [upi, setUpi] = useState('');
  const [scheduleDate, setScheduleDate] = useState(
    data.schedulePaymentDate ? new Date(data.schedulePaymentDate) : null,
  );
  const [notes, setNotes] = useState();

  const navigate = useNavigate();

  useEffect(() => {
    const paytemp = data.flow[data.flow.length - 1]?.payload?.payments;
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

  const cashOtherBills = otherAdjustedBills.filter(
    (o) => o.partyId === data.partyId && o.payments[0].type === 'cash',
  );
  const chequeOtherBills = otherAdjustedBills.filter(
    (o) => o.partyId === data.partyId && o.payments[0].type === 'cheque',
  );
  const upiOtherBills = otherAdjustedBills.filter(
    (o) => o.partyId === data.partyId && o.payments[0].type === 'upi',
  );

  const receive = () => {
    let newPayments = data.payments || [];
    // Remove payment for current bill in otherBills list and add to the current bill.
    let cash1 = cash;
    let cheque1 = cheque;
    let upi1 = upi;

    const currentCashPayment = cashOtherBills.find((o) => o.id === data.id);
    const currentChequePayment = chequeOtherBills.find((o) => o.id === data.id);
    const currentUpiPayment = upiOtherBills.find((o) => o.id === data.id);
    if (currentCashPayment) {
      setOtherAdjustedBills((oab) =>
        oab.filter(
          (oabf) => !(oabf.id === data.id && oabf.payments[0].type === 'cash'),
        ),
      );
      cash1 = currentCashPayment.payments[0].amount;
    }
    if (currentChequePayment) {
      setOtherAdjustedBills((oab) =>
        oab.filter(
          (oabf) =>
            !(oabf.id === data.id && oabf.payments[0].type === 'cheque'),
        ),
      );
      cheque1 = currentChequePayment.payments[0].amount;
    }
    if (currentUpiPayment) {
      setOtherAdjustedBills((oab) =>
        oab.filter(
          (oabf) => !(oabf.id === data.id && oabf.payments[0].type === 'upi'),
        ),
      );
      upi1 = currentUpiPayment.payments[0].amount;
    }

    newPayments = [
      ...newPayments,
      cash1 > 0 && {
        type: 'cash',
        amount: cash1,
      },
      cheque1 > 0 && {
        type: 'cheque',
        amount: cheque1,
      },
      upi1 > 0 && {
        type: 'upi',
        amount: upi1,
      },
    ].filter(Boolean);
    const tempBill = {
      ...data,
      payments: [...newPayments],
      accountsNotes: notes,
      ...(scheduleDate && { schedulePaymentDate: scheduleDate.getTime() }),
      with: 'Accounts',
    };

    setCash(cash1);
    setCheque(cheque1);
    setUpi(upi1);

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
        isReceived1 ? { pointerEvents: 'none', filter: 'grayscale(1)' } : {}
      }
      className="bill-row"
    >
      <center>
        <div className="bill-row-top">
          <Text>
            {!isOld ? '*NEW* ' : ''}
            {data.billNumber}
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
            disabled={disabled || cashOtherBills.length}
            className={`input ${disabled ? '' : 'payment'}`}
            onChange={(_, e) => setCash(e.value)}
            placeholder="Cash"
            value={cash}
            contentBefore="₹"
            type="number"
            contentAfter={
              <ContentAfterInputReceive
                otherBills={cashOtherBills}
                setOtherAdjustedBills={setOtherAdjustedBills}
                data={data}
                setInputContent={setCash}
                inputContent={cash}
                type="cash"
                openAdjustDialog={openAdjustDialog}
              />
            }
          />
          <Input
            disabled={disabled || chequeOtherBills.length}
            className={`input ${disabled ? '' : 'payment'}`}
            onChange={(_, e) => setCheque(e.value)}
            placeholder="Cheque"
            contentBefore="₹"
            value={cheque}
            type="number"
            contentAfter={
              <ContentAfterInputReceive
                otherBills={chequeOtherBills}
                setOtherAdjustedBills={setOtherAdjustedBills}
                data={data}
                setInputContent={setCheque}
                inputContent={cheque}
                type="cheque"
                openAdjustDialog={openAdjustDialog}
              />
            }
          />
          <Input
            disabled={disabled || upiOtherBills.length}
            className={`input ${disabled ? '' : 'payment'}`}
            onChange={(_, e) => setUpi(e.value)}
            placeholder="UPI"
            value={upi}
            contentBefore="₹"
            type="number"
            contentAfter={
              <ContentAfterInputReceive
                otherBills={upiOtherBills}
                setOtherAdjustedBills={setOtherAdjustedBills}
                data={data}
                setInputContent={setUpi}
                inputContent={upi}
                type="upi"
                openAdjustDialog={openAdjustDialog}
              />
            }
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

function ContentAfterInputReceive({
  otherBills,
  setOtherAdjustedBills,
  data,
  setInputContent,
  inputContent,
  type,
  openAdjustDialog,
}) {
  return otherBills.length ? (
    <div
      onClick={() => {
        setOtherAdjustedBills((od) =>
          od.filter(
            (odf) =>
              !(odf.partyId === data.partyId && odf.payments[0].type === type),
          ),
        );
        setInputContent('');
      }}
    >
      <Dismiss12Filled />
    </div>
  ) : (
    <div
      onClick={() => {
        if (inputContent.length) {
          openAdjustDialog(data, `${inputContent}`, type);
        }
        setInputContent('');
      }}
    >
      <Open12Filled />
    </div>
  );
}
