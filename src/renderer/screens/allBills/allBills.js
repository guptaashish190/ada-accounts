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
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils, { useDebounce } from '../../services/globalUtils';
import { VerticalSpace1 } from '../../common/verticalSpace';
import BillDetailDialog from './billDetail/billDetail';
import { useAuthUser } from '../../contexts/allUsersContext';
import PartySelector from '../../common/partySelector';

export default function AllBillsScreen() {
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading] = useState(false);

  const [queryPartyId, setQueryPartyId] = useState('');
  const [queryWith, setQueryWith] = useState();
  const [queryWithId, setQueryWithId] = useState();
  const [queryBillNumber, setQueryBillNumber] = useState('');
  const [queryMR, setQueryMR] = useState('');

  const [filteredOrders, setFilteredOrders] = useState([]);
  useEffect(() => {
    fetchOrders();
  }, []);

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

      console.log(orderList);
      setFilteredOrders(orderList);
    } catch (error) {
      console.error('Error fetchisng parties: ', error);
    }
  };

  const onSearchBill = () => {
    const ordersRef = collection(firebaseDB, 'orders');

    // Build the query dynamically based on non-empty filter fields
    let dynamicQuery = ordersRef;

    const filters = {
      partyId: queryPartyId,
      with: queryWith,
      billNumber: queryBillNumber ? `T-${queryBillNumber}` : null,
      mrId: queryMR,
    };

    console.log(filters);

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
          <PartySelector onPartySelected={(p) => setQueryPartyId(p.id)} />

          <Dropdown
            onOptionSelect={(_, e) => setQueryWith(e.optionValue)}
            className="dropdown"
            placeholder="With"
          >
            <Option
              text="Accounts"
              value="Accounts"
              key="accounts-with-dropdown"
            >
              Accounts
            </Option>
            <Option text={null} value={null} key="accounts-none-dropdown">
              None
            </Option>
            {allUsers.map((user) => (
              <Option text={user.username} value={user.uid} key={user.uid}>
                {user.username}
              </Option>
            ))}
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
            className="dropdown"
            placeholder="MR"
          >
            {allUsers.map((user) => (
              <Option text={user.username} value={user.uid} key={user.uid}>
                {user.username}
              </Option>
            ))}
          </Dropdown>
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
        <div className="all-bills-header">
          <div />
          <div>Party Name</div>
          <div>Bill No.</div>
          <div>Date</div>
          <div>With</div>
          <div>MR</div>
          <div>Amount</div>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          filteredOrders.map((sr, index) => {
            return <BillRow data={sr} index={index} />;
          })
        )}
      </div>
    </center>
  );
}

function BillRow({ data, index }) {
  const navigate = useNavigate();
  const [party, setParty] = useState();
  const [withUser, setWithUser] = useState();
  const [mrUser, setMrUser] = useState();

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

  const getMrUser = async () => {
    const user1 = await globalUtils.fetchUserById(data.mrId);
    setMrUser(user1.username);
  };
  useEffect(() => {
    getParty();
    getWithUser();
    getMrUser();
  }, []);
  return (
    <Dialog>
      <DialogTrigger>
        <div className="bill-row">
          <Text style={{ color: '#aaa' }}>{index + 1}.</Text>
          <Text>{party?.name || '--'}</Text>
          <Text>
            <b>{data.billNumber?.toUpperCase() || '--'}</b>
          </Text>
          <Text>{new Date(data.creationTime).toLocaleDateString()}</Text>
          <Text>{withUser || '--'}</Text>
          <Text>{mrUser || '--'}</Text>
          <Text>{globalUtils.getCurrencyFormat(data.orderAmount)}</Text>
        </div>
      </DialogTrigger>
      <DialogSurface>
        <BillDetailDialog
          party={party}
          withUser={withUser}
          mrUser={mrUser}
          order={data}
        />
      </DialogSurface>
    </Dialog>
  );
}
