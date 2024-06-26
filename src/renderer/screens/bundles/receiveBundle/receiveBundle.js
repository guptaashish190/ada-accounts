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
import math, { parse } from 'mathjs';
import Loader from '../../../common/loader';
import { VerticalSpace1 } from '../../../common/verticalSpace';
import globalUtils from '../../../services/globalUtils';
import { showToast } from '../../../common/toaster';
import './style.css';
import firebaseApp, { firebaseAuth, firebaseDB } from '../../../firebaseInit';
import constants from '../../../constants';
import AdjustAmountDialog from '../../receiveSupplyReport/adjustAmountOnBills/adjustAmountDialog';

export default function ReceiveBundle() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { bundle, bills } = state;
  const [allBills, setAllBills] = useState(bills);
  const [receivedBills, setReceivedBills] = useState([]);
  const [openAdjustAmountDialog, setOpenAdjustAmountDialog] = useState();
  const [otherAdjustedBills, setOtherAdjustedBills] = useState([]);

  const [loading, setLoading] = useState(false);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const receiveBill = (bi) => {
    setReceivedBills((r) => [...r, bi]);
  };

  // update order details in the bundle and individual orders
  const onComplete = async () => {
    setLoading(true);
    // Reference to the document in the "bundles" collection
    const bundleRef = doc(firebaseDB, 'billBundles', bundle.id);

    try {
      // update supply report for all the bill rec details
      updateDoc(bundleRef, {
        status: constants.firebase.billBundleFlowStatus.RECEIVED,
        orderDetails: receivedBills.map((rb) => ({
          billId: rb.id,
          ...(rb.accountsNotes ? { accountsNotes: rb.accountsNotes } : {}),
          payments: rb.payments,
          ...(rb.schedulePaymentDate
            ? { schedulePaymentDate: rb.schedulePaymentDate }
            : {}),
          with: rb.with,
        })),
        otherAdjustedBills: otherAdjustedBills.map((oab1) => {
          return {
            billId: oab1.id,
            payments: oab1.payments,
          };
        }),
        receivedBy: firebaseAuth.currentUser.uid,
      });

      // update current bills updated flow
      for await (const rb2 of receivedBills) {
        const orderRef = doc(firebaseDB, 'orders', rb2.id);

        updateDoc(orderRef, {
          with: rb2.with,
          ...(rb2.schedulePaymentDate
            ? { schedulePaymentDate: rb2.schedulePaymentDate }
            : {}),
          accountsNotes: rb2.accountsNotes || '',
        });
      }

      // update party payments
      // Update  balance of other bills adjusted
      for await (const oab1 of [...receivedBills, ...otherAdjustedBills]) {
        if (oab1.payments?.length) {
          const partyRef = doc(firebaseDB, 'parties', oab1.partyId);

          const partySnapshot = await getDoc(partyRef);
          let newPayments = partySnapshot.data().payments || [];

          const addedPayments = oab1.payments.map((oab1p) => ({
            ...oab1p,
            timestamp: Timestamp.now().toMillis(),
            bundleId: bundle.id,
            billId: oab1.id,
          }));

          newPayments = [...newPayments, ...addedPayments];
          updateDoc(partyRef, {
            payments: newPayments,
          });
        }
      }

      showToast(dispatchToast, 'All Bills Received', 'success');
      setLoading(false);
      onCreateCashReceipt();
    } catch (error) {
      console.error('Error updating document: ', error);
      showToast(dispatchToast, 'An error occured', 'error');
      setLoading(false);
    }
  };

  const onSave = () => {};
  const onCreateCashReceipt = () => {
    const prItems = {};
    [...receivedBills, ...otherAdjustedBills].forEach((cRBill) => {
      if (cRBill.payments?.length) {
        cRBill.payments.forEach((crBillP) => {
          if (crBillP.type === 'cash') {
            prItems[cRBill.partyId] =
              (prItems[cRBill.partyId] || 0) + parseInt(crBillP.amount);
          }
        });
      }
    });
    if (!Object.keys(prItems).length) {
      showToast(dispatchToast, 'No Cash Received', 'error');
      navigate('/bundles');
      return;
    }

    const updatedModelPrItems = Object.keys(prItems).map((pri) => {
      return {
        partyId: pri,
        amount: prItems[pri],
      };
    });
    navigate('/createPaymentReceipts', {
      state: { bundleId: bundle.id, prItems: updatedModelPrItems },
    });
  };

  useState(() => {}, []);

  if (loading) return <Loader />;

  const allBillsReceived = receivedBills.length === allBills.length;

  return (
    <>
      <Toaster toasterId={toasterId} />
      <AdjustAmountDialog
        adjustedBills={otherAdjustedBills}
        setAdjustedBills={setOtherAdjustedBills}
        party={openAdjustAmountDialog?.orderData.party}
        amountToAdjust={openAdjustAmountDialog?.amount}
        type={openAdjustAmountDialog?.type}
        onDone={() => {
          setOpenAdjustAmountDialog();
        }}
      />

      <center>
        <div className="receive-sr-container">
          <h3>Receive Bundle: {bundle.id}</h3>
          <VerticalSpace1 />

          {allBills.map((bill, i) => {
            return (
              <BillRow
                onReceive={(x) => {
                  receiveBill(x);
                }}
                key={`rsr-${bill.id}`}
                data={bill}
                isReceived={
                  receivedBills.findIndex((x) => x.id === bill.id) !== -1
                }
                index={i}
                onUndo={() => {
                  setReceivedBills((b) => b.filter((tb) => tb.id !== bill.id));
                }}
                openAdjustDialog={(orderData, amount, type) => {
                  setOpenAdjustAmountDialog({ orderData, amount, type });
                }}
                setOtherAdjustedBills={setOtherAdjustedBills}
                otherAdjustedBills={otherAdjustedBills}
              />
            );
          })}
        </div>
        <Button
          disabled={!allBillsReceived}
          onClick={() => onComplete()}
          size="large"
          appearance="primary"
        >
          COMPLETED
        </Button>
      </center>
    </>
  );
}

