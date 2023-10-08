/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable radix */
/* eslint-disable no-restricted-syntax */

import {
  collection,
  doc,
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
  makeStyles,
  useId,
  useToastController,
} from '@fluentui/react-components';
import { Open12Filled } from '@fluentui/react-icons';
import { getAuth } from 'firebase/auth';
import math, { parse } from 'mathjs';
import Loader from '../../../common/loader';
import { VerticalSpace1 } from '../../../common/verticalSpace';
import globalUtils from '../../../services/globalUtils';
import { showToast } from '../../../common/toaster';
import './style.css';
import firebaseApp, { firebaseDB } from '../../../firebaseInit';
import AdjustAmountDialog from '../adjustAmountOnBills/adjustAmountDialog';

export default function ReceiveSRScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { supplyReport } = state;
  const [allBills, setAllBills] = useState([]);
  const [receivedBills, setReceivedBills] = useState([]);
  const [openAdjustAmountDialog, setOpenAdjustAmountDialog] = useState();
  const [otherAdjustedBills, setOtherAdjustedBills] = useState([]);

  const [loading, setLoading] = useState(false);

  const getAllBills = async () => {
    setLoading(true);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds([
        ...supplyReport.orders,
        ...supplyReport.attachedBills,
        ...supplyReport.supplementaryBills,
      ]);

      fetchedOrders = (await fetchedOrders).filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);
      setAllBills(fetchedOrders);

      setLoading(false);
    } catch (e) {
      setLoading(false);
      console.error(e);
    }
  };

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const receiveBill = (bi) => {
    setReceivedBills((r) => [...r, bi]);
  };

  // update order details in the supplyreport and individual orders
  const onComplete = async (save) => {
    setLoading(true);
    // Reference to the document in the "supplyReports" collection
    const supplyReportRef = doc(firebaseDB, 'supplyReports', supplyReport.id);

    try {
      await updateDoc(supplyReportRef, {
        ...(!save ? { status: 'Completed' } : {}),
        orderDetails: receivedBills.map((rb) => ({
          billId: rb.id,
          notes: rb.notes,
          payments: rb.payments || [],
          ...(rb.schedulePaymentDate
            ? { schedulePaymentDate: rb.schedulePaymentDate }
            : {}),
          with: rb.with,
        })),
        receivedBy: getAuth(firebaseApp).currentUser.uid,
      });

      for await (const rb2 of receivedBills) {
        const orderRef = doc(firebaseDB, 'orders', rb2.id);

        await updateDoc(orderRef, {
          payments: rb2.payments || [],
          flow: [
            ...rb2.flow,
            {
              employeeId: getAuth(firebaseApp).currentUser.uid,
              timestamp: new Date().getTime(),
              type: 'Received Bill',
            },
          ],
          balance:
            rb2.balance -
            rb2.payments.reduce((acc, cur) => acc + cur.amount, 0),
          flowCompleted: true,
          orderStatus: 'Received Bill',
          with: rb2.with,
        });
      }

      showToast(dispatchToast, 'All Bills Received', 'success');
      setLoading(false);
      navigate(-1);
      //   console.log('Document successfully updated!');
    } catch (error) {
      console.error('Error updating document: ', error);
      showToast(dispatchToast, 'An error occured', 'error');
      setLoading(false);
    }
  };

  useState(() => {
    getAllBills();
  }, []);

  if (loading) return <Loader />;

  const allBillsReceived = receivedBills.length === allBills.length;

  return (
    <>
      <AdjustAmountDialog
        otherAdjustedBills={otherAdjustedBills}
        setOtherAdjustedBills={setOtherAdjustedBills}
        orderData={openAdjustAmountDialog?.orderData}
        amountToAdjust={openAdjustAmountDialog?.amount}
        setOpen={(x) => {
          setOpenAdjustAmountDialog(x);
        }}
      />
      <center>
        <div className="receive-sr-container">
          <h3>Receive Supply Report: {supplyReport.id}</h3>
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
                openAdjustDialog={(orderData, amount) => {
                  setOpenAdjustAmountDialog({ orderData, amount });
                }}
              />
            );
          })}
        </div>
        {allBillsReceived ? (
          <Button
            onClick={() => onComplete()}
            size="large"
            appearance="primary"
          >
            COMPLETED
          </Button>
        ) : (
          <Button onClick={() => onComplete(true)} size="large">
            SAVE
          </Button>
        )}
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
}) {
  const [cash, setCash] = useState('');
  const [cheque, setCheque] = useState('');
  const [upi, setUpi] = useState('');
  const [scheduleDate, setScheduleDate] = useState();
  const [notes, setNotes] = useState('');

  const navigate = useNavigate();

  const receive = () => {
    let newPayments = data.payments || [];
    newPayments = [
      ...newPayments,
      cash.length > 0 && {
        type: 'cash',
        amount: cash,
      },
      cheque.length > 0 && {
        type: 'cheque',
        amount: cheque,
      },
      upi.length > 0 && {
        type: 'upi',
        amount: cheque,
      },
    ].filter(Boolean);
    const tempBill = {
      ...data,
      payments: [...newPayments],
      notes,
      ...(scheduleDate && { schedulePaymentDate: scheduleDate.getTime() }),
      with: 'Accounts',
    };

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
            disabled={isReceived}
            className={`input ${isReceived ? '' : 'payment'}`}
            onChange={(_, e) => setCash(e.value)}
            placeholder="Cash"
            contentBefore="₹"
            type="number"
            contentAfter={
              <div
                onClick={() => {
                  openAdjustDialog(data, cash);
                }}
              >
                <Open12Filled />
              </div>
            }
          />
          <Input
            disabled={isReceived}
            className={`input ${isReceived ? '' : 'payment'}`}
            onChange={(_, e) => setCheque(e.value)}
            placeholder="Cheque"
            contentBefore="₹"
            type="number"
          />
          <Input
            disabled={isReceived}
            className={`input ${isReceived ? '' : 'payment'}`}
            onChange={(_, e) => setUpi(e.value)}
            placeholder="UPI"
            contentBefore="₹"
            type="number"
          />
          <DatePicker
            disabled={isReceived}
            onSelectDate={setScheduleDate}
            placeholder="Schedule"
          />
          <Input
            disabled={isReceived}
            onChange={(_, e) => setNotes(e.value)}
            className="input"
            placeholder="Notes"
          />
        </div>
      </center>
    </div>
  );
}
