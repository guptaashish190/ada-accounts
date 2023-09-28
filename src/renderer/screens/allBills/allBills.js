import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import lodash from 'lodash';

import {
  Button,
  Card,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import { VerticalSpace1 } from '../../common/verticalSpace';

export default function AllBillsScreen() {
  const [partyDetails, setPartyDetails] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading] = useState(false);

  const [queryPartyName, setQueryPartyName] = useState('');
  const [queryWith, setQueryWith] = useState();
  const [queryBillNumber, setQueryBillNumber] = useState('');
  const [queryMR, setQueryMR] = useState('');
  const [queryArea, setQueryArea] = useState('');
  const [queryStatus, setQueryStatus] = useState('');

  const [filteredOrders, setFilteredOrders] = useState([]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const usersCollection = collection(firebaseDB, 'users');
      const querySnapshot = await getDocs(usersCollection);

      const userList = [];
      querySnapshot.forEach((doc) => {
        userList.push(doc.data());
      });

      setAllUsers(userList);
      setLoadingUsers(false);
    } catch (error) {
      console.error('Error fetching users: ', error);
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const ordersCollection = collection(firebaseDB, 'orders');
      const q = query(ordersCollection, limit(10));
      const querySnapshot = await getDocs(q);

      const orderList = [];
      querySnapshot.forEach((doc) => {
        orderList.push(doc.data());
      });

      setFilteredOrders(orderList);
    } catch (error) {
      console.error('Error fetchisng parties: ', error);
    }
  };

  const handler = useCallback(
    lodash.debounce(() => {
      console.log('Fetc');
    }, 1000),
    [],
  );

  useEffect(() => {
    handler();
  }, [queryPartyName]);

  if (loading) return <Loader />;

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
      <div className="all-bills-screen">
        <h3>Search Bills</h3>
        <div className="all-bills-search-input-container">
          <Input
            onChange={(_, e) => setQueryPartyName(e.value)}
            className="input"
            placeholder="Party name"
          />

          <Dropdown
            onOptionSelect={(_, e) => setQueryWith(e.optionValue)}
            onOpenChange={(_, e) => {
              if (!allUsers.length) {
                fetchUsers();
              }
            }}
            className="dropdown"
            placeholder="With"
          >
            {loadingUsers ? (
              <Spinner />
            ) : (
              allUsers.map((user) => (
                <Option text={user.username} value={user.uid} key={user.uid}>
                  {user.username}
                </Option>
              ))
            )}
          </Dropdown>

          <Input
            onChange={(_, e) => setQueryBillNumber(e.value)}
            contentBefore="T-"
            type="number"
            className="input"
            placeholder="Bill No."
          />
          <Dropdown
            onOptionSelect={(_, e) => setQueryMR(e.optionValue)}
            onOpenChange={(_, e) => {
              if (!allUsers.length) {
                fetchUsers();
              }
            }}
            className="dropdown"
            placeholder="MR"
          >
            {loadingUsers ? (
              <Spinner />
            ) : (
              allUsers.map((user) => (
                <Option text={user.username} value={user.uid} key={user.uid}>
                  {user.username}
                </Option>
              ))
            )}
          </Dropdown>
          <Input
            onChange={(_, e) => setQueryArea(e.value)}
            className="input"
            placeholder="Area"
          />
          <Dropdown
            onOptionSelect={(_, e) => setQueryStatus(e.optionText)}
            className="input"
            placeholder="Status"
          >
            {options.map((option) => (
              <Option text={option} key={option}>
                {option}
              </Option>
            ))}
          </Dropdown>
        </div>
        <VerticalSpace1 />
        <div className="all-bills-row-header" />
        <VerticalSpace1 />
        <div className="all-bills-header">
          <div />
          <div>Party Name</div>
          <div>Bill No.</div>
          <div>Date</div>
          <div>With</div>
          <div>Amount</div>
        </div>
        {filteredOrders.map((sr, index) => {
          return <BillRow data={sr} index={index} />;
        })}
      </div>
    </center>
  );
}

function BillRow({ data, index }) {
  const navigate = useNavigate();
  const [party, setParty] = useState();
  const [withUser, setWithUser] = useState();

  const getParty = async () => {
    const party1 = await globalUtils.fetchPartyInfo(data.partyId);
    setParty(party1);
  };
  const getWithUser = async () => {
    if (!data.with || data.with === 'Accounts' || data.with === '') {
      setWithUser(data.with);
      return;
    }
    const user1 = await globalUtils.fetchUserById(data.with);
    setWithUser(user1.username);
  };

  useEffect(() => {
    getParty();
    getWithUser();
  }, []);
  return (
    <div className="bill-row">
      <Text style={{ color: '#aaa' }}>{index + 1}.</Text>
      <Text>{party?.name || ''}</Text>
      <Text>
        <b>{data.billNumber?.toUpperCase() || ''}</b>
      </Text>
      <Text>{new Date(data.creationTime).toLocaleDateString()}</Text>
      <Text>{withUser || ''}</Text>
      <Text>{globalUtils.getCurrencyFormat(data.orderAmount)}</Text>
    </div>
  );
}
