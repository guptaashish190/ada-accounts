/* eslint-disable no-restricted-syntax */
/* eslint-disable jsx-a11y/control-has-associated-label */
import {
  Timestamp,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Image,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import { firebaseAuth, firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import { useAuthUser } from '../../contexts/allUsersContext';
import AdjustAmountDialog from '../receiveSupplyReport/adjustAmountOnBills/adjustAmountDialog';
import constants from '../../constants';
import { ChequeEntryDialog } from '../cheques/cheques';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';

export default function UpiScreen() {
  const [receivedUpiItems, setReceivedUpiItems] = useState([]);
  const [unReceivedUpiItems, setUnReceivedUpiItems] = useState([]);
  const [unReceivedChequeItems, setUnReceivedChequeItems] = useState([]);

  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();

  const fetchUpi = async () => {
    setLoading(true);
    try {
      const upiCollection = getCompanyCollection(currentCompanyId, DB_NAMES.UPI);
      let dynamicQuery = upiCollection;

      const dateFrom = new Date(fromDate);

      const dateTo = new Date(toDate);
      dateTo.setHours(23);
      dateTo.setMinutes(59);
      dateTo.setSeconds(59);

      dynamicQuery = query(
        dynamicQuery,
        where('timestamp', '>=', dateFrom.getTime()),
        where('isReceived', '==', true),
      );
      dynamicQuery = query(
        dynamicQuery,
        where('timestamp', '<=', dateTo.getTime()),
        where('isReceived', '==', true),
      );

      const querySnapshot = await getDocs(dynamicQuery);

      const reportsData = [];
      querySnapshot.forEach((doc1) => {
        reportsData.push({ id: doc.id, ...doc1.data() });
      });

      reportsData.sort((rd1, rd2) => rd2.timestamp - rd1.timestamp);
      const dataWithParty2 =
        await globalUtils.fetchPartyInfoForOrders(reportsData);
      setReceivedUpiItems(dataWithParty2);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching supply reports:', error);
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchUpi();
    fetcUnreceived();
  }, [currentCompanyId]);

  const fetcUnreceived = async () => {
    try {
      setLoading(true);
      const q = query(
        getCompanyCollection(currentCompanyId, DB_NAMES.UPI),
        where('isReceived', '==', false),
      );

      const querySnapshot = await getDocs(q);

      const documents = [];

      querySnapshot.forEach((doc1) => {
        // You can access the document data here using doc.data()
        documents.push({ id: doc1.id, ...doc1.data() });
      });

      const dataWithParty =
        await globalUtils.fetchPartyInfoForOrders(documents);
      setUnReceivedUpiItems(
        dataWithParty.filter((x) => x.type === 'upi' || x.type === undefined),
      );
      setUnReceivedChequeItems(
        dataWithParty.filter((x) => x.type === 'cheque'),
      );
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  return (
    <center>
      <h3>Payments</h3>
      {loading ? (
        <Spinner />
      ) : (
        <div>
          <div>
            <DatePicker
              size="large"
              className=" filter-input"
              onSelectDate={(d) => setFromDate(d)}
              placeholder="From Date"
              value={fromDate}
            />
            &nbsp;
            <DatePicker
              size="large"
              className=" filter-input"
              onSelectDate={(d) => {
                setToDate(d);
              }}
              placeholder="To date"
              value={toDate}
            />
            &nbsp;
            <Button size="large" onClick={() => fetchUpi()}>
              Get
            </Button>
          </div>
          <VerticalSpace1 />
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Party</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {unReceivedUpiItems?.map((uri) => {
                return <UpiItemRow key={`upi-list-${uri.id}`} data={uri} />;
              })}
              {unReceivedChequeItems?.map((uri) => {
                return (
                  <UpiItemRow
                    refreshData={() => {
                      fetcUnreceived();
                      fetchUpi();
                    }}
                    key={`cheque-list-${uri.id}`}
                    data={uri}
                  />
                );
              })}
              {receivedUpiItems?.map((uri) => {
                return <UpiItemRow key={`upi-list-${uri.id}`} data={uri} />;
              })}
            </tbody>
          </table>
        </div>
      )}
    </center>
  );
}

function UpiItemRow({ data, refreshData }) {
  const { allUsers } = useAuthUser();
  const [loading, setLoading] = useState(false);
  return (
    <tr>
      <td>{globalUtils.getTimeFormat(data.timestamp, true)}</td>
      <td>{data.type?.toUpperCase()}</td>
      <td>{data.party?.name}</td>
      <td>{globalUtils.getCurrencyFormat(data.amount)}</td>
      <td
        style={{
          color: data.isReceived
            ? constants.colors.success
            : constants.colors.warning,
        }}
      >
        <b>{data.isReceived ? 'Received' : 'Pending'}</b>
      </td>
      <td>{allUsers.find((x) => x.uid === data?.createdBy)?.username}</td>
      <td>
        {data?.type === 'cheque' ? (
          <ChequeEntryDialog
            onClose={() => {
              if (loading) return;
              setLoading(true);
              try {
                const upiRef = doc(firebaseDB, 'upi', data.id);
                updateDoc(upiRef, {
                  receivedBy: firebaseAuth.currentUser.uid,
                  isReceived: true,
                });
              } catch (e) {
                console.log(e);
              }
              setLoading(false);
              if (refreshData) refreshData();
            }}
            chequeData={{
              image: data.imageUrl,
              party: data.party,
              amount: data.amount,
            }}
          />
        ) : (
          <UPIDialog
            createdBy={
              allUsers.find((x) => x.uid === data?.createdBy)?.username
            }
            data={data}
          />
        )}
      </td>
    </tr>
  );
}

function UPIDialog({ data, createdBy }) {
  const [adjustedBills, setAdjustedBills] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);

  const [loading, setLoading] = useState(false);

  const onDone = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const partyRef = doc(firebaseDB, 'parties', data.partyId);
      const partySnapshot = await getDoc(partyRef);
      let newPayments = partySnapshot.data().payments || [];

      newPayments = [
        ...newPayments,
        {
          amount: data.amount,
          adjustedBills: adjustedBills.map((x) => x.id),
          timestamp: Timestamp.now().toMillis(),
          mode: 'UPI',
        },
      ];
      updateDoc(partyRef, {
        payments: newPayments,
      });

      const upiRef = doc(firebaseDB, 'upi', data.id);
      updateDoc(upiRef, {
        receivedBy: firebaseAuth.currentUser.uid,
        isReceived: true,
        bills: adjustedBills.map((x) => x.billNumber),
      });
      setOpenDialog(false);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  return (
    <Dialog open={openDialog}>
      <DialogTrigger disableButtonEnhancement>
        <Button onClick={() => setOpenDialog(true)}>
          {data.isReceived ? 'View' : 'Receive'}
        </Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Receive Payment</DialogTitle>
          <DialogContent>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Image
                width={300}
                style={{ objectFit: 'contain' }}
                src={data?.imageUrl}
              />
              <div style={{ marginLeft: '20px' }}>
                <Text size={400}>
                  Party: <b>{data.party?.name}</b>
                </Text>
                <VerticalSpace1 />
                <Text size={400}>
                  Amount: <b>{globalUtils.getCurrencyFormat(data.amount)}</b>
                </Text>
                <VerticalSpace1 />
                <Text size={400}>
                  Status: <b>{data.isReceived ? 'Received' : 'Pending'}</b>
                </Text>
                <VerticalSpace1 />
                <Text size={400}>
                  Created By: <b>{createdBy}</b>
                </Text>
                <VerticalSpace1 />
                <Text size={400}>
                  Comments: <b>{data.comment}</b>
                </Text>
                <VerticalSpace1 />
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button
                onClick={() => setOpenDialog(false)}
                appearance="secondary"
              >
                Close
              </Button>
            </DialogTrigger>
            {!data.isReceived ? (
              <Button
                onClick={() => {
                  onDone();
                }}
                appearance="primary"
              >
                {loading ? <Spinner /> : 'Receive'}
              </Button>
            ) : null}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
