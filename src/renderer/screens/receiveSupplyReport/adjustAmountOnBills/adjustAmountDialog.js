/* eslint-disable eqeqeq */
import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Input,
  Spinner,
  Text,
  useId,
  useToastController,
} from '@fluentui/react-components';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firebaseDB } from '../../../firebaseInit';
import globalUtils from '../../../services/globalUtils';
import './style.css';
import { showToast } from '../../../common/toaster';

function AdjustAmountDialog({
  onDone,
  orderData,
  amountToAdjust,
  setOpen,
  otherAdjustedBills,
  setOtherAdjustedBills,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [amountLeft, setAmountLeft] = useState(amountToAdjust);

  const fetchData = async () => {
    if (!orderData) return;
    setLoading(true);
    const q = query(
      collection(firebaseDB, 'orders'),
      where('balance', '>', 0), // Filter by balance greater than zero
      where('partyId', '==', orderData?.party?.id), // Filter by specific partyId
    );

    try {
      const querySnapshot = await getDocs(q);
      const ordersData = [];

      querySnapshot.forEach((doc) => {
        ordersData.push(doc.data());
      });

      ordersData.sort((o1, o2) => o2.creationTime - o1.creationTime);

      setOrders(ordersData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setAmountLeft(amountToAdjust);
  }, [orderData]);

  if (!orderData) {
    return null;
  }

  return (
    <Dialog open={orderData} setOpen={() => setOpen(null)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            Adjust Amount - {globalUtils.getCurrencyFormat(amountToAdjust)}
          </DialogTitle>
          <DialogContent>
            <div className="adjust-amount-dialog">
              <h4>
                <u>{orderData.party?.name}</u>
              </h4>
              <div>
                Amount Left - {globalUtils.getCurrencyFormat(amountLeft)}
              </div>

              {loading ? (
                <center>
                  <Spinner />
                </center>
              ) : (
                orders.map((o) => {
                  return (
                    <AdjustAmountBillRow
                      adjusted={
                        otherAdjustedBills.findIndex((f) => f.id === o.id) !==
                        -1
                      }
                      onAdjust={(amount) => {
                        const newOrder = { ...o, tempAmountAdjusted: amount };
                        setOtherAdjustedBills((b) => [...b, o]);
                        setAmountLeft((al) => al - amount);
                      }}
                      unAdjust={(amount) => {
                        console.log(`${amount} am`);
                        setOtherAdjustedBills((other) =>
                          other.filter((ot) => ot.id !== o.id),
                        );
                        setAmountLeft(
                          (al) => parseInt(al, 10) + parseInt(amount, 10),
                        );
                      }}
                      key={`adju-amount-${o.id}`}
                      bill={o}
                      amountLeft={amountLeft}
                    />
                  );
                })
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button
                onClick={() => {
                  setLoading(true);
                  setOpen();
                }}
                appearance="primary"
              >
                Done
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export default AdjustAmountDialog;

function AdjustAmountBillRow({
  bill,
  onAdjust,
  adjusted,
  unAdjust,
  amountLeft,
}) {
  const [amountToAdjust, setAmountToAdjust] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState();

  useEffect(() => {
    if (!adjusted) {
      if (amountLeft > bill.balance) {
        setAmountToAdjust(bill.balance);
      } else {
        console.log(amountLeft, amountLeft.toString());
        setAmountToAdjust(amountLeft.toString());
      }
    }
  }, [amountLeft]);

  return (
    <Card appearance="filled-alternative" style={{ marginTop: '10px' }}>
      <div className="adjust-amount-dialog-bill-row">
        <Text>
          <b>{bill.billNumber?.toUpperCase()}</b>
        </Text>
        <Text>Total: {globalUtils.getCurrencyFormat(bill.orderAmount)}</Text>
        <Text>{globalUtils.getTimeFormat(bill.creationTime, true)}</Text>
        <Text>
          <b>Bal: {globalUtils.getCurrencyFormat(bill.balance)}</b>
        </Text>
      </div>
      <div className="adjust-amount-dialog-bill-row-2">
        <Input
          disabled={adjusted}
          onChange={(t) => {
            setAmountToAdjust(t.target.value);
          }}
          value={amountToAdjust}
          size="small"
          style={{ marginRight: '10px' }}
          placeholder={globalUtils.getCurrencyFormat(bill.orderAmount)}
        />
        {adjusted ? (
          <Button
            style={{ color: '#06D6A0' }}
            onClick={() => {
              unAdjust(adjustedAmount);
              setAdjustedAmount();
            }}
          >
            Adjusted
          </Button>
        ) : (
          <Button
            style={{ color: '#F25C54' }}
            disabled={amountToAdjust > bill.balance || amountToAdjust === '0'}
            onClick={() => {
              onAdjust(amountToAdjust);
              setAdjustedAmount(amountToAdjust);
            }}
          >
            Adjust{' '}
            {amountToAdjust.length && amountToAdjust != bill.balance
              ? globalUtils.getCurrencyFormat(amountToAdjust)
              : 'Full'}
          </Button>
        )}
      </div>
    </Card>
  );
}
