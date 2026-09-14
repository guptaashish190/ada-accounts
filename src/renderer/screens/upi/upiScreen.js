/* eslint-disable no-restricted-syntax */
/* eslint-disable jsx-a11y/control-has-associated-label */
import {
  Timestamp,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dropdown,
  Input,
  Option,
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
import { VerticalSpace1 } from '../../common/verticalSpace';
import { useAuthUser } from '../../contexts/allUsersContext';
import constants from '../../constants';
import { ChequeEntryDialog } from './chequeEntryDialog';
import { useCompany } from '../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import { enrichPaymentItems } from '../../services/paymentSourceUtils';
import { PaymentSourceInfo } from '../../common/paymentSourceInfo';
import PartySelector from '../../common/partySelector';
import './style.css';

const MODE_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'upi', label: 'UPI' },
  { id: 'neft', label: 'NEFT' },
  { id: 'cheque', label: 'Cheque' },
];

const normalizeType = (item) =>
  (item?.type || 'upi').toString().toLowerCase();

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const matchesFilters = (item, { mode, party, chequeNumber, chequeDateFrom, chequeDateTo }) => {
  if (mode !== 'all' && normalizeType(item) !== mode) return false;
  if (party?.id && item.partyId !== party.id) return false;
  if (mode === 'cheque') {
    if (chequeNumber) {
      const number = (item.chequeNumber || '').toString();
      if (!number.toLowerCase().includes(chequeNumber.toLowerCase())) return false;
    }
    if (chequeDateFrom && (!item.chequeDate || item.chequeDate < startOfDay(chequeDateFrom).getTime())) {
      return false;
    }
    if (chequeDateTo && (!item.chequeDate || item.chequeDate > endOfDay(chequeDateTo).getTime())) {
      return false;
    }
  }
  return true;
};

function FilterField({ label, wide, children }) {
  return (
    <div className={`online-payments-field${wide ? ' online-payments-field-wide' : ''}`}>
      <span className="online-payments-field-label">{label}</span>
      {children}
    </div>
  );
}

