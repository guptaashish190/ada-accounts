/* eslint-disable radix */
/* eslint-disable no-restricted-syntax */

import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DatePicker, setMonth } from '@fluentui/react-datepicker-compat';
import {
  Button,
  Card,
  Field,
  Input,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  useId,
  useToastController,
} from '@fluentui/react-components';
import { getAuth } from 'firebase/auth';
import math, { parse } from 'mathjs';
import Loader from '../../common/loader';
import { VerticalSpace1 } from '../../common/verticalSpace';
import globalUtils from '../../services/globalUtils';
import { showToast } from '../../common/toaster';
import './style.css';
import firebaseApp, { firebaseDB } from '../../firebaseInit';
import { useAuthUser } from '../../contexts/allUsersContext';

export default function ViewSupplyReportScreen() {
  const { allUsers } = useAuthUser();
  const { state } = useLocation();
  const navigate = useNavigate();
  const supplyReport = state.prefillSupplyReport;
  const [allBills, setAllBills] = useState([]);
  const [receivedBills, setReceivedBills] = useState([]);
  const [loading, setLoading] = useState(false);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    getAllBills();
  }, []);

  const getAllBills = async () => {
    setLoading(true);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds([
        ...supplyReport.orders,
        ...(supplyReport.attachedBills || []),
      ]);

      fetchedOrders = (await fetchedOrders).filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);
      setAllBills(fetchedOrders);

      setLoading(false);
    } catch (e) {
      setLoading(false);
      console.error(e);
    }
  };
  const receiveBill = (bi) => {
    setReceivedBills((r) => [...r, bi]);
  };

  if (loading) return <Loader />;

  if (!supplyReport) {
    return <div>Error loading supply report</div>;
  }
  return (
    <center>
      <div className="view-supply-report-container">
        <h3>Supply Report: {supplyReport.id}</h3>
        <VerticalSpace1 />
        <div className="vsrc-detail-items">
          <div className="label">Received By: </div>
          <div className="value">
            {allUsers.find((x) => x.uid === supplyReport.receivedBy)?.username}
          </div>
        </div>
        <div className="vsrc-detail-items">
          <div className="label">Supplyman: </div>
          <div className="value">
            {allUsers.find((x) => x.uid === supplyReport.supplymanId)?.username}
          </div>
        </div>
        <div className="vsrc-detail-items">
          <div className="label">Dispatch Time: </div>
          <div className="value">
            {globalUtils.getTimeFormat(supplyReport.dispatchTimestamp)}
          </div>
        </div>

        <div className="vsrc-detail-items">
          <div className="label">Status </div>
          <div className="value">{supplyReport.status}</div>
        </div>
        <VerticalSpace1 />
        <Table size="extra-small" className="vsrc-table">
          <TableHeader className="table-header-container">
            <TableRow>
              <TableHeaderCell key="vsrc-thc-billnumber">
                BILL NO.
              </TableHeaderCell>
              <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell">
                PARTY
              </TableHeaderCell>
              <TableHeaderCell key="vsrc-thc-amount vsrc-table-cell">
                AMOUNT
              </TableHeaderCell>
              <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell">
                CASH
              </TableHeaderCell>
              <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell">
                CHEQUE
              </TableHeaderCell>
              <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell">
                UPI
              </TableHeaderCell>
              <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell">
                SCHEDULED
              </TableHeaderCell>
              <TableHeaderCell key="vsrc-thc-partyname">NOTES</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allBills.map((bill, i) => {
              return (
                <BillRow
                  orderDetail={
                    supplyReport.orderDetails &&
                    supplyReport.orderDetails.find((x) => x.billId === bill.id)
                  }
                  key={`rsr-${bill.id}`}
                  data={bill}
                  index={i}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </center>
  );
}

function BillRow({ data, index, orderDetail }) {
  const navigate = useNavigate();

  const getBalance = () => {
    return (
      data.orderAmount -
      (data.payments?.reduce((acc, cur) => acc + parseInt(cur.amount), 0) || 0)
    );
  };

  return (
    <TableRow className="vsrc-table-row">
      <TableCustomCell>
        <b>{data.billNumber?.toUpperCase()}</b>
      </TableCustomCell>
      <TableCustomCell>
        <div style={{ color: 'grey', fontSize: '0.9em' }}>
          {data.party.name}
        </div>
      </TableCustomCell>
      <TableCustomCell>
        <b>{globalUtils.getCurrencyFormat(data.orderAmount)}</b>
      </TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(
          orderDetail?.payments?.find((x) => x.type === 'cash')?.amount,
        ) || '--'}
      </TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(
          orderDetail?.payments?.find((x) => x.type === 'cheque')?.amount,
        ) || '--'}
      </TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(
          orderDetail?.payments?.find((x) => x.type === 'upi')?.amount,
        ) || '--'}
      </TableCustomCell>
      <TableCustomCell>
        {orderDetail?.schedulePaymentDate
          ? globalUtils?.getTimeFormat(orderDetail.schedulePaymentDate, true)
          : '--'}
      </TableCustomCell>
      <TableCustomCell>{orderDetail?.notes || '--'}</TableCustomCell>
    </TableRow>
  );
}

function TableCustomCell({ children }) {
  return (
    <TableCell className="vsrc-table-cell">
      <TableCellLayout>{children}</TableCellLayout>
    </TableCell>
  );
}
