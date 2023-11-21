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
} from '@fluentui/react-components';
import {
  DeleteRegular,
  Person12Filled,
  Check20Filled,
} from '@fluentui/react-icons';
import shortid from 'shortid';
import { useLocation } from 'react-router-dom';
import { addDoc, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import BillSelector from '../../components/billSelector/billSelector';
import AllUsersContext, { useAuthUser } from '../../contexts/allUsersContext';
import constants from '../../constants';
import { showToast } from '../../common/toaster';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import { firebaseDB } from '../../firebaseInit';
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
  };

  useEffect(() => {
    if (prefillSupplyReport) {
      prefillState();
    }
    getNewSupplyReportNumber();
  }, []);

  const addBills = (b) => {
    const toAddBills = [];
    b.forEach((element) => {
      if (bills.findIndex((x) => x.id === element.id) === -1) {
        toAddBills.push(element);
      }
    });

    setBills([...bills, ...toAddBills]);
    setModifiedBills([...modifiedBills, ...toAddBills]);
  };

  const getTotalCases = () =>
    modifiedBills.reduce((acc, cur) => acc + cur.bags[0].quantity, 0);
  const getTotalPackets = () =>
    modifiedBills.reduce((acc, cur) => acc + cur.bags[1].quantity, 0);
  const getTotalPolyBags = () =>
    modifiedBills.reduce((acc, cur) => acc + cur.bags[2].quantity, 0);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const onSubmit = async (save) => {
    if (bills.length === 0) {
      showToast(dispatchToast, 'Please add bills', 'error');
      return;
    }

    if (!selectedSupplyman) {
      showToast(dispatchToast, 'Please select a supplyman', 'error');
      return;
    }

    let billNumbersAdded = true;
    modifiedBills.forEach((bi) => {
      if (
        !bi.billNumber ||
        bi.billNumber.length === 0 ||
        bi.billNumber === 'T-'
      ) {
        billNumbersAdded = false;
      }
    });

    if (!billNumbersAdded) {
      showToast(dispatchToast, 'Please enter bill numberds', 'error');
      return;
    }

    try {
      setLoading(true);
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
          timestamp: new Date().getTime(),
          numCases: getTotalCases(),
          numPackets: getTotalPackets(),
          numPolybags: getTotalPolyBags(),
          note: notes,
          orders: bills.map((b) => b.id),
          supplymanId: selectedSupplyman.uid,
        };
      } else {
        supplyReport = {
          timestamp: new Date().getTime(),
          numCases: getTotalCases(),
          numPackets: getTotalPackets(),
          numPolybags: getTotalPolyBags(),
          isCompleted: false,
          note: notes,
          orders: bills.map((b) => b.id),
          supplymanId: selectedSupplyman.uid,
          id: reportDocRef.id,
          status: constants.firebase.supplyReportStatus.TOACCOUNTS,
          receiptNumber: srNumber,
        };
      }
      const docRef = setDoc(reportDocRef, supplyReport);

      for (const modifiedBill1 of modifiedBills) {
        const orderRef = doc(firebaseDB, 'orders', modifiedBill1.id);

        updateDoc(orderRef, {
          bags: modifiedBill1.bags,
          billNumber: modifiedBill1.billNumber,
        });
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

  return (
    <>
      {loading ? <Loader translucent /> : null}
      <Toaster toasterId={toasterId} />
      <div className="create-supply-report-screen-container">
        <center>
          <h3 className="title">
            {prefillSupplyReport
              ? `Supply Report: ${prefillSupplyReport.id}`
              : 'Create Supply Report'}
          </h3>
          <div>{srNumber}</div>
          <VerticalSpace1 />
          {editable ? <BillSelector onBillsAdded={(b) => addBills(b)} /> : null}
          <VerticalSpace2 />
          {bills.length === 0 ? (
            <div className="no-bills-added">No bills added</div>
          ) : (
            <div className="bill-row-container">
              <BillRowLabelHeader />
              {bills.map((b, i) => (
                <BillRow
                  billsRefList={billListRefs}
                  editable={editable}
                  index={i}
                  key={`createsupplyreport-${b.id}`}
                  bill={b}
                  remove={() => {
                    const tempBills = bills.filter(
                      (bill1) => b.id !== bill1.id,
                    );
                    const tempBills2 = modifiedBills.filter(
                      (bill1) => b.id !== bill1.id,
                    );
                    setModifiedBills(tempBills2);
                    setBills(tempBills);
                  }}
                  updatedBill={(newBill) => {
                    const tempBill = [...modifiedBills];
                    tempBill[i] = newBill;
                    setModifiedBills(tempBill);
                  }}
                />
              ))}
            </div>
          )}
          <VerticalSpace1 />
          {bills.length !== 0 ? (
            <>
              <TotalBagsComponent
                cases={getTotalCases()}
                polybags={getTotalPolyBags()}
                packet={getTotalPackets()}
              />
              <VerticalSpace2 />
              <SelectUserDropdown
                placeholder="Select a supplyman"
                disabled={!editable}
                user={selectedSupplyman}
                setUser={setSelectedSupplyman}
              />
              <VerticalSpace2 />
              <Textarea
                disabled={!editable}
                value={notes}
                onChange={(x) => setNotes(x.target.value)}
                style={{ width: '50%' }}
                placeholder="Extra notes"
              />
              <VerticalSpace2 />
              {!prefillSupplyReport ? (
                <Button
                  onClick={() => onSubmit()}
                  size="large"
                  appearance="primary"
                  icon={<Check20Filled />}
                >
                  Forward to accounts
                </Button>
              ) : null}

              {prefillSupplyReport && editable ? (
                <Button
                  onClick={() => onSubmit(true)}
                  size="large"
                  appearance="primary"
                  icon={<Check20Filled />}
                >
                  Save
                </Button>
              ) : null}

              {prefillSupplyReport && !editable ? (
                <Button
                  onClick={() => setEditable(true)}
                  size="large"
                  appearance="primary"
                  icon={<Check20Filled />}
                >
                  Edit Supply Report
                </Button>
              ) : null}
            </>
          ) : null}
        </center>
      </div>
    </>
  );
}

