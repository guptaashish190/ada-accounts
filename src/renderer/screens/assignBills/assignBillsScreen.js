import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Timestamp,
  addDoc,
  doc,
  getDoc,
  getDocs,
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
  Button,
  Card,
  Divider,
  Tooltip,
  Spinner,
  Toaster,
  useId,
  useToastController,
} from '@fluentui/react-components';
import PartySelector from '../../common/partySelector';
import { firebaseDB } from '../../firebaseInit';
import SupplementaryBillDialog from '../verifySupplyReport/supplementaryBillDialog/supplementaryBillDialog';
import { VerticalSpace1 } from '../../common/verticalSpace';
import PartySection from './partyOldBillsSection.js/partyOldBillsSection';
import SelectUserDropdown from '../../common/selectUser';
import constants from '../../constants';
import globalUtils from '../../services/globalUtils';
import { showToast } from '../../common/toaster';
import './style.css';
import { firebaseAuth } from '../../firebaseInit';
import { useCompany } from '../../contexts/companyContext';
import { useSettingsContext } from '../../contexts/settingsContext';
import { getCompanyCollection, getCompanyDoc, DB_NAMES } from '../../services/firestoreHelpers';
import {
  buildAssignmentDetails,
  canCreateBundle,
  getHandoverBalance,
} from '../../services/handoverBalanceUtils';
import { canEditBundle } from '../../services/bundleEditUtils';
import TableCustomCell from '../../common/tableCustomCell';

