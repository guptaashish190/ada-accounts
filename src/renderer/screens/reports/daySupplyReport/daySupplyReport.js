/* eslint-disable no-restricted-syntax */
import {
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';

import {
  Button,
  Checkbox,
  Input,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';

import '../style.css';
import { useAuthUser } from '../../../contexts/allUsersContext';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';
import defaulterPartyAlgo from './defaulterPartyAlgo';
import { useCompany } from '../../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../../services/firestoreHelpers';

export default function DaySupplyReportPrint() {
  const [supplyReports, setSupplyReports] = useState([]);
  const [unSuppliedOrders, setUnSuppliedOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allowEditRemark, setAllowEditRemarks] = useState(false);
  const [newRemarks, setNewRemarks] = useState({});
  const [showDefaultersOnly, setShowDefaultersOnly] = useState(false);

  const [loading, setLoading] = useState(false);
  const { currentCompanyId } = useCompany();

  const handlePrint = () => {
    window.print();
  };

  const onSearch = () => {
    const supplyReportRef = getCompanyCollection(
      currentCompanyId,
      DB_NAMES.SUPPLY_REPORTS,
    );
    const ordersRef = getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS);

    let dynamicQuery = supplyReportRef;
    let dynamicQueryOrder = ordersRef;

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
      where('dispatchTimestamp', '>=', dateFrom.getTime()),
      where('dispatchTimestamp', '<=', dateTo.getTime()),
    );

    dynamicQueryOrder = query(
      dynamicQueryOrder,
      where('billCreationTime', '>=', dateFrom.getTime()),
      where('billCreationTime', '<=', dateTo.getTime()),
      where('supplyReportId', '==', ''),
    );

    const fetchData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(dynamicQuery);
        let supplyReportData = querySnapshot.docs.map((doc1) => ({
          ...doc1.data(),
          id: doc1.id,
        }));
        supplyReportData = supplyReportData.sort(
          (rd1, rd2) => rd1.dispatchTimestamp - rd2.dispatchTimestamp,
        );

        supplyReportData = supplyReportData.filter(
          (x) => x.status !== constants.firebase.supplyReportStatus.TOACCOUNTS,
        );
        const querySnapshotunsupplier = await getDocs(dynamicQueryOrder);
        const unSuppliedOrders1 = querySnapshotunsupplier.docs.map((doc1) => ({
          ...doc1.data(),
          id: doc1.id,
        }));

        setSupplyReports(supplyReportData);
        setUnSuppliedOrders(unSuppliedOrders1);
      } catch (error) {
        console.error('Error fetching supply reports:', error);
      }
      setLoading(false);
    };

    fetchData();
  };

  const submitRemarks = async () => {
    if (!allowEditRemark) {
      setAllowEditRemarks(true);
      return;
    }
    if (Object.keys(newRemarks).length === 0) {
      setAllowEditRemarks(false);
      return;
    }
    try {
      await Promise.all(
        Object.keys(newRemarks).map(async (orderId) => {
          const orderRef = getCompanyDoc(
            currentCompanyId,
            DB_NAMES.ORDERS,
            orderId,
          );
          await updateDoc(orderRef, {
            accountsNotes: newRemarks[orderId],
          });
        }),
      );
      setAllowEditRemarks(false);
      onSearch();
    } catch (e) {
      alert('Error updating remarks');
    }
  };

  useEffect(() => {
    onSearch();
  }, []);

  return (
    <div className="print-supply-reports-page">
      <div className="print-supply-reports-container">
        <h3>
          Day Supply Report - {globalUtils.getTimeFormat(selectedDate, true)}
        </h3>

        <div className="all-bills-search-input-container no-print">
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

          <Button disabled={allowEditRemark} onClick={handlePrint}>
            Print
          </Button>
          <Checkbox
            onChange={(e, d) => setShowDefaultersOnly(d.checked)}
            label="Defaulter Parties"
          />
          <Button onClick={() => submitRemarks()}>
            {allowEditRemark ? 'Save Remarks' : 'Edit Remarks'}
          </Button>
        </div>
        {loading ? (
          <div className="no-print">
            <Spinner />
          </div>
        ) : (
          <div>
            {supplyReports.map((sr) => {
              return (
                <SupplyReportRow
                  showDefaultersOnly={showDefaultersOnly}
                  key={`supply-report-all-list-${sr.id}`}
                  data={sr}
                  editRemarks={allowEditRemark}
                  setRemarks={setNewRemarks}
                />
              );
            })}
            <h2>
              {unSuppliedOrders.length === 0 ? 'No ' : ''}Unsupplied Bills
            </h2>
            {unSuppliedOrders.length !== 0 ? (
              <table className="app-table">
                <thead className="supply-report-row">
                  <th>
                    <Text>Party Name</Text>
                  </th>
                  <th>
                    <Text>Bill Number</Text>
                  </th>
                  <th>
                    <Text>Amount</Text>
                  </th>
                  <th>
                    <Text>Credit Days</Text>
                  </th>
                  <th>
                    <Text>Payment</Text>
                  </th>
                  <th>
                    <Text>Outstanding</Text>
                  </th>
                  <th>
                    <Text>Remarks</Text>
                  </th>
                </thead>
                {unSuppliedOrders?.map((unso) => {
                  return (
                    <SupplyReportOrderRow
                      key={`unsupplied-${unso.id}`}
                      editRemarks={allowEditRemark}
                      billId={unso.id}
                      setRemarks={setNewRemarks}
                    />
                  );
                })}
              </table>
            ) : null}
          </div>
        )}
        {!loading && supplyReports.length === 0 ? (
          <div>No Supply Reports found</div>
        ) : null}
      </div>

      <div>*** End of Report ***</div>
    </div>
  );
}

