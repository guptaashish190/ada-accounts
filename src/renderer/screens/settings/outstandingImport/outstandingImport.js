import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Radio,
  RadioGroup,
  Spinner,
  Switch,
  Text,
} from '@fluentui/react-components';
import { ArrowUpload24Regular, ArrowSync24Regular } from '@fluentui/react-icons';
import { doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { firebaseDB } from '../../../firebaseInit';
import { useCompany } from '../../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../../services/firestoreHelpers';
import {
  buildNewOrderPayload,
  buildMajorityPartyCorrections,
  buildOrderUpdatePayload,
  buildSectionPartyIdMap,
  getMatchedPartyIds,
  isBill,
  matchOutstandingRow,
  normalizeBillNumber,
  parseOutstandingRows,
  selectZeroBalanceOrderIds,
  ZERO_MODE,
} from '../../../services/outstandingImportUtils';
import './style.css';

const IN_QUERY_LIMIT = 30;
const BATCH_LIMIT = 450;

const chunkArray = (arr, size) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

export default function OutstandingImportScreen() {
  const { currentCompanyId } = useCompany();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [currentStep, setCurrentStep] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [updateAmount, setUpdateAmount] = useState(true);
  const [updateBalance, setUpdateBalance] = useState(true);
  const [zeroMode, setZeroMode] = useState(ZERO_MODE.OFF);
  const [zeroModeEnabled, setZeroModeEnabled] = useState(false);
  const [zeroCandidateIds, setZeroCandidateIds] = useState([]);
  const [loadingZeroPreview, setLoadingZeroPreview] = useState(false);
  const [enablePartyMajorityFix, setEnablePartyMajorityFix] = useState(false);
  const [syncPartyBalance, setSyncPartyBalance] = useState(true);
  const [correctionPreview, setCorrectionPreview] = useState({
    transferCandidates: [],
    partyBalanceUpdates: [],
    sectionSummaries: [],
  });
  const [error, setError] = useState('');

  const summary = useMemo(() => {
    const initial = {
      total: rows.length,
      matched: 0,
      created: 0,
      ambiguous: 0,
      invalid: 0,
      skipped: 0,
      toBeZeroed: zeroCandidateIds.length,
      toTransfer: correctionPreview.transferCandidates.length,
      toSyncParties: correctionPreview.partyBalanceUpdates.length,
    };
    return rows.reduce((acc, row) => {
      if (row.status === 'matched') acc.matched += 1;
      if (row.status === 'create') acc.created += 1;
      if (row.status === 'ambiguous') acc.ambiguous += 1;
      if (row.status === 'invalid') acc.invalid += 1;
      if (!['matched', 'create'].includes(row.status)) acc.skipped += 1;
      return acc;
    }, initial);
  }, [
    rows,
    zeroCandidateIds.length,
    correctionPreview.transferCandidates.length,
    correctionPreview.partyBalanceUpdates.length,
  ]);

  const fetchOrdersForRows = async (parsedRows, onProgress = () => {}) => {
    const ordersCollection = getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS);
    const candidateNumbers = [...new Set(parsedRows.map((row) => row.billNumber).filter(Boolean))];

    if (!candidateNumbers.length) {
      onProgress('No bill numbers found for matching.');
      return [];
    }

    const chunks = chunkArray(candidateNumbers, IN_QUERY_LIMIT);
    const orderMap = new Map();

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      onProgress(`Matching bills in Firestore (${chunkIndex + 1}/${chunks.length})...`);
      const q = query(ordersCollection, where('billNumber', 'in', chunk));
      // eslint-disable-next-line no-await-in-loop
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnap) => {
        orderMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });
    }

    onProgress('Preparing matched preview...');
    return [...orderMap.values()];
  };

  const resolvePreviewRows = (parsedRows, allOrders) => {
    const orderByBillNumber = {};

    allOrders.forEach((order) => {
      const directKey = normalizeBillNumber(order.billNumber);
      if (!directKey) return;
      if (!orderByBillNumber[directKey]) {
        orderByBillNumber[directKey] = [];
      }
      orderByBillNumber[directKey].push(order);
    });

    return parsedRows.map((row) => {
      const exactOrders = orderByBillNumber[row.billNumber] || [];
      const uniqueOrders = [...new Map(exactOrders.map((order) => [order.id, order])).values()];
      const isTSeriesBill = isBill(row.billNumber);
      const matchedOrders = isTSeriesBill
        ? uniqueOrders
        : uniqueOrders.filter(
            (order) => Number(order.billCreationTime || 0) === Number(row.billCreationTime || 0) && Number(order.orderAmount || 0) === Number(row.orderAmount || 0),
          );

      const decision = matchOutstandingRow(row, matchedOrders);
      let status = decision.status;
      if (decision.status === 'unmatched') {
        if (!row.isOldBill && isTSeriesBill) {
          status = 'skipped_old_unmatched';
        } else {
          status = row.hasValidBillDate ? 'create' : 'invalid';
        }
      }

      return {
        ...row,
        status,
        matchedOrder: decision.matchedOrder || null,
      };
    });
  };

  const fetchEligibleOrdersForZeroing = async (mode, resolvedRows) => {
    if (!currentCompanyId || mode === ZERO_MODE.OFF) return [];

    const ordersCollection = getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS);
    const orderMap = new Map();

    if (mode === ZERO_MODE.ALL_UNMATCHED) {
      const q = query(ordersCollection, where('balance', '!=', 0));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        orderMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });
      return [...orderMap.values()];
    }

    const matchedPartyIds = [...getMatchedPartyIds(resolvedRows)];
    if (!matchedPartyIds.length) return [];

    const chunks = chunkArray(matchedPartyIds, IN_QUERY_LIMIT);
    for (const chunk of chunks) {
      const q = query(
        ordersCollection,
        where('partyId', 'in', chunk),
        where('balance', '!=', 0),
      );
      // eslint-disable-next-line no-await-in-loop
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        orderMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });
    }

    return [...orderMap.values()];
  };

  useEffect(() => {
    let cancelled = false;

    const buildZeroPreview = async () => {
      if (!rows.length || zeroMode === ZERO_MODE.OFF || !zeroModeEnabled) {
        setZeroCandidateIds([]);
        return;
      }
      if (!currentCompanyId) return;

      setLoadingZeroPreview(true);
      try {
        const eligibleOrders = await fetchEligibleOrdersForZeroing(zeroMode, rows);
        if (cancelled) return;

        const ids = selectZeroBalanceOrderIds({
          rows,
          eligibleOrders,
          zeroMode,
        });
        setZeroCandidateIds(ids);
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to build zero-preview set:', e);
          setZeroCandidateIds([]);
        }
      }
      if (!cancelled) {
        setLoadingZeroPreview(false);
      }
    };

    buildZeroPreview();
    return () => {
      cancelled = true;
    };
  }, [rows, zeroMode, zeroModeEnabled, currentCompanyId]);

  useEffect(() => {
    if (!enablePartyMajorityFix || !rows.length) {
      setCorrectionPreview({
        transferCandidates: [],
        partyBalanceUpdates: [],
        sectionSummaries: [],
      });
      return;
    }

    const preview = buildMajorityPartyCorrections(rows, {
      syncPartyBalance,
    });
    setCorrectionPreview(preview);
  }, [rows, enablePartyMajorityFix, syncPartyBalance]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!currentCompanyId) {
      setError('Please select a company first.');
      return;
    }

    setLoadingPreview(true);
    setCurrentStep('Reading selected file...');
    setError('');
    setResult(null);
    setRows([]);
    setFileName(file.name);
    setZeroModeEnabled(false);
    setZeroMode(ZERO_MODE.OFF);
    setZeroCandidateIds([]);
    setEnablePartyMajorityFix(false);
    setSyncPartyBalance(true);
    setCorrectionPreview({
      transferCandidates: [],
      partyBalanceUpdates: [],
      sectionSummaries: [],
    });

    try {
      const buffer = await file.arrayBuffer();
      setCurrentStep('Parsing workbook...');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      setCurrentStep('Parsing rows from spreadsheet...');
      const parsedRows = parseOutstandingRows(sheetRows);

      if (!parsedRows.length) {
        setError('No valid bill rows found in the selected file.');
        return;
      }

      setCurrentStep('Fetching matching bills from Firestore...');
      const allOrders = await fetchOrdersForRows(parsedRows, setCurrentStep);
      setCurrentStep('Resolving matched and unmatched rows...');
      const resolvedRows = resolvePreviewRows(parsedRows, allOrders);
      setRows(resolvedRows);
      setCurrentStep('Preview ready.');
    } catch (e) {
      console.error('Failed to read outstanding file:', e);
      setError('Failed to parse file. Please check the format and try again.');
    } finally {
      setLoadingPreview(false);
      setCurrentStep('');
    }
  };

  const runImport = async () => {
    if (!rows.length || applying) return;
    const hasPartyCorrectionWork =
      enablePartyMajorityFix
      && (correctionPreview.transferCandidates.length > 0
        || correctionPreview.partyBalanceUpdates.length > 0);
    const hasZeroingWork =
      zeroModeEnabled && zeroMode !== ZERO_MODE.OFF && zeroCandidateIds.length > 0;

    if (!updateAmount && !updateBalance && !hasPartyCorrectionWork && !hasZeroingWork) {
      setError(
        'Enable at least one action (Amount, Balance, Majority Party Fix, or Zero Unmatched) to apply import.',
      );
      return;
    }
    if (!currentCompanyId) {
      setError('Please select a company first.');
      return;
    }

    setApplying(true);
    setError('');
    const ordersCollection = getCompanyCollection(currentCompanyId, DB_NAMES.ORDERS);
    let batch = writeBatch(firebaseDB);
    let pendingOps = 0;

    const stats = {
      updated: 0,
      created: 0,
      zeroed: 0,
      partyTransferred: 0,
      partyBalanceSynced: 0,
      skipped: 0,
      ambiguous: 0,
      ambiguousBills: [],
      invalid: 0,
    };
    const touchedOrderIds = new Set();
    const transferByOrderId = new Map(
      correctionPreview.transferCandidates.map((item) => [item.orderId, item]),
    );
    const sectionPartyIdMap = buildSectionPartyIdMap(rows);

    const commitBatchIfNeeded = async (force = false) => {
      if (pendingOps === 0) return;
      if (!force && pendingOps < BATCH_LIMIT) return;
      await batch.commit();
      batch = writeBatch(firebaseDB);
      pendingOps = 0;
    };

    try {
      if (
        zeroModeEnabled
        && zeroMode === ZERO_MODE.ALL_UNMATCHED
        && zeroCandidateIds.length > 0
      ) {
        const shouldContinue = window.confirm(
          `This will set balance to zero for ${zeroCandidateIds.length} unmatched bills across the company. Continue?`,
        );
        if (!shouldContinue) {
          setApplying(false);
          return;
        }
      }

      if (enablePartyMajorityFix && correctionPreview.transferCandidates.length > 0) {
        const shouldContinue = window.confirm(
          `This will transfer ${correctionPreview.transferCandidates.length} bills to section-majority party IDs. Continue?`,
        );
        if (!shouldContinue) {
          setApplying(false);
          return;
        }
      }

      for (const row of rows) {
        if (row.status === 'matched' && row.matchedOrder?.id) {
          const updatePayload = {
            ...buildOrderUpdatePayload(row, row.matchedOrder, {
              updateAmount,
              updateBalance,
            }),
          };
          const transferCandidate = transferByOrderId.get(row.matchedOrder.id);
          if (
            transferCandidate?.toPartyId
            && transferCandidate.toPartyId !== row.matchedOrder.partyId
          ) {
            updatePayload.partyId = transferCandidate.toPartyId;
          }

          if (!Object.keys(updatePayload).length) {
            stats.skipped += 1;
            // eslint-disable-next-line no-continue
            continue;
          }

          const orderRef = doc(ordersCollection, row.matchedOrder.id);
          batch.update(orderRef, updatePayload);
          pendingOps += 1;
          stats.updated += 1;
          if (transferCandidate?.toPartyId) {
            stats.partyTransferred += 1;
          }
          touchedOrderIds.add(row.matchedOrder.id);
        } else if (row.status === 'create') {
          const newDocRef = doc(ordersCollection);
          const createPayload = buildNewOrderPayload(row, newDocRef.id);
          const inferredPartyId = row.sectionId ? sectionPartyIdMap.get(row.sectionId) : null;
          if (inferredPartyId) {
            createPayload.partyId = inferredPartyId;
          }
          batch.set(newDocRef, createPayload);
          pendingOps += 1;
          stats.created += 1;
        } else {

          stats.skipped += 1;
          if (row.status === 'ambiguous') {
            stats.ambiguous += 1;
            stats.ambiguousBills.push({
              rowIndex: row.rowIndex,
              billNumber: row.billNumber,
              billDateDisplay: row.billDateDisplay,
              orderAmount: row.orderAmount,
              balance: row.balance,
            });
          }
          if (row.status === 'invalid') stats.invalid += 1;
        }

        // eslint-disable-next-line no-await-in-loop
        await commitBatchIfNeeded();
      }

      if (enablePartyMajorityFix && syncPartyBalance) {
        const partiesCollection = getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES);
        for (const partyUpdate of correctionPreview.partyBalanceUpdates) {
          if (!partyUpdate.partyId) {
            // eslint-disable-next-line no-continue
            continue;
          }
          const partyRef = doc(partiesCollection, partyUpdate.partyId);
          batch.update(partyRef, { partyBalance: partyUpdate.partyBalance });
          pendingOps += 1;
          stats.partyBalanceSynced += 1;

          // eslint-disable-next-line no-await-in-loop
          await commitBatchIfNeeded();
        }
      }

      if (zeroModeEnabled && zeroMode !== ZERO_MODE.OFF) {
        for (const orderId of zeroCandidateIds) {
          if (!orderId || touchedOrderIds.has(orderId)) {
            // eslint-disable-next-line no-continue
            continue;
          }
          const orderRef = doc(ordersCollection, orderId);
          batch.update(orderRef, { balance: 0 });
          pendingOps += 1;
          stats.zeroed += 1;
          touchedOrderIds.add(orderId);

          // eslint-disable-next-line no-await-in-loop
          await commitBatchIfNeeded();
        }
      }

      await commitBatchIfNeeded(true);
      setResult(stats);
    } catch (e) {
      console.error('Outstanding import failed:', e);
      setError(e.message || 'Import failed while applying updates.');
    }

    setApplying(false);
  };

  const reset = () => {
    setRows([]);
    setResult(null);
    setError('');
    setFileName('');
    setZeroModeEnabled(false);
    setZeroMode(ZERO_MODE.OFF);
    setZeroCandidateIds([]);
    setEnablePartyMajorityFix(false);
    setSyncPartyBalance(true);
    setCorrectionPreview({
      transferCandidates: [],
      partyBalanceUpdates: [],
      sectionSummaries: [],
    });
  };

  return (
    <div className="outstanding-import-page">
      <div className="outstanding-import-header">
        <h2>Outstanding Excel Import</h2>
        <Text size={200}>
          Uses column B (bill), C (bill date), D (amount), F (balance)
        </Text>
      </div>

      <Card className="outstanding-import-card">
        <div className="outstanding-toolbar">
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            contentBefore={<ArrowUpload24Regular />}
            onChange={handleFile}
          />
          <Button
            icon={<ArrowSync24Regular />}
            appearance="subtle"
            onClick={reset}
          >
            Reset
          </Button>
        </div>

        {!!fileName && (
          <Text size={200} className="outstanding-file-name">
            File: {fileName}
          </Text>
        )}

        <div className="outstanding-toggle-row">
          <Switch
            checked={updateAmount}
            onChange={(_, data) => setUpdateAmount(data.checked)}
            label="Update Amount"
          />
          <Switch
            checked={updateBalance}
            onChange={(_, data) => setUpdateBalance(data.checked)}
            label="Update Balance"
          />
        </div>

        <div className="outstanding-majority-fix">
          <Switch
            checked={enablePartyMajorityFix}
            onChange={(_, data) => setEnablePartyMajorityFix(data.checked)}
            label="Fix partyId by section majority (bill-only)"
          />
          {enablePartyMajorityFix && (
            <>
              <Switch
                checked={syncPartyBalance}
                onChange={(_, data) => setSyncPartyBalance(data.checked)}
                label="Sync partyBalance from section total (header col F)"
              />
            </>
          )}
        </div>

        <div className="outstanding-zero-mode">
          <Switch
            checked={zeroModeEnabled}
            onChange={(_, data) => {
              const enabled = data.checked;
              setZeroModeEnabled(enabled);
              setZeroMode(enabled ? ZERO_MODE.PARTY_ONLY : ZERO_MODE.OFF);
              if (!enabled) setZeroCandidateIds([]);
            }}
            label="Zero unmatched bills"
          />
          {zeroModeEnabled && (
            <RadioGroup
              value={zeroMode}
              onChange={(_, data) => {
                setZeroMode(data.value);
              }}
              layout="vertical"
            >
              <Radio
                value={ZERO_MODE.PARTY_ONLY}
                label="Zero only party bills"
              />
              <Radio
                value={ZERO_MODE.ALL_UNMATCHED}
                label="Zero all unmatching bills"
              />
            </RadioGroup>
          )}
          {zeroModeEnabled && zeroMode === ZERO_MODE.ALL_UNMATCHED && (
            <Text size={200} className="outstanding-zero-warning">
              Global zeroing affects all unmatched bills with non-zero balance.
            </Text>
          )}
        </div>

        {loadingPreview && (
          <div className="outstanding-loading">
            <Spinner label="Reading file and matching bills..." />
            {!!currentStep && <Text size={200}>{currentStep}</Text>}
          </div>
        )}

        {loadingZeroPreview && (
          <div className="outstanding-loading">
            <Spinner label="Preparing zero-unmatched preview..." />
          </div>
        )}

        {error && <div className="outstanding-error">{error}</div>}

        {!!rows.length && !loadingPreview && (
          <>
            <div className="outstanding-summary">
              <span>Total: {summary.total}</span>
              <span>Matched: {summary.matched}</span>
              <span>Create: {summary.created}</span>
              <span>Ambiguous: {summary.ambiguous}</span>
              <span>Invalid: {summary.invalid}</span>
              <span>To Zero: {summary.toBeZeroed}</span>
              <span>To Transfer: {summary.toTransfer}</span>
              <span>To Sync Parties: {summary.toSyncParties}</span>
            </div>

            <div className="outstanding-table-wrap">
              <table className="app-table compact">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Bill Number</th>
                    <th>Bill Date</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>DB Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 250).map((row) => (
                    <tr key={`outstanding-row-${row.rowIndex}-${row.billNumber}`}>
                      <td>{row.rowIndex}</td>
                      <td>{row.billNumber}</td>
                      <td>{row.billDateDisplay}</td>
                      <td>{row.orderAmount}</td>
                      <td>{row.balance}</td>
                      <td className={`status-${row.status}`}>{row.status}</td>
                      <td>{row.matchedOrder?.billNumber || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="outstanding-footer">
              <Text size={200}>
                Showing first 250 preview rows. All parsed rows are applied.
              </Text>
              <Button
                appearance="primary"
                onClick={runImport}
                disabled={applying || loadingPreview}
              >
                {applying ? 'Applying...' : 'Apply Import'}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className="outstanding-result">
            <Text weight="semibold">Import finished</Text>
            <div>Updated: {result.updated}</div>
            <div>Created: {result.created}</div>
            <div>Zeroed: {result.zeroed || 0}</div>
            <div>PartyId Transferred: {result.partyTransferred || 0}</div>
            <div>PartyBalance Synced: {result.partyBalanceSynced || 0}</div>
            <div>Skipped: {result.skipped}</div>
            <div>Ambiguous: {result.ambiguous}</div>
            <div>Invalid: {result.invalid}</div>
            {result.ambiguousBills?.length > 0 && (
              <div className="outstanding-ambiguous-list">
                <Text weight="semibold" size={200}>
                  Skipped ambiguous bills
                </Text>
                <div className="outstanding-table-wrap outstanding-ambiguous-table">
                  <table className="app-table compact">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Bill Number</th>
                        <th>Bill Date</th>
                        <th>Amount</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.ambiguousBills.map((bill) => (
                        <tr key={`ambiguous-${bill.rowIndex}-${bill.billNumber}`}>
                          <td>{bill.rowIndex}</td>
                          <td>{bill.billNumber}</td>
                          <td>{bill.billDateDisplay}</td>
                          <td>{bill.orderAmount}</td>
                          <td>{bill.balance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

