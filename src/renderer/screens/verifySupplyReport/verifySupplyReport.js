/* eslint-disable no-unreachable */
/* eslint-disable no-restricted-syntax */
import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Dropdown,
  Input,
  Label,
  Option,
  Text,
  Textarea,
  Toaster,
  Tooltip,
  useId,
  useToastController,
} from '@fluentui/react-components';

import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import {
  DeleteRegular,
  Checkmark12Filled,
  Edit12Filled,
} from '@fluentui/react-icons';
import {
  Timestamp,
  arrayUnion,
  doc,
  getDoc,
  getDocs,
  limitToLast,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import shortid from 'shortid';
import { evaluate } from 'mathjs';
import { confirmAlert } from 'react-confirm-alert';
import globalUtils from '../../services/globalUtils';
import { showToast } from '../../common/toaster';
import './style.css';
import { useCompany } from '../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import firebaseApp, { firebaseAuth, firebaseDB } from '../../firebaseInit';
import Loader from '../../common/loader';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import SupplementaryBillDialog from './supplementaryBillDialog/supplementaryBillDialog';
import constants from '../../constants';

// BALANCE WILL BE ADDED TO THE ORDER DOCUMENT BEFORE THIS SCREEN FOR A NEW ORDER(BILL)
// BECAUSE OF THIS, AS THE OLD BILLS ARE FILTERED BASED ON BALANCE, THE NEW BILL SHOULD NOT
// COME IN THE LIST OF OLD BILLS AS THE NEW BILL DOESNT HAVE ANY BALANCE KEY IN THE DOCUMENT

export default function VerifySupplyReport() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState([]);
  const locationState = location.state;
  const supplyReport = locationState?.supplyReport;
  const [accountsNotes, setAccountsNotes] = useState('');
  const [allPartiesCreditDays, setAllPartiesCreditDays] = useState({});
  /** Party IDs that already had credit days from DB on load — field stays read-only until next visit */
  const [creditDaysLockedByPartyId, setCreditDaysLockedByPartyId] = useState(
    {},
  );
  const [attachedBills, setAttachedBills] = useState([]);
  const [supplementaryBills, setSupplementaryBills] = useState([]);
  const [supplymanUser, setSupplymanUser] = useState();
  const [mrRoutes, setMrRoutes] = useState([]);
  const [orderMrAssignments, setOrderMrAssignments] = useState({});
  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);
  const navigate = useNavigate();

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();

  const [isSupplementBillAddDialogOpen, setIsSupplementBillAddDialogOpen] =
    useState(false);

  // Fetch MR routes from Firestore
  const fetchMrRoutes = async () => {
    try {
      const mrRoutesCollection = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.MR_ROUTES,
      );
      const querySnapshot = await getDocs(mrRoutesCollection);

      const routesData = [];
      querySnapshot.forEach((routeDoc) => {
        routesData.push({
          id: routeDoc.id,
          ...routeDoc.data(),
        });
      });

      setMrRoutes(routesData);
      return routesData;
    } catch (error) {
      console.error('Error fetching MR routes:', error);
      showToast(dispatchToast, 'Error fetching MR routes', 'error');
      return [];
    }
  };

  // Find MR and day for a given partyId
  const findMrAndDayForParty = (partyId, routes) => {
    for (const route of routes) {
      if (route.route && Array.isArray(route.route)) {
        for (const dayRoute of route.route) {
          if (dayRoute.parties && Array.isArray(dayRoute.parties)) {
            if (dayRoute.parties.includes(partyId)) {
              return {
                mrName: route.name,
                day: dayRoute.day,
                found: true,
              };
            }
          }
        }
      }
    }
    return { found: false };
  };

  // Initialize MR assignments for all orders
  const initializeMrAssignments = (orders, routes) => {
    const assignments = {};
    orders.forEach((order) => {
      const mrInfo = findMrAndDayForParty(order.partyId, routes);
      assignments[order.id] = {
        mrName: mrInfo.found ? mrInfo.mrName : '',
        day: mrInfo.found ? mrInfo.day : '',
        isRequired: !mrInfo.found,
      };
    });
    setOrderMrAssignments(assignments);
  };

  const prefillState = async () => {
    setLoading(true);
    try {
      // Fetch orders and MR routes in parallel
      const [fetchedOrders, routesData] = await Promise.all([
        globalUtils.fetchOrdersByIds(supplyReport.orders, currentCompanyId),
        fetchMrRoutes(),
      ]);

      let orders = (await fetchedOrders).filter((fo) => !fo.error);
      orders = await globalUtils.fetchPartyInfoForOrders(
        orders,
        currentCompanyId,
      );
      setBills(orders);

      // Initialize MR assignments
      initializeMrAssignments(orders, routesData);
      console.log(orders);
      // set credit days from party data
      const fetchedCreditDays = {};
      const lockedFromDb = {};
      orders.forEach((o) => {
        if (o.party?.creditDays != null) {
          fetchedCreditDays[o.partyId] = o.party.creditDays;
          lockedFromDb[o.partyId] = true;
        }
      });

      console.log('Fetched credit days:', fetchedCreditDays);
      console.log('Party data sample:', orders[0]?.party);
      setAllPartiesCreditDays(fetchedCreditDays);
      setCreditDaysLockedByPartyId(lockedFromDb);

      const supplymanUser1 = await globalUtils.fetchUserById(
        supplyReport.supplymanId,
      );
      setSupplymanUser(supplymanUser1);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      showToast(
        dispatchToast,
        'An error occured loading supply report',
        'error',
      );
    }
  };
  useEffect(() => {
    prefillState();
  }, []);

  // Update MR assignment for a specific order
  const updateMrAssignment = (orderId, field, value) => {
    setOrderMrAssignments((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  // Validate MR assignments and payment terms before dispatch
  const validateMrAssignments = () => {
    const requiredOrders = Object.entries(orderMrAssignments).filter(
      ([orderId, assignment]) => assignment.isRequired,
    );

    for (const [orderId, assignment] of requiredOrders) {
      if (!assignment.mrName || !assignment.day) {
        return {
          isValid: false,
          message:
            'Please select MR Name and Route Day for all required orders',
        };
      }
    }

    // Also validate credit days for required orders
    for (const [orderId, assignment] of requiredOrders) {
      const bill = bills.find((b) => b.id === orderId);
      if (bill && allPartiesCreditDays[bill.partyId] == null) {
        return {
          isValid: false,
          message: 'Please set Credit Days for all required orders',
        };
      }
    }

    return { isValid: true };
  };

  // Update MR routes with party assignments
  const updateMrRoutesWithParties = async () => {
    try {
      const routeUpdates = {};

      // Group parties by MR and day
      Object.entries(orderMrAssignments).forEach(([orderId, assignment]) => {
        if (assignment.mrName && assignment.day) {
          const bill = bills.find((b) => b.id === orderId);
          if (bill) {
            const key = `${assignment.mrName}-${assignment.day}`;
            if (!routeUpdates[key]) {
              routeUpdates[key] = {
                mrName: assignment.mrName,
                day: assignment.day,
                parties: [],
              };
            }
            routeUpdates[key].parties.push(bill.partyId);
          }
        }
      });

      // Update each MR route document
      const updatePromises = Object.entries(routeUpdates).map(
        async ([key, routeUpdate]) => {
          // Find the MR route document by name
          const mrRouteDoc = mrRoutes.find(
            (route) => route.name === routeUpdate.mrName,
          );

          if (!mrRouteDoc) {
            console.warn(`MR route ${routeUpdate.mrName} not found`);
            return;
          }

          const mrRouteRef = getCompanyDoc(
            currentCompanyId,
            DB_NAMES.MR_ROUTES,
            mrRouteDoc.id,
          );

          try {
            // Get the current document data
            const currentDoc = await getDoc(mrRouteRef);
            if (!currentDoc.exists()) {
              console.warn(`MR route document ${mrRouteDoc.id} not found`);
              return;
            }

            const currentData = currentDoc.data();
            const updatedRoute = [...currentData.route];

            // Find the day index in the route array
            const dayIndex = updatedRoute.findIndex(
              (dayRoute) => dayRoute.day === routeUpdate.day,
            );

            if (dayIndex !== -1) {
              // Get current parties array or initialize empty array
              const currentParties = updatedRoute[dayIndex].parties || [];

              // Add new parties that aren't already in the array
              const newParties = routeUpdate.parties.filter(
                (partyId) => !currentParties.includes(partyId),
              );

              // Update the parties array
              updatedRoute[dayIndex] = {
                ...updatedRoute[dayIndex],
                parties: [...currentParties, ...newParties],
              };

              // Update the entire document with the modified route
              await updateDoc(mrRouteRef, {
                route: updatedRoute,
              });

              console.log(
                `Updated MR route ${routeUpdate.mrName} for day ${routeUpdate.day} with new parties:`,
                newParties,
              );
            } else {
              console.warn(
                `Day ${routeUpdate.day} not found in MR route ${routeUpdate.mrName}`,
              );
            }
          } catch (error) {
            console.error(
              `Error updating MR route ${routeUpdate.mrName}:`,
              error,
            );
          }
        },
      );

      // Wait for all updates to complete
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating MR routes with parties:', error);
      showToast(dispatchToast, 'Error updating MR routes', 'error');
    }
  };

  const onDispatch = async () => {
    setLoading(true);
    try {
      const supplyReportRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.SUPPLY_REPORTS,
        supplyReport.id,
      );

      await updateDoc(supplyReportRef, {
        status: constants.firebase.supplyReportStatus.DISPATCHED,
        dispatchTimestamp: Timestamp.now().toMillis(),
        dispatchAccountNotes: accountsNotes,
        attachedBills: attachedBills
          .filter((x) => x.balance !== 0)
          .map((b) => b.id),
        supplementaryBills: supplementaryBills
          .filter((x) => x.balance !== 0)
          .map((b) => b.id),
      });

      await Promise.all(
        bills.map(async (bill1) => {
          await updateOrder(bill1);
        }),
      );

      // update credit days for all parties
      await Promise.all(
        Object.keys(allPartiesCreditDays).map(async (creditDaysParty) => {
          const partyRef = getCompanyDoc(
            currentCompanyId,
            DB_NAMES.PARTIES,
            creditDaysParty,
          );
          await updateDoc(partyRef, {
            creditDays: allPartiesCreditDays[creditDaysParty],
          });
        }),
      );

      // Update MR routes with party assignments
      await updateMrRoutesWithParties();

      await Promise.all(
        [...attachedBills, ...supplementaryBills].map(async (bill1) => {
          await updateOldOrder(bill1);
        }),
      );

      setLoading(false);
      navigate(-1);
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };
  const updateOrder = async (bill1) => {
    try {
      // Create a reference to the specific order document
      const orderRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.ORDERS,
        bill1.id,
      );

      // Calculate due date based on credit days
      const partyCreditDays = allPartiesCreditDays[bill1.partyId];
      const billDate = bill1.billCreationTime || Timestamp.now().toMillis();
      let dueDate = null;
      if (partyCreditDays != null) {
        const billDateObj = new Date(billDate);
        billDateObj.setDate(billDateObj.getDate() + partyCreditDays);
        dueDate = billDateObj.getTime();
      }

      // Update the "orderStatus" field in the order document to "dispatched"
      await updateDoc(orderRef, {
        balance: parseInt(bill1.orderAmount, 10),
        with: supplyReport.supplymanId,
        orderStatus: 'Dispatched',
        supplyReportId: supplyReport.id,
        // Credit days tracking (Story 1.1/1.2)
        creditDays: partyCreditDays,
        dueDate,
        schedulePaymentDate: dueDate,
        paymentStatus: 'NOT_DUE',
        flow: [
          ...bill1.flow,
          {
            employeeId: firebaseAuth.currentUser.uid,
            timestamp: Timestamp.now().toMillis(),
            type: 'Dispatched',
            comment: bill1.notes || '',
          },
        ],
      });

      console.log(`Order status updated to "dispatched"`);
    } catch (error) {
      console.error(`Error updating order  status:`, error);
    }
  };
  const updateOldOrder = async (modifiedBill1) => {
    try {
      // Create a reference to the specific order document
      const orderRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.ORDERS,
        modifiedBill1.id,
      );

      // Update the "orderStatus" field in the order document to "dispatched"
      await updateDoc(orderRef, {
        accountsNotes: modifiedBill1.notes || '',
        with: supplyReport.supplymanId,
      });

      console.log(`Order status updated to "dispatched"`);
    } catch (error) {
      console.error(`Error updating order  status:`, error);
    }
  };

  if (loading) {
    return <Loader />;
  }
  return (
    <>
      <Toaster toasterId={toasterId} />
      <div className="verify-supply-report">
        <center>
          <h3>Verify Supply Report</h3>
          ID: {supplyReport?.receiptNumber || '--'}{' '}
          <span style={{ color: 'grey' }}>
            (Supplyman: {supplymanUser?.username})
          </span>
          <VerticalSpace2 />
          {bills.map((b, i) => {
            return (
              <PartySection
                attachedBills={[...attachedBills, ...supplementaryBills]}
                setAttachedBills={setAttachedBills}
                key={`party-section-${b.id}`}
                creditDays={allPartiesCreditDays[b.partyId]}
                creditDaysLocked={!!creditDaysLockedByPartyId[b.partyId]}
                setCreditDays={(days) =>
                  setAllPartiesCreditDays((p) => ({ ...p, [b.partyId]: days }))
                }
                index={i}
                bill={b}
                mrRoutes={mrRoutes}
                mrAssignment={orderMrAssignments[b.id]}
                updateMrAssignment={updateMrAssignment}
                currentCompanyId={currentCompanyId}
              />
            );
          })}
          <div>
            <Label size="large" style={{ color: '#00A9A5' }}>
              <b>Supplementary Bills</b>
            </Label>
            <VerticalSpace1 />
            <Button onClick={() => setIsSupplementBillAddDialogOpen(true)}>
              Add Supplementary Bill
            </Button>
            <VerticalSpace1 />
            {supplementaryBills.map((b, i) => {
              return (
                <SupplementaryBillRow
                  key={`supp-${b.id}`}
                  oldbill={b}
                  saveBill={(newB) => {
                    let updatedSuppBills = [...supplementaryBills];
                    updatedSuppBills = updatedSuppBills.map((x) => {
                      if (x.id === newB.id) {
                        return newB;
                      }
                      return x;
                    });
                    setSupplementaryBills(updatedSuppBills);
                  }}
                  removeAttachedBill={() => {
                    setSupplementaryBills((sb) =>
                      sb.filter((x) => x.id !== b.id),
                    );
                  }}
                />
              );
            })}
          </div>
          <VerticalSpace2 />
          <Textarea
            style={{ width: '50vw' }}
            size="large"
            value={accountsNotes}
            onChange={(e) => setAccountsNotes(e.target.value)}
            placeholder="Account notes"
          />
          <br />
          <br />
          <Button
            onClick={() => {
              const uniqueParties = [];
              bills.forEach((x) =>
                uniqueParties.includes(x.partyId)
                  ? null
                  : uniqueParties.push(x.partyId),
              );

              // Validate credit days - all parties must have credit days set
              const partiesWithoutCreditDays = uniqueParties.filter(
                (partyId) => allPartiesCreditDays[partyId] == null,
              );
              if (partiesWithoutCreditDays.length > 0) {
                showToast(
                  dispatchToast,
                  'Please set Credit Days for all parties',
                  'error',
                );
                return;
              }

              // Validate MR assignments
              const mrValidation = validateMrAssignments();
              if (!mrValidation.isValid) {
                showToast(dispatchToast, mrValidation.message, 'error');
                return;
              }

              confirmAlert({
                title: 'Confirm to submit',
                message: 'Are you sure to do this.',
                buttons: [
                  {
                    label: 'Yes',
                    onClick: () => {
                      onDispatch();
                    },
                  },
                  {
                    label: 'No',
                    onClick: () => {},
                  },
                ],
              });
            }}
            appearance="primary"
          >
            Dispatch
          </Button>
        </center>
        <Dialog open={isSupplementBillAddDialogOpen}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Add Supplementary Bills</DialogTitle>
              <DialogContent>
                <SupplementaryBillDialog
                  currentBills={[
                    ...attachedBills,
                    ...bills,
                    ...supplementaryBills,
                  ]}
                  addSupplementaryBill={(b) => {
                    console.log('attached');
                    setSupplementaryBills((ab) => [...ab, b]);
                  }}
                />
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setIsSupplementBillAddDialogOpen(false)}
                  appearance="secondary"
                >
                  Close
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>
    </>
  );
}