function SupplyReportRow({
  data,
  editRemarks,
  setRemarks,
  showDefaultersOnly,
}) {
  const { allUsers } = useAuthUser();

  return (
    <table className="app-table">
      <thead className="supply-report-row">
        <th style={{ width: '25%' }}>
          <Text className="sr-id">
            {data.receiptNumber} (
            {data.status === 'Completed' ? 'Received' : 'Unreceived'})
          </Text>
        </th>
        <th style={{ width: '10%' }}>
          <Text className="sr-timestamp">
            {allUsers.find((x) => x.uid === data.supplymanId)?.username}
          </Text>
        </th>

        <th style={{ width: '10%' }}>
          <Text className="sr-supplyman">
            {globalUtils.getDayTime(data.dispatchTimestamp)}
          </Text>
        </th>
        <th style={{ width: '10%' }}>
          <Text className="sr-supplyman">Credit Days</Text>
        </th>
        <th style={{ width: '20%' }}>
          <Text>Payment</Text>
        </th>
        <th>
          <Text>Outstanding</Text>
        </th>
        <th style={{ width: '13%' }}>
          <Text>Remarks</Text>
        </th>
      </thead>

      {data.orders.map((x) => (
        <SupplyReportOrderRow
          key={`order-${x}`}
          showDefaultersOnly={showDefaultersOnly}
          setRemarks={setRemarks}
          editRemarks={editRemarks}
          billId={x}
        />
      ))}
    </table>
  );
}

