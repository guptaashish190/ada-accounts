/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable no-restricted-syntax */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import {
  Button,
  Dialog,
  DialogSurface,
  DialogTrigger,
  Spinner,
} from '@fluentui/react-components';
import { firebaseDB } from '../../../../firebaseInit';
import './style.css';
import BillDetailDialog from '../../../allBills/billDetail/billDetail';
import globalUtils from '../../../../services/globalUtils';
import { VerticalSpace1 } from '../../../../common/verticalSpace';
import EditPartyDetails from './editParty';

export default function PartyDetailsScreen() {
  const { state } = useLocation();
  const [party, setParty] = useState();
  const [loading, setLoading] = useState();
  const [outstandingBills, setOutstandingBills] = useState();

  const { partyId } = state;

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const supplyReportRef = doc(firebaseDB, 'parties', partyId);
      const docSnapshot = await getDoc(supplyReportRef);
      if (docSnapshot.exists()) {
        setParty(docSnapshot.data());
      } else {
        console.log('Document not found.');
      }
      await fetchOutstanding();
      setLoading(false);
    } catch (error) {
      console.error('Error fetching document:', error);
      setLoading(false);
    }
  };
  const fetchOutstanding = async () => {
    try {
      const ordersCollection = collection(firebaseDB, 'orders');
      const q = query(
        ordersCollection,
        where('partyId', '==', partyId),
        where('balance', '!=', 0),
      );

      const querySnapshot = await getDocs(q);
      console.log(querySnapshot.size);
      const ordersData = [];
      for await (const doc1 of querySnapshot.docs) {
        const orderData = doc1.data();
        ordersData.push(orderData);
      }
      const sortedData = ordersData.sort(
        (s1, s2) => s2.creationTime - s1.creationTime,
      );
      setOutstandingBills(sortedData);
    } catch (error) {
      console.error('Error fetching orders: ', error);
    }
  };
  useEffect(() => {
    fetchDocument();
  }, []);

  const getOutstandigBalance = () => {
    if (!outstandingBills || !outstandingBills.length) return '--';
    const amount = outstandingBills?.reduce(
      (acc, cur) => acc + parseInt(cur.balance, 10),
      0,
    );
    return globalUtils.getCurrencyFormat(amount);
  };

  const getOutstandigAmount = () => {
    if (!outstandingBills || !outstandingBills.length) return '--';
    const amount = outstandingBills?.reduce(
      (acc, cur) => acc + parseInt(cur.orderAmount, 10),
      0,
    );
    return globalUtils.getCurrencyFormat(amount);
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <center>
      <div className="party-detail-screen">
        <h3>
          {party?.name}

          {party ? (
            <EditPartyDetails
              refreshParty={() => fetchDocument()}
              party={party}
            />
          ) : null}
        </h3>
        <div className="vsrc-detail-items-container">
          <div className="vsrc-detail-items">
            <div className="label">Area: </div>
            <div className="value">{party?.area}</div>
          </div>
          <div className="vsrc-detail-items">
            <div className="label">License: </div>
            <div className="value">{party?.licence}</div>
          </div>

          <div className="vsrc-detail-items">
            <div className="label">Address: </div>
            <div className="value">
              {`${party?.addressline1},${party?.addressline2}`}
            </div>
          </div>
          <div className="vsrc-detail-items">
            <div className="label">Mobile: </div>
            <div className="value">{party?.mobile}</div>
          </div>
        </div>
        <VerticalSpace1 />
        <h3>Outstanding</h3>
        <table className="all-bills-header">
          <tr>
            <th>Bill No.</th>
            <th>Date</th>
            <th>With</th>
            <th>MR</th>
            <th>Amount</th>
            <th>Balance</th>
            <th>Days</th>
          </tr>
          {loading ? (
            <Spinner />
          ) : (
            outstandingBills?.map((sr, index) => {
              return <BillRow data={sr} index={index} />;
            })
          )}

          <tr>
            <td />
            <td />
            <td />
            <td />
            <td>
              {' '}
              <b>{getOutstandigAmount()}</b>
            </td>
            <td>
              <b>{getOutstandigBalance()}</b>
            </td>
            <td />
          </tr>
        </table>
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
    if (!data.mrId) return;
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
        <tr className="bill-row">
          <td>
            <b>{data.billNumber?.toUpperCase() || '--'}</b>
          </td>
          <td>{new Date(data.creationTime).toLocaleDateString()}</td>
          <td>{withUser || '--'}</td>
          <td>{mrUser || '--'}</td>
          <td>{globalUtils.getCurrencyFormat(data.orderAmount)}</td>
          <td>{globalUtils.getCurrencyFormat(data.balance)}</td>
          <td>{globalUtils.getDaysPassed(data.creationTime)}</td>
        </tr>
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