export default function AssignBillScreen() {
  const { state } = useLocation();
  const editBundle = state?.editBundle;
  const editingBundleId = editBundle?.bundleId;

  const [fileNumbers, setFileNumbers] = useState([]);
  const [addBillDialog, setAddBillDialog] = useState(false);
  const [addedParties, setAddedParties] = useState([]);
  const [addedBills, setAddedBills] = useState([]);
  const [selectedUser, setSelectedUser] = useState();
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(!!editingBundleId);
  const [bundleNumber, setBundleNumber] = useState();
  const [withPartyBillIds, setWithPartyBillIds] = useState([]);

  const toasterId = useId('assign-bills-toaster');
  const { dispatchToast } = useToastController(toasterId);

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();
  const { settings } = useSettingsContext();
  const billWithPartyUserId = settings?.billWithParty?.userId || '';
  const originalBundleBillIds = useMemo(
    () => editBundle?.bills?.map((b) => b.id) || [],
    [editBundle?.bills],
  );
  const sortedAddedParties = useMemo(
    () =>
      [...addedParties].sort((a, b) =>
        (a.name || '').localeCompare(b.name || ''),
      ),
    [addedParties],
  );

  const addWithPartyBill = (bill) => {
    if (!billWithPartyUserId) {
      showToast(
        dispatchToast,
        'Set "Bill With Party" user in Settings first',
        'error',
      );
      return;
    }
    setWithPartyBillIds((current) => {
      if (current.includes(bill.id)) return current;
      return [...current, bill.id];
    });
    setAddedBills((current) => current.filter((b) => b.id !== bill.id));
  };

  const getFileNumbers = async () => {
    const fileNumbersDoc = doc(firebaseDB, 'settings', 'fileNumbers');

    const document = await getDoc(fileNumbersDoc);
    setFileNumbers(document.data()?.data || []);
  };

  const getNewBundleReceiptNumber = async () => {
    const srNumber1 = await globalUtils.getNewReceiptNumber(
      constants.newReceiptCounters.BUNDLES,
      currentCompanyId,
    );
    setBundleNumber(srNumber1);
  };
  const updateWithPartyBills = async (billIds) => {
    if (!billIds.length) return;

    const fetchedOrders = await globalUtils.fetchOrdersByIds(
      billIds,
      currentCompanyId,
    );

    for await (const selectedBill of fetchedOrders.filter((b) => !b.error)) {
      const orderRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.ORDERS,
        selectedBill.id,
      );

      await updateDoc(orderRef, {
        flow: [
          ...(selectedBill.flow || []),
          {
            employeeId: firebaseAuth.currentUser.uid,
            timestamp: Timestamp.now().toMillis(),
            type: constants.firebase.billFlowTypes.BILL_WITH_PARTY,
          },
        ],
        flowCompleted: true,
        orderStatus: constants.firebase.billFlowTypes.BILL_WITH_PARTY,
        with: billWithPartyUserId,
      });
    }
  };

  const prefillFromBundle = async (bundleData) => {
    setPrefillLoading(true);
    try {
      setBundleNumber(bundleData.receiptNumber);

      if (bundleData.assignedTo) {
        const userObj = await globalUtils.fetchUserById(bundleData.assignedTo);
        setSelectedUser(userObj);
      }

      const bills = (bundleData.bills || []).map((bill) => ({
        ...bill,
        handoverBalance: getHandoverBalance(bill),
        accountsNotes: bill.accountsNotes || '',
      }));
      setAddedBills(bills);

      const partyIds = [...new Set(bills.map((b) => b.partyId).filter(Boolean))];
      if (partyIds.length) {
        const parties = await globalUtils.fetchPartyByIds(
          partyIds,
          currentCompanyId,
        );
        setAddedParties(parties);
      }
    } catch (e) {
      console.error(e);
      showToast(dispatchToast, 'Failed to load bundle for editing', 'error');
    } finally {
      setPrefillLoading(false);
    }
  };

  const onCreateBundle = async () => {
    if (creatingLoading) return;

    const { hasBundleBills, hasWithParty: hasWithPartyBills, bundleBills: billsToAssign } =
      canCreateBundle(addedBills, withPartyBillIds);

    if (!hasBundleBills && !hasWithPartyBills) {
      return;
    }
    if (hasBundleBills && !selectedUser) {
      showToast(dispatchToast, 'Select a user to assign the bundle', 'error');
      return;
    }
    if (hasWithPartyBills && !billWithPartyUserId) {
      showToast(
        dispatchToast,
        'Set "Bill With Party" user in Settings first',
        'error',
      );
      return;
    }

    setCreatingLoading(true);
    try {
      if (hasBundleBills) {
        const bundleBillList = billsToAssign.filter(
          (b) => !withPartyBillIds.includes(b.id),
        );

        if (editingBundleId) {
          const bundleRef = getCompanyDoc(
            currentCompanyId,
            DB_NAMES.BILL_BUNDLES,
            editingBundleId,
          );
          const bundleSnap = await getDoc(bundleRef);
          const currentBundle = bundleSnap.data();
          if (!canEditBundle(currentBundle, true)) {
            showToast(
              dispatchToast,
              'Cannot edit a bundle that has been handed over',
              'error',
            );
            return;
          }
          const previousBillIds = editBundle?.bills?.map((b) => b.id) || [];
          const newBillIds = bundleBillList.map((x) => x.id);
          const removedBillIds = previousBillIds.filter(
            (id) => !newBillIds.includes(id),
          );

          await updateDoc(bundleRef, {
            assignedTo: selectedUser.uid,
            bills: newBillIds,
            assignmentDetails: buildAssignmentDetails(bundleBillList),
          });

          for await (const bill1 of bundleBillList) {
            await updateBills(bill1);
          }

          for await (const billId of removedBillIds) {
            const orderRef = getCompanyDoc(
              currentCompanyId,
              DB_NAMES.ORDERS,
              billId,
            );
            await updateDoc(orderRef, {
              with: 'Accounts',
              lastHandoverBalance: null,
            });
          }

          showToast(dispatchToast, 'Bundle updated ', 'success');
        } else {
          const billBundlesRef = getCompanyCollection(
            currentCompanyId,
            DB_NAMES.BILL_BUNDLES,
          );

          await addDoc(billBundlesRef, {
            status: constants.firebase.billBundleFlowStatus.CREATED,
            timestamp: Timestamp.now().toMillis(),
            assignedTo: selectedUser.uid,
            receiptNumber: bundleNumber,
            bills: bundleBillList.map((x) => x.id),
            assignmentDetails: buildAssignmentDetails(bundleBillList),
            partyCollections: [],
            partyPayments: [],
          });

          for await (const bill1 of billsToAssign.filter(
            (b) => !withPartyBillIds.includes(b.id),
          )) {
            await updateBills(bill1);
          }

          await globalUtils.incrementReceiptCounter(
            constants.newReceiptCounters.BUNDLES,
            currentCompanyId,
          );

          getNewBundleReceiptNumber();
        }
      }

      if (hasWithPartyBills) {
        await updateWithPartyBills(withPartyBillIds);
      }

      setCreatingLoading(false);
      if (!editingBundleId) {
        setAddedBills([]);
        setAddedParties([]);
        setWithPartyBillIds([]);
        setSelectedUser();
      }
    } catch (e) {
      console.log(e);
      setCreatingLoading(false);
    }
  };

  const updateBills = async (modifiedBill1) => {
    try {
      // Create a reference to the specific order document
      const orderRef = getCompanyDoc(currentCompanyId, DB_NAMES.ORDERS, modifiedBill1.id);

      // Update the "orderStatus" field in the order document to "dispatched"
      updateDoc(orderRef, {
        accountsNotes: modifiedBill1.accountsNotes || '',
        with: selectedUser.uid,
        lastHandoverBalance: getHandoverBalance(modifiedBill1),
      });

      console.log(`Order status updated to "dispatched"`);
    } catch (error) {
      console.error(`Error updating order  status:`, error);
    }
  };

  useEffect(() => {
    if (editBundle) {
      prefillFromBundle(editBundle);
    } else {
      getNewBundleReceiptNumber();
    }
    getFileNumbers();
  }, []);

  if (prefillLoading) {
    return (
      <div className="assign-bills-screen">
        <center>
          <Spinner />
        </center>
      </div>
    );
  }

  return (
    <div className="assign-bills-screen">
      <Toaster toasterId={toasterId} />
      <center>
        <h3>{editingBundleId ? 'Edit Bill Bundle' : 'Create Bill Bundle'}</h3>
        {bundleNumber}
        {/* <AddBillDialog /> */}
        <VerticalSpace1 />

        <AddPartySectionsDialog
          defaultOpen={!editingBundleId}
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

        <div className="assign-bills-parties-list">
        {sortedAddedParties.map((ap) => {
          return (
            <PartySection
              attachedBills={addedBills}
              setAttachedBills={setAddedBills}
              party={ap}
              key={`billbundlesection${ap.id}`}
              withPartyBillIds={withPartyBillIds}
              isEditMode={!!editingBundleId}
              originalBundleBillIds={originalBundleBillIds}
              bundleAssignedTo={editBundle?.assignedTo}
              onMarkWithParty={addWithPartyBill}
              onUndoWithParty={(billId) => {
                setWithPartyBillIds((ids) => ids.filter((id) => id !== billId));
              }}
              onRemoveParty={(partyBillIds = []) => {
                setAddedBills((x) => x.filter((i) => i.partyId !== ap.id));
                setWithPartyBillIds((ids) =>
                  ids.filter((id) => !partyBillIds.includes(id)),
                );
                setAddedParties((ap2) => ap2.filter((x) => x.id !== ap.id));
              }}
            />
          );
        })}
        </div>
        <VerticalSpace1 />

        <SelectUserDropdown user={selectedUser} setUser={setSelectedUser} />
        <VerticalSpace1 />
        {/* <Textarea size="large" placeholder="Message" / */}
        <VerticalSpace1 />
        <SummaryDialog
          loading={creatingLoading}
          assignedUser={selectedUser}
          onSubmit={onCreateBundle}
          addedBills={addedBills}
          withPartyBillIds={withPartyBillIds}
          withPartyBillCount={withPartyBillIds.length}
          isEditMode={!!editingBundleId}
        />
      </center>
    </div>
  );
}

