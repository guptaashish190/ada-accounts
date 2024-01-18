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
import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { DatePicker } from '@fluentui/react-datepicker-compat';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import './style.css';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';

import CreateVoucherDialog from './createVoucherDialog/createVoucherDialog';
import { useAuthUser } from '../../contexts/allUsersContext';
import voucherFormatGenerator from '../../common/printerDataGenerator/voucherFormatGenerator';

export default function VoucherScreen() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  const { allUsers } = useAuthUser();
  const fetchVouchers = async () => {
    const crColl = collection(firebaseDB, 'vouchers');

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

  const printVoucher = (voucher) => {
    const printData = {
      voucher,
      username: allUsers.find((x) => x.uid === voucher.employeeId)?.username,
      time: globalUtils.getTimeFormat(voucher.timestamp),
      createdBy: allUsers.find((x) => x.uid === voucher.requesterId)?.username,
    };
    console.log(printData);
    window.electron.ipcRenderer.sendMessage(
      'print',
      voucherFormatGenerator(printData),
    );
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  return (
    <center>
      <div className="pr-list-container">
        <h3>Vouchers</h3>

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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((rc, i) => {
              return (
                <tr key={`vouchers-list-${rc.id}`} className="pr-receipt-row">
                  <td>{rc.receiptNumber}</td>
                  <td>
                    {allUsers.find((x) => x.uid === rc.employeeId)?.username ||
                      '--'}
                  </td>
                  <td>{rc.title}</td>
                  <td>{globalUtils.getTimeFormat(rc.timestamp)}</td>
                  <td>{rc.narration}</td>
                  <td>{globalUtils.getCurrencyFormat(rc.amount)}</td>
                  <td>
                    <center>
                      <Button onClick={() => printVoucher(rc)}>Print</Button>
                      <br />
                      <br />
                      <Dialog>
                        <DialogTrigger>
                          <Button>View</Button>
                        </DialogTrigger>
                        <DialogSurface>
                          <DialogBody>
                            <DialogTitle>{rc.receiptNumber}</DialogTitle>
                            <DialogContent>
                              <center>
                                {rc.images?.map((x) => {
                                  return (
                                    <Image
                                      width={200}
                                      src={x}
                                      style={{ marginRight: '10px' }}
                                    />
                                  );
                                })}
                              </center>
                            </DialogContent>
                          </DialogBody>
                        </DialogSurface>
                      </Dialog>
                    </center>
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
