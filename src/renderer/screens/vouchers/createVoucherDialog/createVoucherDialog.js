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

export default function CreateVoucherDialog({ open, setOpen, inputsEnabled }) {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const toasterId = useId('toaster');

  const { dispatchToast } = useToastController(toasterId);
  const [currentReceiptNumber, setCurrentReceiptNumber] = useState();

  const { allUsers } = useAuthUser();

  const getCurrentReceiptNumber = async () => {
    try {
      const newRN = await globalUtils.getNewReceiptNumber(
        constants.newReceiptCounters.CASHRECEIPTS,
      );
      setCurrentReceiptNumber(newRN);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    getCurrentReceiptNumber();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  return (
    <Dialog>
      <DialogTrigger>
        <Button>Create Voucher</Button>
      </DialogTrigger>

      <Toaster toasterId={toasterId} />

      <center>
        <div className="create-payment-receipt-container">
          {state?.view ? (
            <h3>Voucher: {state?.cashReceiptNumber}</h3>
          ) : (
            <h3>Voucher - {currentReceiptNumber}</h3>
          )}
        </div>
      </center>
    </Dialog>
  );
}
