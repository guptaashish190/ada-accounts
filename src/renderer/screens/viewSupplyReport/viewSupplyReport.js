/* eslint-disable radix */
/* eslint-disable no-restricted-syntax */

import {
  collection,
  doc,
  getDoc,
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
  Skeleton,
  SkeletonItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  th,
  tr,
  Text,
  Tooltip,
  makeStyles,
  useId,
  useToastController,
} from '@fluentui/react-components';
import { getAuth } from 'firebase/auth';
import math, { parse } from 'mathjs';
import Loader from '../../common/loader';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import globalUtils from '../../services/globalUtils';
import { showToast } from '../../common/toaster';
import './style.css';
import firebaseApp, { firebaseDB } from '../../firebaseInit';
import { useAuthUser } from '../../contexts/allUsersContext';

export default function ViewSupplyReportScreen() {
  const { allUsers } = useAuthUser();
  const { state } = useLocation();
  const navigate = useNavigate();
  const supplyReportState = state.prefillSupplyReport;
  const supplyReportIdState = state.supplyReportId;
  const [supplyReport, setSupplyReport] = useState(supplyReportState);
  const [allBills, setAllBills] = useState([]);
  const [receivedBills, setReceivedBills] = useState([]);
  const [loading, setLoading] = useState(false);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  // Fetch the document data
  const fetchSupplyReport = async () => {
    try {
      setLoading(true);
      const supplyReportRef = doc(
        firebaseDB,
        'supplyReports',
        supplyReportIdState,
      );
      const docSnapshot = await getDoc(supplyReportRef);
      if (docSnapshot.exists()) {
        setSupplyReport(docSnapshot.data());
      } else {
        console.log('Document not found.');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching document:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplyReport) {
      getAllBills();
    }
  }, [supplyReport]);

  useEffect(() => {
    if (supplyReportIdState) {
      fetchSupplyReport();
    }
  }, []);

  const getAllBills = async () => {
    setLoading(true);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds([
        ...supplyReport.orders,
        ...(supplyReport.supplementaryBills || []),
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
        <h3>Supply Report: {supplyReport.receiptNumber}</h3>
        <VerticalSpace1 />
        <div className="vsrc-detail-items-container">
          <div className="vsrc-detail-items">
            <div className="label">Received By: </div>
            <div className="value">
              {
                allUsers.find((x) => x.uid === supplyReport.receivedBy)
                  ?.username
              }
            </div>
          </div>
          <div className="vsrc-detail-items">
            <div className="label">Supplyman: </div>
            <div className="value">
              {
                allUsers.find((x) => x.uid === supplyReport.supplymanId)
                  ?.username
              }
            </div>
          </div>
          <div className="vsrc-detail-items">
            <div className="label">Dispatch Time: </div>
            <div className="value">
              {globalUtils.getTimeFormat(supplyReport.dispatchTimestamp)}
            </div>
          </div>

          <div className="vsrc-detail-items">
            <div className="label">Dispatch Notes: </div>
            <div className="value">{supplyReport.note || '--'}</div>
          </div>
          <div className="vsrc-detail-items">
            <div className="label">Items: </div>
            <div className="value">
              {' '}
              {supplyReport.numPolybags} Polybags, {supplyReport.numCases}{' '}
              Cases, {supplyReport.numPackets} Packets
            </div>
          </div>

          <div className="vsrc-detail-items">
            <div className="label">Status </div>
            <div className="value">{supplyReport.status}</div>
          </div>
        </div>
        <VerticalSpace1 />
        <h3 style={{ color: 'grey' }}>Received Bills</h3>
        <table>
          <tr>
            <th>BILL NO.</th>
            <th>PARTY</th>
            <th>AMOUNT</th>
            <th>CASH</th>
            <th>CHEQUE</th>
            <th>UPI</th>
            <th>SCHEDULED</th>
            <th>ACC NOTES</th>
          </tr>
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
        </table>

        {supplyReport.otherAdjustedBills?.length ? (
          <>
            <VerticalSpace2 />
            <h3 style={{ color: 'grey' }}>Other Adjusted Bills</h3>
            <OtherAdjustedBills
              otherAdjustedBills={supplyReport.otherAdjustedBills}
            />
          </>
        ) : null}

        {supplyReport.returnedBills?.length ? (
          <>
            <VerticalSpace2 />
            <h3 style={{ color: 'grey' }}>Returned Goods Bills</h3>
            <ReturnedBillsTable returnedBills={supplyReport.returnedBills} />
          </>
        ) : null}
        <VerticalSpace2 />
      </div>
    </center>
  );
}

function OtherAdjustedBills({ otherAdjustedBills }) {
  return (
    <table size="extra-small">
      <tr>
        <th>BILL NO.</th>
        <th>PARTY</th>
        <th>CASH</th>
        <th>CHEQUE</th>
        <th>UPI</th>
      </tr>

      {otherAdjustedBills?.map((bill, i) => {
        return <OtherAdjustedBillsRow data={bill} index={i} />;
      })}
    </table>
  );
}

function OtherAdjustedBillsRow({ data, index }) {
  const [order, setOrder] = useState();
  const [party, setParty] = useState();

  const [loading, setLoading] = useState(false);

  const fetchOrderAndParty = async () => {
    try {
      setLoading(true);
      // Fetch the order using orderId
      const orderRef = doc(firebaseDB, 'orders', data.orderId);
      const orderSnapshot = await getDoc(orderRef);
      if (orderSnapshot.exists()) {
        const fetchedOrder = orderSnapshot.data();
        setOrder(fetchedOrder);

        // Fetch party information using partyId from the fetched order
        const partyRef = doc(firebaseDB, 'parties', fetchedOrder.partyId);
        const partySnapshot = await getDoc(partyRef);
        if (partySnapshot.exists()) {
          const fetchedParty = partySnapshot.data();
          setParty(fetchedParty);
        } else {
          console.log('Party not found');
        }
      } else {
        console.log('Order not found');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching order and party:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderAndParty();
  }, []);

  if (loading) {
    return (
      <tr>
        <TableCustomCell>
          <Spinner />
        </TableCustomCell>
      </tr>
    );
  }
  if (!order || !party) {
    return <Text>Error Fetching Bill Details</Text>;
  }

  return (
    <tr>
      <TableCustomCell>
        <b>{order.billNumber?.toUpperCase()}</b>
      </TableCustomCell>
      <TableCustomCell>{party.name}</TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'cash')?.amount,
        ) || '--'}
      </TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'cheque')?.amount,
        ) || '--'}
      </TableCustomCell>

      <TableCustomCell>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'upi')?.amount,
        ) || '--'}
      </TableCustomCell>
    </tr>
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
    <tr>
      <TableCustomCell>
        <b>{data.billNumber?.toUpperCase()}</b>
      </TableCustomCell>
      <TableCustomCell>
        <div>{data.party.name}</div>
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
      <TableCustomCell>{orderDetail?.accountsNotes || '--'}</TableCustomCell>
    </tr>
  );
}

