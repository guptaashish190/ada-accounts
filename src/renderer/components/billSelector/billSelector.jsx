/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useEffect, useState } from 'react';
import './style.css';

import {
  Button,
  Field,
  Input,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
} from '@fluentui/react-components';

import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  where,
  or,
} from 'firebase/firestore';
import shortid from 'shortid';
import firebaseApp, { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import constants from '../../constants';

export default function BillSelector({
  bills,
  onAdd,
  onRemove,
  focusFirstElement,
}) {
  const [ordersList, setOrdersList] = useState([]);
  const [open, setOpen] = useState(false);
  const [showOrderList, setShowOrderList] = useState([]);
  const [searchPartyName, setSearchPartyName] = useState('');

  useEffect(() => {
    if (!open) {
      focusFirstElement();
    }
  }, [open]);

  const getDispatchableBills = async () => {
    const ordersRef = collection(firebaseDB, 'orders');
    const q = query(
      ordersRef,
      or(
        where(
          'orderStatus',
          '==',
          constants.firebase.billFlowTypes.ORDER_PACKED,
        ),
        where(
          'orderStatus',
          '==',
          constants.firebase.billFlowTypes.GOODS_RETURNED,
        ),
        where(
          'orderStatus',
          '==',
          constants.firebase.billFlowTypes.SUPPLY_REPORT_CANCELLED,
        ),
        where('orderStatus', '==', constants.firebase.billFlowTypes.MARG_DATA),
      ),
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const snapshotDocData = snapshot.docs.map((sn) => ({
        ...sn.data(),
        id: sn.id,
      }));
      const allOrders =
        await globalUtils.fetchPartyInfoForOrders(snapshotDocData);
      allOrders.sort((a, b) =>
        a.orderStatus === constants.firebase.billFlowTypes.MARG_DATA ? 1 : -1,
      );
      setOrdersList(allOrders.filter((x) => x.type !== 'R'));
      setShowOrderList(allOrders.filter((x) => x.type !== 'R'));
    });

    return () => {
      unsubscribe();
    };
  };

  useEffect(() => {
    if (searchPartyName?.length === 0) {
      setShowOrderList(ordersList);
    } else {
      const newOrderList = ordersList.filter((order) =>
        order.party.name.includes(searchPartyName.toUpperCase()),
      );
      setShowOrderList(newOrderList);
    }
  }, [searchPartyName]);

  useState(() => {
    const unsubscribe = getDispatchableBills();
    return () => {
      unsubscribe();
    };
  }, []);
  return (
    <div
      className="bill-selector"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
        }
      }}
    >
      <Dialog open={open}>
        <DialogTrigger disableButtonEnhancement>
          <Button
            onClick={() => {
              setOpen(true);
            }}
            size="large"
            style={{ width: '200px' }}
          >
            Add Bill
          </Button>
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Dispatch Ready Bills</DialogTitle>
            <DialogContent>
              <br />
              <Input
                size="large"
                placeholder="Party name"
                value={searchPartyName}
                onKeyDown={(event) => {
                  if (event.key === 'Shift') {
                    setOpen(false);
                  }
                  if (event.key === 'Enter') {
                    if (showOrderList.length === 1) {
                      const order1 = showOrderList[0];
                      if (bills.findIndex((x) => x.id === order1.id) === -1) {
                        onAdd(order1);
                      }
                    }
                    setSearchPartyName('');
                  }
                }}
                onChange={(t) => {
                  setSearchPartyName(t.target.value);
                }}
              />

              <br />
              <br />
              {showOrderList.map((order) => {
                return (
                  <OrderRow
                    key={`bill-select-id-${order.id}`}
                    isSelected={
                      bills.findIndex((x) => x.id === order.id) !== -1
                    }
                    onAddToggle={() => {
                      const { id } = order;

                      // Check if an object with the same id already exists in the list
                      const existingIndex = bills.findIndex(
                        (item) => item.id === id,
                      );

                      if (existingIndex !== -1) {
                        // If the object with the same id exists, remove it from the list

                        onRemove(order);
                      } else {
                        // If the object with the same id doesn't exist, add it to the list
                        onAdd(order);
                      }
                    }}
                    order={order}
                  />
                );
              })}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </DialogTrigger>
              <DialogTrigger>
                <Button
                  appearance="primary"
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  Add
                </Button>
              </DialogTrigger>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function OrderRow({ order, onAddToggle, isSelected }) {
  const [party, setParty] = useState(null);
  const [loading, setLoading] = useState();

  return (
    <div
      key={shortid.generate()}
      className={`order-row ${isSelected ? 'is-selected' : ''}`}
    >
      <div className="bill-number">
        {order.challanNumber?.toUpperCase()}
        <br />
        {order.billNumber?.toUpperCase()}
      </div>
      <div className="bill-name">
        <div>
          {order.party?.name} {order.fileNumber}
          {globalUtils.getTimeFormat(order.creationTime)}
        </div>
        <span className="bill-number" style={{ fontSize: '0.8em' }}>
          {' '}
          {order.orderStatus}
        </span>
      </div>
      <div className="bill-amount">₹{order.orderAmount}</div>
      <Button
        appearance="secondary"
        onClick={() => onAddToggle()}
        style={{
          backgroundColor: isSelected ? '#F25C5466' : null,
          color: 'black',
          border: isSelected ? '1px solid #F25C5477' : '1px solid #ddd',
        }}
      >
        {isSelected ? 'Remove' : 'Add'}
      </Button>
    </div>
  );
}
