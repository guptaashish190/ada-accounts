import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Image,
  Text,
} from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDocs, query, where } from 'firebase/firestore';

import { DatePicker } from '@fluentui/react-datepicker-compat';
import globalUtils from '../../services/globalUtils';
import './style.css';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';

import CreateVoucherDialog from './createVoucherDialog/createVoucherDialog';
import { useAuthUser } from '../../contexts/allUsersContext';
import voucherFormatGenerator from '../../common/printerDataGenerator/voucherFormatGenerator';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';

export default function VoucherScreen() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  const { allUsers } = useAuthUser();
  // Story 0.6: Use company context for company-scoped data
  const { currentCompanyId } = useCompany();

  const fetchVouchers = async () => {
    // Story 0.6: Use company-scoped collection
    const crColl = getCompanyCollection(currentCompanyId, DB_NAMES.VOUCHERS);

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

  const printVoucher = (voucher) => {};

  // Re-fetch when company changes (Story 0.6)
  useEffect(() => {
    fetchVouchers();
  }, [currentCompanyId]);

  return (
    <center>
      <div className="pr-list-container">
        <h3>Expense</h3>

        <VerticalSpace1 />
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
        <VerticalSpace2 />
        <table>
          <thead>
            <tr>
              <th>Voucher</th>
              <th>Username</th>
              <th>Title</th>
              <th>Date</th>
              <th>Narration</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((rc, i) => {
              return (
                <tr
                  style={rc.status === 'Cancelled' ? { opacity: 0.4 } : {}}
                  onClick={() => {
                    if (rc.status === 'Cancelled') return;
                    navigate('/viewVoucherScreen', {
                      state: { voucherData: rc },
                    });
                  }}
                  key={`vouchers-list-${rc.id}`}
                  className="pr-receipt-row"
                >
                  <td>{rc.receiptNumber}</td>
                  <td>
                    {allUsers.find((x) => x.uid === rc.employeeId)?.username ||
                      '--'}
                  </td>
                  <td>
                    {rc.type} {rc.status === 'Cancelled' ? '(CANCELLED)' : ''}
                  </td>
                  <td>{globalUtils.getTimeFormat(rc.timestamp, true)}</td>
                  <td>{rc.narration}</td>
                  <td>{globalUtils.getCurrencyFormat(rc.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </center>
  );
}
