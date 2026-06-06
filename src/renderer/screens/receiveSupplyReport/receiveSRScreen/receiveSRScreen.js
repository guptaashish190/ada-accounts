/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable radix */
/* eslint-disable no-restricted-syntax */

import { Timestamp, getDoc, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DatePicker, setMonth } from '@fluentui/react-datepicker-compat';
import {
  Button,
  Card,
  Field,
  Input,
  Text,
  Toaster,
  Tooltip,
  makeStyles,
  useId,
  useToastController,
} from '@fluentui/react-components';

import { Open12Filled, Dismiss12Filled } from '@fluentui/react-icons';
import math, { parse } from 'mathjs';
import Loader from '../../../common/loader';
import { VerticalSpace1 } from '../../../common/verticalSpace';
import globalUtils from '../../../services/globalUtils';
import { showToast } from '../../../common/toaster';
import './style.css';
import { firebaseAuth, firebaseDB } from '../../../firebaseInit';
import { useCompany } from '../../../contexts/companyContext';
import { useSettingsContext } from '../../../contexts/settingsContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../../services/firestoreHelpers';
import AdjustAmountDialog from '../adjustAmountOnBills/adjustAmountDialog';
import constants from '../../../constants';
import BillRow from './billRow';
import {
  getErpBalance,
  getHandoverBalance,
  mergeHandoverOntoBills,
} from '../../../services/handoverBalanceUtils';

