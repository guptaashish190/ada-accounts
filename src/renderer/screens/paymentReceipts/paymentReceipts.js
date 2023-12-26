import { Button, Card, Text } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import CreatePaymentReceiptDialog from './createPaymentReceiptDialog/createPaymentReceiptDialog';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import './style.css';
import { VerticalSpace1 } from '../../common/verticalSpace';
import { useAuthUser } from '../../contexts/allUsersContext';

export default function PaymentReceipts() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  const fetchCashReceipts = async () => {
    const crColl = collection(firebaseDB, 'cashReceipts');

    const dateFrom = new Date(fromDate);
    dateFrom.setHours(0);
    dateFrom.setMinutes(0);
    dateFrom.setSeconds(0);

    const dateTo = new Date(toDate);
    dateTo.setHours(23);
    dateTo.setMinutes(59);
    dateTo.setSeconds(59);

    const crQuery = query(
      crColl,
      where('timestamp', '>=', dateFrom.getTime()),
      where('timestamp', '<=', dateTo.getTime()),
    );

    const querySnapshot = await getDocs(crQuery);
    const receiptData = [];
    querySnapshot.forEach((doc) => {
      receiptData.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    receiptData.sort((x, y) => y.timestamp - x.timestamp);
    setReceipts(receiptData);
  };

  const { allUsers } = useAuthUser();
  useEffect(() => {
    fetchCashReceipts();
  }, []);

  return (
    <center>
      <div className="pr-list-container">
        <h3>All Cash Receipts</h3>
        <Button
          onClick={() => {
            navigate('/createPaymentReceipts');
          }}
        >
          Create
        </Button>
        <VerticalSpace1 />
        <div>
          <DatePicker
            //   open={fromDateOpen}
            className=" filter-input"
            onSelectDate={(x) => {
              setFromDate(x);
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
            }}
            placeholder="To"
            value={toDate}
          />
          &nbsp;
          <Button onClick={() => fetchCashReceipts()}>Get</Button>
        </div>
        <VerticalSpace1 />
        <table>
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Username</th>
              <th>Parties</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((rc, i) => {
              return (
                <tr
                  key={`receipt-list-${rc.cashReceiptNumber}`}
                  onClick={() => {
                    navigate('/createPaymentReceipts', {
                      state: { ...rc, view: true },
                    });
                  }}
                  className="pr-receipt-row"
                >
                  <td className="pr-id">
                    {i + 1}. {rc.cashReceiptNumber}
                  </td>
                  <td className="timestamp">
                    {globalUtils.getTimeFormat(rc.timestamp, true)}
                  </td>
                  <td className="username">
                    {
                      allUsers.find((x) => x.uid === rc?.paymentFromUserId)
                        ?.username
                    }
                  </td>
                  <td className="username">{rc.prItems.length}</td>
                  <td className="username">
                    {globalUtils.getCurrencyFormat(
                      rc.prItems.reduce(
                        (acc, current) => acc + (current.amount || 0),
                        0,
                      ),
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </center>
  );
}
