/* eslint-disable jsx-a11y/control-has-associated-label */
import { DatePicker } from '@fluentui/react-datepicker-compat';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Input,
  ProgressBar,
  Spinner,
} from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import { VerticalSpace2 } from '../../common/verticalSpace';
import globalUtils from '../../services/globalUtils';

export default function ScheduledBillsScreen() {
  const [orders, setOrders] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [toDateOpen, setToDateOpen] = useState(false);
  const [fromDateOpen, setfromDateOpen] = useState(true);
  const [zeroBalanceBills, setZeroBalanceBills] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchScheduledBills = async () => {
    try {
      setLoading(true);
      const ordersCollection = collection(firebaseDB, 'orders');
      const dateFrom = new Date(fromDate);
      dateFrom.setHours(0);
      dateFrom.setMinutes(0);
      dateFrom.setSeconds(0);

      const dateTo = new Date(toDate);
      dateTo.setHours(23);
      dateTo.setMinutes(59);
      dateTo.setSeconds(59);

      const q = query(
        ordersCollection,
        where('schedulePaymentDate', '>=', dateFrom.getTime()),
        where('schedulePaymentDate', '<=', dateTo.getTime()),
        limit(1000),
        orderBy('schedulePaymentDate', 'desc'),
      );
      const querySnapshot = await getDocs(q);

      const orderList = [];
      querySnapshot.forEach((doc1) => {
        const od = doc1.data();
        console.log(od.balance);
        if (od.balance > 2) {
          orderList.push(od);
        } else {
          zeroBalanceBills.push(od);
        }
      });
      setOrders(orderList);
    } catch (error) {
      console.error('Error fetching partiee: ', error);
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchScheduledBills();
  }, []);

  return (
    <center>
      <h3>Scheduled Bills</h3>
      <div>
        <DatePicker
          //   open={fromDateOpen}
          className=" filter-input"
          onSelectDate={(x) => {
            setFromDate(x);
            setToDateOpen(true);
            setfromDateOpen(false);
          }}
          placeholder="From"
          value={fromDate}
        />
        &nbsp;
        <DatePicker
          //   open={toDateOpen}
          className=" filter-input"
          onSelectDate={(x) => {
            setToDate(x);
            setToDateOpen(false);
          }}
          placeholder="To"
          value={toDate}
        />
        &nbsp;
        <Button onClick={() => fetchScheduledBills()}>Get</Button>
      </div>

      <VerticalSpace2 />

      {loading ? (
        <Spinner />
      ) : (
        <div>
          <div className="modern-table">
            <div className="modern-table-header" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
              <div>Bill Number</div>
              <div>Party</div>
              <div style={{ textAlign: 'right' }}>Amount</div>
              <div style={{ textAlign: 'right' }}>Balance</div>
              <div>Scheduled For</div>
              <div>Accounts Notes</div>
              <div>Schedule</div>
              <div>Action</div>
            </div>
            {orders.map((x) => (
              <OrderScheduledRow key={`scheuled${x.id}`} order={x} />
            ))}
          </div>
          <br />
          <h2>Bills Payment Received</h2>
          <div className="modern-table">
            <div 
              className="modern-table-header" 
              style={{ 
                gridTemplateColumns: 'repeat(5, 1fr)',
                backgroundColor: '#10b981',
                color: 'white'
              }}
            >
              <div>Bill Number</div>
              <div>Party</div>
              <div style={{ textAlign: 'right' }}>Amount</div>
              <div>Scheduled For</div>
              <div>Accounts Notes</div>
            </div>
            {zeroBalanceBills.map((x) => (
              <ZeroBalanceBillRow key={`zeroscheuled${x.id}`} order={x} />
            ))}
          </div>
        </div>
      )}
    </center>
  );
}

function OrderScheduledRow({ order }) {
  const [orderUpdated, setOrderUpdated] = useState(order);
  const [party, setParty] = useState();
  const [scheduleDate, setScheduleDate] = useState();
  const [accNotes, setAccNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const getParty = async () => {
    const party1 = await globalUtils.fetchPartyInfo(orderUpdated.partyId);
    setParty(party1);
  };

  const onSave = async () => {
    setLoading(true);
    const orderDoc = doc(firebaseDB, 'orders', orderUpdated.id);
    await updateDoc(orderDoc, {
      schedulePaymentDate: scheduleDate.getTime(),
      accountsNotes: accNotes.length ? accNotes : undefined,
    });

    const newOrder = await getDoc(orderDoc);
    setOrderUpdated(newOrder.data());
    setAccNotes('');
    setScheduleDate();
    setLoading(false);
  };

  useEffect(() => {
    getParty();
  }, []);
  return (
    <tr key={`scheuled${orderUpdated.id}`}>
      <td>{orderUpdated.billNumber}</td>
      <td>{party?.name ?? '...'}</td>
      <td>{globalUtils.getCurrencyFormat(orderUpdated.orderAmount)}</td>
      <td>{globalUtils.getCurrencyFormat(orderUpdated.balance)}</td>
      <td>
        {globalUtils.getTimeFormat(orderUpdated.schedulePaymentDate, true)}
      </td>

      <td>
        <Input
          value={accNotes}
          onChange={(e) => setAccNotes(e.target.value)}
          placeholder={orderUpdated.accountsNotes}
        />
      </td>
      <td>
        <DatePicker
          minDate={new Date()}
          size="small"
          onSelectDate={setScheduleDate}
          placeholder="Schedule"
          value={scheduleDate}
        />
      </td>
      <td>
        {loading ? (
          <Spinner />
        ) : (
          <Button
            onClick={() => onSave()}
            disabled={
              accNotes === orderUpdated.accountsNotes &&
              scheduleDate?.getTime() === orderUpdated.schedulePaymentDate
            }
          >
            Save
          </Button>
        )}
      </td>
    </tr>
  );
}

function ZeroBalanceBillRow({ order }) {
  const [party, setParty] = useState();
  const getParty = async () => {
    const party1 = await globalUtils.fetchPartyInfo(order.partyId);
    setParty(party1);
  };

  useEffect(() => {
    getParty();
  }, []);

  return (
    <tr key={`scheuled${order.id}`}>
      <td>{order.billNumber}</td>
      <td>{party?.name ?? '...'}</td>
      <td>{globalUtils.getCurrencyFormat(order.orderAmount)}</td>
      <td>{globalUtils.getTimeFormat(order.schedulePaymentDate, true)}</td>

      <td>{order.accountsNotes}</td>
    </tr>
  );
}