function TableCustomCell({ children }) {
  return (
    <Tooltip content={children}>
      <td>{children}</td>
    </Tooltip>
  );
}

function ReturnedBillsTable({ returnedBills }) {
  return (
    <table size="extra-small" className="vsrc-table">
      <tr className="table-header-container">
        <th>BILL NO.</th>
        <th>PARTY</th>
        <th>AMOUNT</th>
        <th>REMARKS</th>
      </tr>
      {returnedBills?.map((bill, i) => {
        return <ReturnedBillRow data={bill} index={i} />;
      })}
    </table>
  );
}
function ReturnedBillRow({ data, index }) {
  const [order, setOrder] = useState();
  const [party, setParty] = useState();

  const [loading, setLoading] = useState(false);

  const fetchOrderAndParty = async () => {
    try {
      setLoading(true);
      // Fetch the order using orderId
      const orderRef = doc(firebaseDB, 'orders', data.billId);
      const orderSnapshot = await getDoc(orderRef);
      if (orderSnapshot.exists()) {
        const fetchedOrder = orderSnapshot.data();
        setOrder(fetchedOrder);

        // Fetch party information using partyId from the fetched order
        const partyRef = doc(firebaseDB, 'parties', fetchedOrder.partyId);
        const partySnapshot = await getDoc(partyRef);
        if (partySnapshot.exists()) {
          const fetchedParty = partySnapshot.data();
          setParty(fetchedParty);
        } else {
          console.log('Party not found');
        }
      } else {
        console.log('Order not found');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching order and party:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderAndParty();
  }, []);

  if (loading) {
    return (
      <tr className="vsrc-table-row">
        <TableCustomCell>
          <Spinner />
        </TableCustomCell>
      </tr>
    );
  }
  if (!order || !party) {
    return <Text>Error Fetching Bill Details</Text>;
  }

  return (
    <tr className="vsrc-table-row">
      <TableCustomCell>
        <b>{order.billNumber?.toUpperCase()}</b>
      </TableCustomCell>
      <TableCustomCell>{party.name}</TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(order.orderAmount) || '--'}
      </TableCustomCell>
      <TableCustomCell>{data.remarks || '--'}</TableCustomCell>
    </tr>
  );
}
