import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Spinner,
  Dropdown,
  Option,
  Label,
} from '@fluentui/react-components';
import {
  ArrowDownload24Regular,
  ArrowUpload24Regular,
  DocumentTable24Regular,
} from '@fluentui/react-icons';
import { writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { firebaseDB } from '../../../firebaseInit';
import { useCompany } from '../../../contexts/companyContext';
import { useCurrentUser } from '../../../contexts/userContext';
import {
  getCompanyCollection,
  DB_NAMES,
} from '../../../services/firestoreHelpers';

// Fields mirror AshishDrugAgencies-App/lib/src/parties/models/party_model.dart
const PARTY_FIELDS = [
  { key: 'name', label: 'Party Name', required: true },
  { key: 'area', label: 'Area' },
  { key: 'fileNumber', label: 'File Number' },
  { key: 'addressline1', label: 'Address Line 1' },
  { key: 'addressline2', label: 'Address Line 2' },
  { key: 'addressline3', label: 'Address Line 3' },
  { key: 'pin', label: 'PIN' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'phone1', label: 'Phone 1' },
  { key: 'phone2', label: 'Phone 2' },
  { key: 'license', label: 'Drug License' },
  { key: 'tin', label: 'TIN / GST' },
  { key: 'panNo', label: 'PAN' },
  { key: 'paymentTerms', label: 'Payment Terms' },
  { key: 'creditDays', label: 'Credit Days' },
];

const SKIP = '__skip__';

const HEADER_HINTS = {
  name: ['party', 'name', 'customer', 'shop'],
  area: ['area', 'locality', 'region'],
  fileNumber: ['file'],
  addressline1: ['address', 'addr', 'line 1', 'line1', 'street'],
  addressline2: ['line 2', 'line2'],
  addressline3: ['line 3', 'line3'],
  pin: ['pin', 'pincode', 'postal', 'zip'],
  contact: ['contact', 'person'],
  phone1: ['phone', 'mobile', 'mob', 'tel', 'contact no'],
  phone2: ['phone 2', 'mobile 2', 'alt phone'],
  license: ['license', 'drug', 'dl'],
  tin: ['tin', 'gst', 'gstin'],
  panNo: ['pan'],
  paymentTerms: ['payment', 'terms'],
  creditDays: ['credit', 'days'],
};

export default function ImportParties({ open, onClose, onImported }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const { currentCompanyId } = useCompany();
  const { user } = useCurrentUser();

  const reset = () => {
    setRows([]);
    setHeaders([]);
    setMapping({});
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!jsonData.length) return;

        const cols = Object.keys(jsonData[0]);
        setHeaders(cols);
        setRows(jsonData);
        autoMap(cols);
      } catch (err) {
        console.error('Error parsing file:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const autoMap = (cols) => {
    const newMap = {};
    const lowerCols = cols.map((c) => c.toLowerCase().trim());
    const used = new Set();

    PARTY_FIELDS.forEach((f) => {
      const exactIdx = lowerCols.findIndex(
        (c, i) => !used.has(i) && c === f.key.toLowerCase(),
      );
      if (exactIdx !== -1) {
        newMap[f.key] = cols[exactIdx];
        used.add(exactIdx);
        return;
      }
      const labelIdx = lowerCols.findIndex(
        (c, i) => !used.has(i) && c === f.label.toLowerCase(),
      );
      if (labelIdx !== -1) {
        newMap[f.key] = cols[labelIdx];
        used.add(labelIdx);
        return;
      }
      const hints = HEADER_HINTS[f.key] || [];
      const hintIdx = lowerCols.findIndex(
        (c, i) => !used.has(i) && hints.some((h) => c.includes(h)),
      );
      if (hintIdx !== -1) {
        newMap[f.key] = cols[hintIdx];
        used.add(hintIdx);
      }
    });

    setMapping(newMap);
  };

  const setFieldMapping = (fieldKey, colName) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (colName === SKIP) {
        delete next[fieldKey];
      } else {
        next[fieldKey] = colName;
      }
      return next;
    });
  };

  const nameCol = mapping.name;
  const canImport = rows.length > 0 && nameCol;

  const strVal = (row, col) =>
    col ? String(row[col] ?? '').trim() : '';

  const buildParties = () => {
    return rows
      .map((row) => {
        const name = strVal(row, mapping.name);
        if (!name) return null;

        const creditDaysRaw = strVal(row, mapping.creditDays);
        let creditDays = null;
        if (creditDaysRaw !== '') {
          const parsed = parseInt(creditDaysRaw, 10);
          if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 120) {
            creditDays = parsed;
          }
        }

        return {
          name,
          area: strVal(row, mapping.area),
          fileNumber: strVal(row, mapping.fileNumber),
          addressline1: strVal(row, mapping.addressline1),
          addressline2: strVal(row, mapping.addressline2),
          addressline3: strVal(row, mapping.addressline3),
          pin: strVal(row, mapping.pin),
          contact: strVal(row, mapping.contact),
          phone1: strVal(row, mapping.phone1),
          phone2: strVal(row, mapping.phone2),
          phone3: '',
          phone4: '',
          license: strVal(row, mapping.license),
          tin: strVal(row, mapping.tin),
          panNo: strVal(row, mapping.panNo),
          paymentTerms: strVal(row, mapping.paymentTerms),
          creditDays,
          partyBalance: 0,
          payments: [],
          cid: currentCompanyId || '',
          createdBy: user?.uid || '',
          createdAt: Date.now(),
        };
      })
      .filter(Boolean);
  };

  const doImport = async () => {
    if (importing) return;
    if (!currentCompanyId) {
      setResult({ success: false, error: 'No company selected.' });
      return;
    }
    setImporting(true);
    const parties = buildParties();

    try {
      const colRef = getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES);
      let imported = 0;
      const BATCH_LIMIT = 450;

      for (let i = 0; i < parties.length; i += BATCH_LIMIT) {
        const batch = writeBatch(firebaseDB);
        const chunk = parties.slice(i, i + BATCH_LIMIT);
        chunk.forEach((p) => {
          const newRef = doc(colRef);
          batch.set(newRef, { ...p, id: newRef.id });
        });
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
        imported += chunk.length;
      }

      setResult({ success: true, count: imported });
      onImported?.();
    } catch (err) {
      console.error('Import error:', err);
      setResult({ success: false, error: err.message });
    }
    setImporting(false);
  };

  const previewParties = rows.length > 0 ? buildParties().slice(0, 10) : [];

  const downloadSampleTemplate = () => {
    const headerRow = PARTY_FIELDS.map((f) => f.label);
    const sampleRow = {
      'Party Name': 'ACME MEDICAL',
      Area: 'MG Road',
      'File Number': 'F-001',
      'Address Line 1': '12, Main Street',
      'Address Line 2': 'Near City Hospital',
      'Address Line 3': '',
      PIN: '462001',
      'Contact Person': 'Mr. Sharma',
      'Phone 1': '9876543210',
      'Phone 2': '',
      'Drug License': 'MP/BPL/20B/1234',
      'TIN / GST': '23ABCDE1234F1Z5',
      PAN: 'ABCDE1234F',
      'Payment Terms': 'Credit',
      'Credit Days': '30',
    };
    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headerRow });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parties');
    XLSX.writeFile(wb, 'parties-import-sample.xlsx');
  };

  return (
    <Dialog open={open}>
      <DialogSurface style={{ maxWidth: 820 }}>
        <DialogBody>
          <DialogTitle>Import Parties from CSV / Excel</DialogTitle>
          <DialogContent className="import-dialog-content">
            {!rows.length && !result && (
              <>
                <div
                  className="import-drop-zone"
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      fileRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <ArrowUpload24Regular />
                  <p style={{ margin: '8px 0 4px' }}>
                    <strong>Click to select a file</strong>
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--colorNeutralForeground3)',
                    }}
                  >
                    Supports .csv, .xlsx, .xls files. First row is treated as
                    column headers.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={handleFile}
                  />
                </div>

                <div className="import-format-section">
                  <div className="import-format-title-row">
                    <Label className="import-format-title">
                      Expected columns
                    </Label>
                    <Button
                      size="small"
                      appearance="secondary"
                      icon={<ArrowDownload24Regular />}
                      onClick={downloadSampleTemplate}
                    >
                      Download sample Excel
                    </Button>
                  </div>
                  <div className="import-format-chips">
                    {PARTY_FIELDS.map((f) => (
                      <span
                        key={f.key}
                        className={`import-format-chip${
                          f.required ? ' required' : ''
                        }`}
                      >
                        {f.label}
                        {f.required && ' *'}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {rows.length > 0 && !result && (
              <>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <DocumentTable24Regular />
                  <span style={{ fontWeight: 600 }}>
                    {rows.length} rows found
                  </span>
                  <Button
                    size="small"
                    appearance="subtle"
                    onClick={() => {
                      reset();
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                  >
                    Change file
                  </Button>
                </div>

                <Label style={{ fontWeight: 600, marginBottom: 4 }}>
                  Map columns to party fields:
                </Label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {PARTY_FIELDS.map((f) => (
                    <div
                      key={f.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ width: 130, fontSize: 13 }}>
                        {f.label}
                        {f.required && ' *'}
                      </span>
                      <Dropdown
                        value={mapping[f.key] || '— skip —'}
                        selectedOptions={[mapping[f.key] || SKIP]}
                        onOptionSelect={(_, d) =>
                          setFieldMapping(f.key, d.optionValue)
                        }
                        style={{ minWidth: 180, flex: 1 }}
                        size="small"
                      >
                        <Option value={SKIP} text="— skip —">
                          — skip —
                        </Option>
                        {headers.map((h) => (
                          <Option key={h} value={h} text={h}>
                            {h}
                          </Option>
                        ))}
                      </Dropdown>
                    </div>
                  ))}
                </div>

                {previewParties.length > 0 && (
                  <>
                    <Label style={{ fontWeight: 600 }}>
                      Preview (first {previewParties.length} rows):
                    </Label>
                    <div className="import-preview-wrapper">
                      <table className="app-table compact">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Area</th>
                            <th>PIN</th>
                            <th>Address</th>
                            <th>Phone</th>
                            <th>File #</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewParties.map((p, i) => (
                            <tr key={i}>
                              <td>{p.name}</td>
                              <td>{p.area}</td>
                              <td>{p.pin}</td>
                              <td>{p.addressline1}</td>
                              <td>{p.phone1}</td>
                              <td>{p.fileNumber}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="import-summary">
                      Total parties to import:{' '}
                      <strong>{buildParties().length}</strong>
                    </div>
                  </>
                )}

                {!nameCol && (
                  <p
                    style={{
                      color: '#c5221f',
                      fontSize: 13,
                      marginTop: 8,
                    }}
                  >
                    Please map a column to <strong>Party Name</strong> to
                    continue.
                  </p>
                )}
              </>
            )}

            {result && (
              <div style={{ padding: 20, textAlign: 'center' }}>
                {result.success ? (
                  <>
                    <p
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: '#1e7e34',
                      }}
                    >
                      Import Successful
                    </p>
                    <p>{result.count} parties imported.</p>
                  </>
                ) : (
                  <>
                    <p
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: '#c5221f',
                      }}
                    >
                      Import Failed
                    </p>
                    <p>{result.error}</p>
                  </>
                )}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} appearance="secondary">
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && rows.length > 0 && (
              <Button
                onClick={doImport}
                appearance="primary"
                disabled={!canImport || importing}
              >
                {importing ? (
                  <>
                    <Spinner size="tiny" /> Importing...
                  </>
                ) : (
                  `Import ${buildParties().length} Parties`
                )}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
