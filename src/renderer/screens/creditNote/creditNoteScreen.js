import { collection, getDocs, orderBy, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Card,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  th,
  TableRow,
  Text,
  Tooltip,
} from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import './style.css';

export default function CreditNoteScreen() {
  const [creditNotes, setCreditNotes] = useState([]);

  const [loading, setLoading] = useState(false);
  const fetchCNs = async () => {
    try {
      setLoading(true);
      const cnCollRef = collection(firebaseDB, 'creditNotes');
      const cnColl = await getDocs(cnCollRef, orderBy('timestamp', 'desc'));

      const cnData = cnColl.docs.map((doc) => doc.data());
      const cnWithParties = await globalUtils.fetchPartyInfoForOrders(cnData);

      setCreditNotes(cnWithParties);
      setLoading(false);
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCNs();
  }, []);
  if (loading) return <Spinner />;

  return (
    <center>
      <h3>Credit Notes</h3>

      <table>
        <thead>
          <tr>
            <th>CN No.</th>
            <th>Party Name</th>
            <th>Amount</th>
            <th>Remarks</th>
            <th>Created On</th>
          </tr>
        </thead>
        <tbody>
          {creditNotes.map((cn, i) => (
            <CnTableRow
              key={`credit-notes-${cn.receiptNumber}`}
              data={cn}
              index={i}
            />
          ))}
        </tbody>
      </table>
    </center>
  );
}

function CnTableRow({ data, index }) {
  return (
    <tr>
      <TableCustomCell>{data.receiptNumber}</TableCustomCell>
      <TableCustomCell>{data.party?.name}</TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(data.amount)}
      </TableCustomCell>
      <TableCustomCell>{data.remarks}</TableCustomCell>
      <TableCustomCell>
        {globalUtils.getTimeFormat(data.timestamp, true)}
      </TableCustomCell>
    </tr>
  );
}

function TableCustomCell({ children }) {
  return (
    <Tooltip content={children}>
      <td>{children || '--'}</td>
    </Tooltip>
  );
}
