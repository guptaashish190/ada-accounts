/* eslint-disable no-restricted-syntax */
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
} from '@fluentui/react-components';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import { useAuthUser } from '../../contexts/allUsersContext';

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
  const { allUsers } = useAuthUser();

  const onSearch = (clear) => {
    const supplyReportRef = collection(firebaseDB, 'supplyReports');

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
    dynamicQuery = query(dynamicQuery);
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
        setSupplyReports(supplyReportData);
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
          All Supply Reports
        </Text>
      </div>

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
            <Dropdown
              onOptionSelect={(_, e) => setSupplyman(e.optionValue)}
              placeholder="All"
              size="small"
              style={{ width: '140px' }}
            >
              <Option text="All" value={null} key="supplyman-all">
                All
              </Option>
              {allUsers
                .filter((x) => !x.isDeactivated)
                .map((user) => (
                  <Option text={user.username} value={user.uid} key={user.uid}>
                    {user.username}
                  </Option>
                ))}
            </Dropdown>
          </div>

          <div className="filter-item">
            <Text size={200} weight="semibold" style={{ marginBottom: '4px' }}>
              Date Range
            </Text>
            <div className="date-range">
              <DatePicker
                onSelectDate={(t) => {
                  setFromDate(t);
                  setToDate(t);
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
            {supplyReports.map((sr, i) => {
              return (
                <SupplyReportCard
                  key={`supply-report-all-list-${sr.id}`}
                  index={i}
                  data={sr}
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

function SupplyReportCard({ data, index }) {
  const navigate = useNavigate();
  const [supplyman, setSupplyman] = useState();

  const getSupplyman = async () => {
    const user = await globalUtils.fetchUserById(data.supplymanId);
    setSupplyman(user);
  };

  useEffect(() => {
    getSupplyman();
  }, []);

  const totalBills =
    data.orders.length +
    (data.attachedBills?.length || 0) +
    (data.supplementaryBills?.length || 0);

  return (
    <div
      className="supply-report-card"
      role="button"
      tabIndex={0}
      onClick={() => {
        navigate('/viewSupplyReport', {
          state: { prefillSupplyReport: data },
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          navigate('/viewSupplyReport', {
            state: { prefillSupplyReport: data },
          });
        }
      }}
    >
      <div className="card-header">
        <div className="sr-info">
          <div className="user-info">
            <div className="profile-picture-container">
              {supplyman?.profilePicture ? (
                <img
                  src={supplyman.profilePicture}
                  alt={supplyman.username}
                  className="profile-picture"
                />
              ) : (
                <div className="profile-picture-placeholder">
                  <Text size={300} weight="bold" style={{ color: '#ffffff' }}>
                    {supplyman?.username?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </div>
              )}
            </div>
            <div className="user-details">
              <Text size={400} weight="bold" style={{ color: '#0078d4' }}>
                {supplyman?.username || 'Loading...'}
              </Text>
              <Text size={200} style={{ color: '#605e5c' }}>
                {globalUtils.getTimeFormat(data.timestamp, true)}
              </Text>
            </div>
          </div>
        </div>
        <div
          className="status-badge"
          style={{ backgroundColor: statusColors[data.status] }}
        >
          <Text size={200} weight="medium" style={{ color: 'white' }}>
            {data?.status?.toUpperCase()}
          </Text>
        </div>
      </div>

      <div className="card-details">
        <div className="detail-item">
          <Text size={200} style={{ color: '#605e5c' }}>
            SR Number:
          </Text>
          <Text size={200} weight="semibold" style={{ color: '#323130' }}>
            {data.receiptNumber}
          </Text>
        </div>
        <div className="detail-item">
          <Text size={200} style={{ color: '#605e5c' }}>
            Total Bills:
          </Text>
          <Text size={200} weight="semibold" style={{ color: '#323130' }}>
            {totalBills}
          </Text>
        </div>
      </div>
    </div>
  );
}
