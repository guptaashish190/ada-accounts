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
} from '@fluentui/react-components';
import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { firebaseDB } from '../../../firebaseInit';
import PartySelector from '../../../common/partySelector';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import './style.css';
import { showToast } from '../../../common/toaster';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';

export default function CreatePaymentReceiptDialog({
  open,
  setOpen,
  inputsEnabled,
}) {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [prItems, setPrItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const toasterId = useId('toaster');
  const [editable, setEditable] = useState(inputsEnabled || !state?.view);
  const { dispatchToast } = useToastController(toasterId);
  const [currentReceiptNumber, setCurrentReceiptNumber] = useState();

  const getTotal = () => {
    return prItems.reduce(
      (acc, cur) => acc + parseInt(cur.amount || '0', 10),
      0,
    );
  };

  const onSubmit = async () => {
    if (prItems.find((pri) => !pri.amount)) {
      showToast(dispatchToast, 'Enter amount for all the parties', 'error');
      return;
    }

    try {
      setLoading(true);
      const updatedPrItems = prItems.map((pri1) => {
        return {
          amount: parseInt(pri1.amount, 10),
          partyId: pri1.partyId,
        };
      });

      await runTransaction(firebaseDB, async (transaction) => {
        const cashReceiptsCollectionRef = collection(
          firebaseDB,
          '/cashReceipts',
        );
        const newReceiptNumber = await globalUtils.getNewReceiptNumber(
          constants.newReceiptCounters.CASHRECEIPTS,
        );

        // Add a new document with a generated ID to the "cashReceipts" collection
        const docRef = await addDoc(cashReceiptsCollectionRef, {
          supplyReportId: state?.supplyReportId,
          prItems: updatedPrItems,
          timestamp: new Date().getTime(),
          createdByUserId: getAuth().currentUser.uid,
        });

        // Update the roll number in the transaction
        await transaction.update(docRef, {
          cashReceiptNumber: newReceiptNumber,
        });
        globalUtils.incrementReceiptCounter(
          constants.newReceiptCounters.CASHRECEIPTS,
        );
      });

      setLoading(false);
      showToast(dispatchToast, 'Created Payment Receipt', 'success');
      navigate('/paymentReceipts');
    } catch (error) {
      showToast(dispatchToast, 'Error Creating Receipt', 'error');
      console.error('Error adding document: ', error);
      setLoading(false);
    }
  };

  const getPartyDetails = async () => {
    setLoading(true);
    const prItemsFetched = await globalUtils.fetchPartyInfoForOrders(
      state?.prItems,
    );
    setPrItems(prItemsFetched);
    setLoading(false);
  };

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
    getPartyDetails();
    getCurrentReceiptNumber();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  if (!prItems?.length) {
    return <div>Error getting party info</div>;
  }

  return (
    <>
      <Toaster toasterId={toasterId} />
      <center>
        <div className="create-payment-receipt-container">
          {state?.viewOnly ? (
            <h3>Create Cash Receipt - {currentReceiptNumber}</h3>
          ) : (
            <h3>Cash Receipt: {state.cashReceiptNumber}</h3>
          )}
          <VerticalSpace1 />
          {!editable && !state?.view ? (
            <>
              <Button onClick={() => setEditable(true)}>Edit</Button>
              <VerticalSpace1 />
            </>
          ) : null}
          {editable && !state?.view ? (
            <PartySelector
              clearOnSelect
              descriptive
              onPartySelected={(selected) => {
                if (
                  selected &&
                  selected.id &&
                  prItems.findIndex((pri) => pri.party?.id === selected.id) ===
                    -1 &&
                  editable
                ) {
                  setPrItems((p) => [
                    ...p,
                    { party: selected, partyId: selected.id },
                  ]);
                } else {
                  showToast(dispatchToast, 'Cannot add party', 'error');
                }
              }}
            />
          ) : null}
          <VerticalSpace1 />

          <table size="extra-small" className="vsrc-table">
            <tr className="table-header-container">
              <th>Party</th>
              <th>Area</th>
              <th>File</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
            {prItems.map((pri) => (
              <PaymentReceiptRow
                editable={editable && !state?.view}
                amount={pri.amount}
                setAmount={(val) => {
                  setPrItems((newPr) =>
                    newPr.map((newprc) => {
                      if (newprc.party?.id === pri.party?.id) {
                        return { ...newprc, amount: val };
                      }
                      return newprc;
                    }),
                  );
                }}
                onDelete={() => {
                  setPrItems((x) =>
                    x.filter((x1) => x1.party.id !== pri.party.id),
                  );
                }}
                pr={pri}
              />
            ))}
          </table>

          <div className="total-amount">
            Total Amount: <b>{globalUtils.getCurrencyFormat(getTotal())}</b>
          </div>
        </div>
        <VerticalSpace2 />
        {editable && !state?.view ? (
          <Button onClick={() => onSubmit()} size="large">
            Create
          </Button>
        ) : null}
      </center>
    </>
  );
}

function PaymentReceiptRow({ pr, setAmount, amount, editable, onDelete }) {
  return (
    <tr className="vsrc-table-row" key={`pri-${pr.party?.id}`}>
      <td>
        <Text style={{ textWrap: 'nowrap', width: '200px' }}>
          {pr.party?.name}
        </Text>
      </td>{' '}
      <td>
        <Text>{pr.party?.area || '--'}</Text>
      </td>
      <td>
        <Text>{pr.party?.fileNumber || '--'}</Text>
      </td>
      <td>
        <Input
          disabled={!editable}
          size="large"
          value={amount}
          style={{ fontWeight: 'bold' }}
          appearance="filled-lighter-shadow"
          onChange={(e, v) => setAmount(e.target.value)}
          type="number"
          contentBefore="₹"
        />
      </td>
      <td>
        <Button
          disabled={!editable}
          onClick={() => {
            onDelete();
          }}
        >
          Delete
        </Button>
      </td>
    </tr>
  );
}

function td({ children }) {
  return (
    <TableCell width={100} className="vsrc-table-cell">
      <TableCellLayout>{children}</TableCellLayout>
    </TableCell>
  );
}
