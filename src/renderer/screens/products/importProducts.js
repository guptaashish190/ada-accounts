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
  ArrowUpload24Regular,
  DocumentTable24Regular,
} from '@fluentui/react-icons';
import { writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { firebaseDB } from '../../firebaseInit';
import { useCompany } from '../../contexts/companyContext';
import {
  getCompanyCollection,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import './style.css';

const PRODUCT_FIELDS = [
  { key: 'name', label: 'Product Name', required: true },
  { key: 'company', label: 'Company / Brand' },
  { key: 'packSize', label: 'Pack Size' },
  { key: 'mrp', label: 'MRP' },
  { key: 'composition', label: 'Composition' },
];

const SKIP = '__skip__';

export default function ImportProducts({ open, onClose, onImported }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const { currentCompanyId } = useCompany();

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

    PRODUCT_FIELDS.forEach((f) => {
      const exact = lowerCols.findIndex((c) => c === f.key.toLowerCase());
      if (exact !== -1) {
        newMap[f.key] = cols[exact];
        return;
      }
      const partial = lowerCols.findIndex(
        (c) =>
          c.includes(f.key.toLowerCase()) || f.label.toLowerCase().includes(c),
      );
      if (partial !== -1) {
        newMap[f.key] = cols[partial];
        return;
      }
      if (f.key === 'name') {
        const nameIdx = lowerCols.findIndex(
          (c) => c.includes('product') || c.includes('item'),
        );
        if (nameIdx !== -1) newMap[f.key] = cols[nameIdx];
      }
      if (f.key === 'company') {
        const idx = lowerCols.findIndex(
          (c) => c.includes('brand') || c.includes('manufacturer'),
        );
        if (idx !== -1) newMap[f.key] = cols[idx];
      }
      if (f.key === 'packSize') {
        const idx = lowerCols.findIndex(
          (c) => c.includes('pack') || c.includes('unit') || c.includes('size'),
        );
        if (idx !== -1) newMap[f.key] = cols[idx];
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

  const buildProducts = () => {
    return rows
      .map((row) => {
        const name = String(row[mapping.name] || '').trim();
        if (!name) return null;
        return {
          name,
          Name: name.toUpperCase(),
          company: String(row[mapping.company] || '').trim(),
          packSize: String(row[mapping.packSize] || '').trim(),
          mrp: parseFloat(row[mapping.mrp]) || 0,
          composition: String(row[mapping.composition] || '').trim(),
          isActive: true,
        };
      })
      .filter(Boolean);
  };

  const doImport = async () => {
    if (importing) return;
    setImporting(true);
    const products = buildProducts();

    try {
      const colRef = getCompanyCollection(currentCompanyId, DB_NAMES.PRODUCTS);
      let imported = 0;
      const BATCH_LIMIT = 450;

      for (let i = 0; i < products.length; i += BATCH_LIMIT) {
        const batch = writeBatch(firebaseDB);
        const chunk = products.slice(i, i + BATCH_LIMIT);
        chunk.forEach((p) => {
          const newRef = doc(colRef);
          batch.set(newRef, { ...p, id: newRef.id });
        });
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

  const previewProducts = rows.length > 0 ? buildProducts().slice(0, 10) : [];

  return (
    <Dialog open={open}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>Import Products from CSV / Excel</DialogTitle>
          <DialogContent className="import-dialog-content">
            {!rows.length && !result && (
              <div
                className="import-drop-zone"
                onClick={() => fileRef.current?.click()}
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
                  Supports .csv, .xlsx, .xls files
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
              </div>
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
                      fileRef.current.value = '';
                    }}
                  >
                    Change file
                  </Button>
                </div>

                <Label style={{ fontWeight: 600, marginBottom: 4 }}>
                  Map columns to product fields:
                </Label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {PRODUCT_FIELDS.map((f) => (
                    <div
                      key={f.key}
                      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
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
                        style={{ minWidth: 200 }}
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

                {previewProducts.length > 0 && (
                  <>
                    <Label style={{ fontWeight: 600 }}>
                      Preview (first {previewProducts.length} rows):
                    </Label>
                    <div className="import-preview-wrapper">
                      <table className="import-preview-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Company</th>
                            <th>Pack</th>
                            <th>MRP</th>
                            <th>Composition</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewProducts.map((p, i) => (
                            <tr key={i}>
                              <td>{p.name}</td>
                              <td>{p.company}</td>
                              <td>{p.packSize}</td>
                              <td>{p.mrp}</td>
                              <td>{p.composition}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="import-summary">
                      Total products to import:{' '}
                      <strong>{buildProducts().length}</strong>
                    </div>
                  </>
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
                    <p>{result.count} products imported.</p>
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
                  `Import ${buildProducts().length} Products`
                )}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
