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
import { useAuthUser } from '../../../contexts/allUsersContext';
import { firebaseDB } from '../../../firebaseInit';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';

export default function SaleReport() {
  const [todaysBills, setTodaysBills] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allowEditRemark, setAllowEditRemarks] = useState(false);
  const [newRemarks, setNewRemarks] = useState({});

  // filters
  const [filterNoPayments, setFilterNoPayments] = useState(false);

  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();

  const handlePrint = () => {
    window.electron.ipcRenderer.sendMessage('printCurrentPage');
  };

  const onSearch = (clear) => {
    const ordersRef = collection(firebaseDB, 'orders');

    let dynamicQueryOrder = ordersRef;

    const dateFrom = new Date(selectedDate);
    dateFrom.setHours(0);
    dateFrom.setMinutes(0);
    dateFrom.setSeconds(1);
    const dateTo = new Date(selectedDate);
    dateTo.setHours(23);
    dateTo.setMinutes(59);
    dateTo.setSeconds(59);

    dynamicQueryOrder = query(
      dynamicQueryOrder,
      where('billCreationTime', '>=', dateFrom.getTime()),
      where('billCreationTime', '<=', dateTo.getTime()),
    );

    // Fetch parties based on the dynamic query
    const fetchData = async () => {
      setLoading(true);
      try {
        const querySnapshotunsupplier = await getDocs(dynamicQueryOrder);
        const todaysBills1 = querySnapshotunsupplier.docs.map((doc1) => ({
          ...doc1.data(),
        }));
        const mrWise = {};
        todaysBills1.forEach((elem) => {
          if (mrWise[elem.mrId] === undefined) {
            mrWise[elem.mrId] = [elem];
          } else {
            mrWise[elem.mrId].push(elem);
          }
        });

        setTodaysBills(mrWise);
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
          <Button onClick={() => submitRemarks()}>
            {allowEditRemark ? 'Save Remarks' : 'Edit Remarks'}
          </Button>
          <span>
            <Checkbox
              checked={filterNoPayments}
              onChange={(ev, data) => setFilterNoPayments(data.checked)}
            />{' '}
            Filter no payments
          </span>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <div>
            <h2>{todaysBills.length === 0 ? 'No ' : ''}All Bills</h2>

            {Object.keys(todaysBills)?.map((unso) => {
              return (
                <table>
                  <thead className="supply-report-row">
                    <th>
                      <Text>
                        MR: {allUsers.find((x) => x.uid === unso)?.username}
                      </Text>
                    </th>
                    <th>
                      <Text>Bill Number</Text>
                    </th>
                    <th>
                      <Text>Bill Amount</Text>
                    </th>
                    <th>
                      <Text>Payment Received</Text>
                    </th>
                    <th>
                      <Text>Remarks</Text>
                    </th>
                  </thead>
                  {todaysBills[unso].map((x) => (
                    <TodaysBillRow
                      filterNoPayments={filterNoPayments}
                      editRemarks={allowEditRemark}
                      billId={x.id}
                      setRemarks={setNewRemarks}
                    />
                  ))}
                </table>
              );
            })}
          </div>
        )}
        {!loading && todaysBills.length === 0 ? (
          <div>No bills found</div>
        ) : null}
      </div>

      <div>*** End of Report ***</div>
    </center>
  );
}

function TodaysBillRow({ billId, editRemarks, setRemarks, filterNoPayments }) {
  const [order, setOrder] = useState();
  const [loading, setLoading] = useState(false);
  const fetchOrder = async () => {
    setLoading(true);
    try {
      const order1 = await globalUtils.fetchOrdersByIds([billId]);
      const newOrder = await globalUtils.fetchPartyInfoForOrders(order1);
      setOrder(newOrder[0]);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrder();
  }, []);

  if (loading) return <Spinner />;
  if (!loading && !order) return <div>Error loading order</div>;

  const getPaymentSum = order.payments?.reduce(
    (acc, current) => acc + (parseInt(current.amount, 10) || 0),
    0,
  );

  if (!loading && order && filterNoPayments && getPaymentSum) {
    return null;
  }
  console.log(getPaymentSum);
  return (
    <tbody className="supply-report-print-bill-detail">
      <td style={{ width: '20%' }}>{order.party.name}</td>
      <td style={{ width: '10%' }}>{order.billNumber}</td>
      <td style={{ width: '10%' }}>
        {globalUtils.getCurrencyFormat(order.orderAmount)}
      </td>
      {/* <td style={{ width: '20%' }}>
        {order.bags
          .filter((x) => x.quantity > 0)
          .map((x) => `${x.quantity} ${x.bagType}`)
          .join(',')}
      </td> */}

      <td style={{ width: '10%' }}>
        <b>
          {(getPaymentSum === 0
            ? '--'
            : globalUtils.getCurrencyFormat(getPaymentSum)) || '--'}
        </b>
      </td>
      <td style={{ width: '20%' }}>
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
      {/* <td>{order.orderStatus}</td> */}
    </tbody>
  );
}
