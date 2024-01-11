/* eslint-disable no-restricted-syntax */
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
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

import './style.css';
import ReactToPrint, { useReactToPrint } from 'react-to-print';
import { useAuthUser } from '../../../contexts/allUsersContext';
import { firebaseDB } from '../../../firebaseInit';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';

export default function DaySupplyReportPrint() {
  const [supplyReports, setSupplyReports] = useState([]);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();

  const printingRef = useRef();

  const handlePrint = () => {
    window.electron.ipcRenderer.sendMessage('printCurrentPage');
  };
  const onSearch = (clear) => {
    const supplyReportRef = collection(firebaseDB, 'supplyReports');

    // Build the query dynamically based on non-empty filter fields
    let dynamicQuery = supplyReportRef;

    const dateFrom = new Date(selectedDate);
    dateFrom.setHours(0);
    dateFrom.setMinutes(0);
    dateFrom.setSeconds(1);
    const dateTo = new Date(selectedDate);
    dateTo.setHours(23);
    dateTo.setMinutes(59);
    dateTo.setSeconds(59);
    console.log(dateFrom.toLocaleString(), dateTo.toLocaleString());
    dynamicQuery = query(
      dynamicQuery,
      where('timestamp', '>=', dateFrom.getTime()),
      where('timestamp', '<=', dateTo.getTime()),
    );

    dynamicQuery = query(dynamicQuery);
    // Fetch parties based on the dynamic query
    const fetchData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(dynamicQuery);
        let supplyReportData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        supplyReportData = supplyReportData.sort(
          (rd1, rd2) => rd2.receiptNumber.slice(3) - rd1.receiptNumber.slice(3),
        );

        supplyReportData = supplyReportData.filter(
          (x) => x.status !== constants.firebase.supplyReportStatus.TOACCOUNTS,
        );
        setSupplyReports(supplyReportData);
      } catch (error) {
        console.error('Error fetching supply reports:', error);
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
          <div ref={printingRef}>
            {supplyReports.map((sr, i) => {
              return (
                <SupplyReportRow
                  key={`supply-report-all-list-${sr.id}`}
                  index={i}
                  data={sr}
                />
              );
            })}
          </div>
        )}
        {!loading && supplyReports.length === 0 ? (
          <div>No Supply Reports found</div>
        ) : null}
      </div>
    </center>
  );
}

function SupplyReportRow({ data, index }) {
  const navigate = useNavigate();
  const [supplyman, setSupplyman] = useState();

  const getSupplyman = async () => {
    const user = await globalUtils.fetchUserById(data.supplymanId);
    setSupplyman(user);
  };

  useEffect(() => {
    getSupplyman();
  }, []);
  return (
    <>
      <div className="supply-report-row">
        <Text className="sr-id">{data.receiptNumber}</Text>
        <Text className="sr-timestamp">
          {globalUtils.getTimeFormat(data.timestamp, true)}
        </Text>
        <Text className="sr-parties-length">
          {data.orders.length +
            (data.attachedBills?.length || 0) +
            (data.supplementaryBills?.length || 0)}{' '}
          Bills{' '}
        </Text>
        <Text className="sr-supplyman">{supplyman?.username}</Text>
      </div>

      <div>
        {data.orders.map((x) => (
          <SupplyReportOrderRow billId={x} />
        ))}
      </div>
      <br />
    </>
  );
}

function SupplyReportOrderRow({ billId }) {
  const [order, setOrder] = useState();
  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();
  const fetchOrder = async () => {
    setLoading(true);
    try {
      const order1 = await globalUtils.fetchOrdersByIds([billId]);
      const newOrder = await globalUtils.fetchPartyInfoForOrders(order1);
      setOrder(newOrder[0]);
      console.log(newOrder[0]);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrder();
  }, []);

  if (loading) return <Spinner />;
  if (!order) return <div>Error loading order</div>;

  return (
    <div className="supply-report-print-bill-detail">
      <div>{order.party.name}</div>
      <div>{order.billNumber}</div>
      <div>{globalUtils.getCurrencyFormat(order.orderAmount)}</div>
      <div>MR: {allUsers.find((x) => x.uid === order.mrId)?.username}</div>
    </div>
  );
}