function TotalBagsComponent({ cases, polybags, packet }) {
  return (
    <div className="bag-row-total">
      <Text size={400}>
        Cases:{' '}
        <Text size={600}>
          <b>{cases}</b>
        </Text>
      </Text>
      <Text size={400}>
        Packets:{' '}
        <Text size={600}>
          <b>{packet}</b>
        </Text>
      </Text>
      <Text size={400}>
        Polybag:{' '}
        <Text size={600}>
          <b>{polybags}</b>
        </Text>
      </Text>
    </div>
  );
}

function BillRow({ bill, updatedBill, remove, editable, index }) {
  const { settings } = useSettingsContext();
  const inputId = `createsupreport-bill-${index}`;
  const nextId = `createsupreport-bill-${index + 1}`;
  const handleKeyUp = (e) => {
    if (e.key === 'Enter') {
      document.getElementById(nextId)?.focus();
    }
  };
  return (
    <>
      <Text className="party-name">{bill.party?.name}</Text>
      <Input
        onKeyDown={(e) => handleKeyUp(e)}
        id={inputId}
        style={{ marginRight: '20px', width: '100px' }}
        contentBefore="T-"
        defaultValue={bill.billNumber || ''}
        onChange={(x) => {
          const tempBill = { ...bill };
          tempBill.billNumber = `T-${x.target.value}`;
          updatedBill(tempBill);
        }}
      />
      <Text>{bill.party.fileNumber}</Text>
      <Text>{bill.party.area}</Text>
      <SpinButton
        disabled={!editable}
        className="spinner"
        defaultValue={bill.bags[0].quantity}
        min={0}
        max={20}
        id={shortid.generate()}
        onChange={(_, data) => {
          const tempBill = { ...bill };
          tempBill.bags[0].quantity = parseInt(
            data.value || data.displayValue || 0,
            10,
          );
          updatedBill(tempBill);
        }}
      />
      <SpinButton
        disabled={!editable}
        className="spinner"
        defaultValue={bill.bags[1].quantity}
        onChange={(_, data) => {
          const tempBill = { ...bill };
          tempBill.bags[1].quantity = parseInt(
            data.value || data.displayValue || 0,
            10,
          );
          updatedBill(tempBill);
        }}
        min={0}
        max={20}
        id={shortid.generate()}
      />
      <SpinButton
        disabled={!editable}
        className="spinner"
        defaultValue={bill.bags[2].quantity}
        min={0}
        max={20}
        id={shortid.generate()}
        onChange={(_, data) => {
          const tempBill = { ...bill };
          tempBill.bags[2].quantity = parseInt(
            data.value || data.displayValue || 0,
            10,
          );
          updatedBill(tempBill);
        }}
      />
      {editable ? (
        <Button
          className="delete-button"
          icon={<DeleteRegular />}
          aria-label="Delete"
          onClick={() => {
            remove();
          }}
        />
      ) : (
        <div />
      )}
    </>
  );
}

function BillRowLabelHeader() {
  return (
    <>
      <Text className="party-name label-header">Party</Text>
      <Text className="bill-number label-header">Bill Number</Text>
      <Text className="field label-header">File</Text>

      <Text className="field label-header">Area</Text>
      <Text className="spinner label-header">Cases</Text>
      <Text className="spinner label-header">Packets</Text>
      <Text className="spinner label-header">Polybags</Text>
      <Text className="spinner" />
    </>
  );
}
