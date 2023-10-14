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
  Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tooltip,
} from '@fluentui/react-components';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import React, { useEffect, useState } from 'react';
import PartySelector from '../../common/partySelector';
import './style.css';
import { VerticalSpace1 } from '../../common/verticalSpace';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';

export default function ChequesScreen() {
  const [chequeList, setChequeList] = useState([]);

  useEffect(() => {
    const fetchCheques = async () => {
      const chequeCollection = collection(firebaseDB, 'cheques');

      try {
        const qs = query(
          chequeCollection,
          orderBy('entryNumber', 'desc'),
          limit(10),
        );
        const querySnapshot = await getDocs(qs);
        const chequesData = [];

        querySnapshot.forEach((doc) => {
          chequesData.push(doc.data());
        });

        const newData = await globalUtils.fetchPartyInfoForOrders(chequesData);
        setChequeList(newData);
      } catch (error) {
        console.error('Error fetching documents: ', error);
      }
    };

    fetchCheques();
  }, []);
  return (
    <div className="cheques-screen">
      <center>
        <h3>Cheques</h3>
        <ChequeEntryDialog />
        <VerticalSpace1 />
        <Table size="extra-small" className="cheques-table">
          <TableHeader className="table-header-container">
            <TableRow>
              <TableHeaderCell>Entry No.</TableHeaderCell>
              <TableHeaderCell>Party Name</TableHeaderCell>
              <TableHeaderCell>Cheque Number</TableHeaderCell>
              <TableHeaderCell>Cheque Date</TableHeaderCell>
              <TableHeaderCell>Amount</TableHeaderCell>
              <TableHeaderCell>Notes</TableHeaderCell>
              <TableHeaderCell>Received On</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chequeList.map((ch, i) => {
              return <ChequeTableRow data={ch} index={i} />;
            })}
          </TableBody>
        </Table>
      </center>
    </div>
  );
}

function ChequeTableRow({ data, index }) {
  return (
    <TableRow className="cheque-data-row">
      <TableCustomCell>
        <b>{data.entryNumber}</b>
      </TableCustomCell>
      <TableCustomCell>{data.party.name}</TableCustomCell>
      <TableCustomCell>{data.chequeNumber}</TableCustomCell>
      <TableCustomCell>
        {globalUtils.getTimeFormat(data.chequeDate, true)}
      </TableCustomCell>
      <TableCustomCell>
        {globalUtils.getCurrencyFormat(data.amount)}
      </TableCustomCell>
      <TableCustomCell>{data.notes}</TableCustomCell>
      <TableCustomCell>
        {globalUtils.getTimeFormat(data.timestamp, true)}
      </TableCustomCell>
    </TableRow>
  );
}

function TableCustomCell({ children }) {
  return (
    <Tooltip content={children}>
      <TableCell className="cheque-table-cell">
        <TableCellLayout>{children}</TableCellLayout>
      </TableCell>
    </Tooltip>
  );
}

function ChequeEntryDialog() {
  const [showChequeEntryDialog, setShowChequeEntryDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState();
  const [party, setParty] = useState();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddCheque = async () => {
    if (!chequeNumber.length || !chequeDate || !party || !amount.length) {
      // eslint-disable-next-line no-alert
      alert('Enter all fields');
      return;
    }
    setLoading(true);
    const chequeCollection = collection(firebaseDB, 'cheques');

    try {
      const newEntryNumber = await globalUtils.getNewChequeEntryNumber();
      await addDoc(chequeCollection, {
        chequeNumber,
        partyId: party.id,
        amount,
        notes,
        chequeDate: chequeDate.getTime(),
        timestamp: new Date().getTime(),
        entryNumber: newEntryNumber,
      });
      setShowChequeEntryDialog(false);
      setLoading(false);
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert('error adding cheque entry');
      console.error('Error adding document: ', error);
      setLoading(false);
    }
  };
  return (
    <Dialog open={showChequeEntryDialog}>
      <DialogTrigger disableButtonEnhancement>
        <Button onClick={() => setShowChequeEntryDialog(true)}>
          Cheque Entry
        </Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogContent className="cheque-entry-dailog">
            {loading ? <Spinner /> : null}
            <Label>Cheque Number</Label>
            <Input
              type="number"
              value={chequeNumber}
              onChange={(e) => setChequeNumber(e.target.value)}
              placeholder="Cheque Number"
            />
            <VerticalSpace1 />

            <Label>Cheque Date</Label>
            <DatePicker
              onSelectDate={setChequeDate}
              value={chequeDate}
              onChange={(e) => setChequeNumber(e.target.value)}
              placeholder="Cheque Date"
            />
            <VerticalSpace1 />

            <Label>Select Party</Label>
            <PartySelector onPartySelected={(p) => setParty(p)} />
            <VerticalSpace1 />

            <Label>Amount</Label>
            <Input
              type="number"
              contentBefore="₹"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
            />
            <VerticalSpace1 />

            <Label>Notes (Adjusted Bills)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
            />
            <VerticalSpace1 />
            <VerticalSpace1 />
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="secondary"
                onClick={() => setShowChequeEntryDialog(false)}
              >
                Close
              </Button>
            </DialogTrigger>
            <Button onClick={() => handleAddCheque()} appearance="primary">
              Create Cheque Entry
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
