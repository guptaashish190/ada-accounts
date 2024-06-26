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
import { useLocation, useNavigate } from 'react-router-dom';
import firebaseApp, { firebaseAuth, firebaseDB } from '../../../firebaseInit';
import PartySelector from '../../../common/partySelector';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import './style.css';
import { showToast } from '../../../common/toaster';
import globalUtils from '../../../services/globalUtils';
import constants from '../../../constants';
import { useAuthUser } from '../../../contexts/allUsersContext';
import cashReceiptFormatGenerator from '../../../common/printerDataGenerator/cashReceiptFormatGenerator';
import SelectUserDropdown from '../../../common/selectUser';

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
  const [paymentFrom, setPaymentFrom] = useState();
  const { allUsers } = useAuthUser();

  const getTotal = () => {
    return (
      prItems &&
      prItems.reduce((acc, cur) => acc + parseInt(cur.amount || '0', 10), 0)
    );
  };

  const onSubmit = async () => {
    if (loading) return;
    if (prItems.find((pri) => !pri.amount)) {
      showToast(dispatchToast, 'Enter amount for all the parties', 'error');
      return;
    }
    if (!paymentFrom) {
      showToast(dispatchToast, 'Select a user', 'error');
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
          supplyReportId: state?.supplyReportId || '',
          prItems: updatedPrItems,
          timestamp: Timestamp.now().toMillis(),
          createdByUserId: firebaseAuth.currentUser.uid,
          paymentFromUserId: paymentFrom.uid,
          parties: updatedPrItems.map((x) => x.partyId),
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
      onPrint();
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
    setPrItems(prItemsFetched || []);
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

  const onPrint = () => {
    let printDataNew = [];
    if (state?.view) {
      printDataNew = {
        time: globalUtils.getTimeFormat(state?.timestamp),
        createdBy: allUsers.find((x) => x.uid === state?.createdByUserId)
          ?.username,
        user: allUsers.find((x) => x.uid === state?.paymentFromUserId)
          ?.username,
        items: prItems,
        total: getTotal(),
        receiptNumber: state?.cashReceiptNumber,
      };
    } else {
      printDataNew = {
        time: globalUtils.getTimeFormat(new Date()),
        createdBy: allUsers.find((x) => x.uid === firebaseAuth.currentUser.uid)
          ?.username,
        user: paymentFrom?.username,
        items: prItems,
        receiptNumber: currentReceiptNumber,
        total: getTotal(),
      };
    }
    window.electron.ipcRenderer.sendMessage(
      'print',
      cashReceiptFormatGenerator(printDataNew),
    );
  };

  useEffect(() => {
    getPartyDetails();
    getCurrentReceiptNumber();
    if (state?.supplymanId?.length > 0) {
      const supoplyman = allUsers.find((x) => state?.supplymanId === x.uid);
      setPaymentFrom(supoplyman);
    }
  }, []);

  if (loading) {
    return <Spinner />;
  }

  return (
    <>
      <Toaster toasterId={toasterId} />
      <center>
        <div className="create-payment-receipt-container">
          {state?.view ? (
            <h3>Cash Receipt: {state?.cashReceiptNumber}</h3>
          ) : (
            <h3>Create Cash Receipt - {currentReceiptNumber}</h3>
          )}
          {state?.view ? (
            <div className="vsrc-detail-items-container">
              <div className="vsrc-detail-items">
                <div className="label">Created At: </div>
                <div className="value">
                  {globalUtils.getTimeFormat(state?.timestamp)}
                </div>
              </div>
              <div className="vsrc-detail-items">
                <div className="label">Created By: </div>
                <div className="value">
                  {
                    allUsers.find((x) => x.uid === state?.createdByUserId)
                      ?.username
                  }
                </div>
              </div>
              <div className="vsrc-detail-items">
                <div className="label">Username: </div>
                <div className="value">
                  {
                    allUsers.find((x) => x.uid === state?.paymentFromUserId)
                      ?.username
                  }
                </div>
              </div>
              {state?.supplyReportId && state.supplyReportId.length && (
                <div className="vsrc-detail-items">
                  <Button
                    className="label"
                    onClick={() => {
                      navigate('/viewSupplyReport', {
                        state: { supplyReportId: state?.supplyReportId },
                      });
                    }}
                  >
                    Supply Report{' '}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          <VerticalSpace1 />
          {!editable && !state?.view ? (
            <>
              <Button onClick={() => setEditable(true)}>Edit</Button>
              <VerticalSpace1 />
            </>
          ) : null}
          {editable && !state?.view ? (
            <>
              <SelectUserDropdown user={paymentFrom} setUser={setPaymentFrom} />
              <VerticalSpace1 />
              <PartySelector
                clearOnSelect
                descriptive
                onPartySelected={(selected) => {
                  if (
                    selected &&
                    selected.id &&
                    prItems?.findIndex(
                      (pri) => pri.party?.id === selected.id,
                    ) === -1 &&
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
            </>
          ) : null}
          <VerticalSpace1 />

          <table size="extra-small" className="vsrc-table">
            <thead>
              <tr style={{ width: '100%' }} className="table-header-container">
                <th>Party</th>
                <th>Area</th>
                <th>File</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {prItems &&
                prItems.map((pri) => (
                  <PaymentReceiptRow
                    key={`paymentreceiptrow-${pri.partyId}`}
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
            </tbody>
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
        ) : (
          <Button onClick={() => onPrint()} size="large">
            Print
          </Button>
        )}
      </center>
    </>
  );
}

function PaymentReceiptRow({ pr, setAmount, amount, editable, onDelete }) {
  return (
    <tr className="vsrc-table-row" key={`pri-${pr.party?.id}`}>
      <td>{pr.party?.name}</td> <td>{pr.party?.area || '--'}</td>
      <td>{pr.party?.fileNumber || '--'}</td>
      <td>
        <Input
          disabled={!editable}
          size="large"
          value={amount}
          style={{ fontWeight: 'bold', width: '150px' }}
          appearance="filled-lighter-shadow"
          onChange={(e, v) => setAmount(e.target.value)}
          type="number"
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
