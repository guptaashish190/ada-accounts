/* eslint-disable no-restricted-syntax */
import { getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import { useCompany } from '../../contexts/companyContext';
import SelectUserDropdown from '../../common/selectUser';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';
import constants from '../../constants';

const statusColors = {
  Completed: '#00A9A5',
  Dispatched: '#d9cf4c',
  'To Accounts': '#F25C54',
  Delivered: '#5060d9',
  CANCELLED: 'grey',
};

export default function AllSupplyReportsScreen() {
  const [supplyReports, setSupplyReports] = useState([]);

  // filter state
  const [supplyman, setSupplyman] = useState();
  const [status, setStatus] = useState();
  const [srNumber, setSrNumber] = useState('');
  const [fromDate, setFromDate] = useState();
  const [toDate, setToDate] = useState();

  const [loading, setLoading] = useState(false);

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();
  const toDateMin = fromDate ? new Date(fromDate) : undefined;
  const toDateMax = fromDate
    ? new Date(
        new Date(fromDate).getFullYear(),
        new Date(fromDate).getMonth(),
        new Date(fromDate).getDate() + 30,
      )
    : undefined;
  const isDateRangeSelected = Boolean(fromDate && toDate);

  const onSearch = (clear) => {
    if (!clear && !isDateRangeSelected) return;

    const supplyReportRef = getCompanyCollection(currentCompanyId, DB_NAMES.SUPPLY_REPORTS);

    // Build the query dynamically based on non-empty filter fields
    let dynamicQuery = supplyReportRef;

    const filters = {
      supplymanId: supplyman,
      status,
      receiptNumber: srNumber && srNumber.length && `SR-${srNumber}`,
      timestamp: fromDate && toDate,
    };
    if (Object.keys(filters).length === 0) return;

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
      console.log(dateFrom.toLocaleString(), dateTo.toLocaleString());
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
    // Fetch parties based on the dynamic query
    const fetchData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(dynamicQuery);
        let supplyReportData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        supplyReportData = supplyReportData.sort(
          (rd1, rd2) => rd2.receiptNumber.slice(3) - rd1.receiptNumber.slice(3),
        );
        setSupplyReports(supplyReportData.slice(0, 100));
      } catch (error) {
        console.error('Error fetching supply reports:', error);
      }
      setLoading(false);
    };

    fetchData();
  };
  useEffect(() => {
    onSearch(true);
  }, []);

  return (
    <div className="all-supply-reports-container">
      <div className="page-header">
        <Text size={600} weight="bold" style={{ color: '#323130' }}>
          Supply Reports
        </Text>
      </div>
      <center>
        <Button
          appearance="primary"
          onClick={() => {
            window.electron.ipcRenderer.sendMessage('new-window', {
              type: constants.windowConstants.CREATE_SUPPLY_REPORT,
            });
          }}
        >
          Create Supply Report
        </Button>
      </center>
      <br />
      {/* Compact Filter Section */}
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
              {Object.keys(statusColors).map((status1) => (
                <Option
                  text={status1}
                  value={status1}
                  key={`sr-filter-status-${status1}`}
                >
                  {status1}
                </Option>
              ))}
            </Dropdown>
          </div>

          <div className="filter-item">
            <Text size={200} weight="semibold" style={{ marginBottom: '4px' }}>
              SR Number
            </Text>
            <Input
              onChange={(_, e) => setSrNumber(e.value)}
              contentBefore="SR-"
              type="number"
              placeholder="Enter number"
              size="small"
              style={{ width: '120px' }}
            />
          </div>

          <div className="filter-item">
            <Text size={200} weight="semibold" style={{ marginBottom: '4px' }}>
              Supplyman
            </Text>
            <SelectUserDropdown
              user={supplyman}
              setUser={setSupplyman}
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
              disabled={!isDateRangeSelected}
            >
              Search
            </Button>
            <Button
              onClick={() => {
                setFromDate();
                setToDate();
                setSrNumber('');
                setStatus(null);
                setSupplyman('');
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

      {/* Results Section */}
      <div className="results-section">
        {loading ? (
          <div className="loading-container">
            <Spinner size="medium" />
            <Text size={300} style={{ marginTop: '12px', color: '#605e5c' }}>
              Loading supply reports...
            </Text>
          </div>
        ) : (
          <div className="supply-reports-list">
            {supplyReports.map((sr) => {
              return (
                <SupplyReportRow
                  key={`supply-report-all-list-${sr.id}`}
                  data={sr}
                  currentCompanyId={currentCompanyId}
                />
              );
            })}
          </div>
        )}

        {!loading && supplyReports.length === 0 && (
          <div className="no-results">
            <Text size={400} style={{ color: '#605e5c' }}>
              No supply reports found
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

function openViewSupplyReportWindow(supplyReport) {
  window.electron.ipcRenderer.sendMessage('new-window', {
    type: constants.windowConstants.VIEW_SUPPLY_REPORT,
    data: { prefillSupplyReport: supplyReport },
  });
}

function SupplyReportRow({ data, currentCompanyId }) {
  const [supplyman, setSupplyman] = useState();
  const [billRows, setBillRows] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const getSupplyman = async () => {
    const user = await globalUtils.fetchUserById(data.supplymanId);
    setSupplyman(user);
  };

  const getBills = async () => {
    const allBillIds = [
      ...(data.orders || []),
      ...(data.attachedBills || []),
      ...(data.supplementaryBills || []),
    ];

    if (allBillIds.length === 0) {
      setBillRows([]);
      return;
    }

    setLoadingBills(true);
    try {
      let fetchedOrders = await globalUtils.fetchOrdersByIds(
        allBillIds,
        currentCompanyId,
      );
      fetchedOrders = fetchedOrders.filter((fo) => !fo.error);
      fetchedOrders = await globalUtils.fetchPartyInfoForOrders(
        fetchedOrders,
        currentCompanyId,
      );
      setBillRows(fetchedOrders);
    } catch (error) {
      console.error('Error fetching supply report bills:', error);
      setBillRows([]);
    }
    setLoadingBills(false);
  };

  useEffect(() => {
    getSupplyman();
    getBills();
  }, [data.id, currentCompanyId]);

  const totalBills =
    (data.orders?.length || 0) +
    (data.attachedBills?.length || 0) +
    (data.supplementaryBills?.length || 0);
  const reportDate = globalUtils.getTimeFormat(data.timestamp, true) || '--';
  // Read payment from partyPayments[] on the SR/bundle document (new schema).
  // Falls back to orderDetail.payments for legacy records.
  const getPaymentAmountByType = (orderDetail, paymentType, partyId) => {
    const partyPayment = (data.partyPayments || []).find(
      (pp) => pp.partyId === partyId,
    );
    const payments = partyPayment?.payments || orderDetail?.payments || [];
    const amount = payments
      .filter((payment) => (payment?.type || '').toLowerCase() === paymentType)
      .reduce((acc, payment) => acc + (Number(payment?.amount) || 0), 0);

    return amount > 0 ? amount : undefined;
  };

  const getNeftPaymentAmount = (orderDetail, partyId) => {
    const neftAmount =
      (getPaymentAmountByType(orderDetail, 'neft', partyId) || 0) +
      (getPaymentAmountByType(orderDetail, 'other', partyId) || 0);

    return neftAmount > 0 ? neftAmount : undefined;
  };

  return (
    <div
      className="supply-report-card"
      role="button"
      tabIndex={0}
      onClick={() => openViewSupplyReportWindow(data)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          openViewSupplyReportWindow(data);
        }
      }}
    >
      <div className="supply-report-row-header">
        <div className="sr-header-content">
          <Text size={400} weight="bold" className="sr-title">
            {data.receiptNumber}
            <span className="sr-title-separator"> - </span>
            <span className="sr-title-supplyman">
              {supplyman?.username || 'Loading...'}
            </span>
          </Text>
          <Text size={200} className="sr-subtitle">
            {reportDate} | {totalBills}{' '}
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
            No bills in this report
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
                  const cashAmount = getPaymentAmountByType(orderDetail, 'cash', bill.partyId);
                  const chequeAmount = getPaymentAmountByType(orderDetail, 'cheque', bill.partyId);
                  const upiAmount = getPaymentAmountByType(orderDetail, 'upi', bill.partyId);
                  const neftAmount = getNeftPaymentAmount(orderDetail, bill.partyId);

                  return (
                    <tr key={`sr-bill-row-${data.id}-${bill.id}-${billIndex}`}>
                      <td>{billIndex + 1}</td>
                      <td className="party-col">{bill.party?.name || '--'}</td>
                      <td>{bill.billNumber?.toUpperCase() || '--'}</td>
                      <td className="num amount-col">
                        {globalUtils.getCurrencyFormat(
                          bill.orderAmount ?? bill.billAmount ?? bill.amount,
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
