/* eslint-disable no-restricted-syntax */
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';

import '../style.css';
import ReactToPrint, { useReactToPrint } from 'react-to-print';
import { min } from 'mathjs';
import { useAuthUser } from '../../../contexts/allUsersContext';
import { firebaseDB } from '../../../firebaseInit';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';
import defaulterPartyAlgo from './defaulterPartyAlgo';

export default function DaySupplyReportPrint() {
  const [supplyReports, setSupplyReports] = useState([]);
  const [unSuppliedOrders, setUnSuppliedOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allowEditRemark, setAllowEditRemarks] = useState(false);
  const [newRemarks, setNewRemarks] = useState({});
  const [showDefaultersOnly, setShowDefaultersOnly] = useState(false);

  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();

  const handlePrint = () => {
    window.electron.ipcRenderer.sendMessage('printCurrentPage');
  };

  const onSearch = (clear) => {
    const supplyReportRef = collection(firebaseDB, 'supplyReports');
    const ordersRef = collection(firebaseDB, 'orders');

    // Build the query dynamically based on non-empty filter fields
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

    // Fetch parties based on the dynamic query
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
      Object.keys(newRemarks).forEach(async (orderId) => {
        const orderRef = doc(firebaseDB, 'orders', orderId);
        await updateDoc(orderRef, {
          accountsNotes: newRemarks[orderId],
        });
      });
      setAllowEditRemarks(false);
      onSearch();
    } catch (e) {
      alert('Error updating remarks');
    }
  };

  useEffect(() => {
    onSearch(true);
  }, []);

  return (
    <center>
      <div className="print-supply-reports-container">
        <h3>
          Day Supply Report - {globalUtils.getTimeFormat(selectedDate, true)}
        </h3>

        <div className="all-bills-search-input-container">
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
          <Spinner />
        ) : (
          <div>
            {supplyReports.map((sr, i) => {
              return (
                <SupplyReportRow
                  showDefaultersOnly={showDefaultersOnly}
                  key={`supply-report-all-list-${sr.id}`}
                  index={i}
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
              <table>
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
                    <Text>Payment Terms</Text>
                  </th>
                  <th>
                    <Text>Payment</Text>
                  </th>
                  <th>
                    <Text>Last Payment Received</Text>
                  </th>
                  <th>
                    <Text>Remarks</Text>
                  </th>
                </thead>
                {unSuppliedOrders?.map((unso) => {
                  return (
                    <SupplyReportOrderRow
                      editRemarks={allowEditRemark}
                      billId={unso.id}
                      setRemarks={setNewRemarks}
                    />
                  );
                })}
              </table>
            ) : (
              ''
            )}
          </div>
        )}
        {!loading && supplyReports.length === 0 ? (
          <div>No Supply Reports found</div>
        ) : null}
      </div>

      <div>*** End of Report ***</div>
    </center>
  );
}

