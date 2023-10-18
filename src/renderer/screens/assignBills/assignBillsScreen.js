import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import {
  Dropdown,
  Option,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Button,
  Card,
  Divider,
  Table,
  TableHeader,
  TableCell,
  TableRow,
  TableBody,
  Tooltip,
  TableCellLayout,
  Spinner,
} from '@fluentui/react-components';
import PartySelector from '../../common/partySelector';
import { firebaseDB } from '../../firebaseInit';
import SupplementaryBillDialog from '../verifySupplyReport/supplementaryBillDialog/supplementaryBillDialog';
import { VerticalSpace1 } from '../../common/verticalSpace';
import PartySection from './partyOldBillsSection.js/partyOldBillsSection';
import SelectUserDropdown from '../../common/selectUser';
import constants from '../../constants';
import globalUtils from '../../services/globalUtils';
import './style.css';

export default function AssignBillScreen() {
  const [fileNumbers, setFileNumbers] = useState([]);
  const [addBillDialog, setAddBillDialog] = useState(false);
  const [addedParties, setAddedParties] = useState([]);
  const [addedBills, setAddedBills] = useState([]);
  const [selectedUser, setSelectedUser] = useState();
  const [creatingLoading, setCreatingLoading] = useState(false);

  const getFileNumbers = async () => {
    const settingsCollection = collection(firebaseDB, 'settings');
    const fileNumbersDoc = doc(firebaseDB, 'settings', 'fileNumbers');

    const document = await getDoc(fileNumbersDoc);
    setFileNumbers(document.data()?.data || []);
  };

  const onCreateBundle = async () => {
    if (creatingLoading) return;
    if (!addedBills.length || !selectedUser) {
      return;
    }
    setCreatingLoading(true);
    try {
      const billBundlesRef = collection(firebaseDB, 'billBundles');

      await addDoc(billBundlesRef, {
        status: constants.firebase.billBundleFlowStatus.CREATED,
        timestamp: new Date().getTime(),
        assignedTo: selectedUser.uid,
        bills: addedBills.map((x) => x.id),
      });

      await addedBills.forEach(async (bill1) => {
        await updateBills(bill1);
      });
      setCreatingLoading(false);
      setAddedBills([]);
      setAddedParties([]);
      setSelectedUser();
      // navigate(-1);
    } catch (e) {
      console.log(e);
      setCreatingLoading(false);
    }
  };

  const updateBills = async (modifiedBill1) => {
    try {
      // Create a reference to the specific order document
      const orderRef = doc(firebaseDB, 'orders', modifiedBill1.id);

      // Update the "orderStatus" field in the order document to "dispatched"
      await updateDoc(orderRef, {
        accountsNotes: modifiedBill1.notes || '',
        balance: parseInt(modifiedBill1.balance, 10),
        with: selectedUser.uid,
      });

      console.log(`Order status updated to "dispatched"`);
    } catch (error) {
      console.error(`Error updating order  status:`, error);
    }
  };

  useEffect(() => {
    getFileNumbers();
  }, []);

  return (
    <div className="assign-bills-screen">
      <center>
        <h3>Create Bill Bundle</h3>

        {/* <AddBillDialog /> */}
        <VerticalSpace1 />

        <AddPartySectionsDialog
          addParties={(toAdd) => {
            const finalParties = [];
            toAdd.forEach((toAddItem) => {
              if (addedParties.findIndex((x) => x.id === toAddItem.id) === -1) {
                finalParties.push(toAddItem);
              }
            });
            setAddedParties((x) => [...x, ...finalParties]);
          }}
        />
        <VerticalSpace1 />
        <Divider />

        {addedParties.map((ap) => {
          return (
            <PartySection
              attachedBills={addedBills}
              setAttachedBills={setAddedBills}
              party={ap}
              onRemoveParty={() => {
                setAddedParties((ap2) => ap2.filter((x) => x.id !== ap.id));
              }}
            />
          );
        })}
        <VerticalSpace1 />

        <SelectUserDropdown user={selectedUser} setUser={setSelectedUser} />
        <VerticalSpace1 />
        <SummaryDialog
          loading={creatingLoading}
          assignedUser={selectedUser}
          onSubmit={onCreateBundle}
          addedBills={addedBills}
        />
      </center>
    </div>
  );
}

