/* eslint-disable jsx-a11y/control-has-associated-label */
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

export default function CashReport() {
  const [cashVouchers, setCashVouchers] = useState([]);
  const [total, setTotal] = useState(0);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [loading, setLoading] = useState(false);

  const printingRef = useRef();
  // const handlePrint = useReactToPrint({
  //   copyStyles: true,

  //   content: () => printingRef.current,
  // });

  const handlePrint = () => {
    window.electron.ipcRenderer.sendMessage('printCurrentPage');
  };
  const onSearch = (clear) => {
    const supplyReportRef = collection(firebaseDB, 'cashReceipts');

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

    dynamicQuery = query(
      dynamicQuery,
      where('timestamp', '>=', dateFrom.getTime()),
      where('timestamp', '<=', dateTo.getTime()),
    );

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
          (rd1, rd2) => rd1.timestamp - rd2.timestamp,
        );
        let total1 = 0;
        supplyReportData.forEach((x) => {
          x.prItems.forEach((y) => {
            total1 += y.amount;
          });
        });
        setTotal(total1);
        setCashVouchers(supplyReportData);
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
          Cash Collection Report -{' '}
          {globalUtils.getTimeFormat(selectedDate, true)}
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
            {cashVouchers.map((sr, i) => {
              return (
                <CashReportRow
                  key={`supply-report-all-list-${sr.id}`}
                  index={i}
                  data={sr}
                />
              );
            })}
          </div>
        )}
        {!loading && cashVouchers.length === 0 ? (
          <div>No Supply Reports found</div>
        ) : null}
      </div>
      <h3>Total Cash Collection - {globalUtils.getCurrencyFormat(total)}</h3>

      <div>*** End of Report ***</div>
    </center>
  );
}

function CashReportRow({ data, index }) {
  const navigate = useNavigate();

  const { allUsers } = useAuthUser();
  return (
    <table>
      <thead className="supply-report-row">
        <th>
          <Text className="sr-id">{data.cashReceiptNumber}</Text>
        </th>
        <th />
        <th>
          <Text className="sr-id">
            {allUsers.find((x) => x.uid === data.paymentFromUserId)?.username}
          </Text>
        </th>

        <th>
          {' '}
          <Text className="sr-supplyman">
            {globalUtils.getDayTime(data.timestamp)}
          </Text>
        </th>
      </thead>

      {data.prItems.map((x) => (
        <SupplyReportOrderRow prItem={x} />
      ))}
    </table>
  );
}

function SupplyReportOrderRow({ prItem }) {
  const [party, setParty] = useState();
  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();
  const fetchParty = async () => {
    setLoading(true);
    try {
      const party1 = await globalUtils.fetchPartyInfo(prItem.partyId);

      setParty(party1);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchParty();
  }, []);

  if (loading) return <Spinner />;
  if (!party) return <div>Error loading party</div>;

  return (
    <tbody className="supply-report-print-bill-detail">
      <td style={{ width: '20%' }}>{party.name}</td>
      <td style={{ width: '10%' }}>{party.area}</td>
      <td style={{ width: '5%' }}>{party.fileNumber}</td>
      <td style={{ width: '10%' }}>
        {globalUtils.getCurrencyFormat(prItem.amount)}
      </td>
    </tbody>
  );
}