function SupplyReportOrderRow({
  billId,
  editRemarks,
  setRemarks,
  showDefaultersOnly,
}) {
  const [order, setOrder] = useState();
  const [loading, setLoading] = useState(true);
  const [cashReceipts, setCashReceipts] = useState([]);
  const [chequeReceipts, setChequeReceipts] = useState([]);
  const [upiReceipts, setUpiReceipts] = useState([]);
  const [isDefaulter, setIsDefaulter] = useState(true);
  const { currentCompanyId } = useCompany();

  const fetchOrder = async () => {
    try {
      const order1 = await globalUtils.fetchOrdersByIds(
        [billId],
        currentCompanyId,
      );
      const newOrder = await globalUtils.fetchPartyInfoForOrders(
        order1,
        currentCompanyId,
      );
      setOrder(newOrder[0]);
      await fetchPayments(newOrder[0]);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  const fetchPayments = async (orderObj) => {
    try {
      const cashRef = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.CASH_RECEIPTS,
      );
      const upiRef = getCompanyCollection(currentCompanyId, DB_NAMES.UPI);
      const chequeRef = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.CHEQUES,
      );

      const dateFrom = new Date(orderObj.billCreationTime);
      dateFrom.setDate(dateFrom.getDate() - 3);
      dateFrom.setHours(0);
      dateFrom.setMinutes(0);
      dateFrom.setSeconds(0);

      const dateTo = new Date(orderObj.billCreationTime);
      dateTo.setDate(dateTo.getDate() + 7);
      dateTo.setHours(23);
      dateTo.setMinutes(59);
      dateTo.setSeconds(59);

      const cashQuery = query(
        cashRef,
        where('parties', 'array-contains', orderObj.partyId),
        where('timestamp', '>=', dateFrom.getTime()),
        where('timestamp', '<=', dateTo.getTime()),
      );
      const chequeQuery = query(
        chequeRef,
        where('partyId', '==', orderObj.partyId),
        where('timestamp', '>=', dateFrom.getTime()),
        where('timestamp', '<=', dateTo.getTime()),
      );

      const upiQuery = query(
        upiRef,
        where('partyId', '==', orderObj.partyId),
        where('timestamp', '>=', dateFrom.getTime()),
        where('timestamp', '<=', dateTo.getTime()),
      );

      let cashDocs = await getDocs(cashQuery);
      let upiDocs = await getDocs(upiQuery);
      let chequeDocs = await getDocs(chequeQuery);

      cashDocs = cashDocs.docs.map((x) => ({ id: x.id, ...x.data() }));
      chequeDocs = chequeDocs.docs.map((x) => ({ id: x.id, ...x.data() }));
      upiDocs = upiDocs.docs
        .filter((x) => x.data().type === 'upi')
        .map((x) => ({ id: x.id, ...x.data() }));

      setCashReceipts(cashDocs);
      setChequeReceipts(chequeDocs);
      setUpiReceipts(upiDocs);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, []);

  useEffect(() => {
    if (showDefaultersOnly) {
      if (!loading) {
        setIsDefaulter(
          defaulterPartyAlgo(
            upiReceipts,
            chequeReceipts,
            cashReceipts,
            order,
          ),
        );
      }
    } else {
      setIsDefaulter(false);
    }
  }, [loading, showDefaultersOnly]);

  if (loading) return <Spinner />;
  if (!order) return <div>Error loading order</div>;

  return (
    <tbody
      style={{ backgroundColor: isDefaulter ? '#ff000077' : 'white' }}
      className="supply-report-print-bill-detail"
    >
      <td style={{ textAlign: 'left' }}>
        {order.party?.name}
        <b>
          {order.orderStatus === 'Goods Returned' ? 'Goods Returned' : null}
        </b>
      </td>
      <td>{order.billNumber}</td>
      <td>{globalUtils.getCurrencyFormat(order.orderAmount)}</td>

      <td>{order.party?.creditDays || '--'}</td>

      <td>
        {[...cashReceipts, ...upiReceipts, ...chequeReceipts].length === 0
          ? '--'
          : ''}
        {cashReceipts.map((cr) => (
          <div key={`Cash${cr.id}`}>
            <b>
              Cash:
              {globalUtils.getCurrencyFormat(
                cr.prItems.find((x) => x.partyId === order.partyId)?.amount,
              )}
            </b>
            ({globalUtils.getTimeFormat(cr.timestamp, true)?.slice(0, 5)})
          </div>
        ))}
        {upiReceipts.map((cr) => (
          <div key={`upi${cr.id}`}>
            <b>UPI {globalUtils.getCurrencyFormat(cr.amount)}</b>(
            {globalUtils.getTimeFormat(cr.timestamp, true)?.slice(0, 5)})
          </div>
        ))}
        {chequeReceipts.map((cr) => (
          <div key={`cheque${cr.id}`}>
            <b>Cheque: {globalUtils.getCurrencyFormat(cr.amount)}</b>(
            {globalUtils.getTimeFormat(cr.timestamp, true)?.slice(0, 5)})<br />
            (PDC: {globalUtils.getTimeFormat(cr.chequeDate, true)})
          </div>
        ))}
      </td>
      <td>{globalUtils.getCurrencyFormat(order.party.partyBalance)}</td>
      <td>
        {editRemarks ? (
          <Input
            size="small"
            appearance="outline"
            onChange={(e) =>
              setRemarks((x) => ({ ...x, [order.id]: e.target.value }))
            }
            defaultValue={order.accountsNotes}
          />
        ) : (
          order.accountsNotes
        )}
      </td>
    </tbody>
  );
}
