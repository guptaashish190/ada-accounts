/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable no-unreachable */
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Card,
  Text,
  Table,
  TableHeader,
  TableRow,
  th,
  TableBody,
  TableCellLayout,
  TableCell,
  Input,
  useToastController,
  useId,
  Toaster,
  Spinner,
  Dropdown,
  Option,
  Textarea,
} from '@fluentui/react-components';
import {
  Timestamp,
  addDoc,
  collection,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import firebaseApp, { firebaseDB } from '../../../firebaseInit';
import PartySelector from '../../../common/partySelector';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import './style.css';
import { showToast } from '../../../common/toaster';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';
import { useAuthUser } from '../../../contexts/allUsersContext';
import cashReceiptFormatGenerator from '../../../common/printerDataGenerator/cashReceiptFormatGenerator';

export default function CreateVoucherDialog({ inputsEnabled }) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState();
  const [user, setUser] = useState();
  const [amount, setAmount] = useState();
  const [narration, setNarration] = useState('');

  const [loading, setLoading] = useState(false);
  const toasterId = useId('toaster');

  const { dispatchToast } = useToastController(toasterId);
  const [currentReceiptNumber, setCurrentReceiptNumber] = useState();

  const { allUsers } = useAuthUser();

  const createVoucher = () => {
    if (type == null || user == null || amount <= 0 || narration.length === 0) {
      window.alert('Enter all the details.');
    }

    console.log({
      type,
      employeeId: user,
      narration,
      amount,
    });

    return;
    const voucherRef = collection(firebaseDB, 'vouchers');

    addDoc(voucherRef, {
      type,
      employeeId: user,
      narration,
      amount,
      timestamp: new Date().getTime(),
    });
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <Dialog open={open}>
      <DialogTrigger>
        <Button onClick={() => setOpen(true)}>Create Voucher</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogTitle>Create Voucher</DialogTitle>
        <DialogContent>
          <br />
          <div className="create-payment-receipt-container">
            <Dropdown
              style={{ width: '60%' }}
              onOptionSelect={(_, e) => setUser(e.optionValue)}
              className="dropdown filter-input"
              placeholder="User"
            >
              {allUsers.map((user1) => (
                <Option
                  text={user1.username}
                  value={user1.uid}
                  key={`allbills-filter-user-${user1.uid}`}
                >
                  {user1.username}
                </Option>
              ))}
            </Dropdown>
            <br />
            <br />
            <Dropdown
              style={{ width: '60%' }}
              onOptionSelect={(_, e) => setType(e.optionValue)}
              className="dropdown filter-input"
              placeholder="Type"
            >
              {TYPES.map((type1) => (
                <Option text={type1} value={type1} key={`vouchers-${type1}`}>
                  {type1}
                </Option>
              ))}
            </Dropdown>
            <br /> <br />
            <Input
              onChange={(e) => setAmount(e.target.value)}
              contentBefore="₹"
              type="number"
              style={{ width: '60%' }}
              placeholder="Amount"
            />{' '}
            <br /> <br />
            <Textarea
              onChange={(e) => setNarration(e.target.value)}
              style={{ width: '60%' }}
              placeholder="Narration"
            />{' '}
            <br /> <br />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => createVoucher()}>Create</Button>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
const TYPES = [
  'Office Expense',
  'Frieght Inward',
  'Frieght Outward',
  'Parking',
  'Petrol',
  'Vehicle Repair',
  'Refreshment',
  'Other',
];
