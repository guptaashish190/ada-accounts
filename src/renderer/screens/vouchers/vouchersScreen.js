import { Button, Card, Text } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query } from 'firebase/firestore';

import { DatePicker } from '@fluentui/react-datepicker-compat';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import './style.css';
import { VerticalSpace1 } from '../../common/verticalSpace';
import { useAuthUser } from '../../contexts/allUsersContext';
import CreateVoucherDialog from './createVoucherDialog/createVoucherDialog';

export default function VoucherScreen() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  const fetchVouchers = async () => {
    const crColl = collection(firebaseDB, 'vouchers');
    const crQuery = query(crColl, limit(50));
    const querySnapshot = await getDocs(crQuery);
    const vouchersData = [];
    querySnapshot.forEach((doc) => {
      vouchersData.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    vouchersData.sort((x, y) => y.timestamp - x.timestamp);
    setVouchers(vouchersData);
  };

  const { allUsers } = useAuthUser();
  useEffect(() => {
    fetchVouchers();
  }, []);

  return (
    <center>
      <div className="pr-list-container">
        <h3>Vouchers</h3>

        <CreateVoucherDialog />
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
          <Button onClick={() => fetchVouchers()}>Get</Button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Username</th>
              <th>Parties</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((rc, i) => {
              return (
                <tr key={`vouchers-list-${rc.id}`} className="pr-receipt-row">
                  <td>{rc.id}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </center>
  );
}
