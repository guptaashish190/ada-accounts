import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { ArrowUpload24Regular } from '@fluentui/react-icons';
import { getDocs, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { firebaseDB } from '../../../firebaseInit';
import { useCompany } from '../../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../../services/firestoreHelpers';
import { parseSheetRows, prepareRouteImport } from './routeImportAlgo';

const ISSUE_PREVIEW = 12;

export default function ImportRouteParties({ open, onClose, onImported }) {
  const fileRef = useRef(null);
  const { currentCompanyId } = useCompany();
  const [fileName, setFileName] = useState('');
  const [sheetRows, setSheetRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [plan, setPlan] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setFileName('');
    setSheetRows([]);
    setParseError('');
    setPlan(null);
    setPreviewing(false);
    setApplying(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    if (applying) return;
    reset();
    onClose();
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPlan(null);
    setResult(null);
    setParseError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const workbook = XLSX.read(loadEvent.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const parsed = parseSheetRows(jsonRows);
        if (parsed.error) {
          setSheetRows([]);
          setParseError(parsed.error);
          return;
        }
        setSheetRows(parsed.rows);
      } catch (error) {
        console.error('Error parsing route file:', error);
        setSheetRows([]);
        setParseError('Could not read that file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePreview = async () => {
    if (!currentCompanyId || sheetRows.length === 0 || previewing) return;
    setPreviewing(true);
    setResult(null);
    try {
      const [partiesSnapshot, routesSnapshot] = await Promise.all([
        getDocs(getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES)),
        getDocs(getCompanyCollection(currentCompanyId, DB_NAMES.MR_ROUTES)),
      ]);
      const parties = partiesSnapshot.docs.map((partyDoc) => ({
        id: partyDoc.id,
        name: partyDoc.data().name || partyDoc.data().partyName || '',
      }));
      const existingRoutes = routesSnapshot.docs.map((routeDoc) => ({
        id: routeDoc.id,
        ...routeDoc.data(),
      }));
      setPlan(prepareRouteImport({ sheetRows, parties, existingRoutes }));
    } catch (error) {
      console.error('Error previewing route import:', error);
      setParseError(error.message || 'Could not load parties and routes.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (!plan || applying || !currentCompanyId) return;
    const { creates, updates } = plan.writes;
    if (creates.length === 0 && updates.length === 0) return;

    setApplying(true);
    try {
      const routesCollection = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.MR_ROUTES,
      );
      const batch = writeBatch(firebaseDB);
      creates.forEach((route) => {
        const ref = doc(routesCollection);
        batch.set(ref, { name: route.name, route: route.route });
      });
      updates.forEach((route) => {
        batch.update(
          getCompanyDoc(currentCompanyId, DB_NAMES.MR_ROUTES, route.id),
          { route: route.route },
        );
      });
      await batch.commit();
      setResult({
        success: true,
        created: creates.length,
        updated: updates.length,
      });
      onImported?.();
    } catch (error) {
      console.error('Error applying route import:', error);
      setResult({ success: false, error: error.message });
    } finally {
      setApplying(false);
    }
  };

  const canApply =
    plan &&
    !result?.success &&
    (plan.writes.creates.length > 0 || plan.writes.updates.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) handleClose();
      }}
    >
      <DialogSurface style={{ maxWidth: 760 }}>
        <DialogBody>
          <DialogTitle>Import parties onto routes</DialogTitle>
          <DialogContent className="route-import-content">
            <ol className="route-import-steps">
              <li>Match each Party Name to an existing party. Parties are not created.</li>
              <li>Read Route Name and Day. Short spellings such as SATYE and ARVIND 1 still collapse to SATYENDAR and ARVIND.</li>
              <li>Put that party on that day of that route, and remove it from every other day and route.</li>
              <li>A blank route name or day leaves that party where it already is.</li>
            </ol>

            {!result && (
              <div
                className="route-import-drop"
                onClick={() => fileRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    fileRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <ArrowUpload24Regular />
                <p>
                  <strong>{fileName || 'Choose the route list Excel'}</strong>
                </p>
                <p>Columns: Party Name, Route Name, Day. Preview does not write anything.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
              </div>
            )}

            {parseError && (
              <Text style={{ color: '#a4262c', display: 'block', marginTop: 8 }}>
                {parseError}
              </Text>
            )}

            {sheetRows.length > 0 && !plan && !result && (
              <Text style={{ display: 'block', marginTop: 8 }}>
                {sheetRows.length} rows read. Preview matches them to parties before anything is saved.
              </Text>
            )}

            {plan && !result && (
              <div className="route-import-summary">
                <p>{plan.stats.assignedParties} parties will be placed.</p>
                <p>{plan.stats.routesToCreate} routes will be created, {plan.stats.routesToUpdate} updated.</p>
                <p>{plan.stats.blankRoutes} blank routes left unchanged.</p>
                <p>
                  {plan.stats.partyNotFound} names not in parties, {plan.stats.unknownRoute} unrecognized routes, {plan.stats.partyAmbiguous} ambiguous names.
                </p>
                {plan.issues.length > 0 && (
                  <ul className="route-import-issues">
                    {plan.issues.slice(0, ISSUE_PREVIEW).map((issue) => (
                      <li key={`${issue.type}-${issue.rowNumber || issue.routeName}`}>
                        {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ''}
                        {issue.message}
                      </li>
                    ))}
                    {plan.issues.length > ISSUE_PREVIEW && (
                      <li>{plan.issues.length - ISSUE_PREVIEW} more.</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {result?.success && (
              <Text style={{ display: 'block', marginTop: 8 }}>
                Saved. Created {result.created} routes and updated {result.updated}.
              </Text>
            )}
            {result && !result.success && (
              <Text style={{ color: '#a4262c', display: 'block', marginTop: 8 }}>
                {result.error || 'Import failed.'}
              </Text>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={handleClose} disabled={applying}>
              Close
            </Button>
            {!result?.success && (
              <Button
                appearance="secondary"
                onClick={handlePreview}
                disabled={previewing || applying || sheetRows.length === 0}
              >
                {previewing ? <Spinner size="tiny" /> : 'Preview'}
              </Button>
            )}
            {!result?.success && (
              <Button
                appearance="primary"
                onClick={handleApply}
                disabled={!canApply || applying || previewing}
              >
                {applying ? 'Saving...' : 'Apply to routes'}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
