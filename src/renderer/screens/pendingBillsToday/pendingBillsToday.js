/* eslint-disable jsx-a11y/control-has-associated-label */
import { DatePicker } from '@fluentui/react-datepicker-compat';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Input,
  ProgressBar,
  Spinner,
} from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import { VerticalSpace2 } from '../../common/verticalSpace';
import globalUtils from '../../services/globalUtils';

const numColumns = 5;

export default function PendingBillsToday() {
  const [orders, setOrders] = useState([]);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [toDateOpen, setToDateOpen] = useState(false);
  const [fromDateOpen, setfromDateOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mrPartiesList, setMrPartiesList] = useState({});

  const fetchTodaysBills = async () => {
    try {
      setLoading(true);
      const ordersCollection = collection(firebaseDB, 'orders');
      const routeCollection = collection(firebaseDB, 'mr_routes');
      const dateFrom = new Date(fromDate);
      dateFrom.setHours(0);
      dateFrom.setMinutes(0);
      dateFrom.setSeconds(0);

      const routesList = await getDocs(routeCollection);

      const routes = [];
      routesList.forEach((doc1) => {
        routes.push(doc1.data());
      });

      const weekday = dateFrom.getDay();
      const mrParties = {}; // 0 (Sunday) to 6 (Saturday)
      routes.forEach((route) => {
        mrParties[route.name] = route.route[weekday - 1]?.parties;
      });

      console.log(mrParties);
      setMrPartiesList(mrParties);
      // console.log(mrParties)
    } catch (error) {
      console.error('Error fetching partiee: ', error);
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchTodaysBills();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '600' }}>
          Pending Bills For Collection
        </h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <DatePicker
            className="filter-input"
            onSelectDate={(x) => {
              setFromDate(x);
              setToDateOpen(true);
              setfromDateOpen(false);
            }}
            placeholder="Select Date"
            value={fromDate}
            style={{ minWidth: '200px' }}
          />
          <Button 
            onClick={() => fetchTodaysBills()}
            appearance="secondary"
            style={{ 
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white'
            }}
          >
            Get Bills
          </Button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.keys(mrPartiesList).map((mr) => (
            <div key={`mr${mr}`} style={{
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                padding: '16px 20px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h3 style={{ 
                  margin: '0', 
                  fontSize: '18px', 
                  fontWeight: '600',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    background: '#667eea',
                    color: 'white',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {mrPartiesList[mr]?.length ?? 0}
                  </span>
                  {mr}
                </h3>
              </div>
              <div style={{ padding: '0' }}>
                {mrPartiesList[mr].map((party) => (
                  <BillsList partyId={party} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BillsList({ partyId }) {
  const [bills, setBills] = useState([]);
  const [partyDetails, setPartyDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const fetchPartyDetails = async () => {
    try {
      const partyDoc = doc(firebaseDB, 'parties', partyId);
      const partySnap = await getDoc(partyDoc);
      if (partySnap.exists()) {
        setPartyDetails(partySnap.data());
      } else {
        console.log('No such party document!');
      }
    } catch (error) {
      console.error('Error fetching party details: ', error);
    }
  };
  const fetchPartyBills = async () => {
    try {
      const ordersCollection = collection(firebaseDB, 'orders');
      const q = query(
        ordersCollection,
        where('partyId', '==', partyId),
        where('balance', '>', 0),
        orderBy('billCreationTime', 'asc'),
      ); // Assuming 'balance' field indicates pending amount

      const querySnapshot = await getDocs(q);
      const bills1 = [];
      querySnapshot.forEach((doc1) => {
        bills1.push({ id: doc1.id, ...doc1.data() });
      });

      setBills(bills1);
      console.log(`Bills for party ${partyId}:`, bills);
      // Set the fetched bills to state (not implemented here)
    } catch (error) {
      console.error('Error fetching party bills: ', error);
    }
  };

  const fetchLastPayment = async () => {
    try {
      const cashRef = collection(firebaseDB, 'cashReceipts');
      const upiRef = collection(firebaseDB, 'upi');
      const chequeRef = collection(firebaseDB, 'cheques');

      // Get the oldest pending bill to find payments before that
      const oldestBill = bills.length > 0 ? bills[0] : null;
      if (!oldestBill) {
        setLastPayment(null);
        return;
      }

      const dateFrom = new Date(oldestBill.billCreationTime);
      dateFrom.setHours(0);
      dateFrom.setMinutes(0);
      dateFrom.setSeconds(0);

      // Query for last payment before the oldest pending bill
      const cashQueryLast = query(
        cashRef,
        where('parties', 'array-contains', partyId),
        where('timestamp', '<', dateFrom.getTime()),
        orderBy('timestamp', 'desc'),
        limit(1),
      );
      const chequeQueryLast = query(
        chequeRef,
        where('partyId', '==', partyId),
        where('timestamp', '<', dateFrom.getTime()),
        orderBy('timestamp', 'desc'),
        limit(1),
      );
      const upiQueryLast = query(
        upiRef,
        where('partyId', '==', partyId),
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
      console.log('Error fetching last payment:', e);
      setLastPayment(null);
    }
  };

  const init = async () => {
    setLoading(true);
    await fetchPartyDetails();
    await fetchPartyBills();
    setLoading(false);
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (bills.length > 0) {
      fetchLastPayment();
    }
  }, [bills]);
  if (loading) {
    return <Spinner />;
  }
  if (bills.length === 0) {
    return null;
  }

  const calculateDaysBetween = (date1, date2) => {
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div style={{
      borderBottom: '1px solid #f3f4f6',
      transition: 'all 0.2s ease'
    }}>
      <div 
        style={{ 
          padding: '16px 20px',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          backgroundColor: isCollapsed ? '#fafafa' : '#ffffff'
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
        onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
        onMouseLeave={(e) => e.target.style.backgroundColor = isCollapsed ? '#fafafa' : '#ffffff'}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h4 style={{ 
                margin: '0', 
                fontSize: '16px', 
                fontWeight: '600',
                color: '#1f2937'
              }}>
                {partyDetails?.name ?? partyId}
              </h4>
              <span style={{
                background: bills.length > 0 ? '#ef4444' : '#10b981',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: '500'
              }}>
                {bills.length} Bills
              </span>
            </div>
            {lastPayment && (
              <div style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{ fontWeight: '500' }}>Last Payment:</span>
                {lastPayment.type === 'cash' ? (
                  <span style={{ color: '#059669', fontWeight: '500' }}>
                    Cash: {globalUtils.getCurrencyFormat(
                      lastPayment.prItems?.find((x) => x.partyId === partyId)?.amount,
                    )} ({globalUtils.getTimeFormat(lastPayment.timestamp, true)?.slice(0, 5)})
                  </span>
                ) : lastPayment.type === 'upi' ? (
                  <span style={{ color: '#059669', fontWeight: '500' }}>
                    UPI: {globalUtils.getCurrencyFormat(lastPayment.amount)} ({globalUtils.getTimeFormat(lastPayment.timestamp, true)?.slice(0, 5)})
                  </span>
                ) : lastPayment.type === 'cheque' ? (
                  <span style={{ color: '#059669', fontWeight: '500' }}>
                    Cheque: {globalUtils.getCurrencyFormat(lastPayment.amount)} ({globalUtils.getTimeFormat(lastPayment.timestamp, true)?.slice(0, 5)})
                  </span>
                ) : null}
              </div>
            )}
            {bills.length > 0 && (
              <div style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontWeight: '500' }}>Total Outstanding:</span>
                <span style={{ color: '#dc2626', fontWeight: '600' }}>
                  {globalUtils.getCurrencyFormat(
                    bills.reduce((total, bill) => total + (bill.balance || 0), 0)
                  )}
                </span>
              </div>
            )}
          </div>
          <div style={{ 
            fontSize: '16px', 
            color: '#6b7280',
            transition: 'transform 0.2s ease',
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
          }}>
            ▼
          </div>
        </div>
      </div>
      
      {!isCollapsed && (
        <div style={{ padding: '0 20px 16px 20px' }}>
          <div style={{
            background: '#f8fafc',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              background: '#f1f5f9',
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#475569',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div>Bill No</div>
              <div>Date</div>
              <div style={{ textAlign: 'right' }}>Amount</div>
              <div style={{ textAlign: 'right' }}>Balance</div>
              <div style={{ textAlign: 'right' }}>Days</div>
            </div>
            {bills.map((bill, index) => (
              <div key={bill.id} style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                padding: '12px 16px',
                fontSize: '13px',
                borderBottom: index < bills.length - 1 ? '1px solid #e2e8f0' : 'none',
                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc'
              }}>
                <div style={{ fontWeight: '500', color: '#1f2937' }}>{bill.billNumber}</div>
                <div style={{ color: '#6b7280' }}>
                  {globalUtils.getTimeFormat(bill.billCreationTime, true, false)}
                </div>
                <div style={{ textAlign: 'right', fontWeight: '500', color: '#1f2937' }}>
                  {globalUtils.getCurrencyFormat(bill.orderAmount)}
                </div>
                <div style={{ textAlign: 'right', fontWeight: '600', color: '#dc2626' }}>
                  {globalUtils.getCurrencyFormat(bill.balance)}
                </div>
                <div style={{ textAlign: 'right', color: '#6b7280' }}>
                  {calculateDaysBetween(bill.billCreationTime, new Date())} days
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
