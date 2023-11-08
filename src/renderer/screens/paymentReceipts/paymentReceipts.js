import { Button, Card, Text } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import CreatePaymentReceiptDialog from './createPaymentReceiptDialog/createPaymentReceiptDialog';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import './style.css';
import { VerticalSpace1 } from '../../common/verticalSpace';
import { useAuthUser } from '../../contexts/allUsersContext';

export default function PaymentReceipts() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);

  const fetchCashReceipts = async () => {
    const crColl = collection(firebaseDB, 'cashReceipts');
    const crQuery = query(crColl, limit(50));
    const querySnapshot = await getDocs(crQuery);
    const receiptData = [];
    querySnapshot.forEach((doc) => {
      receiptData.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    receiptData.sort((x, y) => y.timestamp - x.timestamp);
    setReceipts(receiptData);
  };

  const { allUsers } = useAuthUser();
  useEffect(() => {
    fetchCashReceipts();
  }, []);

  return (
    <center>
      <div className="pr-list-container">
        <h3>All Cash Receipts</h3>
        <Button
          onClick={() => {
            navigate('/createPaymentReceipts');
          }}
        >
          Create
        </Button>
        <VerticalSpace1 />
        <table>
          <tr>
            <th>Receipt</th>
            <th>Date</th>
            <th>Username</th>
            <th>Parties</th>
          </tr>
          {receipts.map((rc, i) => {
            return (
              <tr
                key={`receipt-list-${rc.cashReceiptNumber}`}
                onClick={() => {
                  navigate('/createPaymentReceipts', {
                    state: { ...rc, view: true },
                  });
                }}
                className="pr-receipt-row"
              >
                <td className="pr-id">
                  {i + 1}. {rc.cashReceiptNumber}
                </td>
                <td className="timestamp">
                  {globalUtils.getTimeFormat(rc.timestamp, true)}
                </td>
                <td className="username">
                  {
                    allUsers.find((x) => x.uid === rc?.paymentFromUserId)
                      ?.username
                  }
                </td>
                <td className="username">{rc.prItems.length}</td>
              </tr>
            );
          })}
        </table>
      </div>
    </center>
  );
}
