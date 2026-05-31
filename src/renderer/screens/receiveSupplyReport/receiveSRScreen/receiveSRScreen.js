/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable radix */
/* eslint-disable no-restricted-syntax */

import { Timestamp, getDoc, updateDoc } from 'firebase/firestore';
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
import { firebaseAuth } from '../../../firebaseInit';
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

// for bill bundles and supply reports
export default function ReceiveSRScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { supplyReport, isBundle } = state;
  const [allBills, setAllBills] = useState([]);
  const [groupedOldBills, setGroupedOldBills] = useState([]);
  const [groupedSupplementaryBills, setGroupedSupplementaryBills] = useState(
    [],
  );
  const [supplymanUser, setSupplymanUser] = useState();
  const [receivedBills, setReceivedBills] = useState([]);
  const [returnedBills, setReturnedBills] = useState([]);
  const [receivedReturnedBillIds, setReceivedReturnedBillIds] = useState([]);
  const [withPartyBillIds, setWithPartyBillIds] = useState([]);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const { currentCompanyId } = useCompany();
  const { settings } = useSettingsContext();
  const billWithPartyUserId = settings?.billWithParty?.userId || '';

  const dbName = isBundle ? DB_NAMES.BILL_BUNDLES : DB_NAMES.SUPPLY_REPORTS;
  const dbBills = isBundle ? supplyReport.bills : supplyReport.orders;
  const [loading, setLoading] = useState(false);
  const getAllBills = async () => {
    console.log(supplyReport);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(
        dbBills,
        currentCompanyId,
      );

      fetchedOrders = fetchedOrders.filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(
        fetchedOrders,
        currentCompanyId,
      );
      setAllBills(fetchedOrders);
    } catch (e) {
      console.error(e);
    }
  };
  const getGroupedBills = async (orderIds) => {
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
    return [];
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
      const obg = await getGroupedBills(supplyReport.bills);

      setGroupedSupplementaryBills(obg || []);
    } else {
      await getAllBills();
      await getAllReturnedBills();
    }

    if (!isBundle) {
      const obg = await getGroupedBills(supplyReport.attachedBills);
      const sbg = await getGroupedBills(supplyReport.supplementaryBills);

      setGroupedOldBills(obg || []);
      setGroupedSupplementaryBills(sbg || []);
      console.log(sbg);
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
      console.log(dbName, supplyReport.id);
      // update supply report for all the bill rec details
      await updateDoc(supplyReportRef, {
        ...(allBillsReceived
          ? { status: constants.firebase.supplyReportStatus.COMPLETED }
          : {}),
        orderDetails: [
          ...(supplyReportDataNew.orderDetails || []),
          ...receivedBills.map((rb) => ({
            billId: rb.id,
            ...(rb.accountsNotes ? { accountsNotes: rb.accountsNotes } : {}),
            payments: rb.payments,
            ...(rb.schedulePaymentDate
              ? { schedulePaymentDate: rb.schedulePaymentDate }
              : {}),
            with: rb.with,
          })),
          ...withPartyBillIds.map((billId) => ({
            billId,
            with: billWithPartyUserId,
          })),
        ],
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
        receivedBy: firebaseAuth.currentUser.uid,
      });

      // update current bills with balance and updated flow
      for await (const rb2 of receivedBills) {
        const orderRef = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.ORDERS,
          rb2.id,
        );
        const orderData = await getDoc(orderRef);
        const paymentsObj = orderData.data().payments || [];
        await updateDoc(orderRef, {
          flow: [
            ...rb2.flow,
            {
              employeeId: firebaseAuth.currentUser.uid,
              timestamp: Timestamp.now().toMillis(),
              type: constants.firebase.billFlowTypes.RECEIVED_BILL,
            },
          ],
          payments: [...paymentsObj, ...rb2.payments],
          flowCompleted: true,
          orderStatus: constants.firebase.billFlowTypes.RECEIVED_BILL,
          with: rb2.with,
          ...(rb2.schedulePaymentDate
            ? { schedulePaymentDate: rb2.schedulePaymentDate }
            : {}),
          accountsNotes: rb2.accountsNotes || '',
        });
      }

      for await (const billId of withPartyBillIds) {
        const selectedBill =
          allBills.find((bill) => bill.id === billId) ||
          returnedBills.find((bill) => bill.id === billId) ||
          Object.values(groupedOldBills)
            .flat()
            .find((bill) => bill.id === billId) ||
          Object.values(groupedSupplementaryBills)
            .flat()
            .find((bill) => bill.id === billId);

        if (!selectedBill) continue;

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

      // update returned bills
      for await (const rb2 of returnedBills.filter((bill) =>
        receivedReturnedBillIds.includes(bill.id),
      )) {
        const orderRef = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.ORDERS,
          rb2.id,
        );

        await updateDoc(orderRef, {
          flow: [
            ...rb2.flow,
            {
              employeeId: firebaseAuth.currentUser.uid,
              timestamp: Timestamp.now().toMillis(),
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

    receivedBills.forEach((cRBill) => {
      if (cRBill.payments?.length) {
        cRBill.payments.forEach((crBillP) => {
          if (crBillP.type === 'cash') {
            prItems[cRBill.partyId] =
              (prItems[cRBill.partyId] || 0) + parseInt(crBillP.amount);
          }
        });
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
        amount: prItems[pri],
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

  return (
    <>
      <Toaster toasterId={toasterId} />

      <div className="receive-sr-container">
        <div className="header-section">
          <h3 className="page-title">
            Receive {isBundle ? 'Bundle' : 'Supply Report'}:{' '}
            {supplyReport.receiptNumber}
          </h3>
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
          {allBills.map((bill) => {
            return (
              <div
                key={`party-${bill.partyId}`}
                className="party-section-receive-sr"
              >
                <div className="title-sr">
                  <span className="party-name">{bill.party?.name}</span>
                  <span className="payment-terms">
                    Payment:{' '}
                    {bill.party?.creditDays != null
                      ? `${bill.party.creditDays} days credit`
                      : bill.party?.paymentTerms || '-'}
                  </span>
                </div>

                <div className="party-bills-container">
                  {(() => {
                    const isBillReturned =
                      returnedBills.findIndex((x) => x.id === bill.id) !== -1;
                    const isReturnReceived = receivedReturnedBillIds.includes(
                      bill.id,
                    );
                    return (
                  <BillRow
                    supplyReport={supplyReport}
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
                      setWithPartyBillIds((ids) =>
                        ids.filter((id) => id !== bill.id),
                      );
                    }}
                    onReturn={() => {
                      addReturnedBill(bill);
                      setWithPartyBillIds((ids) =>
                        ids.filter((id) => id !== bill.id),
                      );
                    }}
                    onReceive={(x) => {
                      receiveBill(x);
                      setWithPartyBillIds((ids) =>
                        ids.filter((id) => id !== bill.id),
                      );
                    }}
                    key={`rsr-${bill.id}`}
                    data={bill}
                    isReceived={
                      receivedBills.findIndex((x) => x.id === bill.id) !== -1
                    }
                    onUndo={() => {
                      setReceivedBills((b) =>
                        b.filter((tb) => tb.id !== bill.id),
                      );
                      setReturnedBills((b) =>
                        b.filter((tb) => tb.id !== bill.id),
                      );
                      setReceivedReturnedBillIds((ids) =>
                        ids.filter((id) => id !== bill.id),
                      );
                      setWithPartyBillIds((ids) =>
                        ids.filter((id) => id !== bill.id),
                      );
                    }}
                  />
                    );
                  })()}
                  {groupedOldBills[bill.partyId]?.map((oldBill) => {
                    const isBillReturned =
                      returnedBills.findIndex((x) => x.id === oldBill.id) !==
                      -1;
                    const isReturnReceived = receivedReturnedBillIds.includes(
                      oldBill.id,
                    );
                    return (
                      <BillRow
                        supplyReport={supplyReport}
                        isOld
                        isReturned={isBillReturned}
                        allowReceiveReturned={isBillReturned}
                        isReturnReceived={isReturnReceived}
                        onReceiveReturned={() => {
                          setReceivedReturnedBillIds((ids) => {
                            if (ids.includes(oldBill.id)) return ids;
                            return [...ids, oldBill.id];
                          });
                        }}
                        onUndoReturnReceived={() => {
                          setReceivedReturnedBillIds((ids) =>
                            ids.filter((id) => id !== oldBill.id),
                          );
                          setReturnedBills((existing) =>
                            existing.filter((x) => x.id !== oldBill.id),
                          );
                        }}
                        isWithParty={withPartyBillIds.includes(oldBill.id)}
                        onWithParty={() => {
                          addWithPartyBill(oldBill);
                        }}
                        onUndoWithParty={() => {
                          setWithPartyBillIds((ids) =>
                            ids.filter((id) => id !== oldBill.id),
                          );
                        }}
                        onReturn={() => {
                          addReturnedBill(oldBill);
                          setWithPartyBillIds((ids) =>
                            ids.filter((id) => id !== oldBill.id),
                          );
                        }}
                        onReceive={(x) => {
                          receiveBill(x);
                          setWithPartyBillIds((ids) =>
                            ids.filter((id) => id !== oldBill.id),
                          );
                        }}
                        key={`rsr-${oldBill.id}`}
                        data={oldBill}
                        isReceived={
                          receivedBills.findIndex(
                            (x) => x.id === oldBill.id,
                          ) !== -1
                        }
                        onUndo={() => {
                          setReceivedBills((b) =>
                            b.filter((tb) => tb.id !== oldBill.id),
                          );
                          setReturnedBills((b) =>
                            b.filter((tb) => tb.id !== oldBill.id),
                          );
                          setReceivedReturnedBillIds((ids) =>
                            ids.filter((id) => id !== oldBill.id),
                          );
                          setWithPartyBillIds((ids) =>
                            ids.filter((id) => id !== oldBill.id),
                          );
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          {Object.values(groupedSupplementaryBills).map((bills) => {
            return (
              <div
                key={`supp-${bills[0].partyId}`}
                className="party-section-receive-sr"
              >
                <div className="title-sr">
                  <span className="party-name">{bills[0].party?.name}</span>
                  <span className="supplementary-label">
                    Supplementary Bills
                  </span>
                </div>
                <div className="party-bills-container">
                  {groupedSupplementaryBills[bills[0].partyId]?.map(
                    (oldBill) => {
                      const isBillReturned =
                        returnedBills.findIndex((x) => x.id === oldBill.id) !==
                        -1;
                      const isReturnReceived = receivedReturnedBillIds.includes(
                        oldBill.id,
                      );
                      return (
                        <BillRow
                          supplyReport={supplyReport}
                          isOld
                          isReturned={isBillReturned}
                          allowReceiveReturned={isBillReturned}
                          isReturnReceived={isReturnReceived}
                          onReceiveReturned={() => {
                            setReceivedReturnedBillIds((ids) => {
                              if (ids.includes(oldBill.id)) return ids;
                              return [...ids, oldBill.id];
                            });
                          }}
                          onUndoReturnReceived={() => {
                            setReceivedReturnedBillIds((ids) =>
                              ids.filter((id) => id !== oldBill.id),
                            );
                            setReturnedBills((existing) =>
                              existing.filter((x) => x.id !== oldBill.id),
                            );
                          }}
                          isWithParty={withPartyBillIds.includes(oldBill.id)}
                          onWithParty={() => {
                            addWithPartyBill(oldBill);
                          }}
                          onUndoWithParty={() => {
                            setWithPartyBillIds((ids) =>
                              ids.filter((id) => id !== oldBill.id),
                            );
                          }}
                          onReturn={() => {
                            addReturnedBill(oldBill);
                            setWithPartyBillIds((ids) =>
                              ids.filter((id) => id !== oldBill.id),
                            );
                          }}
                          onReceive={(x) => {
                            receiveBill(x);
                            setWithPartyBillIds((ids) =>
                              ids.filter((id) => id !== oldBill.id),
                            );
                          }}
                          key={`rsr-${oldBill.id}`}
                          data={oldBill}
                          isReceived={
                            receivedBills.findIndex(
                              (x) => x.id === oldBill.id,
                            ) !== -1
                          }
                          onUndo={() => {
                            setReceivedBills((b) =>
                              b.filter((tb) => tb.id !== oldBill.id),
                            );
                            setReturnedBills((b) =>
                              b.filter((tb) => tb.id !== oldBill.id),
                            );
                            setReceivedReturnedBillIds((ids) =>
                              ids.filter((id) => id !== oldBill.id),
                            );
                            setWithPartyBillIds((ids) =>
                              ids.filter((id) => id !== oldBill.id),
                            );
                          }}
                        />
                      );
                    },
                  )}
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
