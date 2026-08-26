/* eslint-disable no-restricted-syntax */
import { getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import {
  Button,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
} from '@fluentui/react-components';
import './style.css';
import globalUtils from '../../services/globalUtils';
import constants from '../../constants';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';
import PartySelector from '../../common/partySelector';
import SelectUserDropdown from '../../common/selectUser';
import { mergeHandoverOntoBills } from '../../services/handoverBalanceUtils';

const statusColors = {
  [constants.firebase.billBundleFlowStatus.CREATED]: '#00A9A5',
  [constants.firebase.billBundleFlowStatus.HANDOVER]: '#FFD166',
  [constants.firebase.billBundleFlowStatus.COMPLETED]: '#F25C54',
};

async function filterBundlesByParty(bundles, partyId, companyId) {
  if (!partyId) return bundles;

  const allBillIds = [...new Set(bundles.flatMap((b) => b.bills || []))];
  if (allBillIds.length === 0) return [];

  const orders = await globalUtils.fetchOrdersByIds(allBillIds, companyId);
  const matchingBillIds = new Set(
    orders
      .filter((o) => !o.error && o.partyId === partyId)
      .map((o) => o.id),
  );

  return bundles.filter((b) =>
    (b.bills || []).some((id) => matchingBillIds.has(id)),
  );
}

export default function AllBundlesScreen() {
  const [bundles, setBundles] = useState([]);
  const [status, setStatus] = useState();
  const [bundleNumber, setBundleNumber] = useState('');
  const [assignedUser, setAssignedUser] = useState();
  const [selectedParty, setSelectedParty] = useState();
  const [partySelectorKey, setPartySelectorKey] = useState(0);
  const [fromDate, setFromDate] = useState();
  const [toDate, setToDate] = useState();
  const [loading, setLoading] = useState(false);

  const { currentCompanyId } = useCompany();

  const toDateMin = fromDate ? new Date(fromDate) : undefined;
  const toDateMax = fromDate
    ? new Date(
        new Date(fromDate).getFullYear(),
        new Date(fromDate).getMonth(),
        new Date(fromDate).getDate() + 30,
      )
    : undefined;
  const onSearch = (clear) => {
    const bundlesRef = getCompanyCollection(currentCompanyId, DB_NAMES.BILL_BUNDLES);
    let dynamicQuery = bundlesRef;

    const filters = {
      status,
      assignedTo: assignedUser,
      receiptNumber:
        bundleNumber && bundleNumber.length
          ? `BD-${bundleNumber}`
          : undefined,
      timestamp: fromDate && toDate,
    };

    if (!clear) {
      for (const field in filters) {
        if (filters[field]) {
          if (field === 'timestamp') {
            const dateFrom = fromDate ? new Date(fromDate) : new Date();
            dateFrom.setHours(0);
            dateFrom.setMinutes(0);
            dateFrom.setSeconds(1);
            const dateTo = new Date(toDate);
            dateTo.setHours(23);
            dateTo.setMinutes(59);
            dateTo.setSeconds(59);

            dynamicQuery = query(
              dynamicQuery,
              where(field, '>=', dateFrom.getTime()),
            );
            dynamicQuery = query(
              dynamicQuery,
              where(field, '<=', dateTo.getTime()),
            );
          } else {
            dynamicQuery = query(
              dynamicQuery,
              where(field, '==', filters[field]),
            );
          }
        }
      }
    } else {
      const dateFrom = new Date();
      dateFrom.setHours(0);
      dateFrom.setMinutes(0);
      dateFrom.setSeconds(1);
      const dateTo = new Date();
      dateTo.setHours(23);
      dateTo.setMinutes(59);
      dateTo.setSeconds(59);

      dynamicQuery = query(
        dynamicQuery,
        where('timestamp', '>=', dateFrom.getTime()),
      );
      dynamicQuery = query(
        dynamicQuery,
        where('timestamp', '<=', dateTo.getTime()),
      );
    }

    dynamicQuery = query(dynamicQuery, limit(100));

    const fetchData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(dynamicQuery);
        let bundlesData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        bundlesData = bundlesData.sort(
          (b1, b2) => (b2.timestamp || 0) - (b1.timestamp || 0),
        );

        if (!clear && selectedParty?.id) {
          bundlesData = await filterBundlesByParty(
            bundlesData,
            selectedParty.id,
            currentCompanyId,
          );
        }

        setBundles(bundlesData.slice(0, 100));
      } catch (error) {
        console.error('Error fetching bundles:', error);
      }
      setLoading(false);
    };

    fetchData();
  };

  useEffect(() => {
    onSearch(true);
  }, []);

  return (
    <div className="all-bundles-container">
      <div className="page-header">
        <Text size={600} weight="bold" style={{ color: '#323130' }}>
          Bundles
        </Text>
      </div>
      <center>
        <Button
          appearance="primary"
          onClick={() => {
            window.electron.ipcRenderer.sendMessage('new-window', {
              type: constants.windowConstants.ASSIGN_BILLS,
            });
          }}
        >
          Create Bundle
        </Button>
      </center>
      <br />

      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-item">
            <Text size={200} weight="semibold" style={{ marginBottom: '4px' }}>
              Status
            </Text>
            <Dropdown
              onOptionSelect={(_, e) => setStatus(e.optionValue)}
              placeholder="All Status"
              size="small"
              style={{ width: '120px' }}
            >
              <Option text="All" value={null} key="status-all">
                All
              </Option>
              {Object.values(constants.firebase.billBundleFlowStatus).map(
                (statusValue) => (
                  <Option
                    text={statusValue}
                    value={statusValue}
                    key={`bundle-filter-status-${statusValue}`}
                  >
                    {statusValue}
                  </Option>
                ),
              )}
            </Dropdown>
          </div>

          <div className="filter-item">
            <Text size={200} weight="semibold" style={{ marginBottom: '4px' }}>
              Bundle Number
            </Text>
            <Input
              onChange={(_, e) => setBundleNumber(e.value)}
              contentBefore="BD-"
              type="number"
              placeholder="Enter number"
              size="small"
              style={{ width: '120px' }}
            />
          </div>

          <div className="filter-item">
            <Text size={200} weight="semibold" style={{ marginBottom: '4px' }}>
              Assigned User
            </Text>
            <SelectUserDropdown
              user={assignedUser}
              setUser={setAssignedUser}
              valueKey="uid"
              includeAllOption
              placeholder="All"
              size="small"
              style={{ width: '140px' }}
              showProfilePicture={false}
            />
          </div>

          <div className="filter-item">
            <Text size={200} weight="semibold" style={{ marginBottom: '4px' }}>
              Party
            </Text>
            <PartySelector
              key={`bundle-party-selector-${partySelectorKey}`}
              onPartySelected={(party) => setSelectedParty(party)}
            />
          </div>

          <div className="filter-item">
            <Text size={200} weight="semibold" style={{ marginBottom: '4px' }}>
              Date Range
            </Text>
            <div className="date-range">
              <DatePicker
                onSelectDate={(t) => {
                  setFromDate(t);
                  if (!t) {
                    setToDate();
                    return;
                  }

                  const selectedFromDate = new Date(t);
                  const maxAllowedToDate = new Date(
                    selectedFromDate.getFullYear(),
                    selectedFromDate.getMonth(),
                    selectedFromDate.getDate() + 30,
                  );

                  setToDate((prevToDate) => {
                    if (!prevToDate) return selectedFromDate;
                    if (prevToDate < selectedFromDate) return selectedFromDate;
                    if (prevToDate > maxAllowedToDate) return maxAllowedToDate;
                    return prevToDate;
                  });
                }}
                placeholder="From"
                value={fromDate}
                size="small"
                style={{ width: '100px' }}
              />
              <DatePicker
                onSelectDate={setToDate}
                placeholder="To"
                value={toDate}
                minDate={toDateMin}
                maxDate={toDateMax}
                disabled={!fromDate}
                size="small"
                style={{ width: '100px' }}
              />
            </div>
          </div>

          <div className="filter-actions">
            <Button
              onClick={() => onSearch()}
              appearance="primary"
              size="small"
            >
              Search
            </Button>
            <Button
              onClick={() => {
                setFromDate();
                setToDate();
                setBundleNumber('');
                setStatus(null);
                setAssignedUser('');
                setSelectedParty(null);
                setPartySelectorKey((k) => k + 1);
                onSearch(true);
              }}
              appearance="secondary"
              size="small"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="results-section">
        {loading ? (
          <div className="loading-container">
            <Spinner size="medium" />
            <Text size={300} style={{ marginTop: '12px', color: '#605e5c' }}>
              Loading bundles...
            </Text>
          </div>
        ) : (
          <div className="bundles-list">
            {bundles.map((bundle) => (
              <BundlesRow
                key={`bundle-row-${bundle.id}`}
                data={bundle}
                currentCompanyId={currentCompanyId}
                partyId={selectedParty?.id}
              />
            ))}
          </div>
        )}

        {!loading && bundles.length === 0 && (
          <div className="no-results">
            <Text size={400} style={{ color: '#605e5c' }}>
              No bundles found
            </Text>
            <Text size={200} style={{ color: '#8a8886', marginTop: '4px' }}>
              Try adjusting your search filters
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}

export function BundlesRow({ data, currentCompanyId, partyId }) {
  const navigate = useNavigate();
  const [assignedUser, setAssignedUser] = useState();
  const [billRows, setBillRows] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const getAssignedUser = async () => {
    const user = await globalUtils.fetchUserById(data.assignedTo);
    setAssignedUser(user);
  };

  const getBills = async () => {
    const billIds = data.bills || [];

    if (billIds.length === 0) {
      setBillRows([]);
      return;
    }

    setLoadingBills(true);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(
        billIds,
        currentCompanyId,
      );
      fetchedOrders = fetchedOrders.filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(
        fetchedOrders,
        currentCompanyId,
      );
      fetchedOrders = mergeHandoverOntoBills(
        fetchedOrders,
        data.assignmentDetails || [],
      );
      if (partyId) {
        fetchedOrders = fetchedOrders.filter((bill) => bill.partyId === partyId);
      }
      setBillRows(fetchedOrders);
    } catch (error) {
      console.error('Error fetching bundle bills:', error);
      setBillRows([]);
    }
    setLoadingBills(false);
  };

  useEffect(() => {
    getAssignedUser();
    getBills();
  }, [data.id, currentCompanyId, partyId]);

  const totalBills = partyId ? billRows.length : data.bills?.length || 0;
  const bundleDate = globalUtils.getTimeFormat(data.timestamp, true) || '--';

  const getPaymentAmountByType = (orderDetail, paymentType, billPartyId) => {
    const partyPayment = (data.partyPayments || []).find(
      (pp) => pp.partyId === billPartyId,
    );
    const payments = partyPayment?.payments || orderDetail?.payments || [];
    const amount = payments
      .filter((payment) => (payment?.type || '').toLowerCase() === paymentType)
      .reduce((acc, payment) => acc + (Number(payment?.amount) || 0), 0);

    return amount > 0 ? amount : undefined;
  };

  const getNeftPaymentAmount = (orderDetail, billPartyId) => {
    const neftAmount =
      (getPaymentAmountByType(orderDetail, 'neft', billPartyId) || 0) +
      (getPaymentAmountByType(orderDetail, 'other', billPartyId) || 0);

    return neftAmount > 0 ? neftAmount : undefined;
  };

  const openBundle = () => {
    navigate('/viewBundle', {
      state: { bundleId: data.id },
    });
  };

  return (
    <div
      className="supply-report-card"
      role="button"
      tabIndex={0}
      onClick={openBundle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          openBundle();
        }
      }}
    >
      <div className="supply-report-row-header">
        <div className="sr-header-content">
          <Text size={400} weight="bold" className="sr-title">
            {data.receiptNumber || '--'}
            <span className="sr-title-separator"> - </span>
            <span className="sr-title-supplyman">
              {assignedUser?.username || 'Loading...'}
            </span>
          </Text>
          <Text size={200} className="sr-subtitle">
            {bundleDate} | {totalBills}{' '}
            {totalBills === 1 ? 'Bill' : 'Bills'}
          </Text>
        </div>
        <div
          className="status-badge"
          style={{ backgroundColor: statusColors[data.status] || '#6b6b6b' }}
        >
          <Text size={200} weight="medium" style={{ color: 'white' }}>
            {data?.status?.toUpperCase()}
          </Text>
        </div>
      </div>

      <div className="supply-report-bills">
        {loadingBills ? (
          <Text size={200} className="bills-loading-text">
            Loading bills...
          </Text>
        ) : billRows.length === 0 ? (
          <Text size={200} className="bills-empty-text">
            No bills in this bundle
          </Text>
        ) : (
          <div className="app-table-wrapper sr-bills-table-wrapper">
            <table className="app-table">
              <colgroup>
                <col className="col-index" />
                <col className="col-party" />
                <col className="col-bill-number" />
                <col className="col-money" />
                <col className="col-money" />
                <col className="col-money" />
                <col className="col-money" />
                <col className="col-money" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>PARTY</th>
                  <th>BILL NUMBER</th>
                  <th className="num">AMOUNT</th>
                  <th className="num">CASH</th>
                  <th className="num">CHEQUE</th>
                  <th className="num">UPI</th>
                  <th className="num">NEFT</th>
                </tr>
              </thead>
              <tbody>
                {billRows.map((bill, billIndex) => {
                  const orderDetail = data.orderDetails?.find(
                    (detail) => detail.billId === bill.id,
                  );
                  const cashAmount = getPaymentAmountByType(
                    orderDetail,
                    'cash',
                    bill.partyId,
                  );
                  const chequeAmount = getPaymentAmountByType(
                    orderDetail,
                    'cheque',
                    bill.partyId,
                  );
                  const upiAmount = getPaymentAmountByType(
                    orderDetail,
                    'upi',
                    bill.partyId,
                  );
                  const neftAmount = getNeftPaymentAmount(
                    orderDetail,
                    bill.partyId,
                  );

                  return (
                    <tr key={`bundle-bill-row-${data.id}-${bill.id}-${billIndex}`}>
                      <td>{billIndex + 1}</td>
                      <td className="party-col">{bill.party?.name || '--'}</td>
                      <td>{bill.billNumber?.toUpperCase() || '--'}</td>
                      <td className="num amount-col">
                        {globalUtils.getCurrencyFormat(
                          bill.handoverBalance ?? bill.balance,
                        )}
                      </td>
                      <td className="num amount-col">
                        {globalUtils.getCurrencyFormat(cashAmount)}
                      </td>
                      <td className="num amount-col">
                        {globalUtils.getCurrencyFormat(chequeAmount)}
                      </td>
                      <td className="num amount-col">
                        {globalUtils.getCurrencyFormat(upiAmount)}
                      </td>
                      <td className="num amount-col">
                        {globalUtils.getCurrencyFormat(neftAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
