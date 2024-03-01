/* eslint-disable no-restricted-syntax */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';

import '../style.css';
import ReactToPrint, { useReactToPrint } from 'react-to-print';
import { useAuthUser } from '../../../contexts/allUsersContext';
import { firebaseDB } from '../../../firebaseInit';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';

export default function SaleReportScreen() {
  const [bills, setBills] = useState([]);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();

  const handlePrint = () => {
    window.electron.ipcRenderer.sendMessage('printCurrentPage');
  };
  const onSearch = (clear) => {
    const saleRef = collection(firebaseDB, 'orders');

    // Build the query dynamically based on non-empty filter fields
    let dynamicQuery = saleRef;

    const dateFrom = new Date(selectedDate);
    dateFrom.setHours(0);
    dateFrom.setMinutes(0);
    dateFrom.setSeconds(1);
    const dateTo = new Date(selectedDate);
    dateTo.setHours(23);
    dateTo.setMinutes(59);
    dateTo.setSeconds(59);

    dynamicQuery = query(
      dynamicQuery,
      where('billCreationTime', '>=', dateFrom.getTime()),
      where('billCreationTime', '<=', dateTo.getTime()),
    );

    // Fetch parties based on the dynamic query
    const fetchData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(dynamicQuery);
        let saleReportData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        saleReportData = saleReportData.sort(
          (rd1, rd2) => rd1.billCreationTime - rd2.billCreationTime,
        );

        setBills(saleReportData);
      } catch (error) {
        console.error('Error fetching all bills', error);
      }
      setLoading(false);
    };

    fetchData();
  };
  useEffect(() => {
    onSearch(true);
  }, []);

  return (
    <center>
      <div className="print-supply-reports-container">
        <h3>
          Day Supply Report - {globalUtils.getTimeFormat(selectedDate, true)}
        </h3>

        <div className="all-bills-search-input-container">
          <DatePicker
            className=" filter-input"
            onSelectDate={setSelectedDate}
            placeholder="From"
            value={selectedDate}
          />

          <Button
            onClick={() => {
              onSearch();
            }}
          >
            Search
          </Button>

          <Button onClick={handlePrint}>Print</Button>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <table>
            <thead>
              <th>Bill Number</th>
              <th>Party Name</th>
              <th>Bill Date</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Remarks</th>
            </thead>
            {bills.map((x, i) => {
              return <SupplyReportOrderRow order={x} />;
            })}
          </table>
        )}
        {!loading && bills.length === 0 ? (
          <div>No Supply Reports found</div>
        ) : null}
      </div>

      <div>*** End of Report ***</div>
    </center>
  );
}

function SupplyReportOrderRow({ order }) {
  const [loading, setLoading] = useState(false);
  const [party, setParty] = useState();
  const fetchParty = async () => {
    setLoading(true);
    try {
      const newOrder = await globalUtils.fetchPartyInfoForOrders([order]);
      setParty(newOrder[0]);
      console.log(newOrder);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParty();
  }, []);

  if (loading) return <Spinner />;
  if (!party) return <div>Error loading order</div>;
  const getPaymentSum = order.payments?.reduce(
    (acc, current) => acc + (parseInt(current.amount, 10) || 0),
    0,
  );
  return (
    <tbody className="sale-report-print-bill-detail">
      <td style={{ width: '10%' }}>{order.billNumber || '--'}</td>
      <td style={{ width: '40%' }}>{party.party.name}</td>
      <td style={{ width: '10%' }}>
        {globalUtils.getTimeFormat(order.billCreationTime, true)}
      </td>
      <td style={{ width: '10%' }}>
        {globalUtils.getCurrencyFormat(order.orderAmount)}
      </td>
      <td>{globalUtils.getCurrencyFormat(getPaymentSum) || '--'}</td>
      <td>{order.accountsNotes || '--'}</td>
    </tbody>
  );
}
