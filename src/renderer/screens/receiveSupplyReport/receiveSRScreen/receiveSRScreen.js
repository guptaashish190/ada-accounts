/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable radix */
/* eslint-disable no-restricted-syntax */

import {
  FieldValue,
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
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
import firebaseApp, { firebaseAuth, firebaseDB } from '../../../firebaseInit';
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
  const [receivedBills, setReceivedBills] = useState([]);
  const [returnedBills, setReturnedBills] = useState([]);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const dbName = isBundle ? '/billBundles' : 'supplyReports';
  const dbBills = isBundle ? supplyReport.bills : supplyReport.orders;
  const [loading, setLoading] = useState(false);
  const getAllBills = async () => {
    console.log(supplyReport);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(dbBills);

      fetchedOrders = (await fetchedOrders).filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);
      setAllBills(fetchedOrders);
    } catch (e) {
      console.error(e);
    }
  };
  const getGroupedBills = async (orderIds) => {
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(orderIds);
      fetchedOrders = fetchedOrders.filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);
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
      );

      fetchedOrders = (await fetchedOrders).filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(fetchedOrders);
      setReturnedBills(fetchedOrders);
    } catch (e) {
      console.error(e);
    }
  };

  const init = async () => {
    setLoading(true);
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

  useState(() => {
    init();
  }, []);

  const receiveBill = (bi) => {
    setReceivedBills((r) => [...r, bi]);
  };

  const allBillsReceived =
    receivedBills.length +
      returnedBills.length +
      (supplyReport.orderDetails?.length || 0) ===
    [
      ...dbBills,
      ...(supplyReport.supplementaryBills || []),
      ...(supplyReport.attachedBills || []),
    ].length;

  // update order details in the supplyreport and individual orders
  const onComplete = async () => {
    setLoading(true);

    const supplyReportRef = doc(firebaseDB, dbName, supplyReport.id);
    const supplyReportDataNew = (await getDoc(supplyReportRef)).data();
    try {
      // update supply report for all the bill rec details
      updateDoc(supplyReportRef, {
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
        const orderRef = doc(firebaseDB, 'orders', rb2.id);
        const orderData = await getDoc(orderRef);
        const paymentsObj = orderData.data().payments || [];
        updateDoc(orderRef, {
          flow: [
            ...rb2.flow,
            {
              employeeId: firebaseAuth.currentUser.uid,
              timestamp: Timestamp.now().toMillis(),
              type: 'Received Bill',
            },
          ],
          payments: [...paymentsObj, ...rb2.payments],
          flowCompleted: true,
          orderStatus: 'Received Bill',
          with: rb2.with,
          ...(rb2.schedulePaymentDate
            ? { schedulePaymentDate: rb2.schedulePaymentDate }
            : {}),
          accountsNotes: rb2.accountsNotes || '',
        });
      }

      // update returned bills
      for await (const rb2 of returnedBills) {
        const orderRef = doc(firebaseDB, 'orders', rb2.id);

        updateDoc(orderRef, {
          flow: [
            ...rb2.flow,
            {
              employeeId: firebaseAuth.currentUser.uid,
              timestamp: Timestamp.now().toMillis(),
              type: 'Goods Returned',
            },
          ],
          balance: 0,
          flowCompleted: true,
          orderStatus: 'Goods Returned',
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
      navigate(isBundle ? '/bundles' : '/receiveSupplyReports');
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

      <center>
        <div className="receive-sr-container">
          <h3>
            Receive {isBundle ? 'Bundle' : 'Supply Report'}:{' '}
            {supplyReport.receiptNumber}
          </h3>
          <VerticalSpace1 />

          {allBills.map((bill) => {
            return (
              <div className="party-section-receive-sr">
                <div className="title-sr">
                  {bill.party?.name} (Payment: {bill.party?.paymentTerms || '-'}
                  )
                </div>

                <div className="party-bills-container">
                  <BillRow
                    supplyReport={supplyReport}
                    isReturned={
                      returnedBills.findIndex((x) => x.id === bill.id) !== -1
                    }
                    onReturn={() => {
                      setReturnedBills((x) => [...x, bill]);
                    }}
                    onReceive={(x) => {
                      receiveBill(x);
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
                    }}
                  />
                  {groupedOldBills[bill.partyId]?.map((oldBill) => {
                    return (
                      <BillRow
                        supplyReport={supplyReport}
                        isOld
                        isReturned={
                          returnedBills.findIndex(
                            (x) => x.id === oldBill.id,
                          ) !== -1
                        }
                        onReturn={() => {
                          setReturnedBills((x) => [...x, oldBill]);
                        }}
                        onReceive={(x) => {
                          receiveBill(x);
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
              <div>
                <div className="title-sr">{bills[0].party?.name}</div>
                <div className="party-bills-container">
                  {groupedSupplementaryBills[bills[0].partyId]?.map(
                    (oldBill) => {
                      return (
                        <BillRow
                          supplyReport={supplyReport}
                          isOld
                          isReturned={
                            returnedBills.findIndex(
                              (x) => x.id === oldBill.id,
                            ) !== -1
                          }
                          onReturn={() => {
                            setReturnedBills((x) => [...x, oldBill]);
                          }}
                          onReceive={(x) => {
                            receiveBill(x);
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
                          }}
                        />
                      );
                    },
                  )}
                </div>
              </div>
            );
          })}
          <div />
        </div>
        <VerticalSpace1 />
        {allBillsReceived ? (
          <Button
            onClick={() => onComplete()}
            size="large"
            appearance="primary"
          >
            COMPLETED
          </Button>
        ) : (
          <Button onClick={() => onComplete()} size="large">
            SAVE
          </Button>
        )}
      </center>
    </>
  );
}
