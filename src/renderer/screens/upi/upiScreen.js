/* eslint-disable no-restricted-syntax */
/* eslint-disable jsx-a11y/control-has-associated-label */
import {
  Timestamp,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
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
import { firebaseAuth } from '../../firebaseInit';
import globalUtils from '../../services/globalUtils';
import { VerticalSpace1, VerticalSpace2 } from '../../common/verticalSpace';
import { useAuthUser } from '../../contexts/allUsersContext';
import AdjustAmountDialog from '../receiveSupplyReport/adjustAmountOnBills/adjustAmountDialog';
import constants from '../../constants';
import { ChequeEntryDialog } from '../cheques/cheques';
import { useCompany } from '../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import { enrichPaymentItems } from '../../services/paymentSourceUtils';
import {
  PaymentSourceInfo,
} from '../../common/paymentSourceInfo';

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
    if (!currentCompanyId) {
      setReceivedUpiItems([]);
      return;
    }

    setLoading(true);
    try {
      const upiCollection = getCompanyCollection(currentCompanyId, DB_NAMES.UPI);
      const dateFrom = new Date(fromDate);
      dateFrom.setHours(0, 0, 0, 0);

      const dateTo = new Date(toDate);
      dateTo.setHours(23, 59, 59, 999);

      const dynamicQuery = query(
        upiCollection,
        where('timestamp', '>=', dateFrom.getTime()),
        where('timestamp', '<=', dateTo.getTime()),
        where('isReceived', '==', true),
      );
      

      const querySnapshot = await getDocs(dynamicQuery);

      const reportsData = [];
      querySnapshot.forEach((doc1) => {
        reportsData.push({ id: doc1.id, ...doc1.data() });
      });

      reportsData.sort((rd1, rd2) => rd2.timestamp - rd1.timestamp);
      const dataWithParty2 = await globalUtils.fetchPartyInfoForOrders(
        reportsData,
        currentCompanyId,
      );
      const enriched = await enrichPaymentItems(
        currentCompanyId,
        dataWithParty2,
      );
      setReceivedUpiItems(enriched);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching supply reports:', error);
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchUpi();
    if (!currentCompanyId) return undefined;

    setLoading(true);
    const unreceivedQuery = query(
      getCompanyCollection(currentCompanyId, DB_NAMES.UPI),
      where('isReceived', '==', false),
    );

    const unsubscribe = onSnapshot(
      unreceivedQuery,
      async (querySnapshot) => {
        try {
          const documents = [];

          querySnapshot.forEach((doc1) => {
            documents.push({ id: doc1.id, ...doc1.data() });
          });

          const dataWithParty = await globalUtils.fetchPartyInfoForOrders(
            documents,
            currentCompanyId,
          );
          const enriched = await enrichPaymentItems(
            currentCompanyId,
            dataWithParty,
          );
          setUnReceivedUpiItems(
            enriched.filter(
              (x) => x.type === 'upi' || x.type === 'neft' || x.type === undefined,
            ),
          );
          setUnReceivedChequeItems(
            enriched.filter((x) => x.type === 'cheque'),
          );
        } catch (error) {
          console.error('Error fetching pending payments stream:', error);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to pending payments:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [currentCompanyId]);

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
          <table className="app-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Party</th>
                <th>Amount</th>
                <th>Source</th>
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
  const { currentCompanyId } = useCompany();
  return (
    <tr>
      <td>{globalUtils.getTimeFormat(data.timestamp, true)}</td>
      <td>{data.type?.toUpperCase()}</td>
      <td>{data.party?.name}</td>
      <td>{globalUtils.getCurrencyFormat(data.amount)}</td>
      <td>{data.sourceLabels || '--'}</td>
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
          data.isReceived ? (
            <Text size={200}>--</Text>
          ) : (
          <ChequeEntryDialog
            onClose={() => {
              if (loading) return;
              setLoading(true);
              try {
                const upiRef = getCompanyDoc(
                  currentCompanyId,
                  DB_NAMES.UPI,
                  data.id,
                );
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
              image: Array.isArray(data.imageUrl)
                ? data.imageUrl[0]
                : data.imageUrl,
              party: data.party,
              amount: data.amount,
              sourceRefs: data.sourceRefs,
              partyId: data.partyId,
              accountsNotes: data.accountsNotes,
            }}
          />
          )
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
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [loading, setLoading] = useState(false);
  const { currentCompanyId } = useCompany();
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;

  const clampZoom = (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  const resetImageView = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const openImageViewer = () => {
    resetImageView();
    setShowImageViewer(true);
  };

  const imageSrc = Array.isArray(data?.imageUrl)
    ? data.imageUrl[0]
    : data?.imageUrl;

  const onDone = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const partyRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.PARTIES,
        data.partyId,
      );
      const partySnapshot = await getDoc(partyRef);
      let newPayments = partySnapshot.data().payments || [];

      newPayments = [
        ...newPayments,
        {
          amount: data.amount,
          adjustedBills: adjustedBills.map((x) => x.id),
          timestamp: Timestamp.now().toMillis(),
          mode: (data.type || 'upi').toUpperCase(),
        },
      ];
      updateDoc(partyRef, {
        payments: newPayments,
      });

      const upiRef = getCompanyDoc(currentCompanyId, DB_NAMES.UPI, data.id);
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
    <>
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
                style={{
                  objectFit: 'contain',
                  cursor: 'zoom-in',
                }}
                src={imageSrc}
                onClick={() => openImageViewer()}
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
                <Text size={400}>Source:</Text>
                <PaymentSourceInfo
                  sourceRefs={data.sourceRefs}
                  partyId={data.partyId}
                  showNotes={false}
                />
                <VerticalSpace1 />
                <Text size={400}>
                  Account Notes:{' '}
                  <b>{data.accountsNotes && data.accountsNotes !== '--'
                    ? data.accountsNotes
                    : '--'}
                  </b>
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
      <Dialog
        open={showImageViewer}
        onOpenChange={(_, dialogData) => {
          if (!dialogData.open) {
            setShowImageViewer(false);
            resetImageView();
          }
        }}
      >
        <DialogSurface
          style={{
            width: '95vw',
            maxWidth: '95vw',
            height: '95vh',
          }}
        >
          <DialogBody>
            <DialogTitle>Image Preview</DialogTitle>
            <DialogContent>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '12px',
                  alignItems: 'center',
                }}
              >
                <Button
                  appearance="secondary"
                  onClick={() => setZoomScale((prev) => clampZoom(prev - 0.25))}
                >
                  -
                </Button>
                <Text>{`${Math.round(zoomScale * 100)}%`}</Text>
                <Button
                  appearance="secondary"
                  onClick={() => setZoomScale((prev) => clampZoom(prev + 0.25))}
                >
                  +
                </Button>
                <Button appearance="secondary" onClick={() => resetImageView()}>
                  Reset
                </Button>
                <Text size={200}>
                  Scroll to zoom. Drag to pan when zoomed in.
                </Text>
              </div>
              <div
                style={{
                  height: '72vh',
                  backgroundColor: '#111',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative',
                  userSelect: 'none',
                }}
                onMouseMove={(e) => {
                  if (!isDragging || zoomScale <= 1) return;
                  setPanOffset({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y,
                  });
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY > 0 ? -0.2 : 0.2;
                  setZoomScale((prev) => clampZoom(prev + delta));
                }}
              >
                <img
                  src={imageSrc}
                  alt="UPI"
                  onDragStart={(e) => e.preventDefault()}
                  onMouseDown={(e) => {
                    if (zoomScale <= 1) return;
                    setIsDragging(true);
                    setDragStart({
                      x: e.clientX - panOffset.x,
                      y: e.clientY - panOffset.y,
                    });
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                    transformOrigin: 'center center',
                    cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                  }}
                />
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => {
                  setShowImageViewer(false);
                  resetImageView();
                }}
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
