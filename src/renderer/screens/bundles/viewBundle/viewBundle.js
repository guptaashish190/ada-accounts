/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable radix */
/* eslint-disable no-restricted-syntax */

import { getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Button,
  Spinner,
  TableRow,
  Text,
  Toaster,
  useId,
  useToastController,
} from '@fluentui/react-components';
import Loader from '../../../common/loader';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import globalUtils from '../../../services/globalUtils';
import { showToast } from '../../../common/toaster';
import './style.css';
import { useAuthUser } from '../../../contexts/allUsersContext';
import { useCompany } from '../../../contexts/companyContext';
import {
  getCompanyDoc,
  DB_NAMES,
} from '../../../services/firestoreHelpers';
import constants from '../../../constants';
import { firebaseAuth } from '../../../firebaseInit';
import { mergeHandoverOntoBills } from '../../../services/handoverBalanceUtils';
import { canEditBundle } from '../../../services/bundleEditUtils';

export default function ViewBundleScreen() {
  const [bundle, setBundle] = useState();
  const [user, setuser] = useState();
  const { allUsers } = useAuthUser();
  const currentUser = allUsers?.find((u) => u.uid === firebaseAuth.currentUser?.uid);
  const isManager = !!currentUser?.isManager;
  const { state } = useLocation();
  const { bundleId } = state;
  const [allBills, setAllBills] = useState([]);
  const [loading, setLoading] = useState(false);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  const { currentCompanyId, getCurrentCompanyName } = useCompany();
  const [printMode, setPrintMode] = useState('dispatch');
  const [pendingPrint, setPendingPrint] = useState(false);

  useEffect(() => {
    getAllBills();
  }, []);

  useEffect(() => {
    if (!pendingPrint) return;
    window.print();
    setPendingPrint(false);
  }, [pendingPrint, printMode]);

  const getAllBills = async () => {
    if (!bundleId) return;
    setLoading(true);
    try {
      const bundleRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.BILL_BUNDLES,
        bundleId,
      );
      const bundlerefData = await getDoc(bundleRef);
      const bundleData = bundlerefData.data();
      setBundle({ ...bundleData, id: bundlerefData.id });
      setuser(allUsers.find((x) => x.uid === bundleData.assignedTo));

      let fetchedOrders = await globalUtils.fetchOrdersByIds(
        bundleData.bills,
        currentCompanyId,
      );

      fetchedOrders = fetchedOrders.filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(
        fetchedOrders,
        currentCompanyId,
      );
      setAllBills(
        mergeHandoverOntoBills(
          fetchedOrders,
          bundleData.assignmentDetails || [],
        ),
      );

      setLoading(false);
    } catch (e) {
      setLoading(false);
      console.error(e);
    }
  };

  const onHandOver = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const billBundleRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.BILL_BUNDLES,
        bundleId,
      );

      await updateDoc(billBundleRef, {
        status: constants.firebase.billBundleFlowStatus.HANDOVER,
      });

      await Promise.all(allBills.map((bill1) => updateBills(bill1)));
      await getAllBills();
      setLoading(false);
      showToast(
        dispatchToast,
        `Transferred Bills to User: ${user.username}`,
        'success',
      );
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };
  const updateBills = async (bill1) => {
    try {
      const orderRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.ORDERS,
        bill1.id,
      );
      const currentFlow = Array.isArray(bill1.flow) ? bill1.flow : [];
      const handoverFlowEntry = {
        employeeId: firebaseAuth.currentUser?.uid || '',
        timestamp: Date.now(),
        type: 'Handover',
        bundleId,
      };

      await updateDoc(orderRef, {
        with: user.uid,
        orderStatus: constants.firebase.billBundleFlowStatus.HANDOVER,
        flow: [...currentFlow, handoverFlowEntry],
      });

      console.log(`Order handover flow/status updated`);
    } catch (error) {
      console.error(`Error updating order  status:`, error);
    }
  };

  const onEditBundle = () => {
    window.electron.ipcRenderer.sendMessage('new-window', {
      type: constants.windowConstants.ASSIGN_BILLS,
      data: {
        editBundle: {
          bundleId,
          receiptNumber: bundle.receiptNumber,
          assignedTo: bundle.assignedTo,
          timestamp: bundle.timestamp,
          bills: allBills,
        },
      },
    });
  };

  const getActionButton = () => {
    const showEditButton = canEditBundle(bundle, isManager);

    if (bundle.status === constants.firebase.billBundleFlowStatus.CREATED) {
      return (
        <>
          {showEditButton ? (
            <>
              <Button appearance="secondary" onClick={onEditBundle}>
                Edit
              </Button>
              &nbsp;&nbsp;
            </>
          ) : null}
          <Button
            appearance="primary"
            onClick={() => {
              onHandOver();
            }}
          >
            Handover
          </Button>
        </>
      );
    }
    if (bundle.status === constants.firebase.billBundleFlowStatus.HANDOVER) {
      return (
        <Button
          appearance="primary"
          onClick={() => {
            window.electron.ipcRenderer.sendMessage('new-window', {
              type: constants.windowConstants.RECEIVE_SUPPLY_REPORT,
              data: { supplyReport: bundle, isBundle: true },
            });
          }}
        >
          Receive
        </Button>
      );
    }
    return null;
  };

  const triggerPrint = (mode) => {
    setPrintMode(mode);
    setPendingPrint(true);
  };

  const totalHandoverAmount = allBills.reduce(
    (sum, bill) => sum + Number(bill.handoverBalance ?? bill.balance ?? 0),
    0,
  );

  const billsByParty = useMemo(() => {
    const grouped = {};
    allBills.forEach((bill) => {
      if (!grouped[bill.partyId]) grouped[bill.partyId] = [];
      grouped[bill.partyId].push(bill);
    });
    return Object.values(grouped).sort((a, b) =>
      (a[0].party?.name || '').localeCompare(b[0].party?.name || ''),
    );
  }, [allBills]);

  if (loading) {
    return <Spinner />;
  }
  if (!bundle) {
    return <div>Error loading supply report</div>;
  }
  return (
    <>
      <Toaster toasterId={toasterId} />
      {loading ? (
        <Loader />
      ) : (
        <center>
          <div className="view-bundle-container">
            <div className="bundle-print-header print-only">
              <h2>
                {printMode === 'receiving' ? 'Bundle Receiving' : 'Bundle'}
              </h2>
              <h3>{getCurrentCompanyName()}</h3>
              <p>Bundle ID: {bundle.receiptNumber}</p>
            </div>

            <h3 className="screen-only">Bundle ID: {bundle.receiptNumber}</h3>
            <VerticalSpace1 />
            <div className="no-print">
              {getActionButton()}
              <VerticalSpace1 />
            </div>
            <table className="bundle-details-table print-only">
              <tbody>
                <tr>
                  <th>Received By</th>
                  <td>
                    {allUsers.find((x) => x.uid === bundle.receivedBy)
                      ?.username || '--'}
                  </td>
                  <th>Assigned</th>
                  <td>{user?.username || '--'}</td>
                  <th>Created</th>
                  <td>{globalUtils.getTimeFormat(bundle?.timestamp)}</td>
                  <th>Status</th>
                  <td>{bundle.status}</td>
                </tr>
              </tbody>
            </table>
            <div className="vsrc-detail-items-container screen-only">
              <div className="vsrc-detail-items">
                <div className="label">Received By: </div>
                <div className="value">
                  {allUsers.find((x) => x.uid === bundle.receivedBy)
                    ?.username || '--'}
                </div>
              </div>
              <div className="vsrc-detail-items">
                <div className="label">Assigned User: </div>
                <div className="value">{user?.username}</div>
              </div>
              <div className="vsrc-detail-items">
                <div className="label">Creation Time: </div>
                <div className="value">
                  {globalUtils.getTimeFormat(bundle?.timestamp)}
                </div>
              </div>

              <div className="vsrc-detail-items">
                <div className="label">Status: </div>
                <div className="value">{bundle.status}</div>
              </div>
            </div>
            <VerticalSpace1 />
            <div className="no-print">
              <Button onClick={() => triggerPrint('dispatch')}>
                Print Bundle
              </Button>
              &nbsp;&nbsp;
              {bundle.status ===
              constants.firebase.billBundleFlowStatus.COMPLETED ? (
                <Button onClick={() => triggerPrint('receiving')}>
                  Print Bundle Receiving
                </Button>
              ) : null}
            </div>
            <h3 className="bundle-section-title">All Bills</h3>
            {billsByParty.map((partyBills) => {
              const partyId = partyBills[0].partyId;
              const partyName = partyBills[0].party?.name || '--';
              const partyTotal = partyBills.reduce(
                (sum, bill) =>
                  sum + Number(bill.handoverBalance ?? bill.balance ?? 0),
                0,
              );

              return (
                <div key={partyId} className="bundle-party-section">
                  <h4 className="bundle-party-heading">{partyName}</h4>
                  <table className="app-table bundle-bills-table">
                    <thead>
                      <tr>
                        <th className="col-sno">S.NO.</th>
                        <th className="col-bill">BILL NO.</th>
                        <th className="col-amount num">AMOUNT</th>
                        <th className="col-payment num">CASH</th>
                        <th className="col-payment num">CHEQUE</th>
                        <th className="col-payment num">UPI</th>
                        <th className="col-payment num">NEFT</th>
                        <th className="col-notes">ACC NOTES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partyBills.map((bill, i) => (
                        <BillRow
                          orderDetail={
                            bundle.orderDetails &&
                            bundle.orderDetails.find(
                              (x) => x.billId === bill.id,
                            )
                          }
                          partyPayments={bundle.partyPayments || []}
                          key={`rsr-${bill.id}`}
                          data={bill}
                          index={i}
                          showPartyPayments={i === 0}
                        />
                      ))}
                      <tr className="bundle-party-totals-row">
                        <td colSpan={2}>
                          <b>
                            Subtotal ({partyBills.length}{' '}
                            {partyBills.length === 1 ? 'bill' : 'bills'})
                          </b>
                        </td>
                        <td className="num">
                          <b>{globalUtils.getCurrencyFormat(partyTotal)}</b>
                        </td>
                        <td />
                        <td />
                        <td />
                        <td />
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
            <table className="app-table bundle-bills-table bundle-grand-totals-table">
              <tbody>
                <tr className="bundle-totals-row">
                  <td colSpan={2}>
                    <b>Total ({allBills.length} bills)</b>
                  </td>
                  <td className="num">
                    <b>
                      {globalUtils.getCurrencyFormat(totalHandoverAmount)}
                    </b>
                  </td>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
            {bundle.otherAdjustedBills?.length ? (
              <>
                <VerticalSpace2 />
                <h3 className="bundle-section-title">Other Adjusted Bills</h3>
                <OtherAdjustedBills
                  otherAdjustedBills={bundle.otherAdjustedBills}
                />
              </>
            ) : null}
            {printMode === 'receiving' ? (
              <div className="bundle-print-footer print-only">
                Received By:{' '}
                {allUsers.find((x) => x.uid === bundle.receivedBy)?.username ||
                  '--'}
              </div>
            ) : null}
            <VerticalSpace2 />
          </div>
        </center>
      )}
    </>
  );
}

function BillRow({
  data,
  index,
  orderDetail,
  partyPayments = [],
  showPartyPayments = true,
}) {
  const partyPayment = partyPayments.find((pp) => pp.partyId === data.partyId);
  const payments =
    partyPayment?.payments?.length > 0
      ? partyPayment.payments
      : orderDetail?.payments || [];
  const neftAmount = payments
    .filter((x) => x.type === 'neft' || x.type === 'other')
    .reduce((acc, x) => acc + (Number(x.amount) || 0), 0);
  const accountsNotes =
    data.accountsNotes || orderDetail?.accountsNotes || partyPayment?.notes;
  const formatPartyPayment = (amount) => {
    if (!showPartyPayments) return '';
    return globalUtils.getCurrencyFormat(amount) || '--';
  };

  return (
    <tr>
      <td className="col-sno">{index + 1}</td>
      <td className="col-bill">
        <b>{data.billNumber?.toUpperCase()}</b>
      </td>
      <td className="col-amount num">
        <b>
          {globalUtils.getCurrencyFormat(
            data.handoverBalance ?? data.balance,
          )}
        </b>
      </td>
      <td className="col-payment num">
        {formatPartyPayment(payments.find((x) => x.type === 'cash')?.amount)}
      </td>
      <td className="col-payment num">
        {formatPartyPayment(
          payments.find((x) => x.type === 'cheque')?.amount,
        )}
      </td>
      <td className="col-payment num">
        {formatPartyPayment(payments.find((x) => x.type === 'upi')?.amount)}
      </td>
      <td className="col-payment num">
        {formatPartyPayment(neftAmount > 0 ? neftAmount : undefined)}
      </td>
      <td className="col-notes">{accountsNotes || '--'}</td>
    </tr>
  );
}

function OtherAdjustedBills({ otherAdjustedBills }) {
  return (
    <table size="extra-small" className="app-table">
      <thead >
        <tr>
          <th>BILL NO.</th>
          <th>PARTY</th>
          <th>AMOUNT</th>
          <th>CASH</th>
          <th>CHEQUE</th>
          <th>UPI</th>
        </tr>
      </thead>
      <tbody>
        {otherAdjustedBills?.map((bill, i) => {
          return (
            <OtherAdjustedBillsRow
              key={`other-adjusted-${bill.billId || i}`}
              data={bill}
              index={i}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function OtherAdjustedBillsRow({ data, index }) {
  const [order, setOrder] = useState();
  const [party, setParty] = useState();

  const [loading, setLoading] = useState(false);

  const { currentCompanyId } = useCompany();

  const fetchOrderAndParty = async () => {
    try {
      setLoading(true);
      const orderRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.ORDERS,
        data.billId,
      );
      const orderSnapshot = await getDoc(orderRef);
      if (orderSnapshot.exists()) {
        const fetchedOrder = orderSnapshot.data();
        setOrder(fetchedOrder);

        const partyRef = getCompanyDoc(
          currentCompanyId,
          DB_NAMES.PARTIES,
          fetchedOrder.partyId,
        );
        const partySnapshot = await getDoc(partyRef);
        if (partySnapshot.exists()) {
          const fetchedParty = partySnapshot.data();
          setParty(fetchedParty);
        } else {
          console.log('Party not found');
        }
      } else {
        console.log('Order not found');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching order and party:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderAndParty();
  }, []);

  if (loading) {
    return (
      <tr >
        <td>
          <Spinner />
        </td>
      </tr>
    );
  }
  if (!order || !party) {
    return <Text>Error Fetching Bill Details</Text>;
  }

  return (
    <TableRow >
      <td>
        <b>{order.billNumber?.toUpperCase()}</b>
      </td>
      <td>{party.name}</td>
      <td>{globalUtils.getCurrencyFormat(order.orderAmount) || '--'}</td>
      <td>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'cash')?.amount,
        ) || '--'}
      </td>
      <td>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'cheque')?.amount,
        ) || '--'}
      </td>

      <td>
        {globalUtils.getCurrencyFormat(
          data.payments.find((x) => x.type === 'upi')?.amount,
        ) || '--'}
      </td>
    </TableRow>
  );
}
