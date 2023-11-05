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
  Dispatched: '#FFD166',
  'To Accounts': '#F25C54',
  Delivered: '#F9B572',
};

export default function AllSupplyReportsScreen() {
  const [supplyReports, setSupplyReports] = useState([]);

  // filter state
  const [suppplyman, setSupplyman] = useState();
  const [status, setStatus] = useState();
  const [srNumber, setSrNumber] = useState('');
  const [date, setDate] = useState();

  const [loading, setLoading] = useState(false);
  const { allUsers } = useAuthUser();

  const fetchSupplyReports = async () => {
    setLoading(true);
    try {
      const supplyReportsCollection = collection(firebaseDB, 'supplyReports');

      const supplyQuery = query(supplyReportsCollection, limit(50));
      const querySnapshot = await getDocs(supplyQuery);

      const reportsData = [];
      querySnapshot.forEach((doc) => {
        reportsData.push({ id: doc.id, ...doc.data() });
      });

      reportsData.sort((rd1, rd2) => rd2.timestamp - rd1.timestamp);
      setSupplyReports(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching supply reports:', error);
      setLoading(false);
    }
  };

  const onSearch = () => {
    const supplyReportRef = collection(firebaseDB, 'supplyReports');

    // Build the query dynamically based on non-empty filter fields
    let dynamicQuery = supplyReportRef;

    const filters = {
      supplymanId: suppplyman,
      status,
      receiptNumber: srNumber && srNumber.length && `SR-${srNumber}`,
      timestamp: date && date.getTime(),
    };

    for (const field in filters) {
      if (filters[field]) {
        if (field === 'timestamp') {
          const dateFrom = new Date(date);
          const dateTo = new Date(date);
          dateTo.setHours(23);
          dateTo.setMinutes(59);
          dateTo.setSeconds(59);
          console.log(dateFrom.toLocaleString(), dateTo.toLocaleString());
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
    dynamicQuery = query(dynamicQuery, limit(50));
    // Fetch parties based on the dynamic query
    const fetchData = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(dynamicQuery);
        const supplyReportData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setSupplyReports(supplyReportData);
      } catch (error) {
        console.error('Error fetching supply reports:', error);
      }
      setLoading(false);
    };

    fetchData();
  };
  useEffect(() => {
    fetchSupplyReports();
  }, []);

  return (
    <center>
      <div className="all-supply-reports-container">
        <h3>All Supply Reports</h3>

        <div className="all-bills-search-input-container">
          <Dropdown
            onOptionSelect={(_, e) => setStatus(e.optionValue)}
            className="dropdown  filter-input"
            placeholder="Status"
          >
            <Option text={null} value={null} key="accounts-none-dropdown">
              None
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

          <Input
            onChange={(_, e) => setSrNumber(e.value)}
            contentBefore="SR-"
            type="number"
            className=" filter-input"
          />
          <Dropdown
            onOptionSelect={(_, e) => setSupplyman(e.optionValue)}
            className="dropdown  filter-input"
            placeholder="Supplyman"
          >
            <Option text={null} value={null} key="accounts-none-dropdown">
              None
            </Option>
            {allUsers.map((user) => (
              <Option text={user.username} value={user.uid} key={user.uid}>
                {user.username}
              </Option>
            ))}
          </Dropdown>
          <DatePicker
            className=" filter-input"
            onSelectDate={setDate}
            placeholder="Date"
            value={date}
          />
          <Button
            onClick={() => {
              onSearch();
            }}
          >
            Search
          </Button>
          <Button
            onClick={() => {
              setDate();
              setSrNumber('');
              setStatus(null);
              setSupplyman('');
              fetchSupplyReports();
            }}
          >
            Clear
          </Button>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          supplyReports.map((sr, i) => {
            return (
              <SupplyReportRow
                key={`supply-report-all-list-${sr.id}`}
                index={i}
                data={sr}
              />
            );
          })
        )}
      </div>
    </center>
  );
}

function SupplyReportRow({ data, index }) {
  const navigate = useNavigate();
  const [supplyman, setSupplyman] = useState();

  const getSupplyman = async () => {
    const user = await globalUtils.fetchUserById(data.supplymanId);
    setSupplyman(user);
  };

  useEffect(() => {
    getSupplyman();
  }, []);
  return (
    <>
      <Button
        appearance="subtle"
        onClick={() => {
          navigate('/viewSupplyReport', {
            state: { prefillSupplyReport: data },
          });
        }}
      >
        <div className="supply-report-row">
          <Text className="sr-id">{data.receiptNumber}</Text>
          <Text className="sr-timestamp">
            {globalUtils.getTimeFormat(data.timestamp, true)}
          </Text>
          <Text className="sr-parties-length">
            {data.orders.length +
              (data.attachedBills?.length || 0) +
              (data.supplementaryBills?.length || 0)}{' '}
            Bills{' '}
          </Text>
          <Text className="sr-supplyman">{supplyman?.username}</Text>
          <Text
            className="sr-status"
            style={{ backgroundColor: statusColors[data.status] }}
          >
            {data?.status}
          </Text>
        </div>
      </Button>
      <br />
    </>
  );
}
