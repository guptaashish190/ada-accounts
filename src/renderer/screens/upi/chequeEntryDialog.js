import {
  Button,
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
  Image,
  Text,
} from '@fluentui/react-components';
import { Timestamp, updateDoc } from 'firebase/firestore';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import React, { useEffect, useState } from 'react';
import PartySelector from '../../common/partySelector';
import './chequeEntryDialog.css';
import { VerticalSpace1 } from '../../common/verticalSpace';
import { firebaseAuth } from '../../firebaseInit';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyDoc, DB_NAMES } from '../../services/firestoreHelpers';
import { PaymentSourceInfo } from '../../common/paymentSourceInfo';

export function ChequeEntryDialog({
  onClose,
  chequeData,
  paymentId,
  isReceived = false,
}) {
  const [showChequeEntryDialog, setShowChequeEntryDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [chequeNumber, setChequeNumber] = useState(
    chequeData?.chequeNumber ? String(chequeData.chequeNumber) : '',
  );
  const [chequeDate, setChequeDate] = useState(
    chequeData?.chequeDate ? new Date(chequeData.chequeDate) : undefined,
  );
  const [party, setParty] = useState(chequeData?.party);
  const [amount, setAmount] = useState(
    chequeData?.amount !== undefined ? String(chequeData.amount) : '',
  );
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
    setChequeNumber(
      chequeData?.chequeNumber ? String(chequeData.chequeNumber) : '',
    );
    setChequeDate(
      chequeData?.chequeDate ? new Date(chequeData.chequeDate) : undefined,
    );
  }, [chequeData?.amount, chequeData?.chequeNumber, chequeData?.chequeDate]);

  const handleReceiveCheque = async () => {
    if (loading) return;
    if (!paymentId || !chequeNumber.length || !chequeDate || !party || !amount.length) {
      // eslint-disable-next-line no-alert
      alert('Enter all fields');
      return;
    }
    setLoading(true);

    try {
      const parsedAmount = parseInt(amount, 10);
      await updateDoc(
        getCompanyDoc(currentCompanyId, DB_NAMES.ONLINE_PAYMENTS, paymentId),
        {
          chequeNumber,
          chequeDate: chequeDate.getTime(),
          amount: Number.isNaN(parsedAmount) ? 0 : parsedAmount,
          partyId: party.id,
          notes:
            chequeData?.accountsNotes && chequeData.accountsNotes !== '--'
              ? chequeData.accountsNotes
              : '',
          isReceived: true,
          receivedBy: firebaseAuth.currentUser.uid,
          receivedAt: Timestamp.now().toMillis(),
        },
      );
      onClose();
      setShowChequeEntryDialog(false);
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert('error receiving cheque');
      console.error('Error updating document: ', error);
    }
    setLoading(false);
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
            {isReceived ? 'View' : 'Cheque Entry'}
          </Button>
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {isReceived ? 'View Cheque' : 'Receive Cheque'}
            </DialogTitle>
            <DialogContent className="cheque-entry-dailog">
              {loading ? <Spinner /> : null}
              {chequeData?.image ? (
                <Image
                  fit="contain"
                  src={
                    Array.isArray(chequeData.image)
                      ? chequeData.image[0]
                      : chequeData.image
                  }
                  style={{
                    height: '25vh',
                    marginBottom: '20px',
                    cursor: 'zoom-in',
                  }}
                  onClick={() => openImageViewer()}
                />
              ) : null}
              {chequeData?.sourceRefs?.length > 0 ? (
                <>
                  <Label>Source</Label>
                  <PaymentSourceInfo
                    sourceRefs={chequeData.sourceRefs}
                    partyId={chequeData?.partyId}
                    showNotes={false}
                  />
                  <VerticalSpace1 />
                </>
              ) : null}
              <Label>Cheque Number</Label>
              <Input
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="Cheque Number"
                disabled={isReceived}
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
                disabled={isReceived}
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
                disabled={isReceived}
              />
              <VerticalSpace1 />

              <Label>Account Notes</Label>
              <Text>
                {chequeData?.accountsNotes && chequeData.accountsNotes !== '--'
                  ? chequeData.accountsNotes
                  : '--'}
              </Text>
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
              {!isReceived ? (
                <Button onClick={() => handleReceiveCheque()} appearance="primary">
                  Receive
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
                  src={
                    Array.isArray(chequeData?.image)
                      ? chequeData.image[0]
                      : chequeData?.image
                  }
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
