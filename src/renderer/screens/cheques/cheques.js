import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  th,
  TableRow,
  Tooltip,
  Image,
  Text,
} from '@fluentui/react-components';
import {
  Timestamp,
  addDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import React, { useEffect, useState } from 'react';
import PartySelector from '../../common/partySelector';
import './style.css';
import { VerticalSpace1 } from '../../common/verticalSpace';
import globalUtils from '../../services/globalUtils';
import constants from '../../constants';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';

export default function ChequesScreen() {
  const [chequeList, setChequeList] = useState([]);
  const [filteredCheques, setFilteredCheques] = useState();

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();

  const fetchCheques = async () => {
    const chequeCollection = getCompanyCollection(currentCompanyId, DB_NAMES.CHEQUES);

    try {
      const qs = query(
        chequeCollection,
        orderBy('entryNumber', 'desc'),
        limit(100),
      );
      const querySnapshot = await getDocs(qs);
      const chequesData = [];

      querySnapshot.forEach((doc) => {
        chequesData.push(doc.data());
      });

      const newData = await globalUtils.fetchPartyInfoForOrders(
        chequesData,
        currentCompanyId,
      );
      setChequeList(newData);
    } catch (error) {
      console.error('Error fetching documents: ', error);
    }
  };

  const getFilteredTotal = () => {
    if (!filteredCheques) return 0;

    return filteredCheques.reduce(
      (acc, cur) => acc + parseInt(cur.amount, 10),
      0,
    );
  };

  useEffect(() => {
    fetchCheques();
  }, [currentCompanyId]);

  return (
    <center>
      <div className="cheques-screen">
        <h2>Cheques</h2>
        <VerticalSpace1 />
        {/* <ChequeEntryDialog
          onClose={() => {
            fetchCheques();
          }}
        /> */}
        <VerticalSpace1 />
        <FilterSection
          setFilteredCheques={setFilteredCheques}
          clearFilters={() => {
            setFilteredCheques();
          }}
          currentCompanyId={currentCompanyId}
        />
        <VerticalSpace1 />
        <div className="modern-table">
          <div className="modern-table-header" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            <div>Entry No.</div>
            <div>Party Name</div>
            <div>Cheque Number</div>
            <div>Cheque Date</div>
            <div style={{ textAlign: 'right' }}>Amount</div>
            <div>Notes</div>
            <div>Received On</div>
          </div>
          {(filteredCheques || chequeList).map((ch, i) => (
            <ChequeTableRow
              key={`checque-list-${ch.entryNumber}`}
              data={ch}
              index={i}
            />
          ))}
          {filteredCheques && (
            <div 
              className="modern-table-row" 
              style={{ 
                gridTemplateColumns: 'repeat(7, 1fr)',
                backgroundColor: '#fef3c7',
                fontWeight: '600'
              }}
            >
              <div></div>
              <div></div>
              <div></div>
              <div>Total Amount</div>
              <div className="modern-table-cell amount">
                {globalUtils.getCurrencyFormat(getFilteredTotal())}
              </div>
              <div></div>
              <div></div>
            </div>
          )}
        </div>
      </div>
    </center>
  );
}

function FilterSection({ setFilteredCheques, clearFilters, currentCompanyId }) {
  const [party, setParty] = useState();
  const [chequeNumber, setChequeNumber] = useState('');
  const [dateFrom, setDateFrom] = useState();
  const [dateTo, setDateTo] = useState();
  const [creationDateFrom, setCreationDateFrom] = useState();
  const [creationDateTo, setCreationDateTo] = useState();

  const onFilter = async () => {
    try {
      const chequesRef = getCompanyCollection(currentCompanyId, DB_NAMES.CHEQUES);

      let dynamicQuery = chequesRef;
      let isFiltered = false;

      if (party) {
        dynamicQuery = query(dynamicQuery, where('partyId', '==', party.id));
        isFiltered = true;
      }
      if (chequeNumber.length) {
        dynamicQuery = query(
          dynamicQuery,
          where('chequeNumber', '==', chequeNumber),
        );
        isFiltered = true;
      }
      if (dateFrom && dateTo) {
        const dateTo1 = new Date(dateTo);
        dateTo1.setHours(11);
        dateTo1.setMinutes(59);
        dateTo1.setSeconds(59);

        dynamicQuery = query(
          dynamicQuery,
          where('chequeDate', '>=', dateFrom.getTime()),
          where('chequeDate', '<=', dateTo1.getTime()),
        );
        isFiltered = true;
      }

      if (creationDateFrom && creationDateTo) {
        const creationDateTo1 = new Date(creationDateTo);
        creationDateTo1.setHours(11);
        creationDateTo1.setMinutes(59);
        creationDateTo1.setSeconds(59);
        console.log(creationDateFrom, creationDateTo1);
        dynamicQuery = query(
          dynamicQuery,
          where('timestamp', '>=', creationDateFrom.getTime()),
          where('timestamp', '<=', creationDateTo1.getTime()),
        );
        isFiltered = true;
      }

      if (!isFiltered) {
        dynamicQuery = query(
          dynamicQuery,
          orderBy('entryNumber', 'desc'),
          limit(100),
        );
      }

      const newItems = await getDocs(dynamicQuery);

      const chequesData = [];

      newItems.forEach((doc) => {
        chequesData.push(doc.data());
      });

      const newData = await globalUtils.fetchPartyInfoForOrders(
        chequesData,
        currentCompanyId,
      );
      setFilteredCheques(newData);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Error filtering');
      console.log(e);
    }
  };

  return (
    <div className="filter-section-container">
      <div className="filter-section-item">
        <PartySelector onPartySelected={setParty} />
      </div>
      <div className="filter-section-item">
        <Input
          className=" filter-input"
          value={chequeNumber}
          onChange={(e) => setChequeNumber(e.target.value)}
          placeholder="Cheque Number"
        />
      </div>
      <div className="filter-section-item">
        <DatePicker
          className=" filter-input"
          placeholder="Cheque Date From"
          value={dateFrom}
          onSelectDate={setDateFrom}
        />
      </div>
      <div className="filter-section-item">
        <DatePicker
          className=" filter-input"
          placeholder="Cheque Date To"
          value={dateTo}
          onSelectDate={setDateTo}
        />
      </div>

      <div className="filter-section-item">
        <DatePicker
          className=" filter-input"
          placeholder="Entry Date From"
          value={creationDateFrom}
          onSelectDate={setCreationDateFrom}
        />
      </div>
      <div className="filter-section-item">
        <DatePicker
          className=" filter-input"
          placeholder="Entry Date To"
          value={creationDateTo}
          onSelectDate={setCreationDateTo}
        />
      </div>
      <Button
        onClick={() => {
          onFilter();
        }}
      >
        Filter
      </Button>
      <Button
        onClick={() => {
          setParty();
          setChequeNumber('');
          setDateFrom();
          setDateTo();
          clearFilters();
          setCreationDateFrom();
          setCreationDateTo();
        }}
      >
        Clear Filters
      </Button>
    </div>
  );
}

function ChequeTableRow({ data, index }) {
  return (
    <div 
      className="modern-table-row" 
      style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
    >
      <div className="modern-table-cell">{data.entryNumber}</div>
      <div className="modern-table-cell">{data.party?.name}</div>
      <div className="modern-table-cell">{data.chequeNumber}</div>
      <div className="modern-table-cell date">
        {globalUtils.getTimeFormat(data.chequeDate, true)}
      </div>
      <div className="modern-table-cell amount">
        {globalUtils.getCurrencyFormat(data.amount)}
      </div>
      <div className="modern-table-cell">{data.notes}</div>
      <div className="modern-table-cell date">
        {globalUtils.getTimeFormat(data.timestamp, true)}
      </div>
    </div>
  );
}

function TableCustomCell({ children }) {
  return <td>{children || '--'}</td>;
}

export function ChequeEntryDialog({ onClose, chequeData }) {
  const [showChequeEntryDialog, setShowChequeEntryDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState();
  const [party, setParty] = useState(chequeData?.party);
  const [amount, setAmount] = useState(
    chequeData?.amount !== undefined ? String(chequeData.amount) : '',
  );
  const [notes, setNotes] = useState('');
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

  useEffect(() => {
    setAmount(chequeData?.amount !== undefined ? String(chequeData.amount) : '');
  }, [chequeData?.amount]);

  const handleAddCheque = async () => {
    if (loading) return;
    if (!chequeNumber.length || !chequeDate || !party || !amount.length) {
      // eslint-disable-next-line no-alert
      alert('Enter all fields');
      return;
    }
    setLoading(true);
    const chequeCollection = getCompanyCollection(
      currentCompanyId,
      DB_NAMES.CHEQUES,
    );

    try {
      const newEntryNumber = await globalUtils.getNewReceiptNumber(
        constants.newReceiptCounters.CHEQUES,
        currentCompanyId,
      );
      addDoc(chequeCollection, {
        chequeNumber,
        partyId: party.id,
        amount,
        notes,
        chequeDate: chequeDate.getTime(),
        timestamp: Timestamp.now().toMillis(),
        entryNumber: newEntryNumber,
      });
      globalUtils.incrementReceiptCounter(
        constants.newReceiptCounters.CHEQUES,
        currentCompanyId,
      );
      onClose();
      setShowChequeEntryDialog(false);
      setLoading(false);
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert('error adding cheque entry');
      console.error('Error adding document: ', error);
      setLoading(false);
    }
  };
  const onFormatDate = (date) => {
    return !date
      ? ''
      : `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear() % 100}`;
  };
  const onParseDateFromString = React.useCallback(
    (newValue) => {
      const previousValue = chequeDate || new Date();
      const newValueParts = (newValue || '').trim().split('.');
      const day =
        newValueParts.length > 0
          ? Math.max(1, Math.min(31, parseInt(newValueParts[0], 10)))
          : previousValue.getDate();
      const month =
        newValueParts.length > 1
          ? Math.max(1, Math.min(12, parseInt(newValueParts[1], 10))) - 1
          : previousValue.getMonth();
      let year =
        newValueParts.length > 2
          ? parseInt(newValueParts[2], 10)
          : previousValue.getFullYear();
      if (year < 100) {
        year +=
          previousValue.getFullYear() - (previousValue.getFullYear() % 100);
      }
      return new Date(year, month, day);
    },
    [chequeDate],
  );
  return (
    <>
      <Dialog open={showChequeEntryDialog}>
      <DialogTrigger disableButtonEnhancement>
        <Button onClick={() => setShowChequeEntryDialog(true)}>
          Cheque Entry
        </Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogContent className="cheque-entry-dailog">
            {loading ? <Spinner /> : null}
            {chequeData?.image ? (
              <Image
                fit="contain"
                src={chequeData.image}
                style={{
                  height: '25vh',
                  marginBottom: '20px',
                  cursor: 'zoom-in',
                }}
                onClick={() => openImageViewer()}
              />
            ) : null}
            <Label>Cheque Number</Label>
            <Input
              value={chequeNumber}
              onChange={(e) => setChequeNumber(e.target.value)}
              placeholder="Cheque Number"
            />
            <VerticalSpace1 />

            <Label>Cheque Date(DD.MM.YYYY)</Label>
            <DatePicker
              allowTextInput
              formatDate={onFormatDate}
              onSelectDate={setChequeDate}
              parseDateFromString={onParseDateFromString}
              value={chequeDate}
              placeholder="Cheque Date"
            />
            <VerticalSpace1 />

            {chequeData?.party ? '' : <Label>Select Party</Label>}
            {chequeData?.party ? (
              <div style={{ fontSize: '1.2em' }}>{chequeData.party.name}</div>
            ) : (
              <PartySelector onPartySelected={(p) => setParty(p)} />
            )}

            <VerticalSpace1 />

            <Label>Amount</Label>
            <Input
              type="number"
              contentBefore="₹"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
            />
            <VerticalSpace1 />

            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
            />
            <VerticalSpace1 />
            <VerticalSpace1 />
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="secondary"
                onClick={() => {
                  setShowChequeEntryDialog(false);
                }}
              >
                Close
              </Button>
            </DialogTrigger>
            <Button onClick={() => handleAddCheque()} appearance="primary">
              Create Cheque Entry
            </Button>
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
            <DialogTitle>Cheque Image Preview</DialogTitle>
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
                  src={chequeData?.image}
                  alt="Cheque"
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
