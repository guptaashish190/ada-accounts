import { Button, Card, Text } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import CreatePaymentReceiptDialog from './createPaymentReceiptDialog/createPaymentReceiptDialog';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import './style.css';

export default function PaymentReceipts() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);

  const fetchCashReceipts = async () => {
    const querySnapshot = await getDocs(collection(firebaseDB, 'cashReceipts'));
    const receiptData = [];
    querySnapshot.forEach((doc) => {
      receiptData.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    setReceipts(receiptData);
  };
  useEffect(() => {
    fetchCashReceipts();
  }, []);

  return (
    <center>
      <div className="pr-list-container">
        <h3>All Cash Receipts</h3>
        {receipts.map((rc, i) => {
          return (
            <Card
              onClick={() => {
                navigate('/createPaymentReceipts', {
                  state: { ...rc, view: true },
                });
              }}
              className="pr-receipt-row"
            >
              <Text className="pr-id">
                {i + 1}. {rc.cashReceiptNumber}
              </Text>
              <Text className="timestamp">
                {globalUtils.getTimeFormat(rc.timestamp)}
              </Text>
            </Card>
          );
        })}
      </div>
    </center>
  );
}
