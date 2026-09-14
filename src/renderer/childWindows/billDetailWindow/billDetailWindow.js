import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Image,
  Input,
  Label,
  Spinner,
  Text,
} from '@fluentui/react-components';
import {
  ArrowLeft16Regular,
  ArrowExportLtr16Filled,
  Delete16Regular,
  Dismiss16Regular,
  Edit16Regular,
} from '@fluentui/react-icons';
import {
  deleteDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useAuthUser } from '../../contexts/allUsersContext';
import { useCompany } from '../../contexts/companyContext';
import constants from '../../constants';
import SelectUserDropdown from '../../common/selectUser';
import globalUtils, { useDebounce } from '../../services/globalUtils';
import {
  DB_NAMES,
  getCompanyCollection,
  getCompanyDoc,
} from '../../services/firestoreHelpers';
import './style.css';

const MR_JOB_ID = constants.firebaseIds.JOBS.MR;
const DEFAULT_AVATAR =
  'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-538.jpg';

function formatDateTime(ms) {
  return globalUtils.getTimeFormat(ms) || '—';
}

function findUser(allUsers, uid) {
  if (!uid) return null;
  return (allUsers || []).find((u) => u.uid === uid) || null;
}

function userDisplayName(user, fallback) {
  if (fallback === 'Accounts') return 'Accounts';
  return user?.username || user?.email || fallback || '—';
}

function imageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.url || image.src || image.downloadUrl || '';
}

function openRelatedWindow(type, data) {
  window.electron.ipcRenderer.sendMessage('new-window', { type, data });
}

function PersonChip({ role, user, fallbackName }) {
  const isAccounts = fallbackName === 'Accounts';
  const name = userDisplayName(user, fallbackName);
  const photo = isAccounts ? null : user?.profilePicture;

  return (
    <div className="bill-person">
      {photo ? (
        <Image src={photo} alt={name} className="bill-person-photo" shape="circular" />
      ) : (
        <Image
          src={DEFAULT_AVATAR}
          alt={name}
          className="bill-person-photo"
          shape="circular"
        />
      )}
      <div>
        <div className="bill-person-role">{role}</div>
        <div className="bill-person-name">{name}</div>
      </div>
    </div>
  );
}