export default function UpiScreen() {
  const [receivedUpiItems, setReceivedUpiItems] = useState([]);
  const [unReceivedItems, setUnReceivedItems] = useState([]);
  const [mode, setMode] = useState('all');
  const [filterParty, setFilterParty] = useState();
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDateFrom, setChequeDateFrom] = useState();
  const [chequeDateTo, setChequeDateTo] = useState();

  const [loading, setLoading] = useState(false);
  const [partySelectorKey, setPartySelectorKey] = useState(0);

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  const { currentCompanyId } = useCompany();

  const filterState = {
    mode,
    party: filterParty,
    chequeNumber,
    chequeDateFrom,
    chequeDateTo,
  };

  const fetchReceived = async (overrideFrom, overrideTo) => {
    if (!currentCompanyId) {
      setReceivedUpiItems([]);
      return;
    }

    setLoading(true);
    try {
      const paymentsCollection = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.ONLINE_PAYMENTS,
      );
      const dateFrom = startOfDay(overrideFrom || fromDate);
      const dateTo = endOfDay(overrideTo || toDate);

      const dynamicQuery = query(
        paymentsCollection,
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
    } catch (error) {
      console.error('Error fetching online payments:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReceived();
    if (!currentCompanyId) return undefined;

    setLoading(true);
    const unreceivedQuery = query(
      getCompanyCollection(currentCompanyId, DB_NAMES.ONLINE_PAYMENTS),
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
          setUnReceivedItems(enriched);
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

  const filteredUnreceived = useMemo(
    () => unReceivedItems.filter((item) => matchesFilters(item, filterState)),
    [unReceivedItems, mode, filterParty, chequeNumber, chequeDateFrom, chequeDateTo],
  );
  const filteredReceived = useMemo(
    () => receivedUpiItems.filter((item) => matchesFilters(item, filterState)),
    [receivedUpiItems, mode, filterParty, chequeNumber, chequeDateFrom, chequeDateTo],
  );

  const showChequeFilters = mode === 'cheque';
  const hasRows = filteredUnreceived.length + filteredReceived.length > 0;

  const clearFilters = () => {
    const today = new Date();
    setFilterParty();
    setChequeNumber('');
    setChequeDateFrom();
    setChequeDateTo();
    setMode('all');
    setFromDate(today);
    setToDate(today);
    setPartySelectorKey((key) => key + 1);
    fetchReceived(today, today);
  };

  return (
    <center>
      <div className="online-payments-screen">
        <h3>Online Payments</h3>
        <div className="online-payments-filters">
          <div className="online-payments-filters-row">
            <FilterField label="Type">
              <Dropdown
                value={MODE_OPTIONS.find((option) => option.id === mode)?.label}
                selectedOptions={[mode]}
                onOptionSelect={(_, data) => {
                  setMode(data.optionValue || 'all');
                }}
                style={{ minWidth: '140px' }}
              >
                {MODE_OPTIONS.map((option) => (
                  <Option key={option.id} value={option.id}>
                    {option.label}
                  </Option>
                ))}
              </Dropdown>
            </FilterField>
            <FilterField label="Party" wide>
              <PartySelector
                key={partySelectorKey}
                onPartySelected={setFilterParty}
              />
            </FilterField>
            <FilterField label="Entry date">
              <div className="online-payments-date-range">
                <DatePicker
                  className="filter-input"
                  onSelectDate={(d) => setFromDate(d)}
                  placeholder="From"
                  value={fromDate}
                />
                <span className="online-payments-date-sep">to</span>
                <DatePicker
                  className="filter-input"
                  onSelectDate={(d) => setToDate(d)}
                  placeholder="To"
                  value={toDate}
                />
              </div>
            </FilterField>
            <div className="online-payments-actions">
              <Button appearance="primary" onClick={() => fetchReceived()}>
                Get
              </Button>
              <Button appearance="secondary" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>
          {showChequeFilters ? (
            <div className="online-payments-filters-row">
              <FilterField label="Cheque no.">
                <Input
                  className="filter-input"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="Number"
                />
              </FilterField>
              <FilterField label="Cheque date">
                <div className="online-payments-date-range">
                  <DatePicker
                    className="filter-input"
                    placeholder="From"
                    value={chequeDateFrom}
                    onSelectDate={setChequeDateFrom}
                  />
                  <span className="online-payments-date-sep">to</span>
                  <DatePicker
                    className="filter-input"
                    placeholder="To"
                    value={chequeDateTo}
                    onSelectDate={setChequeDateTo}
                  />
                </div>
              </FilterField>
            </div>
          ) : null}
        </div>
        <div className="app-table-wrapper">
          {loading ? (
            <div className="online-payments-loading">
              <Spinner />
            </div>
          ) : (
            <table className="app-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Party</th>
                  <th>Amount</th>
                  <th>Cheque No.</th>
                  <th>Cheque Date</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnreceived.map((uri) => {
                  return (
                    <UpiItemRow
                      refreshData={() => {
                        fetchReceived();
                      }}
                      key={`pending-${uri.id}`}
                      data={uri}
                    />
                  );
                })}
                {filteredReceived.map((uri) => {
                  return <UpiItemRow key={`received-${uri.id}`} data={uri} />;
                })}
              </tbody>
            </table>
          )}
          {!loading && !hasRows ? (
            <div className="online-payments-empty">No payments found</div>
          ) : null}
        </div>
      </div>
    </center>
  );
}

function UpiItemRow({ data, refreshData }) {
  const { allUsers } = useAuthUser();
  const isCheque = normalizeType(data) === 'cheque';
  return (
    <tr>
      <td>{globalUtils.getTimeFormat(data.timestamp, true)}</td>
      <td>{normalizeType(data).toUpperCase()}</td>
      <td>{data.party?.name}</td>
      <td>{globalUtils.getCurrencyFormat(data.amount)}</td>
      <td>{isCheque ? data.chequeNumber || '--' : '--'}</td>
      <td>
        {isCheque && data.chequeDate
          ? globalUtils.getTimeFormat(data.chequeDate, true)
          : '--'}
      </td>
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
        {isCheque ? (
          <ChequeEntryDialog
            paymentId={data.id}
            isReceived={!!data.isReceived}
            onClose={() => {
              if (refreshData) refreshData();
            }}
            chequeData={{
              image: Array.isArray(data.imageUrl)
                ? data.imageUrl[0]
                : data.imageUrl,
              party: data.party,
              amount: data.amount,
              chequeNumber: data.chequeNumber,
              chequeDate: data.chequeDate,
              sourceRefs: data.sourceRefs,
              partyId: data.partyId,
              accountsNotes: data.accountsNotes,
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
      const paymentRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.ONLINE_PAYMENTS,
        data.id,
      );
      await updateDoc(paymentRef, {
        receivedBy: firebaseAuth.currentUser.uid,
        isReceived: true,
        receivedAt: Timestamp.now().toMillis(),
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
                    <b>
                      {data.accountsNotes && data.accountsNotes !== '--'
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
                  alt="Online payment"
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
                    cursor:
                      zoomScale > 1
                        ? isDragging
                          ? 'grabbing'
                          : 'grab'
                        : 'zoom-in',
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