function SupplyReportRow({
  data,
  index,
  editRemarks,
  setRemarks,
  showDefaultersOnly,
}) {
  const navigate = useNavigate();

  const { allUsers } = useAuthUser();

  return (
    <table>
      <thead className="supply-report-row">
        <th style={{ width: '25vw' }}>
          <Text className="sr-id">
            {data.receiptNumber} (
            {data.status === 'Completed' ? 'Received' : 'Unreceived'})
          </Text>
        </th>
        <th style={{ width: '10vw' }}>
          <Text className="sr-timestamp">
            {allUsers.find((x) => x.uid === data.supplymanId)?.username}
          </Text>
        </th>

        <th style={{ width: '10vw' }}>
          {' '}
          <Text className="sr-supplyman">
            {globalUtils.getDayTime(data.dispatchTimestamp)}
          </Text>
        </th>
        <th style={{ width: '10vw' }}>
          <Text className="sr-supplyman">Payment Terms</Text>
        </th>
        <th style={{ width: '20vw' }}>
          <Text>Payment</Text>
        </th>
        <th style={{ width: '20vw' }}>
          <Text>Last Payment Received</Text>
        </th>
        <th style={{ width: '20vw' }}>
          <Text>Last Billing</Text>
        </th>
        <th style={{ width: '13vw' }}>
          <Text>Remarks</Text>
        </th>
      </thead>

      {data.orders.map((x) => (
        <SupplyReportOrderRow
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
  const [lastPayment, setLastPayment] = useState();
  const [isDefaulter, setIsDefaulter] = useState(true);
  const [lastBilling, setLastBilling] = useState();

  const fetchOrder = async () => {
    try {
      const order1 = await globalUtils.fetchOrdersByIds([billId]);
      const newOrder = await globalUtils.fetchPartyInfoForOrders(order1);
      setOrder(newOrder[0]);
      await fetchPayments(newOrder[0]);
      await fetchLastBilling(newOrder[0]);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  const fetchLastBilling = async (orderData) => {
    const orderRef = collection(firebaseDB, 'orders');
    const lastOrder1 = query(
      orderRef,
      where('partyId', '==', orderData.partyId),
      where('billCreationTime', '<=', orderData.billCreationTime - 86400000),
      where('type', '!=', 'R'),
      orderBy('billCreationTime', 'desc'),
      limit(1),
    );
    const lastOrder2 = await getDocs(lastOrder1);
    if (lastOrder2.docs.length === 1) {
      setLastBilling(lastOrder2.docs[0].data());
    }
  };

  const fetchPayments = async (orderObj) => {
    try {
      const cashRef = collection(firebaseDB, 'cashReceipts');
      const upiRef = collection(firebaseDB, 'upi');
      const chequeRef = collection(firebaseDB, 'cheques');

      const PAYMENT_BEFORE_DAYS = 3;
      const PAYMENT_AFTER_DAYS = 7;

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

      // last payment recd
      const cashQueryLast = query(
        cashRef,
        where('parties', 'array-contains', orderObj.partyId),
        where('timestamp', '<', dateFrom.getTime()),
        orderBy('timestamp', 'desc'),
        limit(1),
      );
      const chequeQueryLast = query(
        chequeRef,
        where('partyId', '==', orderObj.partyId),
        where('timestamp', '<', dateFrom.getTime()),
        orderBy('timestamp', 'desc'),
        limit(1),
      );

      const upiQueryLast = query(
        upiRef,
        where('partyId', '==', orderObj.partyId),
        where('timestamp', '<', dateFrom.getTime()),
        orderBy('timestamp', 'desc'),
        limit(1),
      );
      const cashQueryLastDocs = await getDocs(cashQueryLast);
      const upiQueryLastDocs = await getDocs(upiQueryLast);
      const chequeQueryLastDocs = await getDocs(chequeQueryLast);

      const cashLastValue =
        cashQueryLastDocs.docs.length > 0
          ? cashQueryLastDocs.docs[0].data()
          : undefined;
      const upiLastValue =
        upiQueryLastDocs.docs.length > 0
          ? upiQueryLastDocs.docs[0].data()
          : undefined;
      const chequeLastValue =
        chequeQueryLastDocs.docs.length > 0
          ? chequeQueryLastDocs.docs[0].data()
          : undefined;

      const lastPayment1 = [
        { ...cashLastValue, type: 'cash' },
        { ...upiLastValue, type: 'upi' },
        { ...chequeLastValue, type: 'cheque' },
      ].sort((x1, x2) => (x2?.timestamp || 0) - (x1?.timestamp || 0))[0];

      setLastPayment(lastPayment1.timestamp ? lastPayment1 : undefined);
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
            lastPayment,
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

  const getPaymentSum = order.payments?.reduce(
    (acc, current) => acc + (parseInt(current.amount, 10) || 0),
    0,
  );

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
      {/* <td style={{ width: '20vw' }}>
        {order.bags
          ? order.bags
              .filter((x) => x.quantity > 0)
              .map((x) => `${x.quantity} ${x.bagType}`)
              .join(',')
          : ''}
      </td> */}

      <td>{order.party?.paymentTerms || '--'}</td>

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
      <td>
        {lastPayment?.type === 'cash' ? (
          <div key={`Cash${lastPayment.timestamp}`}>
            <b>
              Cash:
              {globalUtils.getCurrencyFormat(
                lastPayment.prItems.find((x) => x.partyId === order.partyId)
                  ?.amount,
              )}
            </b>
            (
            {globalUtils
              .getTimeFormat(lastPayment.timestamp, true)
              ?.slice(0, 5)}
            )
          </div>
        ) : (
          ''
        )}{' '}
        {lastPayment?.type === 'upi' ? (
          <div key={`upi${lastPayment.timestamp}`}>
            <b>UPI {globalUtils.getCurrencyFormat(lastPayment.amount)}</b>(
            {globalUtils
              .getTimeFormat(lastPayment.timestamp, true)
              ?.slice(0, 5)}
            )
          </div>
        ) : (
          ''
        )}{' '}
        {lastPayment?.type === 'cheque' ? (
          <div key={`cheque${lastPayment.timestamp}`}>
            <b>Cheque: {globalUtils.getCurrencyFormat(lastPayment.amount)}</b>(
            {globalUtils
              .getTimeFormat(lastPayment.timestamp, true)
              ?.slice(0, 5)}
            ) <br />
            (PDC: {globalUtils.getTimeFormat(lastPayment.chequeDate, true)})
          </div>
        ) : (
          ''
        )}
      </td>
      <td>
        {lastBilling ? (
          <>
            <b>{globalUtils.getCurrencyFormat(lastBilling.orderAmount)}</b>
            &nbsp; (
            {globalUtils
              .getTimeFormat(lastBilling.billCreationTime, true)
              ?.slice(0, 5)}
            )
          </>
        ) : null}
      </td>
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
