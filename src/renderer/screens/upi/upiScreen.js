/* eslint-disable no-restricted-syntax */
/* eslint-disable jsx-a11y/control-has-associated-label */
import {
  Timestamp,
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
import { getAuth } from 'firebase/auth';
import { firebaseDB } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import { useAuthUser } from '../../contexts/allUsersContext';
import AdjustAmountDialog from '../receiveSupplyReport/adjustAmountOnBills/adjustAmountDialog';
import constants from '../../constants';

export default function UpiScreen() {
  const [receivedUpiItems, setReceivedUpiItems] = useState([]);
  const [unReceivedUpiItems, setUnReceivedUpiItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(firebaseDB, 'upi'),
        where('isReceived', '==', false),
      );
      const q2 = query(
        collection(firebaseDB, 'upi'),
        where('isReceived', '==', true),
        limit(50),
      );
      const querySnapshot = await getDocs(q);
      const querySnapshot2 = await getDocs(q2);

      const documents = [];
      const documents2 = [];
      querySnapshot.forEach((doc1) => {
        // You can access the document data here using doc.data()
        documents.push({ id: doc1.id, ...doc1.data() });
      });
      querySnapshot2.forEach((doc1) => {
        // You can access the document data here using doc.data()
        documents2.push({ id: doc1.id, ...doc1.data() });
      });

      const dataWithParty =
        await globalUtils.fetchPartyInfoForOrders(documents);
      const dataWithParty2 =
        await globalUtils.fetchPartyInfoForOrders(documents2);
      setUnReceivedUpiItems(dataWithParty || []);
      setReceivedUpiItems(dataWithParty2 || []);
      console.log(dataWithParty, dataWithParty2);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <center>
      <h3>UPIs</h3>
      {loading ? (
        <Spinner />
      ) : (
        <div>
          <table>
            <thead>
              <tr>
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
              <tr>
                <td />
                <td />
                <td />
                <td />
              </tr>
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

function UpiItemRow({ data }) {
  const { allUsers } = useAuthUser();
  return (
    <tr>
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
        <UPIDialog
          createdBy={allUsers.find((x) => x.uid === data?.createdBy)?.username}
          data={data}
        />
      </td>
    </tr>
  );
}

function UPIDialog({ data, createdBy }) {
  const [adjustedBills, setAdjustedBills] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openAdjust, setOpenAdjust] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkedWantToAdjust, setWantToAdjustChecked] = React.useState(false);

  const onDone = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (checkedWantToAdjust) {
        for await (const oab of adjustedBills) {
          const orderRef = doc(firebaseDB, 'orders', oab.id);

          updateDoc(orderRef, {
            balance:
              oab.balance -
              oab.payments.reduce(
                (acc, cur) => acc + parseInt(cur.amount, 10),
                0,
              ),
          });
        }
      }

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
        receivedBy: getAuth().currentUser.uid,
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
    <>
      <AdjustAmountDialog
        adjustedBills={adjustedBills}
        setAdjustedBills={setAdjustedBills}
        party={openAdjust && data.party}
        amountToAdjust={data.amount}
        type="upi"
        closeable
        onDone={() => {
          setOpenAdjust(false);
        }}
      />
      <Dialog open={openDialog}>
        <DialogTrigger disableButtonEnhancement>
          <Button onClick={() => setOpenDialog(true)}>
            {data.isReceived ? 'View' : 'Receive'}
          </Button>
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Receive UPI</DialogTitle>
            <DialogContent>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Image width={300} src={data?.imageUrl} />
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
                  {!data.isReceived ? (
                    <Checkbox
                      checked={checkedWantToAdjust}
                      onChange={(ev, ev2) => {
                        if (!ev2.checked) {
                          setAdjustedBills([]);
                        }
                        setWantToAdjustChecked(ev2.checked);
                      }}
                      label="Want to adjust?"
                    />
                  ) : null}
                  <VerticalSpace1 />
                  {checkedWantToAdjust ? (
                    <>
                      <Text size={400}>
                        {data.isReceived
                          ? data.bills?.join(',')
                          : `Adjusted: ${adjustedBills.map(
                              (ab) => `${ab.billNumber},`,
                            )}`}
                      </Text>
                      <VerticalSpace2 />
                      {!data.isReceived ? (
                        <Button
                          onClick={() => {
                            setAdjustedBills([]);
                            setOpenAdjust(true);
                          }}
                        >
                          Adjust Bills
                        </Button>
                      ) : null}
                    </>
                  ) : null}

                  <VerticalSpace2 />
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
                  disabled={!adjustedBills.length && checkedWantToAdjust}
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
    </>
  );
}
