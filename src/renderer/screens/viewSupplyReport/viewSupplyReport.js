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
import math, { asecDependencies, parse } from 'mathjs';
import Loader from '../../common/loader';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import globalUtils from '../../services/globalUtils';
import { showToast } from '../../common/toaster';
import './style.css';
import firebaseApp, { firebaseDB } from '../../firebaseInit';
import { useAuthUser } from '../../contexts/allUsersContext';
import constants from '../../constants';
import supplyReportRecievingFormatGenerator from '../../common/printerDataGenerator/supplyReportRecievingFormatGenerator';
import supplyReportFormatGenerator from '../../common/printerDataGenerator/supplyReportFormatGenerator';

export default function ViewSupplyReportScreen() {
  const { allUsers } = useAuthUser();
  const { state } = useLocation();
  const navigate = useNavigate();
  const supplyReportState = state.prefillSupplyReport;
  const supplyReportIdState = state.supplyReportId;
  const [supplyReport, setSupplyReport] = useState(supplyReportState);
  const [allBills, setAllBills] = useState([]);
  const [extraOldBills, setExtraOldBills] = useState([]);
  const [otherAdjustedBills, setOtherAdjustedBills] = useState([]);
  const [returnedGoods, setReturnedGoods] = useState([]);

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

  const init = async () => {
    setLoading(true);
    const allReceivedBills = await fetchBillData(supplyReport.orders);
    const extraBills1 = await fetchBillData([
      ...(supplyReport.supplementaryBills || []),
      ...(supplyReport.attachedBills || []),
    ]);
    setAllBills(allReceivedBills);
    setExtraOldBills(extraBills1);

    const otherAdjustedBills1 = await fetchBillData(
      supplyReport.otherAdjustedBills?.map((x) => x.orderId),
    );
    setOtherAdjustedBills(
      otherAdjustedBills1.map((x, i) => ({
        ...x,
        ...supplyReport.otherAdjustedBills[i],
      })),
    );

    const returnedGoods1 = await fetchBillData(
      supplyReport.returnedBills?.map((x) => x.billId),
    );
    setReturnedGoods(
      returnedGoods1.map((x, i) => ({
        ...x,
        ...supplyReport.returnedBills[i],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (supplyReport) {
      init();
    }
  }, [supplyReport]);

  const fetchBillData = async (billList) => {
    if (!billList) return [];
    console.log(billList);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(billList);

      fetchedOrders = (await fetchedOrders).filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);

      return fetchedOrders;
    } catch (e) {
      console.error(e);
    }
    return [];
  };

  useEffect(() => {
    if (supplyReportIdState) {
      fetchSupplyReport();
    }
  }, []);

  const onCancel = () => {
    const confirm = window.confirm('Cancel supply report?');

    if (!confirm) return;

    try {
      setLoading(true);

      const supplyReportsCol = doc(
        firebaseDB,
        'supplyReports',
        supplyReport.id,
      );

      const docRef = updateDoc(supplyReportsCol, {
        status: constants.firebase.supplyReportStatus.CANCELLED,
      });

      showToast(dispatchToast, 'Supply Report Cancelled', 'success');
      fetchSupplyReport();
      setLoading(false);
    } catch (error) {
      console.error('Error adding document: ', error);
      showToast(
        dispatchToast,
        `An error occured deleting supply report ${error}`,
        'error',
      );
      setLoading(false);
    }
  };

  const onPrintSupplyReport = () => {
    const printData = {
      receivedBy: allUsers.find((x) => x.uid === supplyReport.receivedBy)
        ?.username,
      supplyman: allUsers.find((x) => x.uid === supplyReport.supplymanId)
        ?.username,
      dispatchTime: globalUtils.getTimeFormat(supplyReport.dispatchTimestamp),
      receiptNumber: supplyReport.receiptNumber,
      bills: allBills,
      oldBills: extraOldBills,
      otherAdjustedBills,
      returnedGoods,
    };
    window.electron.ipcRenderer.sendMessage(
      'print',
      supplyReportFormatGenerator(printData),
    );
  };
  const onPrintSupplyReportReceiving = () => {
    const printData = {
      receivedBy: allUsers.find((x) => x.uid === supplyReport.receivedBy)
        ?.username,
      supplyman: allUsers.find((x) => x.uid === supplyReport.supplymanId)
        ?.username,
      dispatchTime: globalUtils.getTimeFormat(supplyReport.dispatchTimestamp),
      receiptNumber: supplyReport.receiptNumber,
      bills: allBills,
      otherAdjustedBills,
      returnedGoods,
    };
    window.electron.ipcRenderer.sendMessage(
      'print',
      supplyReportRecievingFormatGenerator(printData),
    );
  };
  const getOtherAdjustedBills = async () => {
    setLoading(true);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds([
        ...supplyReport.otherAdjustedBills,
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
        {supplyReport.status ===
        constants.firebase.supplyReportStatus.TOACCOUNTS ? (
          <Button onClick={() => onCancel()}>Cancel</Button>
        ) : null}
        {supplyReport.status !==
          constants.firebase.supplyReportStatus.COMPLETED &&
        supplyReport.status !==
          constants.firebase.supplyReportStatus.CANCELLED ? (
          <Button onClick={() => onPrintSupplyReport()}>
            Print Supply Report
          </Button>
        ) : null}

        {supplyReport.status ===
        constants.firebase.supplyReportStatus.COMPLETED ? (
          <Button onClick={() => onPrintSupplyReportReceiving()}>
            Print Bill Receiving
          </Button>
        ) : null}

        <VerticalSpace1 />
        <h3 style={{ color: 'grey' }}>New Bills</h3>
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
                    supplyReport.orderDetails &&
                    supplyReport.orderDetails.find((x) => x.billId === bill.id)
                  }
                  key={`rsr-${bill.id}`}
                  data={bill}
                  index={i}
                />
              );
            })}
          </tbody>
        </table>

        <VerticalSpace1 />
        <h3 style={{ color: 'grey' }}>Old Bills</h3>
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
            {extraOldBills.map((bill, i) => {
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
          </tbody>
        </table>

        {otherAdjustedBills?.length ? (
          <>
            <VerticalSpace2 />
            <h3 style={{ color: 'grey' }}>Other Adjusted Bills</h3>
            <OtherAdjustedBills otherAdjustedBills={otherAdjustedBills} />
          </>
        ) : null}

        {returnedGoods?.length ? (
          <>
            <VerticalSpace2 />
            <h3 style={{ color: 'grey' }}>Returned Goods Bills</h3>
            <ReturnedBillsTable returnedBills={returnedGoods} />
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
      <thead>
        <tr>
          <th>BILL NO.</th>
          <th>PARTY</th>
          <th>CASH</th>
          <th>CHEQUE</th>
          <th>UPI</th>
        </tr>
      </thead>
      <tbody>
        {otherAdjustedBills?.map((bill, i) => {
          return (
            <OtherAdjustedBillsRow
              key={`vsrs-otheradjust-${bill.id}`}
              data={bill}
              index={i}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function OtherAdjustedBillsRow({ data, index }) {
  const [loading, setLoading] = useState(false);

  if (loading) {
    return (
      <tr>
        <TableCustomCell>
          <Spinner />
        </TableCustomCell>
      </tr>
    );
  }

  return (
    <tr>
      <TableCustomCell>
        <b>{data.billNumber?.toUpperCase()}</b>
      </TableCustomCell>
      <TableCustomCell>{data.party?.name}</TableCustomCell>
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
  return (
    <tr className="vsrc-table-row">
      <TableCustomCell>
        <b>{data.billNumber?.toUpperCase()}</b>
      </TableCustomCell>
      <TableCustomCell>{data.party.name}</TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(data.orderAmount) || '--'}
      </TableCustomCell>
      <TableCustomCell>{data.remarks || '--'}</TableCustomCell>
    </tr>
  );
}