function AddPartySectionsDialog({ addParties }) {
  const [open, setOpen] = useState(false);
  const [fileNumbers, setFileNumbers] = useState([]);
  const [addedParties, setAddedParties] = useState([]);

  const getFileNumbers = async () => {
    const settingsCollection = collection(firebaseDB, 'settings');
    const fileNumbersDoc = doc(firebaseDB, 'settings', 'fileNumbers');

    const document = await getDoc(fileNumbersDoc);
    setFileNumbers(document.data()?.data || []);
  };

  useEffect(() => {
    getFileNumbers();
  }, []);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Parties</Button>
      <Dialog open={open}>
        <DialogSurface>
          <DialogBody>
            <DialogContent>
              {/* <Dropdown placeholder="Select File Number">
                <Option text="None" value={null} key="none">
                  None
                </Option>
                {fileNumbers.map((option) => (
                  <Option text={option} value={option} key={option}>
                    {option}
                  </Option>
                ))}
              </Dropdown> */}
              <PartySelector
                onPartySelected={(p) => {
                  if (p?.id) {
                    setAddedParties((x) => [...x, p]);
                  }
                }}
              />
              <VerticalSpace1 />
              {addedParties.map((ap) => {
                return (
                  <Card>
                    {ap.name}&nbsp;&nbsp;({ap.area})&nbsp;&nbsp;&nbsp;
                    {ap.fileNumber}
                  </Card>
                );
              })}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setAddedParties([]);
                  addParties(addedParties);
                  setOpen(false);
                }}
                appearance="secondary"
              >
                Add
              </Button>
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

function AddBillDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Bills</Button>
      <Dialog open={open}>
        <DialogSurface>
          <DialogBody>
            <DialogContent>
              <SupplementaryBillDialog
                currentBills={[]}
                addSupplementaryBill={(b) => {}}
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

function SummaryDialog({ addedBills, onSubmit, assignedUser, loading }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button appearance="primary" onClick={() => setOpen(true)}>
        Create Bundle
      </Button>
      <Dialog open={open}>
        <DialogSurface>
          <DialogTitle>Confirm Submit</DialogTitle>
          <DialogBody>
            <DialogContent>
              <VerticalSpace1 />
              <Table className="assign-bills-confirm-table">
                <TableHeader>
                  <TableRow>
                    <TableCell>Bill Number</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Party Name</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Balance</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addedBills.map((ab) => (
                    <TableRow>
                      <TableCustomCell>{ab.billNumber}</TableCustomCell>
                      <TableCustomCell>
                        {globalUtils.getTimeFormat(ab.creationTime, true)}
                      </TableCustomCell>
                      <TableCustomCell>{ab.party?.name}</TableCustomCell>
                      <TableCustomCell>
                        {globalUtils.getCurrencyFormat(ab.orderAmount)}
                      </TableCustomCell>
                      <TableCustomCell>
                        {globalUtils.getCurrencyFormat(ab.balance)}
                      </TableCustomCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <VerticalSpace1 />
              <Card>
                <div>
                  Assign To: <b>{assignedUser?.username}</b>
                </div>
              </Card>
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
              <Button
                onClick={async () => {
                  await onSubmit();
                  setOpen(false);
                }}
                appearance="primary"
              >
                {loading ? <Spinner /> : 'Create'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

function TableCustomCell({ children }) {
  return (
    <Tooltip content={children}>
      <TableCell>
        <TableCellLayout>{children || '--'}</TableCellLayout>
      </TableCell>
    </Tooltip>
  );
}
