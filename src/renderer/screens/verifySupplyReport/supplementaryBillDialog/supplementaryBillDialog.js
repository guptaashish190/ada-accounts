/* eslint-disable no-restricted-syntax */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// import { throttle, debounce } from 'lodash';

import {
  Button,
  Card,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { firebaseDB } from '../../../firebaseInit';
import './style.css';
import Loader from '../../../common/loader';
import globalUtils, { useDebounce } from '../../../services/globalUtils';
import { VerticalSpace1 } from '../../../common/verticalSpace';
import { useAuthUser } from '../../../contexts/allUsersContext';

export default function SupplementaryBillDialog({
  addSupplementaryBill,
  currentBills,
}) {
  const [partyDetails, setPartyDetails] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading] = useState(false);

  const [queryPartyName, setQueryPartyName] = useState('');
  const [queryPartyId, setQueryPartyId] = useState('');

  const debouncedValue = useDebounce(queryPartyName, 500);
  const [queryWith, setQueryWith] = useState();
  const [queryWithId, setQueryWithId] = useState();
  const [queryBillNumber, setQueryBillNumber] = useState('');
  const [queryMR, setQueryMR] = useState('');

  const [filteredOrders, setFilteredOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const ordersCollection = collection(firebaseDB, 'orders');
      const q = query(
        ordersCollection,
        orderBy('creationTime', 'desc'),
        limit(10),
      );
      const querySnapshot = await getDocs(q);

      const orderList = [];
      querySnapshot.forEach((doc) => {
        orderList.push(doc.data());
      });

      setFilteredOrders(orderList);
    } catch (error) {
      console.error('Error fetchisng partiee: ', error);
    }
  };

  const onSearchBill = () => {
    const ordersRef = collection(firebaseDB, 'orders');

    // Build the query dynamically based on non-empty filter fields
    let dynamicQuery = ordersRef;

    const filters = {
      partyId: queryPartyId,
      billNumber: queryBillNumber ? `T-${queryBillNumber}` : null,
    };
    if (Object.keys(filters).length === 0) return;

    for (const field in filters) {
      if (filters[field]) {
        dynamicQuery = query(dynamicQuery, where(field, '==', filters[field]));
      }
    }
    dynamicQuery = query(dynamicQuery, limit(10));
    // Fetch parties based on the dynamic query
    const fetchData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(dynamicQuery);
        console.log();
        const orderData = querySnapshot.docs.map((doc) => doc.data());
        console.log(orderData.length);
        setFilteredOrders(orderData);
      } catch (error) {
        console.error('Error fetching parties:', error);
      }
      setLoading(false);
    };

    fetchData();
  };

  const { allUsers } = useAuthUser();
  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 3) return;
    const fetchParties = async () => {
      // Define a reference to the "parties" collection
      const partiesRef = collection(firebaseDB, 'parties');

      // Create a query with a "name" field filter
      const q = query(
        partiesRef,
        where('name', '>=', debouncedValue.toUpperCase()),
        limit(10),
      );

      try {
        const querySnapshot = await getDocs(q);
        const partyData = querySnapshot.docs.map((doc) => doc.data());
        setPartyDetails(partyData);
      } catch (error) {
        console.error('Error fetching parties:', error);
      }
    };

    fetchParties();
  }, [debouncedValue]);

  const options = [
    'Created',
    'Packed',
    'Modified',
    'To Accounts',
    'Dispatched',
    'Received',
  ];

  return (
    <center>
      <div className="supplementary-bill-dialog">
        <h3>Search Bills</h3>
        <div className="all-bills-search-input-container">
          <Combobox
            onInput={(e) => {
              setQueryPartyName(e.target.value);
            }}
            freeform
            value={queryPartyName}
            onOptionSelect={(_, e) => {
              setQueryPartyName(e.optionText);
              setQueryPartyId(e.optionValue);
            }}
            placeholder="Party name"
          >
            {partyDetails?.length ? (
              partyDetails.map((option1) => (
                <Option
                  value={option1.id}
                  text={option1.name}
                  key={`search-bill-${option1.id}`}
                >
                  {option1.name}
                </Option>
              ))
            ) : (
              <Option key="!212231">None</Option>
            )}
          </Combobox>

          <Input
            onChange={(_, e) => setQueryBillNumber(e.value)}
            contentBefore="T-"
            type="number"
            className="input"
            placeholder="Bill No."
          />
        </div>
        <VerticalSpace1 />
        <Button
          onClick={() => {
            onSearchBill();
          }}
        >
          Search
        </Button>
        <VerticalSpace1 />
        <div className="all-bills-row-header" />
        <VerticalSpace1 />
        {filteredOrders.map((sr, index) => {
          return (
            <BillRow
              key={`supp-diag-row-${sr.id}`}
              addSupplementaryBill={() => addSupplementaryBill(sr)}
              data={sr}
              index={index}
              isAttached={
                currentBills.findIndex((fi) => fi.id === sr.id) !== -1
              }
            />
          );
        })}
      </div>
    </center>
  );
}

function BillRow({ data, index, isAttached, addSupplementaryBill }) {
  const navigate = useNavigate();
  const [party, setParty] = useState();
  const [withUser, setWithUser] = useState();

  const getParty = async () => {
    const party1 = await globalUtils.fetchPartyInfo(data.partyId);
    setParty(party1);
  };
  const getWithUser = async () => {
    if (!data.with || data.with === 'Accounts' || data.with === '') {
      setWithUser('Accounts');
      return;
    }
    console.log(data);
    const user1 = await globalUtils.fetchUserById(data.with);
    setWithUser(user1.username);
  };

  useEffect(() => {
    getParty();
    getWithUser();
  }, []);

  const scheduledDateString = () => {
    if (!data.schedulePaymentDate) return '';
    return `(Scheduled: ${globalUtils.getTimeFormat(
      data.schedulePaymentDate,
      true,
    )})`;
  };
  return (
    <div className="bill-row">
      <div className="row-1">
        <Text size={200}>
          {party?.name || '--'}
          &nbsp;&nbsp;
          <Text size={200}>
            (BAL: {globalUtils.getCurrencyFormat(data.balance) || '--'})
          </Text>
        </Text>
        <Button
          disabled={isAttached || withUser !== 'Accounts'}
          size="small"
          appearance="subtle"
          onClick={() => addSupplementaryBill()}
          style={{
            color: isAttached || withUser !== 'Accounts' ? 'grey' : '#F25C54',
          }}
        >
          {isAttached ? 'Added' : 'Add Bill'}
        </Button>
      </div>
      <div className="row-1">
        <div>
          <Text size={200}>
            <b>{data.billNumber?.toUpperCase() || '--'}</b>
          </Text>
          &nbsp;&nbsp;
          <Text size={200}>
            {globalUtils.getCurrencyFormat(data.orderAmount)}
          </Text>
        </div>
        <Text style={{ color: 'grey', fontSize: '0.8em' }}>
          <i>
            {`With ${withUser || 'Accounts'}`} {scheduledDateString()}
          </i>
        </Text>
      </div>
    </div>
  );
}
