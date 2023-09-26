/* eslint-disable no-restricted-syntax */
import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Button,
  Input,
  Tooltip,
  useId,
  useToastController,
} from '@fluentui/react-components';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import shortid from 'shortid';
import { evaluate } from 'mathjs';
import globalUtils from '../../services/globalUtils';
import { showToast } from '../../common/toaster';
import './style.css';
import { firebaseDB } from '../../firebaseInit';
import Loader from '../../common/loader';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';

// BALANCE WILL BE ADDED TO THE ORDER DOCUMENT BEFORE THIS SCREEN FOR A NEW ORDER(BILL)
// BECAUSE OF THIS, AS THE OLD BILLS ARE FILTERED BASED ON BALANCE, THE NEW BILL SHOULD NOT
// COME IN THE LIST OF OLD BILLS AS THE NEW BILL DOESNT HAVE ANY BALANCE KEY IN THE DOCUMENT

export default function VerifySupplyReport() {
  const location = useLocation();
  const [loading, setLoading] = useState();
  const [bills, setBills] = useState([]);
  const locationState = location.state;
  const supplyReport = locationState?.supplyReport;
  const [attachedBills, setAttachedBills] = useState([]);
  const [supplymanUser, setSupplymanUser] = useState();
  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const prefillState = async () => {
    setLoading(true);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(
        supplyReport.orders,
      );

      fetchedOrders = (await fetchedOrders).filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);
      setBills(fetchedOrders);

      const supplymanUser1 = await globalUtils.fetchUserById(
        supplyReport.supplymanId,
      );
      setSupplymanUser(supplymanUser1);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      showToast(
        dispatchToast,
        'An error occured loading supply report',
        'error',
      );
    }
  };
  useEffect(() => {
    prefillState();
  }, []);

  const onDispatch = async () => {
    setLoading(true);
    try {
      const supplyReportRef = doc(firebaseDB, 'supplyReports', supplyReport.id);

      await updateDoc(supplyReportRef, {
        isDispatched: true,
        attachedBills,
      });

      await bills.forEach(async (bill1) => {
        await updateOrder(bill1);
      });

      await attachedBills.forEach(async (bill1) => {
        await updateOldOrder(bill1);
      });
      setLoading(false);
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };
  const updateOrder = async (bill1) => {
    try {
      // Create a reference to the specific order document
      const orderRef = doc(firebaseDB, 'orders', bill1.id);

      // Update the "orderStatus" field in the order document to "dispatched"
      await updateDoc(orderRef, {
        balance: bill1.orderAmount,
        with: supplyReport.supplymanId,
      });

      console.log(`Order status updated to "dispatched"`);
    } catch (error) {
      console.error(`Error updating order  status:`, error);
    }
  };
  const updateOldOrder = async (modifiedBill1) => {
    try {
      // Create a reference to the specific order document
      const orderRef = doc(firebaseDB, 'orders', modifiedBill1.id);

      // Update the "orderStatus" field in the order document to "dispatched"
      await updateDoc(orderRef, {
        ...modifiedBill1,
        with: supplyReport.supplymanId,
      });

      console.log(`Order status updated to "dispatched"`);
    } catch (error) {
      console.error(`Error updating order  status:`, error);
    }
  };

  return (
    <div className="verify-supply-report">
      <center>
        {loading ? <Loader /> : null}
        <h3>Verify Supply Report</h3>
        ID: {supplyReport?.id}{' '}
        <span style={{ color: 'grey' }}>
          (Supplyman: {supplymanUser?.username})
        </span>
        <VerticalSpace2 />
        {bills.map((b, i) => {
          return (
            <PartySection
              attachedBills={attachedBills}
              setAttachedBills={setAttachedBills}
              key={b.id}
              index={i}
              bill={b}
            />
          );
        })}
        <Button
          onClick={() => {
            onDispatch();
          }}
          appearance="primary"
        >
          Dispatch
        </Button>
      </center>
    </div>
  );
}

