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

const numColumns = 5;

export default function PendingBillsToday() {
  const [orders, setOrders] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [toDateOpen, setToDateOpen] = useState(false);
  const [fromDateOpen, setfromDateOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mrPartiesList, setMrPartiesList] = useState({});

  const fetchTodaysBills = async () => {
    try {
      setLoading(true);
      const ordersCollection = collection(firebaseDB, 'orders');
      const routeCollection = collection(firebaseDB, 'mr_routes');
      const dateFrom = new Date(fromDate);
      dateFrom.setHours(0);
      dateFrom.setMinutes(0);
      dateFrom.setSeconds(0);

      const routesList = await getDocs(routeCollection);

      const routes = [];
      routesList.forEach((doc1) => {
        routes.push(doc1.data());
      });

      const weekday = dateFrom.getDay();
      const mrParties = {}; // 0 (Sunday) to 6 (Saturday)
      routes.forEach((route) => {
        mrParties[route.name] = route.route[weekday - 1]?.parties;
      });

      console.log(mrParties);
      setMrPartiesList(mrParties);
      // console.log(mrParties)
    } catch (error) {
      console.error('Error fetching partiee: ', error);
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchTodaysBills();
  }, []);

  return (
    <center>
      <h3>Pending Bills For Collection</h3>
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
        {/* &nbsp;
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
        &nbsp; */}
        <Button onClick={() => fetchTodaysBills()}>Get</Button>
      </div>

      <VerticalSpace2 />

      {loading ? (
        <Spinner />
      ) : (
        <div>
          {Object.keys(mrPartiesList).map((mr) => (
            <div key={`mr${mr}`}>
              <h2>
                {mr} - {mrPartiesList[mr]?.length ?? 0} Parties
              </h2>
              <table style={{ width: '80%', margin: 'auto' }}>
                <thead>
                  <tr>
                    <th width={`${100 / numColumns}%`}>Bill No</th>
                    <th width={`${100 / numColumns}%`}>Bill Date</th>
                    <th width={`${100 / numColumns}%`}>Bill Amount</th>
                    <th width={`${100 / numColumns}%`}>Balance</th>
                    <th width={`${100 / numColumns}%`}>Days</th>
                  </tr>
                </thead>
              </table>
              {mrPartiesList[mr].map((party) => (
                <BillsList partyId={party} />
              ))}
            </div>
          ))}
        </div>
      )}
    </center>
  );
}

function BillsList({ partyId }) {
  const [bills, setBills] = useState([]);
  const [partyDetails, setPartyDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPartyDetails = async () => {
    try {
      const partyDoc = doc(firebaseDB, 'parties', partyId);
      const partySnap = await getDoc(partyDoc);
      if (partySnap.exists()) {
        setPartyDetails(partySnap.data());
      } else {
        console.log('No such party document!');
      }
    } catch (error) {
      console.error('Error fetching party details: ', error);
    }
  };
  const fetchPartyBills = async () => {
    try {
      const ordersCollection = collection(firebaseDB, 'orders');
      const q = query(
        ordersCollection,
        where('partyId', '==', partyId),
        where('balance', '>', 0),
        orderBy('billCreationTime', 'desc'),
        limit(10),
      ); // Assuming 'balance' field indicates pending amount

      const querySnapshot = await getDocs(q);
      const bills1 = [];
      querySnapshot.forEach((doc1) => {
        bills1.push({ id: doc1.id, ...doc1.data() });
      });

      setBills(bills1);
      console.log(`Bills for party ${partyId}:`, bills);
      // Set the fetched bills to state (not implemented here)
    } catch (error) {
      console.error('Error fetching party bills: ', error);
    }
  };

  const init = async () => {
    setLoading(true);
    await fetchPartyDetails();
    await fetchPartyBills();
    setLoading(false);
  };

  useEffect(() => {
    init();
  }, []);
  if (loading) {
    return <Spinner />;
  }
  if (bills.length === 0) {
    return null;
  }

  const calculateDaysBetween = (date1, date2) => {
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      {/* Show bill number, bill date, bill amount,  number of days since bill issued (calculate using the bill date) in table format of all the bills */}
      <table style={{ width: '80%', margin: 'auto' }}>
        <tbody>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <td colSpan={5}>
              <b>
                {partyDetails?.name ?? partyId} - {bills.length} Pending Bills
              </b>
            </td>
          </tr>
          {bills.map((bill) => (
            <tr key={bill.id}>
              <td width={`${100 / numColumns}%`}>{bill.billNumber}</td>
              <td width={`${100 / numColumns}%`}>
                {globalUtils.getTimeFormat(bill.billCreationTime, true, false)}
              </td>
              <td style={{ textAlign: 'right', width: `${100 / numColumns}%` }}>
                {globalUtils.getCurrencyFormat(bill.orderAmount)}
              </td>
              <td style={{ textAlign: 'right', width: `${100 / numColumns}%` }}>
                {globalUtils.getCurrencyFormat(bill.balance)}
              </td>
              <td style={{ textAlign: 'right', width: `${100 / numColumns}%` }}>
                {calculateDaysBetween(bill.billCreationTime, new Date())} days
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <br />
    </div>
  );
}
