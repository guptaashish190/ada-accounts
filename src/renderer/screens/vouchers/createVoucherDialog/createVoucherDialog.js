/* eslint-disable no-alert */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
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
  Image,
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
import { Delete12Filled } from '@fluentui/react-icons';
import { getAuth } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { File } from 'buffer';
import firebaseApp, {
  firebaseDB,
  firebaseStorage,
} from '../../../firebaseInit';
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
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const toasterId = useId('toaster');

  const { dispatchToast } = useToastController(toasterId);
  const [currentReceiptNumber, setCurrentReceiptNumber] = useState();

  const { allUsers } = useAuthUser();

  const uploadImages = async () => {
    try {
      const imageUrls = [];
      const time = Timestamp.now().toMillis();
      let i = 0;
      const user1 = allUsers.find((x) => x.uid === user);
      if (selectedFiles.length > 0) {
        // Create a reference to 'images/mountains.jpg'
        const uRef = ref(
          firebaseStorage,
          `vouchers/${user1.username}-${time}-${i}'`,
        );

        const uploadedImage = await uploadBytes(uRef, selectedFiles[i]);
        const url = await getDownloadURL(uploadedImage.ref);
        imageUrls.push(url);
        i += 1;
      }
      return imageUrls;
    } catch (e) {
      console.log(e);
    }

    return [];
  };

  const createVoucher = async () => {
    if (
      type == null ||
      user == null ||
      amount <= 0 ||
      narration.length === 0 ||
      selectedFiles.length === 0
    ) {
      window.alert('Enter all the details.');
      return;
    }

    setLoading(true);
    const images = await uploadImages();
    const voucherRef = collection(firebaseDB, 'vouchers');

    const newEntryNumber = await globalUtils.getNewReceiptNumber(
      constants.newReceiptCounters.VOUCHERS,
    );
    addDoc(voucherRef, {
      type,
      employeeId: user,
      receiptNumber: newEntryNumber,
      narration,
      amount: parseInt(amount, 10),
      images,
      requesterId: getAuth(firebaseApp).currentUser.uid,
      timestamp: Timestamp.now().toMillis(),
    });
    globalUtils.incrementReceiptCounter(constants.newReceiptCounters.VOUCHERS);
    setLoading(false);
    setOpen(false);
    setSelectedFiles([]);
    setUser();
    setAmount();
    setNarration();
  };

  const openFileDialog = async () => {
    window.electron.ipcRenderer.sendMessage('open-file-dialog');
    window.electron.ipcRenderer.once('selected-files', (files) => {
      setSelectedFiles((x) => [...x, ...files]);
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
            <br />
            <br />
            <input
              type="file"
              multiple
              onChange={(e) => {
                setSelectedFiles((x) => [...x, ...Array.from(e.target.files)]);
              }}
            />
            {/* <Button onClick={() => openFileDialog()}>Add Receipt Files</Button> */}
            <br />
            <br />
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              {selectedFiles.map((x) => (
                <div className="voucher-image">
                  <div
                    onClick={() =>
                      setSelectedFiles((y) => y.filter((z) => z !== x))
                    }
                    className="voucher-image-delete"
                  >
                    <Delete12Filled />
                  </div>
                  <Image
                    className="voucher-selected-files"
                    style={{ width: '100px' }}
                    src={`file://${x.path}`}
                  />
                </div>
              ))}
            </div>
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
  'Petrol',
  'Parking',
  'Refreshment',
  'Office Expense',
  'Travelling Expense',
  'Repair and Maintenance',
  'Frieght Inward',
  'Frieght Outward',
  'Vehicle Repair',
  'Other',
];