function PartySection({ bill, index, setAttachedBills, attachedBills }) {
  const [oldBills, setOldBills] = useState([]);
  const [loading, setLoading] = useState(false);
  // Fetch orders based on the query
  const fetchData = async () => {
    setLoading(true);
    try {
      const ordersCollection = collection(firebaseDB, 'orders');
      const q = query(
        ordersCollection,
        where('partyId', '==', bill.partyId),
        where('balance', '>', 0),
      );

      const querySnapshot = await getDocs(q);
      const ordersData = [];
      for await (const doc1 of querySnapshot.docs) {
        // Get data for each order
        const orderData = doc1.data();
        // Fetch party information using partyID from the order
        const partyDocRef = doc(firebaseDB, 'parties', orderData.partyId);
        const partyDocSnapshot = await getDoc(partyDocRef);

        if (partyDocSnapshot.exists()) {
          const partyData = partyDocSnapshot.data();

          // Add the party object to the order object
          orderData.party = partyData;
        }

        ordersData.push(orderData);
      }
      const sortedData = ordersData.sort(
        (s1, s2) => s1.creationTime - s2.creationTime,
      );
      setOldBills(sortedData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders: ', error);
      setLoading(false);
    }
  };

  const getOutstanding = (orders1) => {
    return orders1.reduce(
      (acc, cur) =>
        acc + (evaluate(cur.balance?.toString() || '0') || cur.orderAmount),
      0,
    );
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="party-section-container">
      <div className="party-info-header">
        <div className="index">{index + 1}.</div>
        <div className="party-name">{bill.party?.name}</div>
        <div className="bill-number">{bill.billNumber.toUpperCase()}</div>
        <div className="file-number">{bill.party?.fileNumber}</div>
        <div className="amount">₹{bill.orderAmount}</div>
        <div className="amount">O/S ₹{getOutstanding([...oldBills, bill])}</div>
      </div>
      <div className="party-old-bills">
        <div className="party-old-bills-header">BILL NO.</div>
        <div className="party-old-bills-header">BILL DATE</div>
        <div className="party-old-bills-header">WITH</div>
        <div className="party-old-bills-header">AMOUNT</div>
        <div className="party-old-bills-header">BALANCE</div>
        <div className="party-old-bills-header">SCHEDULED</div>
        <div className="party-old-bills-header">NOTE</div>
        <div className="party-old-bills-header" />
        {!loading ? (
          oldBills.map((ob, i) => {
            return (
              <OldBillRow
                key={`ob-${ob.id}`}
                oldbill={ob}
                attachBill={() => {
                  setAttachedBills((ab) => [...ab, ob]);
                }}
                removeAttachedBill={() => {
                  setAttachedBills((ab) => ab.filter((x) => x.id !== ob.id));
                }}
                isAttached={
                  attachedBills.findIndex((fi) => fi.id === ob.id) !== -1
                }
              />
            );
          })
        ) : (
          <Loader />
        )}
      </div>
    </div>
  );
}

function OldBillRow({ oldbill, attachBill, isAttached, removeAttachedBill }) {
  const [newBalance, setNewBalance] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [scheduledData, setScheduledDate] = useState();
  const [withUser, setWithUser] = useState();

  const scheduledForPaymentDate = () => {
    if (oldbill.scheduledForPayment) {
      const date = new Date(oldbill.scheduledForPayment);
      return date.toLocaleDateString();
    }
    return '--';
  };

  const onAttachBill = () => {
    const modifiedBill = { ...oldbill };
    if (newNotes.length > 0) {
      modifiedBill.notes = newNotes;
    }
    if (newBalance.length > 0) {
      modifiedBill.balance = newBalance;
    }
    attachBill(modifiedBill);
  };

  const fetchWithUser = async () => {
    if (oldbill.with && oldbill.with !== 'Accounts') {
      const user = await globalUtils.fetchUserById(oldbill.with);
      setWithUser(user.username);
    } else {
      setWithUser('Accounts');
    }
  };

  const disabled = isAttached || oldbill.with !== 'Accounts';

  useEffect(() => {
    fetchWithUser();
  }, []);
  return (
    <>
      <div className="old-bill bill-number">{oldbill.billNumber}</div>
      <div className="old-bill bill-number">
        {new Date(oldbill.creationTime).toLocaleDateString()}
      </div>
      <div className="old-bill with">{withUser}</div>
      <div className="old-bill amount">₹{oldbill.orderAmount}</div>

      <Tooltip content={`₹${oldbill.balance}`}>
        <Input
          disabled={disabled}
          style={{ width: '100px' }}
          size="small"
          value={newBalance}
          contentBefore="₹"
          appearance="underline"
          placeholder={`${oldbill.balance}`}
          className="old-bill amount"
          onChange={(_, d) => setNewBalance(d.value)}
        />
      </Tooltip>
      <div className="old-bill scheduled">{scheduledForPaymentDate()}</div>
      <Tooltip content={oldbill.note}>
        <Input
          disabled={disabled}
          style={{ width: '100px' }}
          size="small"
          className="old-bill notes"
          value={newNotes}
          appearance="underline"
          placeholder={oldbill.note || '--'}
          onChange={(_, t) => setNewNotes(t.value)}
        />
      </Tooltip>
      {isAttached ? (
        <Button
          className="old-bill"
          appearance="subtle"
          onClick={() => removeAttachedBill()}
        >
          Remove Bill
        </Button>
      ) : (
        <Tooltip
          content={
            withUser !== 'Accounts'
              ? 'Cannot attach bill as it is not present in accounts.'
              : 'Attach Bill'
          }
        >
          <Button
            disabled={disabled}
            className="old-bill"
            appearance="subtle"
            style={{ color: '#F25C54' }}
            onClick={() => onAttachBill()}
          >
            Attach Bill
          </Button>
        </Tooltip>
      )}
    </>
  );
}
