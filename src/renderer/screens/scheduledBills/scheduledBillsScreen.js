import { DatePicker } from '@fluentui/react-datepicker-compat';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Button, Spinner } from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import { VerticalSpace2 } from '../../common/verticalSpace';
import globalUtils from '../../services/globalUtils';

export default function ScheduledBillsScreen() {
  const [orders, setOrders] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [toDateOpen, setToDateOpen] = useState(false);
  const [fromDateOpen, setfromDateOpen] = useState(true);
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
      querySnapshot.forEach((doc) => {
        orderList.push(doc.data());
      });
      console.log(orderList);
      setOrders(orderList);
    } catch (error) {
      console.error('Error fetchisng partiee: ', error);
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
          <table>
            <thead>
              <th>Bill Number</th>
              <th>Party</th>
              <th>Amount</th>
              <th>Balance</th>
              <th>Scheduled For</th>
              <th>Accounts Notes</th>
            </thead>
            <tbody>
              {orders.map((x) => {
                return <OrderScheduledRow key={`scheuled${x.id}`} order={x} />;
              })}
            </tbody>
          </table>
        </div>
      )}
    </center>
  );
}

function OrderScheduledRow({ order }) {
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
      <td>{globalUtils.getCurrencyFormat(order.balance)}</td>
      <td>{globalUtils.getTimeFormat(order.schedulePaymentDate, true)}</td>
      <td>{order.accountsNotes}</td>
    </tr>
  );
}