function AddPartySectionsDialog({ addParties, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [addedParties, setAddedParties] = useState([]);
  const [mrRoutes, setMrRoutes] = useState([]);
  const [selectedMrRoute, setSelectedMrRoute] = useState();
  const [selectedDay, setSelectedDay] = useState();
  const [loading, setLoading] = useState(false);

  const { currentCompanyId } = useCompany();

  const getFileNumbers = async () => {
    setLoading(true);
    try {
      const mrRoutesCollection = getCompanyCollection(currentCompanyId, DB_NAMES.MR_ROUTES);
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
      const partiesData = await globalUtils.fetchPartyByIds(
        parties,
        currentCompanyId,
      );
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
                autoFocus={open}
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

function SummaryDialog({
  addedBills,
  onSubmit,
  assignedUser,
  loading,
  withPartyBillIds = [],
  withPartyBillCount = 0,
  isEditMode = false,
}) {
  const [open, setOpen] = useState(false);
  const { bundleBills, canSubmit } = canCreateBundle(
    addedBills,
    withPartyBillIds,
  );
  const bundleBillCount = bundleBills.length;
  const hasBundleWork = bundleBillCount > 0 && canSubmit;
  const hasWithPartyWork = withPartyBillCount > 0;
  const canSubmitFinal =
    (hasBundleWork && !!assignedUser) || hasWithPartyWork;
  const canConfirmSubmit =
    (hasBundleWork || hasWithPartyWork) && (!hasBundleWork || !!assignedUser);

  return (
    <>
      <Button
        appearance="primary"
        onClick={() => setOpen(true)}
        disabled={!canSubmitFinal}
      >
        {withPartyBillCount > 0 && bundleBillCount === 0
          ? `Apply (${withPartyBillCount} with party)`
          : isEditMode
            ? 'Update Bundle'
            : 'Create Bundle'}
      </Button>
      <Dialog open={open}>
        <DialogSurface>
          <DialogTitle>
            {isEditMode ? 'Confirm Update' : 'Confirm Submit'}
          </DialogTitle>
          <DialogBody>
            <DialogContent>
              <VerticalSpace1 />
              <table className="app-table compact">
                <thead>
                  <tr>
                    <th>Bill Number</th>
                    <th>Date</th>
                    <th>Days</th>
                    <th>Party Name</th>
                    <th>Handover Bal</th>
                  </tr>
                </thead>
                <tbody>
                  {bundleBills
                    .sort((a, b) => a.creationTime - b.creationTime)
                    .map((ab) => (
                      <tr key={`summary-${ab.id}`}>
                        <TableCustomCell>{ab.billNumber}</TableCustomCell>
                        <TableCustomCell>
                          {globalUtils.getTimeFormat(ab.creationTime, true)}
                        </TableCustomCell>
                        <TableCustomCell>
                          {ab.creationTime != null
                            ? globalUtils.getDaysPassed(ab.creationTime)
                            : '--'}
                        </TableCustomCell>
                        <TableCustomCell>{ab.party?.name}</TableCustomCell>
                        <TableCustomCell>
                          {globalUtils.getCurrencyFormat(getHandoverBalance(ab))}
                        </TableCustomCell>
                      </tr>
                    ))}
                </tbody>
              </table>
              <VerticalSpace1 />
              {bundleBillCount > 0 ? (
                <Card>
                  <div>
                    Assign To:{' '}
                    <b>
                      {assignedUser?.username || (
                        <span style={{ color: 'var(--colorPaletteRedForeground1)' }}>
                          Select user above
                        </span>
                      )}
                    </b>
                  </div>
                </Card>
              ) : null}
              {withPartyBillCount > 0 ? (
                <Card>
                  <div>
                    Bills marked With Party: <b>{withPartyBillCount}</b>
                  </div>
                </Card>
              ) : null}
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
                disabled={!canConfirmSubmit || loading}
              >
                {loading ? <Spinner /> : isEditMode ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

