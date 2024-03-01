/* eslint-disable jsx-a11y/control-has-associated-label */
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
  TableRow,
  Text,
  Toaster,
  Tooltip,
  makeStyles,
  useId,
  useToastController,
} from '@fluentui/react-components';
import math, { parse } from 'mathjs';
import Loader from '../../../common/loader';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import globalUtils from '../../../services/globalUtils';
import { showToast } from '../../../common/toaster';
import './style.css';
import firebaseApp, { firebaseDB } from '../../../firebaseInit';
import { useAuthUser } from '../../../contexts/allUsersContext';
import constants from '../../../constants';
import supplyReportFormatGenerator from '../../../common/printerDataGenerator/supplyReportFormatGenerator';
import supplyReportRecievingFormatGenerator from '../../../common/printerDataGenerator/supplyReportRecievingFormatGenerator';

export default function ViewBundleScreen() {
  const [bundle, setBundle] = useState();
  const [user, setuser] = useState();
  const { allUsers } = useAuthUser();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { bundleId } = state;
  const [allBills, setAllBills] = useState([]);
  const [loading, setLoading] = useState(false);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    getAllBills();
  }, []);

  const getAllBills = async () => {
    if (!bundleId) return;
    setLoading(true);
    try {
      const bundleRef = doc(firebaseDB, 'billBundles', bundleId);
      const bundlerefData = await getDoc(bundleRef);
      const bundleData = bundlerefData.data();
      setBundle({ ...bundleData, id: bundlerefData.id });
      setuser(allUsers.find((x) => x.uid === bundleData.assignedTo));

      let fetchedOrders = await globalUtils.fetchOrdersByIds(bundleData.bills);

      fetchedOrders = (await fetchedOrders).filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);
      setAllBills(fetchedOrders);

      setLoading(false);
    } catch (e) {
      setLoading(false);
      console.error(e);
    }
  };

  const onHandOver = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const billBundleRef = doc(firebaseDB, 'billBundles', bundleId);

      updateDoc(billBundleRef, {
        status: constants.firebase.billBundleFlowStatus.HANDOVER,
      });

      await allBills.forEach(async (bill1) => {
        await updateBills(bill1);
      });
      await getAllBills();
      setLoading(false);
      showToast(
        dispatchToast,
        `Transferred Bills to User: ${user.username}`,
        'success',
      );
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };
  const updateBills = async (bill1) => {
    try {
      // Create a reference to the specific order document
      const orderRef = doc(firebaseDB, 'orders', bill1.id);

      // Update the "orderStatus" field in the order document to "dispatched"
      updateDoc(orderRef, {
        with: user.uid,
      });

      console.log(`Order status updated to "HANDOVER"`);
    } catch (error) {
      console.error(`Error updating order  status:`, error);
    }
  };

  const getActionButton = () => {
    if (bundle.status === constants.firebase.billBundleFlowStatus.CREATED) {
      return (
        <Button
          appearance="primary"
          onClick={() => {
            onHandOver();
          }}
        >
          Handover
        </Button>
      );
    }
    if (bundle.status === constants.firebase.billBundleFlowStatus.HANDOVER) {
      return (
        <Button
          appearance="primary"
          onClick={() => {
            navigate('/receiveSRScreen', {
              state: { supplyReport: bundle, isBundle: true },
            });
          }}
        >
          Receive
        </Button>
      );
    }
    return null;
  };

  const onPrintSupplyReport = () => {
    const printData = {
      receivedBy: allUsers.find((x) => x.uid === bundle.receivedBy)?.username,
      supplyman: allUsers.find((x) => x.uid === bundle.assignedTo)?.username,
      dispatchTime: globalUtils.getTimeFormat(bundle.timestamp),
      receiptNumber: bundle.receiptNumber,
      oldBills: allBills,
    };
    window.electron.ipcRenderer.sendMessage(
      'print',
      supplyReportFormatGenerator(printData, true),
    );
  };
  const onPrintSupplyReportReceiving = () => {
    console.log(bundle);
    const printData = {
      receivedBy: allUsers.find((x) => x.uid === bundle.receivedBy)?.username,
      supplyman: allUsers.find((x) => x.uid === bundle.assignedTo)?.username,
      dispatchTime: globalUtils.getTimeFormat(bundle.timestamp),
      receiptNumber: bundle.receiptNumber,
      bills: allBills,
    };
    window.electron.ipcRenderer.sendMessage(
      'print',
      supplyReportRecievingFormatGenerator(printData, true),
    );
  };

  if (loading) {
    return <Spinner />;
  }
  if (!bundle) {
    return <div>Error loading supply report</div>;
  }
  return (
    <>
      <Toaster toasterId={toasterId} />
      {loading ? (
        <Loader />
      ) : (
        <center>
          <div className="view-supply-report-container">
            <h3>Bundle ID: {bundle.receiptNumber}</h3>
            <VerticalSpace1 />
            {getActionButton()}
            <VerticalSpace1 />
            <div className="vsrc-detail-items-container">
              <div className="vsrc-detail-items">
                <div className="label">Received By: </div>
                <div className="value">
                  {allUsers.find((x) => x.uid === bundle.receivedBy)
                    ?.username || '--'}
                </div>
              </div>
              <div className="vsrc-detail-items">
                <div className="label">Assigned User: </div>
                <div className="value">{user?.username}</div>
              </div>
              <div className="vsrc-detail-items">
                <div className="label">Creation Time: </div>
                <div className="value">
                  {globalUtils.getTimeFormat(bundle?.timestamp)}
                </div>
              </div>

              <div className="vsrc-detail-items">
                <div className="label">Status: </div>
                <div className="value">{bundle.status}</div>
              </div>
            </div>
            <VerticalSpace1 />
            <Button onClick={() => onPrintSupplyReport()}>Print Bundle</Button>
            &nbsp;&nbsp;
            {bundle.status ===
            constants.firebase.billBundleFlowStatus.COMPLETED ? (
              <Button onClick={() => onPrintSupplyReportReceiving()}>
                Print Bundle Receiving
              </Button>
            ) : null}
            <h3 style={{ color: 'grey' }}>All Bills</h3>
            <table>
              <thead>
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
              </thead>
              <tbody>
                {allBills.map((bill, i) => {
                  return (
                    <BillRow
                      orderDetail={
                        bundle.orderDetails &&
                        bundle.orderDetails.find((x) => x.billId === bill.id)
                      }
                      key={`rsr-${bill.id}`}
                      data={bill}
                      index={i}
                    />
                  );
                })}
              </tbody>
            </table>
            {bundle.otherAdjustedBills?.length ? (
              <>
                <VerticalSpace2 />
                <h3 style={{ color: 'grey' }}>Other Adjusted Bills</h3>
                <OtherAdjustedBills
                  otherAdjustedBills={bundle.otherAdjustedBills}
                />
              </>
            ) : null}
            <VerticalSpace2 />
          </div>
        </center>
      )}
    </>
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
    <tr className="vsrc-table-row">
      <td>
        <b>{data.billNumber?.toUpperCase()}</b>
      </td>
      <td>
        <div style={{ color: 'grey', fontSize: '0.9em' }}>
          {data.party.name}
        </div>
      </td>
      <td>
        <b>{globalUtils.getCurrencyFormat(data.orderAmount)}</b>
      </td>
      <td>
        {globalUtils.getCurrencyFormat(
          orderDetail?.payments?.find((x) => x.type === 'cash')?.amount,
        ) || '--'}
      </td>
      <td>
        {globalUtils.getCurrencyFormat(
          orderDetail?.payments?.find((x) => x.type === 'cheque')?.amount,
        ) || '--'}
      </td>
      <td>
        {globalUtils.getCurrencyFormat(
          orderDetail?.payments?.find((x) => x.type === 'upi')?.amount,
        ) || '--'}
      </td>
      <td>
        {orderDetail?.schedulePaymentDate
          ? globalUtils?.getTimeFormat(orderDetail.schedulePaymentDate, true)
          : '--'}
      </td>
      <td>{orderDetail?.accountsNotes || '--'}</td>
    </tr>
  );
}

function OtherAdjustedBills({ otherAdjustedBills }) {
  return (
    <table size="extra-small" className="vsrc-table">
      <thead className="table-header-container">
        <tr>
          <th>BILL NO.</th>
          <th>PARTY</th>
          <th>AMOUNT</th>
          <th>CASH</th>
          <th>CHEQUE</th>
          <th>UPI</th>
        </tr>
      </thead>
      <tbody>
        {otherAdjustedBills?.map((bill, i) => {
          return <OtherAdjustedBillsRow data={bill} index={i} />;
        })}
      </tbody>
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
        <td>
          <Spinner />
        </td>
      </tr>
    );
  }
  if (!order || !party) {
    return <Text>Error Fetching Bill Details</Text>;
  }

  return (
    <TableRow className="vsrc-table-row">
      <td>
        <b>{order.billNumber?.toUpperCase()}</b>
      </td>
      <td>{party.name}</td>
      <td>{globalUtils.getCurrencyFormat(order.orderAmount) || '--'}</td>
      <td>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'cash')?.amount,
        ) || '--'}
      </td>
      <td>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'cheque')?.amount,
        ) || '--'}
      </td>

      <td>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'upi')?.amount,
        ) || '--'}
      </td>
    </TableRow>
  );
}
