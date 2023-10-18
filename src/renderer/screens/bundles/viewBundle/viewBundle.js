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
  TableHeaderCell,
  TableRow,
  Text,
  Toaster,
  Tooltip,
  makeStyles,
  useId,
  useToastController,
} from '@fluentui/react-components';
import { getAuth } from 'firebase/auth';
import math, { parse } from 'mathjs';
import Loader from '../../../common/loader';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import globalUtils from '../../../services/globalUtils';
import { showToast } from '../../../common/toaster';
import './style.css';
import firebaseApp, { firebaseDB } from '../../../firebaseInit';
import { useAuthUser } from '../../../contexts/allUsersContext';
import constants from '../../../constants';

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

      await updateDoc(billBundleRef, {
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
      await updateDoc(orderRef, {
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
            navigate('/receiveBundle', {
              state: {
                bundle,
                bills: allBills,
              },
            });
          }}
        >
          Receive
        </Button>
      );
    }
    return null;
  };

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
            <h3>Bundle ID: {bundle.id}</h3>

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
            <h3 style={{ color: 'grey' }}>All Bills</h3>
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
                    BALANCE
                  </TableHeaderCell>
                  <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell2">
                    CASH
                  </TableHeaderCell>
                  <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell3">
                    CHEQUE
                  </TableHeaderCell>
                  <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell4">
                    UPI
                  </TableHeaderCell>
                  <TableHeaderCell key="vsrc-thc-partyname vsrc-table-cell5">
                    SCHEDULED
                  </TableHeaderCell>
                  <TableHeaderCell key="vsrc-thc-partyname">
                    ACC NOTES
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
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
              </TableBody>
            </Table>
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
        <b>{globalUtils.getCurrencyFormat(data.balance)}</b>
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
    </TableRow>
  );
}

function TableCustomCell({ children }) {
  return (
    <Tooltip content={children}>
      <TableCell className="vsrc-table-cell">
        <TableCellLayout>{children}</TableCellLayout>
      </TableCell>
    </Tooltip>
  );
}

function OtherAdjustedBills({ otherAdjustedBills }) {
  return (
    <Table size="extra-small" className="vsrc-table">
      <TableHeader className="table-header-container">
        <TableRow>
          <TableHeaderCell>BILL NO.</TableHeaderCell>
          <TableHeaderCell>PARTY</TableHeaderCell>
          <TableHeaderCell>BALANCE</TableHeaderCell>
          <TableHeaderCell>CASH</TableHeaderCell>
          <TableHeaderCell>CHEQUE</TableHeaderCell>
          <TableHeaderCell>UPI</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {otherAdjustedBills?.map((bill, i) => {
          return <OtherAdjustedBillsRow data={bill} index={i} />;
        })}
      </TableBody>
    </Table>
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
      <TableRow className="vsrc-table-row">
        <TableCustomCell>
          <Spinner />
        </TableCustomCell>
      </TableRow>
    );
  }
  if (!order || !party) {
    return <Text>Error Fetching Bill Details</Text>;
  }

  return (
    <TableRow className="vsrc-table-row">
      <TableCustomCell>
        <b>{order.billNumber?.toUpperCase()}</b>
      </TableCustomCell>
      <TableCustomCell>{party.name}</TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(order.balance) || '--'}
      </TableCustomCell>
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
    </TableRow>
  );
}
