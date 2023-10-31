import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  Input,
  Spinner,
  Text,
  Toaster,
  useId,
  useToastController,
} from '@fluentui/react-components';
import { Delete20Regular } from '@fluentui/react-icons';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import SupplementaryBillDialog from '../../verifySupplyReport/supplementaryBillDialog/supplementaryBillDialog';
import globalUtils from '../../../services/globalUtils';
import './style.css';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import { firebaseDB } from '../../../firebaseInit';
import { showToast } from '../../../common/toaster';
import constants from '../../../constants';

export default function CreateCreditNoteScreen() {
  const [bill, setBill] = useState();
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const onCreate = async () => {
    if (!amount || !amount.length) {
      showToast(dispatchToast, 'Enter Amount', 'error');
      return;
    }
    try {
      const newReciptNumber = await globalUtils.getNewReceiptNumber(
        constants.newReceiptCounters.CREDITNOTE,
      );
      setCreatingLoading(true);
      const cnCollRef = collection(firebaseDB, 'creditNotes');
      addDoc(cnCollRef, {
        timestamp: new Date().getTime(),
        amount,
        remarks,
        partyId: bill.partyId,
        createdBy: getAuth().currentUser.uid,
        receiptNumber: newReciptNumber,
      });

      const orderRef = doc(firebaseDB, 'orders', bill.id);

      updateDoc(orderRef, {
        balance: (bill.balance || 0) - amount,
      });
      await globalUtils.incrementReceiptCounter(
        constants.newReceiptCounters.CREDITNOTE,
      );

      showToast(
        dispatchToast,
        'Credit Note Created (Balance Adjusted)',
        'success',
      );
      setAmount('');
      setBill();
      setRemarks('');

      setCreatingLoading(false);
    } catch (e) {
      // eslint-disable-next-line no-alert
      showToast(dispatchToast, 'Error creating CN', 'error');
      console.log(e);
      setCreatingLoading(false);
    }
  };

  return (
    <>
      <Toaster toasterId={toasterId} />
      <center>
        <div className="create-cn-screen">
          <h3>Create Credit Note</h3>
          <AddBillDialog
            bills={bill ? [bill] : []}
            onAddBill={(sb) => {
              setBill(sb);
            }}
          />
          <VerticalSpace2 />

          {bill ? (
            <BillRow
              onRemove={() => {
                setBill();
              }}
              bill={bill}
              amount={amount}
              setAmount={(val) => setAmount(val)}
              remark={remarks}
              setRemark={(val) => setRemarks(val)}
            />
          ) : null}

          <VerticalSpace2 />
          <Button
            disabled={creatingLoading}
            size="large"
            onClick={() => onCreate()}
            appearance="primary"
          >
            {creatingLoading ? <Spinner /> : 'Create C/N'}
          </Button>
        </div>
      </center>
    </>
  );
}

function BillRow({ bill, onRemove, setAmount, amount, remark, setRemark }) {
  const [party, setParty] = useState();

  const getParty = async () => {
    const party1 = await globalUtils.fetchPartyInfo(bill.partyId);
    setParty(party1);
  };

  useEffect(() => {
    getParty();
  }, []);
  return (
    <Card className="cn-bill-row">
      <Text size={600}>
        <b>
          {party?.name}
          <Delete20Regular color="red" onClick={() => onRemove()} />
        </b>
      </Text>
      <Text size={400}> &nbsp; Bill Number: {bill?.billNumber}</Text>

      <Text size={400}>
        &nbsp; Bill Amount: {globalUtils.getCurrencyFormat(bill.orderAmount)}
      </Text>

      <Text size={400}>
        <b>Balance: {globalUtils.getCurrencyFormat(bill.balance)}</b>
      </Text>

      <Input
        value={amount}
        onChange={(x) => setAmount(x.target.value)}
        placeholder="Amount"
        type="number"
        appearance="subtle"
        contentBefore="₹"
      />
      <Input
        value={remark}
        onChange={(x) => setRemark(x.target.value)}
        placeholder="Remark"
        appearance="subtle"
      />
    </Card>
  );
}

function AddBillDialog({ onAddBill, bills }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Bill</Button>
      <Dialog open={open}>
        <DialogSurface>
          <DialogBody>
            <DialogContent>
              <SupplementaryBillDialog
                currentBills={bills}
                addSupplementaryBill={onAddBill}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setOpen(false);
                }}
                appearance="secondary"
              >
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
