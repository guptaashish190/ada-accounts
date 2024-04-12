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

export default function ExpenseReport() {
  const [expenseVouchers, setExpenseVouchers] = useState({});
  const [total, setTotal] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();

  const printingRef = useRef();
  // const handlePrint = useReactToPrint({
  //   copyStyles: true,

  //   content: () => printingRef.current,
  // });

  const handlePrint = () => {
    window.electron.ipcRenderer.sendMessage('printCurrentPage');
  };
  const onSearch = (clear) => {
    const vouchersRef = collection(firebaseDB, 'vouchers');

    // Build the query dynamically based on non-empty filter fields
    let dynamicQuery = vouchersRef;

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
        const vouchersData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));

        const groupedData = {};
        let total1 = 0;
        vouchersData
          .filter((x) => x.status !== 'Cancelled')
          .forEach((vd) => {
            if (!groupedData[vd.type]) {
              groupedData[vd.type] = [];
            }
            if (groupedData[vd.type].findIndex((x) => x.id === vd.id) === -1) {
              groupedData[vd.type].push(vd);
              total1 += vd.amount;
            }
          });
        setTotal(total1);
        setExpenseVouchers(groupedData);
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
          Expense Report - {globalUtils.getTimeFormat(selectedDate, true)}
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
            {Object.keys(expenseVouchers).map((sr, i) => {
              return (
                <VoucherRow
                  key={`expense-report-all-list-${sr}`}
                  index={i}
                  header={sr}
                  data={expenseVouchers[sr]}
                />
              );
            })}
          </div>
        )}
        {!loading && Object.keys(expenseVouchers).length === 0 ? (
          <div>No vouchers found</div>
        ) : null}
        <h3>Total Expense - {globalUtils.getCurrencyFormat(total)}</h3>
      </div>
      <div>*** End of Report ***</div>
    </center>
  );
}

function VoucherRow({ data, index, header }) {
  const navigate = useNavigate();

  return (
    <table>
      <thead className="supply-report-row">
        <th colSpan="5">
          <Text className="sr-id">{header}</Text>
        </th>
      </thead>

      {data
        .filter((x) => x.status !== 'Cancelled')
        .map((x) => (
          <VoucherDetailRow key={`expense${x.id}`} data={x} />
        ))}
    </table>
  );
}

function VoucherDetailRow({ data }) {
  const { allUsers } = useAuthUser();

  return (
    <tbody className="supply-report-print-bill-detail">
      <td style={{ width: '10%' }}>{data.receiptNumber}</td>
      <td style={{ width: '15%' }}>{data.type}</td>
      <td style={{ width: '20%' }}>
        {allUsers.find((x) => x.uid === data.employeeId)?.username}
      </td>
      <td style={{ width: '10%' }}>
        {globalUtils.getCurrencyFormat(data.amount)}
      </td>
      <td style={{ width: '30%' }}>{data.narration}</td>
    </tbody>
  );
}