// for bill bundles and supply reports
export default function ReceiveSRScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { supplyReport, isBundle } = state;
  const [groupedPrimaryBills, setGroupedPrimaryBills] = useState({});
  const [groupedOldBills, setGroupedOldBills] = useState({});
  const [groupedSupplementaryBills, setGroupedSupplementaryBills] = useState(
    {},
  );
  const [supplymanUser, setSupplymanUser] = useState();
  const [receivedBills, setReceivedBills] = useState([]);
  const [returnedBills, setReturnedBills] = useState([]);
  const [receivedReturnedBillIds, setReceivedReturnedBillIds] = useState([]);
  const [withPartyBillIds, setWithPartyBillIds] = useState([]);
  // { [partyId]: { cash, cheque, upi, neft, scheduleDate, notes } }
  const [partyPaymentInputs, setPartyPaymentInputs] = useState(() => {
    const collections = supplyReport.partyCollections || [];
    if (collections.length === 0) return {};
    const prefill = {};
    for (const col of collections) {
      const { partyId, payments = [] } = col;
      if (!prefill[partyId]) {
        prefill[partyId] = { cash: '', cheque: '', upi: '', neft: '' };
      }
      for (const p of payments) {
        const type = p.type === 'other' ? 'neft' : p.type;
        const prev = parseInt(prefill[partyId][type] || '0') || 0;
        prefill[partyId][type] = String(prev + (parseInt(p.amount) || 0));
      }
    }
    return prefill;
  });

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const { currentCompanyId } = useCompany();
  const { settings } = useSettingsContext();
  const billWithPartyUserId = settings?.billWithParty?.userId || '';

  const dbName = isBundle ? DB_NAMES.BILL_BUNDLES : DB_NAMES.SUPPLY_REPORTS;
  const dbBills = isBundle ? supplyReport.bills : supplyReport.orders;
  const [loading, setLoading] = useState(false);
  const getGroupedBills = async (orderIds, assignmentDetails = []) => {
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(
        orderIds,
        currentCompanyId,
      );
      fetchedOrders = fetchedOrders.filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(
        fetchedOrders,
        currentCompanyId,
      );
      if (assignmentDetails?.length) {
        fetchedOrders = mergeHandoverOntoBills(
          fetchedOrders,
          assignmentDetails,
        );
      }
      const groupedOrders = {};
      for (const element of fetchedOrders) {
        if (groupedOrders[element.partyId] !== undefined) {
          groupedOrders[element.partyId] = [
            ...groupedOrders[element.partyId],
            element,
          ];
        } else {
          groupedOrders[element.partyId] = [element];
        }
      }
      return groupedOrders;
    } catch (e) {
      console.error(e);
    }
    return {};
  };
  const getAllReturnedBills = async () => {
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(
        supplyReport.returnedBills.map((x) => x.billId),
        currentCompanyId,
      );

      fetchedOrders = fetchedOrders.filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(
        fetchedOrders,
        currentCompanyId,
      );
      setReturnedBills(fetchedOrders);
    } catch (e) {
      console.error(e);
    }
  };

  const init = async () => {
    setLoading(true);
    if (supplyReport?.supplymanId) {
      try {
        const supplymanUserData = await globalUtils.fetchUserById(
          supplyReport.supplymanId,
        );
        setSupplymanUser(supplymanUserData);
      } catch (e) {
        console.error('Failed to fetch supplyman user:', e);
      }
    }
    if (isBundle) {
      const obg = await getGroupedBills(
        supplyReport.bills,
        supplyReport.assignmentDetails || [],
      );

      setGroupedSupplementaryBills(obg || {});
    } else {
      const pbg = await getGroupedBills(supplyReport.orders);
      const obg = await getGroupedBills(supplyReport.attachedBills);
      const sbg = await getGroupedBills(supplyReport.supplementaryBills);

      setGroupedPrimaryBills(pbg || {});
      setGroupedOldBills(obg || {});
      setGroupedSupplementaryBills(sbg || {});
      await getAllReturnedBills();
    }
    setLoading(false);
  };

  useEffect(() => {
    init();
    console.log('init');
  }, []);

  const receiveBill = (bi) => {
    setReceivedBills((r) => {
      if (r.find((bill) => bill.id === bi.id)) return r;
      return [...r, bi];
    });
  };

  const addReturnedBill = (bill) => {
    setReturnedBills((current) => {
      if (current.find((existing) => existing.id === bill.id)) return current;
      return [...current, bill];
    });
  };

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
  };

  const updatePartyPayment = (partyId, field, value) => {
    setPartyPaymentInputs((prev) => ({
      ...prev,
      [partyId]: { ...(prev[partyId] || {}), [field]: value },
    }));
  };

  const processedBillsCount =
    receivedBills.length +
    receivedReturnedBillIds.length +
    withPartyBillIds.length +
    (supplyReport.orderDetails?.length || 0);

  const allBillsReceived =
    processedBillsCount ===
    [
      ...dbBills,
      ...(supplyReport.supplementaryBills || []),
      ...(supplyReport.attachedBills || []),
    ].length;

  // update order details in the supplyreport and individual orders
  const onComplete = async () => {
    setLoading(true);

    try {
      if (withPartyBillIds.length > 0 && !billWithPartyUserId) {
        showToast(
          dispatchToast,
          'Set "Bill With Party" user in Settings first',
          'error',
        );
        setLoading(false);
        return;
      }

      const supplyReportRef = getCompanyDoc(
        currentCompanyId,
        dbName,
        supplyReport.id,
      );
      const supplyReportDataNew = (await getDoc(supplyReportRef)).data();
      const now = Timestamp.now().toMillis();
      const employeeId = firebaseAuth.currentUser.uid;

      // Build partyPayments from partyPaymentInputs for parties with received bills
      const receivedPartyIds = [
        ...new Set(receivedBills.map((rb) => rb.partyId)),
      ];
      const partyPaymentsToWrite = receivedPartyIds
        .map((partyId) => {
          const input = partyPaymentInputs[partyId] || {};
          const payments = [
            input.cash > 0 && { type: 'cash', amount: parseInt(input.cash || '0') },
            input.cheque > 0 && { type: 'cheque', amount: parseInt(input.cheque || '0') },
            input.upi > 0 && { type: 'upi', amount: parseInt(input.upi || '0') },
            input.neft > 0 && { type: 'neft', amount: parseInt(input.neft || '0') },
          ].filter(Boolean);
          return {
            partyId,
            payments,
            ...(input.scheduleDate
              ? { schedulePaymentDate: input.scheduleDate.getTime() }
              : {}),
            notes: input.notes || '',
            receivedBy: employeeId,
            timestamp: now,
          };
        })
        .filter((pp) => pp.payments.length > 0);

      const batch = writeBatch(firebaseDB);

      batch.update(supplyReportRef, {
        ...(allBillsReceived
          ? {
              status: isBundle
                ? constants.firebase.billBundleFlowStatus.COMPLETED
                : constants.firebase.supplyReportStatus.COMPLETED,
            }
          : {}),
        orderDetails: [
          ...(supplyReportDataNew.orderDetails || []),
          ...receivedBills.map((rb) => ({
            billId: rb.id,
            with: rb.with,
            ...(isBundle
              ? {
                  handoverBalance: getHandoverBalance(rb),
                  erpBalanceAtReceive: getErpBalance(rb),
                }
              : {}),
          })),
          ...withPartyBillIds.map((billId) => ({
            billId,
            with: billWithPartyUserId,
          })),
        ],
        ...(partyPaymentsToWrite.length > 0
          ? { partyPayments: [...(supplyReportDataNew.partyPayments || []), ...partyPaymentsToWrite] }
          : {}),
        ...(!isBundle
          ? {
              returnedBills: [
                ...returnedBills.map((x) => ({
                  billId: x.id,
                  remarks: x.notes || '',
                })),
              ],
            }
          : {}),
        receivedBy: employeeId,
      });

      for (const rb2 of receivedBills) {
        const orderRef = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.ORDERS,
          rb2.id,
        );
        batch.update(orderRef, {
          flow: [
            ...rb2.flow,
            {
              employeeId,
              timestamp: now,
              type: constants.firebase.billFlowTypes.RECEIVED_BILL,
            },
          ],
          flowCompleted: true,
          orderStatus: constants.firebase.billFlowTypes.RECEIVED_BILL,
          with: rb2.with,
        });
      }

      const billById = new Map();
      for (const bill of [
        ...Object.values(groupedPrimaryBills).flat(),
        ...returnedBills,
        ...Object.values(groupedOldBills).flat(),
        ...Object.values(groupedSupplementaryBills).flat(),
      ]) {
        billById.set(bill.id, bill);
      }

      for (const billId of withPartyBillIds) {
        const selectedBill = billById.get(billId);
        if (!selectedBill) continue;

        const orderRef = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.ORDERS,
          selectedBill.id,
        );

        batch.update(orderRef, {
          flow: [
            ...(selectedBill.flow || []),
            {
              employeeId,
              timestamp: now,
              type: constants.firebase.billFlowTypes.BILL_WITH_PARTY,
            },
          ],
          flowCompleted: true,
          orderStatus: constants.firebase.billFlowTypes.BILL_WITH_PARTY,
          with: billWithPartyUserId,
        });
      }

      for (const rb2 of returnedBills.filter((bill) =>
        receivedReturnedBillIds.includes(bill.id),
      )) {
        const orderRef = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.ORDERS,
          rb2.id,
        );

        batch.update(orderRef, {
          flow: [
            ...rb2.flow,
            {
              employeeId,
              timestamp: now,
              type: constants.firebase.billFlowTypes.GOODS_RETURN_RECD,
            },
          ],
          balance: 0,
          flowCompleted: true,
          orderStatus: constants.firebase.billFlowTypes.GOODS_RETURN_RECD,
          with: 'Accounts',
          accountsNotes: rb2.notes || '',
        });
      }

      await batch.commit();

      showToast(dispatchToast, 'All Bills Received', 'success');
      onCreateCashReceipt();
    } catch (error) {
      console.error('Error updating document: ', error);
      showToast(dispatchToast, 'An error occured', 'error');
      setLoading(false);
    }
  };

  const onCreateCashReceipt = () => {
    const prItems = {};

    // Read cash amounts from party-level payment inputs
    const receivedPartyIds = [...new Set(receivedBills.map((rb) => rb.partyId))];
    receivedPartyIds.forEach((partyId) => {
      const input = partyPaymentInputs[partyId] || {};
      const cashAmt = parseInt(input.cash || '0');
      if (cashAmt > 0) {
        prItems[partyId] = {
          amount: cashAmt,
          accountsNotes: input.notes || '',
        };
      }
    });

    if (!Object.keys(prItems).length) {
      showToast(dispatchToast, 'No Cash Received', 'error');
      window.close();
      return;
    }

    const updatedModelPrItems = Object.keys(prItems).map((pri) => {
      return {
        partyId: pri,
        amount: prItems[pri].amount,
        accountsNotes: prItems[pri].accountsNotes,
      };
    });
    setLoading(false);

    navigate('/createPaymentReceipts', {
      replace: true,
      state: {
        supplyReportId: supplyReport.id,
        prItems: updatedModelPrItems,
        supplymanId: supplyReport.supplymanId,
      },
    });
  };
  if (loading) return <Loader />;

  const renderBillRow = (bill, { isOld = false } = {}) => {
    const isBillReturned =
      returnedBills.findIndex((x) => x.id === bill.id) !== -1;
    const isReturnReceived = receivedReturnedBillIds.includes(bill.id);

    return (
      <BillRow
        supplyReport={supplyReport}
        useHandoverBalance={isBundle}
        isOld={isOld}
        isReturned={isBillReturned}
        allowReceiveReturned={isBillReturned}
        isReturnReceived={isReturnReceived}
        onReceiveReturned={() => {
          setReceivedReturnedBillIds((ids) => {
            if (ids.includes(bill.id)) return ids;
            return [...ids, bill.id];
          });
        }}
        onUndoReturnReceived={() => {
          setReceivedReturnedBillIds((ids) =>
            ids.filter((id) => id !== bill.id),
          );
          setReturnedBills((existing) =>
            existing.filter((x) => x.id !== bill.id),
          );
        }}
        isWithParty={withPartyBillIds.includes(bill.id)}
        onWithParty={() => {
          addWithPartyBill(bill);
        }}
        onUndoWithParty={() => {
          setWithPartyBillIds((ids) => ids.filter((id) => id !== bill.id));
        }}
        onReturn={() => {
          addReturnedBill(bill);
          setWithPartyBillIds((ids) => ids.filter((id) => id !== bill.id));
        }}
        onReceive={(x) => {
          receiveBill(x);
          setWithPartyBillIds((ids) => ids.filter((id) => id !== bill.id));
        }}
        key={`rsr-${bill.id}`}
        data={bill}
        isReceived={receivedBills.findIndex((x) => x.id === bill.id) !== -1}
        onUndo={() => {
          setReceivedBills((b) => b.filter((tb) => tb.id !== bill.id));
          setReturnedBills((b) => b.filter((tb) => tb.id !== bill.id));
          setReceivedReturnedBillIds((ids) =>
            ids.filter((id) => id !== bill.id),
          );
          setWithPartyBillIds((ids) => ids.filter((id) => id !== bill.id));
        }}
      />
    );
  };

  const renderPartyPaymentInputs = (partyId) => {
    const partyInput = partyPaymentInputs[partyId] || {};
    return (
      <div className="party-payment-inputs">
        <div className="party-payment-row">
          <div className="payment-group">
            <div className="payment-label">Cash</div>
            <Input size="small" type="number" placeholder="0" contentBefore="₹"
              value={partyInput.cash || ''} onChange={(_, e) => updatePartyPayment(partyId, 'cash', e.value)} />
          </div>
          <div className="payment-group">
            <div className="payment-label">Cheque</div>
            <Input size="small" type="number" placeholder="0" contentBefore="₹"
              value={partyInput.cheque || ''} onChange={(_, e) => updatePartyPayment(partyId, 'cheque', e.value)} />
          </div>
          <div className="payment-group">
            <div className="payment-label">UPI</div>
            <Input size="small" type="number" placeholder="0" contentBefore="₹"
              value={partyInput.upi || ''} onChange={(_, e) => updatePartyPayment(partyId, 'upi', e.value)} />
          </div>
          <div className="payment-group">
            <div className="payment-label">NEFT</div>
            <Input size="small" type="number" placeholder="0" contentBefore="₹"
              value={partyInput.neft || ''} onChange={(_, e) => updatePartyPayment(partyId, 'neft', e.value)} />
          </div>
          <div className="payment-row-divider" />
          <div className="input-group input-group-date">
            <div className="input-label">Schedule Date</div>
            <DatePicker size="small" placeholder="Select date"
              value={partyInput.scheduleDate || null}
              onSelectDate={(d) => updatePartyPayment(partyId, 'scheduleDate', d)} />
          </div>
          <div className="input-group input-group-notes">
            <div className="input-label">Notes</div>
            <Input size="small" placeholder="Accounts notes..."
              value={partyInput.notes || ''} onChange={(_, e) => updatePartyPayment(partyId, 'notes', e.value)} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Toaster toasterId={toasterId} />

      <div className="receive-sr-container">
        <div className="header-section">
          <h3 className="page-title">
            Receive {isBundle ? 'Bundle' : 'Supply Report'}:{' '}
            {supplyReport.receiptNumber}
          </h3>
          <Text>
            Date:{' '}
            <b>
              {supplyReport.timestamp
                ? globalUtils.getTimeFormat(supplyReport.timestamp, true)
                : '--'}
            </b>
          </Text>
          {!isBundle && (
            <Text>
              Supplyman: <b>{supplymanUser?.username || '--'}</b>
            </Text>
          )}
          {supplyReport.dispatchAccountNotes && (
            <div className="accounts-notes">
              <Text className="notes-label">Accounts Notes:</Text>
              <Text className="notes-content">
                {supplyReport.dispatchAccountNotes}
              </Text>
            </div>
          )}
        </div>
        <div className="bills-section">
          {!isBundle && Object.values(groupedPrimaryBills).map((bills) => {
            const partyId = bills[0].partyId;
            return (
              <div
                key={`primary-${partyId}`}
                className="party-section-receive-sr"
              >
                <div className="title-sr">
                  <span className="party-name">{bills[0].party?.name}</span>
                  <span className="payment-terms">
                    Payment:{' '}
                    {bills[0].party?.creditDays != null
                      ? `${bills[0].party.creditDays} days credit`
                      : bills[0].party?.paymentTerms || '-'}
                  </span>
                </div>

                {renderPartyPaymentInputs(partyId)}

                <div className="party-bills-container">
                  {bills.map((bill) => renderBillRow(bill))}
                  {groupedOldBills[partyId]?.map((oldBill) =>
                    renderBillRow(oldBill, { isOld: true }),
                  )}
                </div>
              </div>
            );
          })}
          {!isBundle && Object.keys(groupedOldBills)
            .filter((partyId) => !groupedPrimaryBills[partyId])
            .map((partyId) => {
              const oldBills = groupedOldBills[partyId];
              return (
                <div
                  key={`attached-${partyId}`}
                  className="party-section-receive-sr"
                >
                  <div className="title-sr">
                    <span className="party-name">{oldBills[0].party?.name}</span>
                    <span className="supplementary-label">Attached Bills</span>
                  </div>

                  {renderPartyPaymentInputs(partyId)}

                  <div className="party-bills-container">
                    {oldBills.map((oldBill) =>
                      renderBillRow(oldBill, { isOld: true }),
                    )}
                  </div>
                </div>
              );
            })}
          {Object.values(groupedSupplementaryBills).map((bills) => {
            const partyId = bills[0].partyId;
            return (
              <div
                key={`supp-${partyId}`}
                className="party-section-receive-sr"
              >
                <div className="title-sr">
                  <span className="party-name">{bills[0].party?.name}</span>
                  <span className="supplementary-label">
                    {isBundle ? 'Bundle Bills' : 'Supplementary Bills'}
                  </span>
                </div>

                {renderPartyPaymentInputs(partyId)}

                <div className="party-bills-container">
                  {bills.map((bill) => renderBillRow(bill, { isOld: true }))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="footer-section">
          <div className="progress-info">
            <Text className="progress-text">
              Progress:{' '}
              {processedBillsCount}{' '}
              /{' '}
              {
                [
                  ...dbBills,
                  ...(supplyReport.supplementaryBills || []),
                  ...(supplyReport.attachedBills || []),
                ].length
              }{' '}
              bills processed
            </Text>
          </div>

          <div className="action-buttons">
            {allBillsReceived ? (
              <Button
                onClick={() => onComplete()}
                size="large"
                appearance="primary"
                className="complete-button"
              >
                Complete
              </Button>
            ) : (
              <Button
                onClick={() => onComplete()}
                size="large"
                className="save-button"
              >
                Save Progress
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