function BillRow({
  data,
  index,
  onReceive,
  isReceived,
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
      cash1.length > 0 && {
        type: 'cash',
        amount: cash1,
      },
      cheque1.length > 0 && {
        type: 'cheque',
        amount: cheque1,
      },
      upi1.length > 0 && {
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

  return (
    <div className="bill-row">
      <center>
        <div className="bill-row-top">
          <Text style={{ fontWeight: 'bold' }}>
            {index + 1}.{data.party?.name}
          </Text>
          <Text>{data.billNumber}</Text>
          <Text>{data.fileNumber}</Text>
          <Text>{globalUtils.getCurrencyFormat(data.orderAmount)}</Text>
          <Text style={{ fontWeight: 'bold' }}>
            BAL: {globalUtils.getCurrencyFormat(data.balance)}
          </Text>
          {isReceived ? (
            <Button onClick={() => onUndo()} appearance="subtle" size="large">
              <Text className="undo-button">UNDO</Text>
            </Button>
          ) : (
            <Button onClick={() => receive()} appearance="subtle" size="large">
              <Text className="receive-button">RECEIVE</Text>
            </Button>
          )}
        </div>
      </center>
      <center>
        <div className="bill-row-bottom">
          <Input
            disabled={isReceived || cashOtherBills.length}
            className={`input ${isReceived ? '' : 'payment'}`}
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
            disabled={isReceived || chequeOtherBills.length}
            className={`input ${isReceived ? '' : 'payment'}`}
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
            disabled={isReceived || upiOtherBills.length}
            className={`input ${isReceived ? '' : 'payment'}`}
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
              disabled={isReceived}
              onSelectDate={setScheduleDate}
              placeholder="Schedule"
              value={scheduleDate}
            />
          </Tooltip>
          <Tooltip content={data.accountsNotes}>
            <Input
              disabled={isReceived}
              value={notes}
              onChange={(_, e) => setNotes(e.value)}
              className="input"
              placeholder="Accounts Notes"
            />
          </Tooltip>
        </div>
      </center>
      <VerticalSpace1 />
      <div>
        {[...cashOtherBills, ...chequeOtherBills, ...upiOtherBills].map((o) => {
          return (
            <Card size="small" key={`cashotherbillrow-${o.id}`}>
              <div>
                Adjusted {o.payments[0].type.toUpperCase()}
                {` `}
                <b>{globalUtils.getCurrencyFormat(o.payments[0].amount)} </b>
                against <b>{o.billNumber}</b>
              </div>
            </Card>
          );
        })}
      </div>
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
