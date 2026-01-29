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
  Text,
} from '@fluentui/react-components';

import {
  query,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  where,
  or,
} from 'firebase/firestore';
import shortid from 'shortid';
import globalUtils from '../../services/globalUtils';
import constants from '../../constants';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';

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

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();

  useEffect(() => {
    if (!open) {
      focusFirstElement();
    }
  }, [open]);

  const getDispatchableBills = async () => {
    const ordersRef = getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS);
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
            appearance="primary"
            style={{ 
              width: '180px',
              borderRadius: '8px',
              fontWeight: '500'
            }}
          >
            + Add Bill
          </Button>
        </DialogTrigger>
        <DialogSurface style={{ maxWidth: '800px', width: '90vw' }}>
          <DialogBody>
            <DialogTitle style={{ fontSize: '1.2em', fontWeight: '600' }}>
              Select Dispatch Ready Bills
            </DialogTitle>
            <DialogContent style={{ padding: '16px 0' }}>
              <div className="search-container">
                <Input
                  size="large"
                  placeholder="Search by party name..."
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
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #e1e5e9'
                  }}
                />
              </div>

              <div className="orders-list">
                {showOrderList.length === 0 ? (
                  <div className="no-orders">
                    <Text size={300} style={{ color: '#666' }}>
                      {searchPartyName ? 'No orders found matching your search' : 'No dispatch ready orders available'}
                    </Text>
                  </div>
                ) : (
                  showOrderList.map((order) => {
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
                  })
                )}
              </div>
            </DialogContent>
            <DialogActions style={{ padding: '16px 0 0 0' }}>
              <DialogTrigger disableButtonEnhancement>
                <Button 
                  appearance="secondary" 
                  onClick={() => setOpen(false)}
                  style={{ borderRadius: '6px' }}
                >
                  Cancel
                </Button>
              </DialogTrigger>
              <DialogTrigger>
                <Button
                  appearance="primary"
                  onClick={() => {
                    setOpen(false);
                  }}
                  style={{ borderRadius: '6px' }}
                >
                  Done
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
      <div className="order-info">
        <div className="order-header">
          <Text size={400} weight="semibold" className="party-name">
            {order.party?.name}
          </Text>
          <Text size={200} className="file-number">
            {order.fileNumber}
          </Text>
        </div>
        <div className="order-details">
          <Text size={200} className="challan-number">
            {order.challanNumber?.toUpperCase()}
          </Text>
          <Text size={200} className="bill-number">
            {order.billNumber?.toUpperCase()}
          </Text>
          <Text size={200} className="order-time">
            {globalUtils.getTimeFormat(order.creationTime, true)}
          </Text>
        </div>
        <div className="order-status">
          <Text size={200} className="status-badge">
            {order.orderStatus}
          </Text>
        </div>
      </div>
      <div className="order-amount">
        <Text size={400} weight="semibold">
          ₹{order.orderAmount}
        </Text>
      </div>
      <Button
        appearance={isSelected ? "primary" : "secondary"}
        onClick={() => onAddToggle()}
        size="small"
        style={{
          borderRadius: '6px',
          minWidth: '80px',
          fontWeight: '500'
        }}
      >
        {isSelected ? 'Remove' : 'Add'}
      </Button>
    </div>
  );
}
