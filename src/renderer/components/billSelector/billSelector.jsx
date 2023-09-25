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
} from 'firebase/firestore';
import shortid from 'shortid';
import firebaseApp, { firebaseDB } from '../../firebaseInit';

export default function BillSelector({ onBillsAdded }) {
  const [ordersList, setOrdersList] = useState([]);
  const [showOrderList, setShowOrderList] = useState([]);
  const [searchPartyName, setSearchPartyName] = useState('');
  const [addedBills, setAddedBills] = useState([]);

  const fetchPartyInfoForOrders = async (orders) => {
    try {
      const updatedOrders = await Promise.all(
        orders.map(async (order) => {
          const partyRef = doc(firebaseDB, 'parties', order.data().partyId); // Replace 'parties' with your collection name

          const partySnapshot = await getDoc(partyRef);

          if (partySnapshot.exists()) {
            const partyData = partySnapshot.data();
            // Replace the partyId with the party object
            return { ...order.data(), party: partyData };
          }
          // If the party document doesn't exist, you can handle this case as needed.
          // For example, you can return the order as is or mark it as an invalid order.
          return order;
        }),
      );

      return updatedOrders;
    } catch (error) {
      console.error('Error fetching party information:', error);
      return orders; // Return the original list of orders if there's an 6aerror
    }
  };
  const getDispatchableBills = async () => {
    const ordersRef = collection(firebaseDB, 'orders');

    const unsubscribe = onSnapshot(ordersRef, async (snapshot) => {
      const allOrders = await fetchPartyInfoForOrders(snapshot.docs);
      setOrdersList(allOrders);
      setShowOrderList(allOrders);
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
    getDispatchableBills();
  }, []);
  return (
    <div className="bill-selector">
      <Dialog>
        <DialogTrigger disableButtonEnhancement>
          <Button size="large" style={{ width: '200px' }}>
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
                onChange={(t) => {
                  setSearchPartyName(t.target.value);
                }}
              />

              <br />
              <br />
              {showOrderList.map((order) => {
                return (
                  <OrderRow
                    isSelected={
                      addedBills.findIndex((x) => x.id === order.id) !== -1
                    }
                    onAddToggle={() => {
                      const { id } = order;

                      // Check if an object with the same id already exists in the list
                      const existingIndex = addedBills.findIndex(
                        (item) => item.id === id,
                      );

                      if (existingIndex !== -1) {
                        // If the object with the same id exists, remove it from the list
                        setAddedBills([
                          ...addedBills.slice(0, existingIndex),
                          ...addedBills.slice(existingIndex + 1),
                        ]);
                      } else {
                        // If the object with the same id doesn't exist, add it to the list
                        setAddedBills([...addedBills, order]);
                      }
                    }}
                    order={order}
                  />
                );
              })}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Close</Button>
              </DialogTrigger>
              <DialogTrigger>
                <Button
                  appearance="primary"
                  onClick={() => onBillsAdded(addedBills)}
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
      <div className="bill-number">{order.billNumber.toUpperCase()}</div>
      <div className="bill-name">
        {order.party.name} {order.fileNumber}
      </div>
      <div className="bill-amount">₹{order.orderAmount}</div>
      <Button
        type="button"
        onKeyDown={() => onAddToggle()}
        onClick={() => onAddToggle()}
        style={{
          backgroundColor: isSelected ? '#F25C54aa' : '#06D6A0aa',
          border: 'none',
        }}
      >
        {isSelected ? 'Remove' : 'Add'}
      </Button>
    </div>
  );
}
