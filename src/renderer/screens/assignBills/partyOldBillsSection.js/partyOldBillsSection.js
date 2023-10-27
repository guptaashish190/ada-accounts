/* eslint-disable no-nested-ternary */
/* eslint-disable no-restricted-syntax */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { evaluate } from 'mathjs';
import {
  Button,
  Divider,
  Input,
  Spinner,
  Tooltip,
} from '@fluentui/react-components';
import { DeleteRegular } from '@fluentui/react-icons';
import { firebaseDB } from '../../../firebaseInit';
import Loader from '../../../common/loader';
import globalUtils from '../../../services/globalUtils';
import './style.css';
import { VerticalSpace2 } from '../../../common/verticalSpace';

export default function PartySection({
  party,
  setAttachedBills,
  attachedBills,
  onRemoveParty,
}) {
  const [oldBills, setOldBills] = useState([]);
  const [loading, setLoading] = useState(false);
  // Fetch orders based on the query
  const fetchData = async () => {
    console.log(party);
    setLoading(true);
    try {
      const ordersCollection = collection(firebaseDB, 'orders');
      const q = query(
        ordersCollection,
        where('partyId', '==', party.id),
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
      <div>
        <h3
          style={{
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {party.name}{' '}
          <DeleteRegular
            onClick={() => {
              onRemoveParty();
            }}
            style={{ marginLeft: '10px', cursor: 'pointer' }}
          />
        </h3>
        <h4>
          {party.fileNumber} - {party.area}
        </h4>
      </div>
      {oldBills.length && !loading ? (
        <div className="party-old-bills">
          <div className="party-old-bills-header">BILL NO.</div>
          <div className="party-old-bills-header">BILL DATE</div>
          <div className="party-old-bills-header">WITH</div>
          <div className="party-old-bills-header">AMOUNT</div>
          <div className="party-old-bills-header">BALANCE</div>
          <div className="party-old-bills-header">SCHEDULED</div>
          <div className="party-old-bills-header">NOTE</div>
          <div className="party-old-bills-header" />
          {oldBills.map((ob, i) => {
            return (
              <OldBillRow
                key={`ob-${ob.id}`}
                oldbill={ob}
                attachBill={(mod) => {
                  setAttachedBills((ab) => [...ab, mod]);
                }}
                removeAttachedBill={() => {
                  setAttachedBills((ab) => ab.filter((x) => x.id !== ob.id));
                }}
                isAttached={
                  attachedBills.findIndex((fi) => fi.id === ob.id) !== -1
                }
              />
            );
          })}
        </div>
      ) : null}
      {!oldBills.length && !loading ? (
        <div>No Outstanding Bills found</div>
      ) : null}
      {loading ? <Spinner /> : null}
      <VerticalSpace2 />
      <Divider />
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
          Remove
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
            style={{ color: disabled ? 'grey' : '#F25C54' }}
            onClick={() => onAttachBill()}
          >
            Attach
          </Button>
        </Tooltip>
      )}
    </>
  );
}
