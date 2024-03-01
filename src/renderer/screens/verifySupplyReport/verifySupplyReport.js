/* eslint-disable no-restricted-syntax */
import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Text,
  Tooltip,
  useId,
  useToastController,
} from '@fluentui/react-components';

import {
  DeleteRegular,
  Checkmark12Filled,
  Edit12Filled,
} from '@fluentui/react-icons';
import {
  Timestamp,
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
import firebaseApp, { firebaseAuth, firebaseDB } from '../../firebaseInit';
import Loader from '../../common/loader';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import SupplementaryBillDialog from './supplementaryBillDialog/supplementaryBillDialog';
import constants from '../../constants';

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
  const [supplementaryBills, setSupplementaryBills] = useState([]);
  const [supplymanUser, setSupplymanUser] = useState();
  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);
  const navigate = useNavigate();
  const [isSupplementBillAddDialogOpen, setIsSupplementBillAddDialogOpen] =
    useState(false);

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
    try {
      const supplyReportRef = doc(firebaseDB, 'supplyReports', supplyReport.id);

      updateDoc(supplyReportRef, {
        status: constants.firebase.supplyReportStatus.DISPATCHED,
        dispatchTimestamp: Timestamp.now().toMillis(),
        attachedBills: attachedBills
          .filter((x) => x.balance !== 0)
          .map((b) => b.id),
        supplementaryBills: supplementaryBills
          .filter((x) => x.balance !== 0)
          .map((b) => b.id),
      });

      await bills.forEach(async (bill1) => {
        await updateOrder(bill1);
      });

      await [...attachedBills, ...supplementaryBills].forEach(async (bill1) => {
        await updateOldOrder(bill1);
      });
      setLoading(false);
      navigate(-1);
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
      updateDoc(orderRef, {
        balance: parseInt(bill1.orderAmount, 10),
        with: supplyReport.supplymanId,
        orderStatus: 'Dispatched',
        supplyReportId: supplyReport.id,
        flow: [
          ...bill1.flow,
          {
            employeeId: firebaseAuth.currentUser.uid,
            timestamp: Timestamp.now().toMillis(),
            type: 'Dispatched',
            comment: bill1.notes || '',
          },
        ],
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
      updateDoc(orderRef, {
        accountsNotes: modifiedBill1.notes || '',
        balance: parseInt(modifiedBill1.balance, 10),
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
        ID: {supplyReport?.receiptNumber || '--'}{' '}
        <span style={{ color: 'grey' }}>
          (Supplyman: {supplymanUser?.username})
        </span>
        <VerticalSpace2 />
        {bills.map((b, i) => {
          return (
            <PartySection
              attachedBills={[...attachedBills, ...supplementaryBills]}
              setAttachedBills={setAttachedBills}
              key={`party-section-${b.id}`}
              index={i}
              bill={b}
            />
          );
        })}
        <div>
          <Label size="large" style={{ color: '#00A9A5' }}>
            <b>Supplementary Bills</b>
          </Label>
          <VerticalSpace1 />
          <Button onClick={() => setIsSupplementBillAddDialogOpen(true)}>
            Add Supplementary Bill
          </Button>{' '}
          <VerticalSpace1 />
          {supplementaryBills.map((b, i) => {
            return (
              <SupplementaryBillRow
                key={`supp-${b.id}`}
                oldbill={b}
                saveBill={(newB) => {
                  let updatedSuppBills = [...supplementaryBills];
                  updatedSuppBills = updatedSuppBills.map((x) => {
                    if (x.id === newB.id) {
                      return newB;
                    }
                    return x;
                  });
                  setSupplementaryBills(updatedSuppBills);
                }}
                removeAttachedBill={() => {
                  setSupplementaryBills((sb) =>
                    sb.filter((x) => x.id !== b.id),
                  );
                }}
              />
            );
          })}
        </div>
        <VerticalSpace2 />
        <Button
          onClick={() => {
            onDispatch();
          }}
          appearance="primary"
        >
          Dispatch
        </Button>
      </center>
      <Dialog open={isSupplementBillAddDialogOpen}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Add Supplementary Bills</DialogTitle>
            <DialogContent>
              <SupplementaryBillDialog
                currentBills={[
                  ...attachedBills,
                  ...bills,
                  ...supplementaryBills,
                ]}
                addSupplementaryBill={(b) => {
                  console.log('attached');
                  setSupplementaryBills((ab) => [...ab, b]);
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setIsSupplementBillAddDialogOpen(false)}
                appearance="secondary"
              >
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
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
        where('balance', '!=', 0),
      );

      const querySnapshot = await getDocs(q);
      console.log(querySnapshot.size);
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
        (s1, s2) => s2.creationTime - s1.creationTime,
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
        <div className="amount">O/S ₹{getOutstanding(oldBills)}</div>
      </div>
      <div className="party-old-bills">
        <div className="party-old-bills-header">BILL NO.</div>
        <div className="party-old-bills-header">BILL DATE</div>
        <div className="party-old-bills-header">WITH</div>
        <div className="party-old-bills-header">AMOUNT</div>
        <div className="party-old-bills-header">BALANCE</div>
        <div className="party-old-bills-header">DAYS</div>
        <div className="party-old-bills-header">SCHEDULED</div>
        <div className="party-old-bills-header">NOTE</div>
        <div className="party-old-bills-header" />
        {!loading ? (
          oldBills.map((ob, i) => {
            return (
              <OldBillRow
                key={`ob-${ob.id}`}
                oldbill={ob}
                attachBill={(mod) => {
                  setAttachedBills((ab) => [...ab, mod]);
                }}
                removeAttachedBill={() => {
                  if (bill.id === ob.id) {
                    return;
                  }
                  setAttachedBills((ab) => ab.filter((x) => x.id !== ob.id));
                }}
                isAttached={
                  bill.id === ob.id ||
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

function OldBillRow({
  oldbill,
  attachBill,
  isAttached,
  removeAttachedBill,
  saveBill,
}) {
  const [newBalance, setNewBalance] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [scheduledData, setScheduledDate] = useState();
  const [withUser, setWithUser] = useState();

  const onAttachBill = (save) => {
    const modifiedBill = { ...oldbill };
    if (newNotes && newNotes.length > 0) {
      modifiedBill.notes = newNotes;
    }
    if (newBalance && newBalance.length > 0) {
      modifiedBill.balance = parseInt(newBalance, 10);
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

      <div className="old-bill">
        {globalUtils.getDaysPassed(oldbill.creationTime)}
      </div>
      <div className="old-bill scheduled">
        {globalUtils.getTimeFormat(oldbill.schedulePaymentDate, true) || '--'}
      </div>
      <Tooltip content={oldbill.note}>
        <Input
          disabled={disabled}
          style={{ width: '100px' }}
          size="small"
          className="old-bill notes"
          value={newNotes}
          appearance="underline"
          placeholder={oldbill.accountsNotes || '--'}
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
            style={{ color: disabled ? '#dddddd' : '#F25C54' }}
            onClick={() => onAttachBill()}
          >
            Attach Bill
          </Button>
        </Tooltip>
      )}
    </>
  );
}

function SupplementaryBillRow({
  oldbill,
  isAttached,
  removeAttachedBill,
  saveBill,
}) {
  const [newBalance, setNewBalance] = useState('');
  const [newNotes, setNewNotes] = useState(oldbill.accountsNotes);
  const [scheduledData, setScheduledDate] = useState();
  const [isSaved, setIsSaved] = useState(false);

  const [party, setParty] = useState();

  const getParty = async () => {
    const party1 = await globalUtils.fetchPartyInfo(oldbill.partyId);
    setParty(party1);
  };
  const scheduledForPaymentDate = () => {
    if (oldbill.schedulePaymentDate) {
      const date = new Date(oldbill.schedulePaymentDate);
      return date.toLocaleDateString();
    }
    return '--';
  };

  const onSaveBill = (save) => {
    const modifiedBill = { ...oldbill };
    if (newNotes && newNotes.length > 0) {
      modifiedBill.notes = newNotes;
    }
    if (newBalance && newBalance.length > 0) {
      modifiedBill.balance = parseInt(newBalance, 10);
    }
    console.log(modifiedBill);
    saveBill(modifiedBill);
  };

  useEffect(() => {
    getParty();
  }, []);
  return (
    <div>
      <VerticalSpace1 />
      <div style={{ width: '80%', textAlign: 'left', marginBottom: '5px' }}>
        {party?.name}
      </div>
      <div className="supplementary-bill-row">
        <Text size={200} className="old-bill bill-number">
          {oldbill.billNumber || '--'}
        </Text>
        <Text size={200} className="old-bill bill-number">
          {new Date(oldbill.creationTime).toLocaleDateString()}
        </Text>
        <div className="old-bill amount">₹{oldbill.orderAmount}</div>

        <div>{globalUtils.getDaysPassed(oldbill.creationTime)} Days</div>

        <Tooltip content={`₹${oldbill.balance}`}>
          <Input
            disabled={isSaved}
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
        <Tooltip content={oldbill.accountsNotes}>
          <Input
            disabled={isSaved}
            style={{ width: '100px' }}
            size="small"
            className="old-bill notes"
            value={newNotes}
            appearance="underline"
            placeholder={oldbill.accountsNotes || 'Notes'}
            onChange={(_, t) => setNewNotes(t.value)}
          />
        </Tooltip>
        <span style={{ display: 'flex' }}>
          {isSaved ? (
            <Button
              className="old-bill"
              appearance="subtle"
              onClick={() => {
                setIsSaved(false);
              }}
            >
              <Edit12Filled />
            </Button>
          ) : (
            <Button
              className="old-bill"
              appearance="subtle"
              style={{ color: '#00A9A5' }}
              onClick={() => {
                onSaveBill();
                setIsSaved(true);
              }}
            >
              <Checkmark12Filled />
            </Button>
          )}
          <Button
            className="old-bill"
            appearance="subtle"
            onClick={() => removeAttachedBill()}
          >
            <DeleteRegular />
          </Button>
        </span>
      </div>
    </div>
  );
}