function PartySection({
  bill,
  index,
  setAttachedBills,
  attachedBills,
  setCreditDays,
  creditDays,
  creditDaysLocked,
  mrRoutes,
  mrAssignment,
  updateMrAssignment,
  currentCompanyId,
}) {
  const [oldBills, setOldBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showOldBills, setShowOldBills] = useState(false);
  const [creditDaysInput, setCreditDaysInput] = useState(
    creditDays != null ? creditDays.toString() : '',
  );

  // Sync display when creditDays prop changes (e.g. initial load); do not tie disabled state to this
  useEffect(() => {
    if (creditDays != null) {
      setCreditDaysInput(creditDays.toString());
    }
  }, [creditDays]);
  // Fetch orders based on the query
  const fetchData = async () => {
    setLoading(true);
    try {
      const ordersCollection = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.ORDERS,
      );
      const q = query(
        ordersCollection,
        where('partyId', '==', bill.partyId),
        where('balance', '!=', 0),
      );

      const querySnapshot = await getDocs(q);

      const ordersData = [];
      for await (const doc1 of [...querySnapshot.docs]) {
        // Get data for each order
        const orderData = doc1.data();
        // Fetch party information using partyID from the order
        const partyDocRef = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.PARTIES,
          orderData.partyId,
        );
        const partyDocSnapshot = await getDoc(partyDocRef);
        if (partyDocSnapshot.exists()) {
          const partyData = partyDocSnapshot.data();

          // Add the party object to the order object
          orderData.party = partyData;
        }

        ordersData.push(orderData);
      }
      const sortedData = ordersData.sort(
        (s1, s2) => s2.creationTime - s1.creationTime,
      );
      setOldBills(sortedData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders: ', error);
      setLoading(false);
    }
  };

  // Get unique MR names from routes
  const uniqueMrNames = [...new Set(mrRoutes.map((route) => route.name))];

  // Debug: Log the routes data to see the structure
  console.log('MR Routes data:', mrRoutes);
  console.log('Unique MR Names:', uniqueMrNames);

  // Get unique days from all routes
  const uniqueDays = [
    ...new Set(
      mrRoutes.flatMap((route) =>
        route.route ? route.route.map((dayRoute) => dayRoute.day) : [],
      ),
    ),
  ];

  return (
    <div className="order-card-compact">
      {/* Compact Header */}
      <div className="compact-header">
        <div className="order-info">
          <Text size={300} weight="bold" style={{ color: '#0078d4' }}>
            #{index + 1}
          </Text>
          <Text size={400} weight="semibold" style={{ color: '#323130' }}>
            {bill.party?.name}
          </Text>
        </div>
        <div
          className="status-badge-compact"
          style={{
            backgroundColor:
              mrAssignment?.isRequired || creditDays == null
                ? '#fef2f2'
                : '#f3f2f1',
            borderColor:
              mrAssignment?.isRequired || creditDays == null
                ? '#fecaca'
                : '#e1dfdd',
          }}
        >
          <Text
            size={200}
            weight="medium"
            style={{
              color:
                mrAssignment?.isRequired || creditDays == null
                  ? '#dc2626'
                  : undefined,
            }}
          >
            {mrAssignment?.isRequired || creditDays == null
              ? '⚠️ Required'
              : '✅ Auto'}
          </Text>
        </div>
      </div>

      {/* Compact Details Row */}
      <div className="compact-details">
        <div className="detail-row">
          <span className="detail-label">Bill:</span>
          <span className="detail-value">
            {bill.billNumber?.toUpperCase() || '--'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Amount:</span>
          <span className="detail-value">
            {globalUtils.getCurrencyFormat(bill.orderAmount)}
          </span>
        </div>
      </div>

      {/* Compact Dropdowns Row */}
      <div className="dropdowns-row-compact">
        <div className="dropdown-item-compact">
          <Label size="small" weight="semibold">
            Credit Days
            {mrAssignment?.isRequired && (
              <span className="required-asterisk"> *</span>
            )}
          </Label>
          <Input
            type="number"
            min={1}
            max={120}
            placeholder="Days"
            disabled={creditDaysLocked}
            value={creditDaysInput}
            onChange={(e) => {
              const { value } = e.target;
              setCreditDaysInput(value);
              if (value.trim() !== '') {
                const parsed = parseInt(value, 10);
                if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 120) {
                  setCreditDays(parsed);
                }
              } else {
                setCreditDays(null);
              }
            }}
            size="small"
            style={{ width: '80px' }}
          />
        </div>

        <div className="dropdown-item-compact">
          <Label size="small" weight="semibold">
            MR Name
            {mrAssignment?.isRequired && (
              <span className="required-asterisk"> *</span>
            )}
          </Label>
          <Dropdown
            onOptionSelect={(_, e) =>
              updateMrAssignment(bill.id, 'mrName', e.optionValue)
            }
            placeholder="Select MR"
            value={mrAssignment?.mrName || ''}
            disabled={!mrAssignment?.isRequired && mrAssignment?.mrName}
            size="small"
            style={{ width: '120px' }}
          >
            {uniqueMrNames.map((mrName) => (
              <Option text={mrName} value={mrName} key={`mr-${mrName}`}>
                {mrName}
              </Option>
            ))}
          </Dropdown>
        </div>

        <div className="dropdown-item-compact">
          <Label size="small" weight="semibold">
            Route Day
            {mrAssignment?.isRequired && (
              <span className="required-asterisk"> *</span>
            )}
          </Label>
          <Dropdown
            onOptionSelect={(_, e) =>
              updateMrAssignment(bill.id, 'day', e.optionValue)
            }
            placeholder="Select Day"
            value={mrAssignment?.day || ''}
            disabled={!mrAssignment?.isRequired && mrAssignment?.day}
            size="small"
            style={{ width: '100px' }}
          >
            {uniqueDays.map((day) => (
              <Option text={day} value={day} key={`day-${day}`}>
                {day}
              </Option>
            ))}
          </Dropdown>
        </div>
      </div>
      <Button
        onClick={() => {
          if (oldBills.length === 0) {
            fetchData();
          }
          setShowOldBills((x) => !x);
        }}
        appearance="transparent"
      >
        {showOldBills ? 'Hide' : 'Show'} Old Bills
      </Button>

      <div
        className="party-old-bills"
        style={{ display: showOldBills ? null : 'none' }}
      >
        <div className="party-old-bills-header">BILL NO.</div>
        <div className="party-old-bills-header">BILL DATE</div>
        <div className="party-old-bills-header">WITH</div>
        <div className="party-old-bills-header">AMOUNT</div>
        <div className="party-old-bills-header">BALANCE</div>
        <div className="party-old-bills-header">AGE</div>
        <div className="party-old-bills-header">DUE STATUS</div>
        <div className="party-old-bills-header">NOTE</div>
        <div className="party-old-bills-header" />
        {!loading ? (
          oldBills.map((ob, i) => {
            return (
              <OldBillRow
                key={`ob-${ob.id}`}
                oldbill={ob}
                creditDays={creditDays}
                attachBill={(mod) => {
                  setAttachedBills((ab) => [...ab, mod]);
                }}
                removeAttachedBill={() => {
                  if (bill.id === ob.id) {
                    return;
                  }
                  setAttachedBills((ab) => ab.filter((x) => x.id !== ob.id));
                }}
                isAttached={
                  bill.id === ob.id ||
                  attachedBills.findIndex((fi) => fi.id === ob.id) !== -1
                }
              />
            );
          })
        ) : (
          <Loader />
        )}
      </div>
    </div>
  );
}

