import React, { useEffect, useState } from 'react';
import {
  Timestamp,
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
  td,
  TableRow,
  TableBody,
  Tooltip,
  tdLayout,
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

      addDoc(billBundlesRef, {
        status: constants.firebase.billBundleFlowStatus.CREATED,
        timestamp: Timestamp.now().toMillis(),
        assignedTo: selectedUser.uid,
        bills: addedBills.filter((x) => x.balance !== 0).map((x) => x.id),
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
      updateDoc(orderRef, {
        accountsNotes: modifiedBill1.accountsNotes || '',
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
              key={`billbundlesection${ap.id}`}
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
  const [addedParties, setAddedParties] = useState([]);
  const [mrRoutes, setMrRoutes] = useState([]);
  const [selectedMrRoute, setSelectedMrRoute] = useState();
  const [selectedDay, setSelectedDay] = useState();
  const [loading, setLoading] = useState(false);

  const getFileNumbers = async () => {
    setLoading(true);
    try {
      const mrRoutesCollection = collection(firebaseDB, 'mr_routes');
      const querySnapshot = await getDocs(mrRoutesCollection);

      const reportsData = [];
      querySnapshot.forEach((doc1) => {
        reportsData.push({ id: doc1.id, ...doc1.data() });
      });

      reportsData.sort((rd1, rd2) => rd2.timestamp - rd1.timestamp);
      setMrRoutes(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching Routes:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    getFileNumbers();
  }, []);

  const onDaySelect = async (parties) => {
    try {
      setLoading(true);
      const partiesData = await globalUtils.fetchPartyByIds(parties);
      setAddedParties(partiesData);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Parties</Button>
      <Dialog open={open}>
        <DialogSurface>
          <DialogBody>
            <DialogContent>
              <Dropdown
                onOptionSelect={(_, e) => {
                  setSelectedMrRoute(e.optionValue);
                }}
                placeholder="Select MR Route"
              >
                {mrRoutes.map((option, i) => (
                  <Option text={option.name} value={i} key={option.id}>
                    {option.name}
                  </Option>
                ))}
              </Dropdown>
              {selectedMrRoute !== undefined ? (
                <Dropdown
                  placeholder="Select Day"
                  onOptionSelect={(_, e) => {
                    onDaySelect(
                      mrRoutes[selectedMrRoute].route[e.optionValue].parties,
                    );
                  }}
                >
                  {mrRoutes[selectedMrRoute]?.route?.map((option, i) => (
                    <Option
                      text={option.day}
                      value={i}
                      key={`selectedmrroute${selectedMrRoute}${option.day}`}
                    >
                      {option.day}
                    </Option>
                  ))}
                </Dropdown>
              ) : null}
              <VerticalSpace1 />
              <PartySelector
                onPartySelected={(p) => {
                  if (p?.id) {
                    setAddedParties((x) => [...x, p]);
                  }
                }}
              />
              <VerticalSpace1 />
              {loading ? <Spinner size="tiny" /> : null}
              {addedParties.map((ap) => {
                return (
                  <Card
                    appearance="outline"
                    style={{ marginTop: '10px' }}
                    key={`assign-bills-dialog-${ap.id}`}
                  >
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
                  setAddedParties([]);
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
              <table className="assign-bills-confirm-table">
                <thead>
                  <tr>
                    <td>Bill Number</td>
                    <td>Date</td>
                    <td>Party Name</td>
                    <td>Amount</td>
                    <td>Balance</td>
                  </tr>
                </thead>
                <tbody>
                  {addedBills.map((ab) => (
                    <tr>
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
                    </tr>
                  ))}
                </tbody>
              </table>
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
      <td>{children || '--'}</td>
    </Tooltip>
  );
}