function EditOrderForm({
  order,
  partyName,
  mrUsers,
  companyUsers,
  companyId,
  onBack,
  onDeleted,
}) {
  const [partyId, setPartyId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [partyResults, setPartyResults] = useState([]);
  const debouncedPartySearch = useDebounce(partySearch, 500);
  const [orderAmount, setOrderAmount] = useState(0);
  const [billNumberSuffix, setBillNumberSuffix] = useState('');
  const [polybags, setPolybags] = useState(0);
  const [cases, setCases] = useState(0);
  const [packets, setPackets] = useState(0);
  const [mrId, setMrId] = useState('');
  const [withValue, setWithValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order) return;
    setPartyId(order.partyId || '');
    setPartySearch('');
    setPartyResults([]);
    setOrderAmount(order.orderAmount || 0);
    setBillNumberSuffix((order.billNumber || '').replace(/^T-/i, ''));
    setPolybags(globalUtils.getBagQuantity(order.bags, 'polybag'));
    setCases(globalUtils.getBagQuantity(order.bags, 'case'));
    setPackets(globalUtils.getBagQuantity(order.bags, 'packet'));
    setMrId(order.mrId || '');
    setWithValue(order.with || '');
  }, [order]);

  useEffect(() => {
    if (!debouncedPartySearch || debouncedPartySearch.length < 3) {
      setPartyResults([]);
      return;
    }
    const fetchParties = async () => {
      const partiesRef = getCompanyCollection(companyId, DB_NAMES.PARTIES);
      const q = query(
        partiesRef,
        where('name', '>=', debouncedPartySearch.toUpperCase()),
        limit(5),
      );
      try {
        const snap = await getDocs(q);
        setPartyResults(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || d.id,
          })),
        );
      } catch (err) {
        console.error('Party search error:', err);
      }
    };
    fetchParties();
  }, [debouncedPartySearch, companyId]);

  if (!order) return null;

  const orderRef = getCompanyDoc(companyId, DB_NAMES.ORDERS, order.id);

  const handleSave = async () => {
    setSaving(true);
    try {
      const bags = [
        { bagType: 'Case', quantity: Number(cases) || 0 },
        { bagType: 'Packet', quantity: Number(packets) || 0 },
        { bagType: 'Polybag', quantity: Number(polybags) || 0 },
      ];
      const billNumber = billNumberSuffix ? `T-${billNumberSuffix}` : '';
      await updateDoc(orderRef, {
        partyId,
        orderAmount: Number(orderAmount) || 0,
        billNumber,
        bags,
        mrId,
        with: withValue,
      });
      onBack();
    } catch (err) {
      console.error('Error saving order:', err);
    }
    setSaving(false);
  };

  const handleCancel = async () => {
    setSaving(true);
    try {
      await updateDoc(orderRef, { orderStatus: 'Cancelled' });
      onBack();
    } catch (err) {
      console.error('Error cancelling order:', err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteDoc(orderRef);
      onDeleted();
    } catch (err) {
      console.error('Error deleting order:', err);
      setSaving(false);
    }
  };

  return (
    <div className="bill-detail-edit">
      <div className="bill-detail-header">
        <div className="bill-detail-header-leading">
          <Button
            appearance="subtle"
            icon={<ArrowLeft16Regular />}
            onClick={onBack}
            disabled={saving}
            aria-label="Back"
          />
        </div>
        <h1>Edit Order</h1>
        <div className="bill-detail-header-actions">
          <Button
            appearance="subtle"
            icon={<Dismiss16Regular />}
            onClick={() => window.close()}
            disabled={saving}
            aria-label="Close"
          />
        </div>
      </div>

      <div className="bill-detail-edit-form">
        <div className="bill-detail-edit-field">
          <Label>Party</Label>
          <div className="party-selected-label">
            Current: <strong>{partyName || partyId || '—'}</strong>
          </div>
          <Input
            placeholder="Search party by name..."
            value={partySearch}
            onChange={(e, d) => setPartySearch(d.value)}
            style={{ width: '100%' }}
          />
          {partyResults.length > 0 && (
            <div className="party-search-results">
              {partyResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`party-search-item${
                    p.id === partyId ? ' selected' : ''
                  }`}
                  onClick={() => {
                    setPartyId(p.id);
                    setPartySearch('');
                    setPartyResults([]);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bill-detail-edit-field">
          <Label>Bill Number</Label>
          <Input
            contentBefore="T-"
            type="number"
            value={billNumberSuffix}
            onChange={(e, d) => setBillNumberSuffix(d.value)}
            placeholder="Bill #"
            style={{ width: '100%' }}
          />
        </div>
        <div className="bill-detail-edit-field">
          <Label>Order Amount</Label>
          <Input
            type="number"
            value={String(orderAmount)}
            onChange={(e, d) => setOrderAmount(d.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="bill-detail-edit-field">
          <Label>With</Label>
          <SelectUserDropdown
            placeholder="Select user"
            user={withValue}
            setUser={(value) => setWithValue(value || '')}
            valueKey="uid"
            users={companyUsers}
            style={{ width: '100%' }}
            getDisplayName={(u) => u.username || u.email || u.uid}
            extraOptions={[
              { text: 'Accounts', value: 'Accounts', key: 'accounts' },
            ]}
          />
        </div>
        <div className="bill-detail-edit-field">
          <Label>Goods</Label>
          <div className="bill-detail-bags-row">
            <div>
              <Label size="small">Polybags</Label>
              <Input
                type="number"
                size="small"
                value={String(polybags)}
                onChange={(e, d) => setPolybags(Number(d.value) || 0)}
              />
            </div>
            <div>
              <Label size="small">Cases</Label>
              <Input
                type="number"
                size="small"
                value={String(cases)}
                onChange={(e, d) => setCases(Number(d.value) || 0)}
              />
            </div>
            <div>
              <Label size="small">Packets</Label>
              <Input
                type="number"
                size="small"
                value={String(packets)}
                onChange={(e, d) => setPackets(Number(d.value) || 0)}
              />
            </div>
          </div>
        </div>
        <div className="bill-detail-edit-field">
          <Label>MR</Label>
          <SelectUserDropdown
            placeholder="Select MR"
            user={mrId}
            setUser={(value) => setMrId(value || '')}
            valueKey="uid"
            users={mrUsers}
            style={{ width: '100%' }}
            getDisplayName={(mr) => mr.username || mr.email || mr.uid}
          />
        </div>
      </div>

      <div className="bill-detail-edit-actions">
        <Button
          appearance="subtle"
          icon={<Delete16Regular />}
          disabled={saving}
          onClick={handleDelete}
          style={{ color: '#c50f1f', marginRight: 'auto' }}
        >
          Delete
        </Button>
        <Button
          appearance="subtle"
          icon={<Dismiss16Regular />}
          disabled={saving}
          onClick={handleCancel}
          style={{ color: '#c50f1f' }}
        >
          Cancel Order
        </Button>
        <Button appearance="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function BillDetailView({
  order,
  party,
  withUser,
  mrUser,
  createdByUser,
  allUsers,
  onEdit,
}) {
  const itemRows = Array.isArray(order.itemWiseDetail)
    ? order.itemWiseDetail
    : [];
  const images = [
    ...(order.mrImages || []).map(imageUrl),
    ...(order.billImages || []).map(imageUrl),
  ].filter(Boolean);
  const flow = order.flow || [];
  const area = (order.area || party?.area || '').toString().toUpperCase();
  const ageDays =
    order.billCreationTime || order.creationTime
      ? globalUtils.getDaysPassed(order.billCreationTime || order.creationTime)
      : null;
  const bags = [
    { label: 'Polybags', value: globalUtils.getBagQuantity(order.bags, 'polybag') },
    { label: 'Cases', value: globalUtils.getBagQuantity(order.bags, 'case') },
    { label: 'Packets', value: globalUtils.getBagQuantity(order.bags, 'packet') },
  ];
  const mr = findUser(allUsers, order.mrId);
  const withPerson =
    order.with && order.with !== 'Accounts'
      ? findUser(allUsers, order.with)
      : null;
  const createdBy = findUser(allUsers, order.createdById);
  const meta = [
    party?.name || order.partyId,
    area,
    order.flowCompleted === false ? 'In pipeline' : null,
    order.hasOrder === false ? order.reasonNoOrder || 'No order' : null,
  ].filter(Boolean);

  const openFlowSource = (flowEntry) => {
    if (flowEntry.bundleId) {
      openRelatedWindow(constants.windowConstants.VIEW_BUNDLE, {
        bundleId: flowEntry.bundleId,
      });
    } else if (flowEntry.supplyReportId) {
      openRelatedWindow(constants.windowConstants.VIEW_SUPPLY_REPORT, {
        supplyReportId: flowEntry.supplyReportId,
      });
    }
  };

  return (
    <div className="bill-sheet">
      <div className="bill-detail-header">
        <div>
          <div className="bill-kicker">{order.orderStatus || 'Bill'}</div>
          <h1>
            {order.billNumber?.toUpperCase() || 'Bill Detail'}
            {order.challanNumber ? (
              <span className="bill-challan">{order.challanNumber}</span>
            ) : null}
          </h1>
          <p className="bill-party-line">{meta.join('  ·  ') || '—'}</p>
          {(order.isCallOrder || party?.creditDays != null) && (
            <div className="bill-chips">
              {order.isCallOrder ? (
                <span className="bill-chip">Call order</span>
              ) : null}
              {party?.creditDays != null ? (
                <span className="bill-chip">{party.creditDays} days credit</span>
              ) : null}
            </div>
          )}
          <div className="bill-kv">
            <span>Created</span>
            <span>{formatDateTime(order.creationTime)}</span>
            <span>Billed</span>
            <span>{formatDateTime(order.billCreationTime)}</span>
          </div>
        </div>
        <div className="bill-detail-header-actions">
          <Button appearance="primary" icon={<Edit16Regular />} onClick={onEdit}>
            Edit
          </Button>
          <Button appearance="secondary" onClick={() => window.close()}>
            Close
          </Button>
        </div>
      </div>

      <div className="bill-metrics">
        <div>
          <span>Amount</span>
          <strong>{globalUtils.getCurrencyFormat(order.orderAmount)}</strong>
        </div>
        <div>
          <span>Balance</span>
          <strong>{globalUtils.getCurrencyFormat(order.balance)}</strong>
        </div>
        <div>
          <span>Age</span>
          <strong>{ageDays != null ? `${ageDays} days` : '—'}</strong>
        </div>
        <div>
          <span>Goods</span>
          <strong>
            {bags.map((bag) => bag.value).join(' · ')}
          </strong>
          <em>poly · case · pkt</em>
        </div>
      </div>

      <div className="bill-people">
        <PersonChip role="MR" user={mr} fallbackName={mrUser} />
        <PersonChip
          role="With"
          user={withPerson}
          fallbackName={withUser || order.with}
        />
        <PersonChip
          role="Created by"
          user={createdBy}
          fallbackName={createdByUser}
        />
      </div>

      {order.accountsNotes ? (
        <p className="bill-notes">{order.accountsNotes}</p>
      ) : null}

      {order.supplyReportId ? (
        <Button
          appearance="subtle"
          icon={<ArrowExportLtr16Filled />}
          onClick={() =>
            openRelatedWindow(constants.windowConstants.VIEW_SUPPLY_REPORT, {
              supplyReportId: order.supplyReportId,
            })
          }
        >
          Open supply report
        </Button>
      ) : null}

      {itemRows.length > 0 && (
        <table className="bill-detail-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {itemRows.map((item, index) => (
              <tr key={`${item.name || item.itemName || 'item'}-${index}`}>
                <td>{item.name || item.itemName || item.product || '—'}</td>
                <td>{item.qty ?? item.quantity ?? '—'}</td>
                <td>
                  {item.rate != null
                    ? globalUtils.getCurrencyFormat(item.rate)
                    : '—'}
                </td>
                <td>
                  {item.amount != null
                    ? globalUtils.getCurrencyFormat(item.amount)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {images.length > 0 && (
        <div className="bill-detail-images">
          {images.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="Bill attachment" />
            </a>
          ))}
        </div>
      )}

      {flow.length > 0 && (
        <div className="bill-detail-flow">
          {flow.map((fl, index) => {
            const actor = findUser(allUsers, fl.employeeId);
            const canOpen = !!(fl.bundleId || fl.supplyReportId);
            return (
              <div
                key={`bill-flow-${fl.type}-${fl.timestamp}-${index}`}
                className="bill-detail-flow-item"
              >
                <Image
                  src={actor?.profilePicture || DEFAULT_AVATAR}
                  alt={userDisplayName(actor, fl.employeeId)}
                  className="bill-person-photo"
                  shape="circular"
                />
                <div className="bill-detail-flow-body">
                  <div className="bill-detail-flow-top">
                    <strong>{fl.type}</strong>
                    <span>{formatDateTime(fl.timestamp)}</span>
                  </div>
                  <div>{userDisplayName(actor, fl.employeeId)}</div>
                  {fl.comment ? <div>{fl.comment}</div> : null}
                </div>
                {canOpen && (
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowExportLtr16Filled />}
                    onClick={() => openFlowSource(fl)}
                  >
                    Open
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BillDetailWindow({ data }) {
  const { allUsers } = useAuthUser();
  const { currentCompanyId } = useCompany();
  const companyId = data?.companyId || currentCompanyId;
  const orderId = data?.orderId;

  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  const [party, setParty] = useState(null);
  const [withUser, setWithUser] = useState('');
  const [mrUser, setMrUser] = useState('');
  const [createdByUser, setCreatedByUser] = useState('');
  const [mode, setMode] = useState('view');

  const companyUsers = useMemo(
    () =>
      (allUsers || []).filter(
        (u) => u.companyId === companyId && !u.isDeactivated,
      ),
    [allUsers, companyId],
  );

  const mrUsers = useMemo(
    () => companyUsers.filter((u) => u.jobs && u.jobs.includes(MR_JOB_ID)),
    [companyUsers],
  );

  useEffect(() => {
    if (!companyId || !orderId) {
      setMissing(true);
      return undefined;
    }

    const unsub = onSnapshot(
      getCompanyDoc(companyId, DB_NAMES.ORDERS, orderId),
      (snap) => {
        if (!snap.exists()) {
          setMissing(true);
          setOrder(null);
          return;
        }
        setMissing(false);
        setOrder({ id: snap.id, ...snap.data() });
      },
      (err) => {
        console.error('Error loading bill:', err);
        setMissing(true);
      },
    );

    return () => unsub();
  }, [companyId, orderId]);

  useEffect(() => {
    if (!order) return undefined;
    let cancelled = false;

    const loadRelated = async () => {
      const [partyInfo, withName, mrName, createdName] = await Promise.all([
        order.partyId
          ? globalUtils.fetchPartyInfo(order.partyId, companyId)
          : Promise.resolve(null),
        !order.with || order.with === 'Accounts' || order.with === ''
          ? Promise.resolve(order.with || '')
          : globalUtils
              .fetchUserById(order.with)
              .then((u) => u?.username || ''),
        order.mrId
          ? globalUtils.fetchUserById(order.mrId).then((u) => u?.username || '')
          : Promise.resolve(''),
        order.createdById
          ? globalUtils
              .fetchUserById(order.createdById)
              .then((u) => u?.username || '')
          : Promise.resolve(''),
      ]);

      if (cancelled) return;
      setParty(partyInfo);
      setWithUser(withName);
      setMrUser(mrName);
      setCreatedByUser(createdName);
    };

    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [order?.id, order?.partyId, order?.with, order?.mrId, order?.createdById, companyId]);

  if (!orderId) {
    return (
      <div className="bill-detail-window">
        <Text>Missing bill id</Text>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="bill-detail-window">
        <div className="bill-detail-empty">
          <Text>This bill is no longer available.</Text>
          <Button onClick={() => window.close()}>Close</Button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bill-detail-window">
        <div className="bill-detail-empty">
          <Spinner label="Loading bill details..." />
        </div>
      </div>
    );
  }

  return (
    <div className="bill-detail-window">
      {mode === 'edit' ? (
        <EditOrderForm
          order={order}
          partyName={party?.name}
          mrUsers={mrUsers}
          companyUsers={companyUsers}
          companyId={companyId}
          onBack={() => setMode('view')}
          onDeleted={() => window.close()}
        />
      ) : (
        <BillDetailView
          order={order}
          party={party}
          withUser={withUser}
          mrUser={mrUser}
          createdByUser={createdByUser}
          allUsers={allUsers || []}
          onEdit={() => setMode('edit')}
        />
      )}
    </div>
  );
}