function OldBillRow({
  oldbill,
  attachBill,
  isAttached,
  removeAttachedBill,
  saveBill,
  creditDays,
}) {
  const [newBalance, setNewBalance] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [withUser, setWithUser] = useState();

  // Calculate due status based on credit days
  const getDueStatus = () => {
    if (creditDays == null) {
      return { text: 'Not Set', color: '#8a8886' };
    }

    const billDate = new Date(oldbill.billCreationTime);
    const dueDate = new Date(billDate);
    dueDate.setDate(dueDate.getDate() + creditDays);

    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { text: `Due in ${diffDays}d`, color: '#107c10' }; // Green - not due yet
    }
    if (diffDays === 0) {
      return { text: 'Due Today', color: '#ff8c00' }; // Orange - due today
    }
    const overdueDays = Math.abs(diffDays);
    const criticalThreshold = creditDays * 2;
    if (overdueDays > criticalThreshold) {
      return { text: `CRITICAL (${overdueDays}d)`, color: '#d13438' }; // Red - critical
    }
    return { text: `Overdue ${overdueDays}d`, color: '#ff8c00' }; // Orange - overdue
  };

  const dueStatus = getDueStatus();

  const onAttachBill = (save) => {
    const modifiedBill = { ...oldbill };
    if (newNotes && newNotes.length > 0) {
      modifiedBill.notes = newNotes;
    }
    if (newBalance && newBalance.length > 0) {
      modifiedBill.balance = parseInt(newBalance, 10);
    }
    attachBill(modifiedBill);
  };

  const fetchWithUser = async () => {
    if (oldbill.with && oldbill.with !== 'Accounts') {
      const user = await globalUtils.fetchUserById(oldbill.with);
      setWithUser(user.username);
    } else {
      setWithUser('Accounts');
    }
  };

  const disabled = (isAttached || oldbill.with !== 'Accounts') && oldbill.with;

  useEffect(() => {
    fetchWithUser();
  }, []);
  return (
    <>
      <div className="old-bill bill-number">{oldbill.billNumber}</div>
      <div className="old-bill bill-number">
        {new Date(oldbill.billCreationTime).toLocaleDateString()}
      </div>
      <div className="old-bill with">{withUser}</div>
      <div className="old-bill amount">
        {globalUtils.getCurrencyFormat(oldbill.orderAmount)}
      </div>

      <div className="old-bill amount">
        {globalUtils.getCurrencyFormat(oldbill.balance)}
      </div>

      <div className="old-bill">
        {globalUtils.getDaysPassed(oldbill.billCreationTime)}d
      </div>
      <div
        className="old-bill due-status"
        style={{ color: dueStatus.color, fontWeight: 'bold' }}
      >
        {dueStatus.text}
      </div>
      <Tooltip content={oldbill.note}>
        <Input
          disabled={disabled}
          style={{ width: '100px' }}
          size="small"
          className="old-bill notes"
          value={newNotes}
          appearance="underline"
          placeholder={oldbill.accountsNotes || '--'}
          onChange={(_, t) => setNewNotes(t.value)}
        />
      </Tooltip>
      {isAttached ? (
        <Button
          className="old-bill"
          appearance="subtle"
          onClick={() => removeAttachedBill()}
        >
          Remove Bill
        </Button>
      ) : (
        <Tooltip
          content={
            withUser !== 'Accounts'
              ? 'Cannot attach bill as it is not present in accounts.'
              : 'Attach Bill'
          }
        >
          <Button
            disabled={disabled}
            className="old-bill"
            appearance="subtle"
            style={{ color: disabled ? '#dddddd' : '#F25C54' }}
            onClick={() => onAttachBill()}
          >
            Attach Bill
          </Button>
        </Tooltip>
      )}
    </>
  );
}

