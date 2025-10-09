/* eslint-disable no-restricted-syntax */
import React, { useContext, useEffect, useRef, useState } from 'react';
import './style.css';
import {
  Button,
  Dropdown,
  Image,
  Input,
  useId,
  Option,
  SpinButton,
  Text,
  Toaster,
  useToastController,
  Textarea,
  Spinner,
  Tooltip,
} from '@fluentui/react-components';
import {
  DeleteRegular,
  Person12Filled,
  Check20Filled,
} from '@fluentui/react-icons';
import shortid from 'shortid';
import { useLocation } from 'react-router-dom';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import BillSelector from '../../components/billSelector/billSelector';
import AllUsersContext, { useAuthUser } from '../../contexts/allUsersContext';
import constants from '../../constants';
import { showToast, temp } from '../../common/toaster';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import firebaseApp, { firebaseAuth, firebaseDB } from '../../firebaseInit';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import { useSettingsContext } from '../../contexts/settingsContext';
import SelectUserDropdown from '../../common/selectUser';

export default function CreateSupplyReportScreen({ prefillSupplyReportP }) {
  const location = useLocation();

  const locationState = location.state;
  const prefillSupplyReport =
    locationState?.prefillSupplyReport || prefillSupplyReportP;
  const [bills, setBills] = useState([]);
  const [modifiedBills, setModifiedBills] = useState([]);
  const [selectedSupplyman, setSelectedSupplyman] = useState();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [editable, setEditable] = useState(true);
  const [srNumber, setSrNumber] = useState();
  const billListRefs = useRef([]);

  const prefillState = async () => {
    setLoading(true);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(
        prefillSupplyReport.orders,
      );

      fetchedOrders = (await fetchedOrders).filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);
      setBills(fetchedOrders);
      setModifiedBills(fetchedOrders);

      const supplymanUser = await globalUtils.fetchUserById(
        prefillSupplyReport.supplymanId,
      );
      setSelectedSupplyman(supplymanUser);
      setNotes(prefillSupplyReport.note);
      setEditable(false);
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

  const getNewSupplyReportNumber = async () => {
    const srNumber1 = await globalUtils.getNewReceiptNumber(
      constants.newReceiptCounters.SUPPLYREPORTS,
    );
    setSrNumber(srNumber1);
    return srNumber1;
  };

  useEffect(() => {
    if (prefillSupplyReport) {
      prefillState();
    }
    getNewSupplyReportNumber();
  }, []);

  const onRemove = (b) => {
    const tempBills = bills.filter((bill1) => b.id !== bill1.id);
    const tempBills2 = modifiedBills.filter((bill1) => b.id !== bill1.id);
    setModifiedBills(tempBills2);
    setBills(tempBills);
  };
  const addBills = (b) => {
    const toAddBills = [];
    if (bills.findIndex((x) => x.id === b.id) === -1) {
      toAddBills.push(b);
    }

    setBills([...bills, ...toAddBills]);
    setModifiedBills([...modifiedBills, ...toAddBills]);
  };

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const onSubmit = async (save) => {
    if (loading) return;
    if (bills.length === 0) {
      showToast(dispatchToast, 'Please add bills', 'error');
      return;
    }

    let billNumbersAdded = true;
    modifiedBills.forEach((bi) => {
      console.log(bi);
      if (
        !bi.billNumber ||
        bi.billNumber.length !== 8 ||
        bi.billNumber === 'T-'
      ) {
        billNumbersAdded = false;
      }
    });

    if (!billNumbersAdded) {
      showToast(dispatchToast, 'Please enter correct bill numbers', 'error');
      return;
    }
    if (!selectedSupplyman) {
      showToast(dispatchToast, 'Please select a supplyman', 'error');
      return;
    }
    try {
      setLoading(true);
      const newSrNumber2 = await getNewSupplyReportNumber();

      let reportDocRef;
      if (save) {
        reportDocRef = doc(firebaseDB, 'supplyReports', prefillSupplyReport.id);
      } else {
        const supplyReportsCol = collection(firebaseDB, 'supplyReports');
        reportDocRef = doc(supplyReportsCol);
      }

      let supplyReport;
      if (save) {
        supplyReport = {
          ...prefillSupplyReport,
          timestamp: Timestamp.now().toMillis(),
          numCases: globalUtils.getTotalCases(modifiedBills),
          numPackets: globalUtils.getTotalPackets(modifiedBills),
          numPolybags: globalUtils.getTotalPolyBags(modifiedBills),
          note: notes,
          orders: bills.map((b) => b.id),
          supplymanId: selectedSupplyman.uid,
        };
      } else {
        supplyReport = {
          timestamp: Timestamp.now().toMillis(),
          numCases: globalUtils.getTotalCases(modifiedBills),
          numPackets: globalUtils.getTotalPackets(modifiedBills),
          numPolybags: globalUtils.getTotalPolyBags(modifiedBills),
          isCompleted: false,
          note: notes,
          orders: bills.map((b) => b.id),
          supplymanId: selectedSupplyman.uid,
          id: reportDocRef.id,
          status: constants.firebase.supplyReportStatus.TOACCOUNTS,
          receiptNumber: newSrNumber2,
        };
      }
      const docRef = setDoc(reportDocRef, supplyReport);

      for (const modifiedBill1 of modifiedBills) {
        const orderRef = doc(firebaseDB, 'orders', modifiedBill1.id);
        const toUpdateData = {
          orderStatus: constants.firebase.supplyReportStatus.TOACCOUNTS,
          billNumber: modifiedBill1.billNumber,
          bags: modifiedBill1.bags || [],
          orderAmount: modifiedBill1.orderAmount
            ? parseInt(modifiedBill1.orderAmount, 10)
            : undefined,
          flow: [
            ...(modifiedBill1.flow || []),
            {
              employeeId: firebaseAuth.currentUser.uid,
              timestamp: Timestamp.now().toMillis(),
              type: constants.firebase.supplyReportStatus.TOACCOUNTS,
            },
          ],
        };
        updateDoc(orderRef, toUpdateData);
      }

      await globalUtils.incrementReceiptCounter(
        constants.newReceiptCounters.SUPPLYREPORTS,
      );
      showToast(dispatchToast, 'Forwarded to accounts', 'success');
      if (!save) {
        resetScreenState();
      } else {
        setEditable(false);
      }

      getNewSupplyReportNumber();
      setLoading(false);
    } catch (error) {
      console.error('Error adding document: ', error);
      showToast(
        dispatchToast,
        `An error occured uploading supply report ${error}`,
        'error',
      );
      setLoading(false);
    }
  };

  const onSave = () => {};

  const resetScreenState = () => {
    setNotes('');
    setBills([]);
    setModifiedBills([]);
    setSelectedSupplyman(null);
  };

  return loading ? (
    <Loader translucent />
  ) : (
    <>
      <Toaster toasterId={toasterId} />
      <div className="create-supply-report-screen-container">
        <div className="supply-report-header">
          <div className="header-content">
            <h2 className="title">
              {prefillSupplyReport
                ? `Supply Report: ${prefillSupplyReport.id}`
                : 'Create Supply Report'}
            </h2>
            <div className="sr-number">
              <Text size={300} weight="semibold">
                SR Number:{' '}
              </Text>
              <Text size={300} weight="bold">
                {srNumber}
              </Text>
            </div>
          </div>
        </div>

        <div className="supply-report-content">
          {editable && (
            <div className="add-bill-section">
              <BillSelector
                focusFirstElement={() => {
                  const inputId = document.getElementById(
                    `createsupreport-bill-${0}`,
                  );
                  if (inputId) {
                    inputId.focus();
                  }
                }}
                bills={bills}
                onAdd={addBills}
                onRemove={onRemove}
              />
            </div>
          )}

          {bills.length === 0 ? (
            <div className="no-bills-added">
              <Text size={400} style={{ color: '#666' }}>
                No bills added yet. Click &quot;Add Bill&quot; to get started.
              </Text>
            </div>
          ) : (
            <div className="bills-section">
              <div className="bills-header">
                <Text size={500} weight="semibold">
                  Bills ({bills.length})
                </Text>
              </div>
              <div className="bill-row-container">
                <BillRowLabelHeader />
                {modifiedBills.map((b, i) => (
                  <BillRow
                    originalBill={bills[i]}
                    billsRefList={billListRefs}
                    editable={editable}
                    index={i * 2}
                    key={`createsupplyreport-${b.id}`}
                    bill={b}
                    remove={() => {
                      onRemove(b);
                    }}
                    updatedBill={(newBill) => {
                      const tempBill = [...modifiedBills];
                      tempBill[i] = newBill;
                      setModifiedBills(tempBill);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {bills.length !== 0 && (
            <div className="summary-section">
              <div className="summary-header">
                <Text size={500} weight="semibold">
                  Summary
                </Text>
              </div>

              <div className="summary-content">
                <TotalBagsComponent
                  cases={globalUtils.getTotalCases(modifiedBills)}
                  polybags={globalUtils.getTotalPolyBags(modifiedBills)}
                  packet={globalUtils.getTotalPackets(modifiedBills)}
                />

                <div className="form-fields">
                  <div className="field-group">
                    <Text size={400} weight="semibold" className="field-label">
                      Supplyman
                    </Text>
                    <SelectUserDropdown
                      placeholder="Select a supplyman"
                      disabled={!editable}
                      user={selectedSupplyman}
                      setUser={setSelectedSupplyman}
                    />
                  </div>

                  <div className="field-group">
                    <Text size={400} weight="semibold" className="field-label">
                      Notes
                    </Text>
                    <Textarea
                      disabled={!editable}
                      value={notes}
                      onChange={(x) => setNotes(x.target.value)}
                      placeholder="Add any additional notes..."
                      style={{
                        borderRadius: '8px',
                        border: '1px solid #e1e5e9',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {bills.length !== 0 && (
            <div className="action-buttons">
              {!prefillSupplyReport ? (
                <Button
                  onClick={() => onSubmit()}
                  size="large"
                  appearance="primary"
                  icon={<Check20Filled />}
                  style={{
                    borderRadius: '8px',
                    fontWeight: '500',
                    minWidth: '200px',
                  }}
                >
                  Forward to Accounts
                </Button>
              ) : null}

              {prefillSupplyReport && editable ? (
                <Button
                  onClick={() => onSubmit(true)}
                  size="large"
                  appearance="primary"
                  icon={<Check20Filled />}
                  style={{
                    borderRadius: '8px',
                    fontWeight: '500',
                    minWidth: '120px',
                  }}
                >
                  Save Changes
                </Button>
              ) : null}

              {prefillSupplyReport && !editable ? (
                <Button
                  onClick={() => setEditable(true)}
                  size="large"
                  appearance="primary"
                  icon={<Check20Filled />}
                  style={{
                    borderRadius: '8px',
                    fontWeight: '500',
                    minWidth: '160px',
                  }}
                >
                  Edit Supply Report
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TotalBagsComponent({ cases, polybags, packet }) {
  return (
    <div className="bag-row-total">
      <div className="bag-item">
        <Text size={300} className="bag-label">
          Cases
        </Text>
        <Text size={500} weight="bold" className="bag-value">
          {cases}
        </Text>
      </div>
      <div className="bag-item">
        <Text size={300} className="bag-label">
          Packets
        </Text>
        <Text size={500} weight="bold" className="bag-value">
          {packet}
        </Text>
      </div>
      <div className="bag-item">
        <Text size={300} className="bag-label">
          Polybags
        </Text>
        <Text size={500} weight="bold" className="bag-value">
          {polybags}
        </Text>
      </div>
    </div>
  );
}

function BillRow({ originalBill, bill, updatedBill, remove, editable, index }) {
  const { settings } = useSettingsContext();
  const inputId = `createsupreport-bill-${index}`;
  const inputId2 = `createsupreport-bill-${index + 1}`;
  const nextId = `createsupreport-bill-${index + 1}`;
  const nextId2 = `createsupreport-bill-${index + 2}`;

  const handleKeyUp = (e) => {
    if (e.key === 'Enter') {
      document.getElementById(nextId)?.focus();
    }
  };

  const handleKeyUp2 = (e) => {
    if (e.key === 'Enter') {
      document.getElementById(nextId2)?.focus();
    }
  };
  if (!bill.bags || bill.bags?.length === 0) {
    bill.bags = [
      {
        bagType: 'Case',
        quantity: 0,
      },
      {
        bagType: 'Packet',
        quantity: 0,
      },
      {
        bagType: 'Polybag',
        quantity: 0,
      },
    ];
  }

  return (
    <div className="bill-row">
      <div className="party-info">
        <div className="party-header">
          <Text size={400} weight="semibold" className="party-name">
            {bill.party?.name}
          </Text>
          {bill.margUpdated && <span className="marg-sync-badge">Marg</span>}
        </div>
        <Text size={300} className="party-area">
          {bill.party.area}
        </Text>
      </div>

      <div className="bill-inputs">
        <div className="input-row">
          <div className="input-field">
            <Input
              onKeyDown={(e) => handleKeyUp(e)}
              id={inputId}
              contentBefore="T-"
              defaultValue={bill.billNumber?.replace('T-', '') || ''}
              type="number"
              size="small"
              disabled={!editable}
              placeholder="Bill #"
              style={{
                width: '100px',
                borderRadius: '6px',
              }}
              onChange={(x) => {
                const tempBill = { ...bill };
                tempBill.billNumber = `T-${x.target.value}`;
                updatedBill(tempBill);
              }}
            />
          </div>
          <div className="input-field">
            <Input
              onKeyDown={(e) => handleKeyUp2(e)}
              id={`${inputId2}`}
              contentBefore="₹"
              type="number"
              size="small"
              disabled={!editable}
              placeholder={originalBill.orderAmount}
              style={{
                width: '100px',
                borderRadius: '6px',
              }}
              onChange={(x) => {
                const tempBill = { ...bill };
                tempBill.orderAmount = x.target.value;
                updatedBill(tempBill);
              }}
            />
          </div>
        </div>
      </div>

      <div className="bag-inputs">
        <div className="bag-row">
          <div className="bag-item">
            <SpinButton
              disabled={!editable}
              defaultValue={bill.bags ? bill.bags[0].quantity : 0}
              min={0}
              max={20}
              size="small"
              id={shortid.generate()}
              style={{ width: '60px' }}
              onChange={(_, data) => {
                const tempBill = { ...bill };
                tempBill.bags[0].quantity = parseInt(
                  data.value || data.displayValue || 0,
                  10,
                );
                updatedBill(tempBill);
              }}
            />
            <Text size={200} className="bag-label">
              C
            </Text>
          </div>
          <div className="bag-item">
            <SpinButton
              disabled={!editable}
              defaultValue={bill.bags ? bill.bags[1].quantity : 0}
              min={0}
              max={20}
              size="small"
              id={shortid.generate()}
              style={{ width: '60px' }}
              onChange={(_, data) => {
                const tempBill = { ...bill };
                tempBill.bags[1].quantity = parseInt(
                  data.value || data.displayValue || 0,
                  10,
                );
                updatedBill(tempBill);
              }}
            />
            <Text size={200} className="bag-label">
              P
            </Text>
          </div>
          <div className="bag-item">
            <SpinButton
              disabled={!editable}
              defaultValue={bill.bags ? bill.bags[2].quantity : 0}
              min={0}
              max={20}
              size="small"
              id={shortid.generate()}
              style={{ width: '60px' }}
              onChange={(_, data) => {
                const tempBill = { ...bill };
                tempBill.bags[2].quantity = parseInt(
                  data.value || data.displayValue || 0,
                  10,
                );
                updatedBill(tempBill);
              }}
            />
            <Text size={200} className="bag-label">
              B
            </Text>
          </div>
        </div>
      </div>

      {editable && (
        <Button
          className="delete-button"
          icon={<DeleteRegular />}
          aria-label="Delete"
          size="small"
          appearance="subtle"
          onClick={() => {
            remove();
          }}
        />
      )}
    </div>
  );
}

function BillRowLabelHeader() {
  return (
    <div className="bill-row-header">
      <div className="header-party">Party</div>
      <div className="header-inputs">Bill information</div>
      <div className="header-bags">Goods</div>
      <div className="header-actions">Action</div>
    </div>
  );
}