function SupplementaryBillRow({
  oldbill,
  isAttached,
  removeAttachedBill,
  saveBill,
}) {
  const [newBalance, setNewBalance] = useState('');
  const [newNotes, setNewNotes] = useState(oldbill.accountsNotes);
  const [scheduledData, setScheduledDate] = useState();
  const [isSaved, setIsSaved] = useState(false);

  const [party, setParty] = useState();

  const getParty = async () => {
    const party1 = await globalUtils.fetchPartyInfo(oldbill.partyId);
    setParty(party1);
  };
  const scheduledForPaymentDate = () => {
    if (oldbill.schedulePaymentDate) {
      const date = new Date(oldbill.schedulePaymentDate);
      return date.toLocaleDateString();
    }
    return '--';
  };

  const onSaveBill = (save) => {
    const modifiedBill = { ...oldbill };
    if (newNotes && newNotes.length > 0) {
      modifiedBill.notes = newNotes;
    }
    if (newBalance && newBalance.length > 0) {
      modifiedBill.balance = parseInt(newBalance, 10);
    }
    console.log(modifiedBill);
    saveBill(modifiedBill);
  };

  useEffect(() => {
    getParty();
  }, []);
  return (
    <div>
      <VerticalSpace1 />
      <div style={{ width: '80%', textAlign: 'left', marginBottom: '5px' }}>
        {party?.name}
      </div>
      <div className="supplementary-bill-row">
        <Text size={200} className="old-bill bill-number">
          {oldbill.billNumber || '--'}
        </Text>
        <Text size={200} className="old-bill bill-number">
          {new Date(oldbill.creationTime).toLocaleDateString()}
        </Text>
        <div className="old-bill amount">₹{oldbill.orderAmount}</div>

        <div>{globalUtils.getDaysPassed(oldbill.creationTime)} Days</div>

        <Tooltip content={`₹${oldbill.balance}`}>
          <Input
            disabled={isSaved}
            style={{ width: '100px' }}
            size="small"
            value={newBalance}
            contentBefore="₹"
            appearance="underline"
            placeholder={`${oldbill.balance}`}
            className="old-bill amount"
            onChange={(_, d) => setNewBalance(d.value)}
          />
        </Tooltip>
        <Tooltip content={oldbill.accountsNotes}>
          <Input
            disabled={isSaved}
            style={{ width: '100px' }}
            size="small"
            className="old-bill notes"
            value={newNotes}
            appearance="underline"
            placeholder={oldbill.accountsNotes || 'Notes'}
            onChange={(_, t) => setNewNotes(t.value)}
          />
        </Tooltip>
        <span style={{ display: 'flex' }}>
          {isSaved ? (
            <Button
              className="old-bill"
              appearance="subtle"
              onClick={() => {
                setIsSaved(false);
              }}
            >
              <Edit12Filled />
            </Button>
          ) : (
            <Button
              className="old-bill"
              appearance="subtle"
              style={{ color: '#00A9A5' }}
              onClick={() => {
                onSaveBill();
                setIsSaved(true);
              }}
            >
              <Checkmark12Filled />
            </Button>
          )}
          <Button
            className="old-bill"
            appearance="subtle"
            onClick={() => removeAttachedBill()}
          >
            <DeleteRegular />
          </Button>
        </span>
      </div>
    </div>
  );
}
