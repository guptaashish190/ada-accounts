import { getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@fluentui/react-datepicker-compat';
import {
  Button,
  Card,
  Spinner,
  Tab,
  TabList,
  Text,
} from '@fluentui/react-components';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import constants from '../../constants';
import { VerticalSpace2 } from '../../common/verticalSpace';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';

const statusColors = {
  [constants.firebase.billBundleFlowStatus.CREATED]: '#00A9A5',
  [constants.firebase.billBundleFlowStatus.HANDOVER]: '#FFD166',
  [constants.firebase.billBundleFlowStatus.COMPLETED]: '#F25C54',
};

export default function AllBundlesScreen() {
  const [bundles, setbundles] = useState([]);

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();

  const fetchbundles = async () => {
    setLoading(true);
    try {
      const bundlesCollection = getCompanyCollection(currentCompanyId, DB_NAMES.BILL_BUNDLES);
      let dynamicQuery = bundlesCollection;

      const dateFrom = new Date(fromDate);
      dateFrom.setHours(0);
      dateFrom.setMinutes(0);
      dateFrom.setSeconds(0);

      const dateTo = new Date(toDate);
      dateTo.setHours(23);
      dateTo.setMinutes(59);
      dateTo.setSeconds(59);

      console.log(fromDate, dateTo);

      dynamicQuery = query(
        dynamicQuery,
        where('timestamp', '>=', dateFrom.getTime()),
      );
      dynamicQuery = query(
        dynamicQuery,
        where('timestamp', '<=', dateTo.getTime()),
      );

      const querySnapshot = await getDocs(dynamicQuery);

      const reportsData = [];
      querySnapshot.forEach((doc) => {
        reportsData.push({ id: doc.id, ...doc.data() });
      });

      reportsData.sort((rd1, rd2) => rd2.timestamp - rd1.timestamp);
      setbundles(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching supply reports:', error);
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchbundles();
  }, []);

  return (
    <center>
      <div className="all-bundles-container">
        <h3>All Bundles</h3>{' '}
        <DatePicker
          size="large"
          className=" filter-input"
          onSelectDate={(d) => setFromDate(d)}
          placeholder="From Date"
          value={fromDate}
        />
        &nbsp;
        <DatePicker
          size="large"
          className=" filter-input"
          onSelectDate={(d) => {
            setToDate(d);
          }}
          placeholder="To date"
          value={toDate}
        />
        &nbsp;
        <Button size="large" onClick={() => fetchbundles()}>
          Get
        </Button>
        <VerticalSpace2 />
        {loading ? (
          <Spinner />
        ) : (
          bundles.map((sr, i) => {
            return (
              <BundlesRow key={`bundle-row-${sr.id}`} index={i} data={sr} />
            );
          })
        )}
        {bundles.length === 0 ? (
          <div style={{ color: 'lightgrey' }}>No Bundles Found</div>
        ) : null}
      </div>
    </center>
  );
}

export function BundlesRow({ data, index }) {
  const navigate = useNavigate();
  const [assignedUser, setAssignedUser] = useState();

  const getassignedUser = async () => {
    const user = await globalUtils.fetchUserById(data.assignedTo);
    setAssignedUser(user);
  };

  useEffect(() => {
    getassignedUser();
  }, []);
  return (
    <>
      <Button
        appearance="subtle"
        onClick={() => {
          navigate('/viewBundle', {
            state: { bundleId: data.id },
          });
        }}
      >
        <div className="supply-report-row">
          <Text className="sr-id">{data.receiptNumber || '--'} </Text>
          <Text>{assignedUser?.username}</Text>
          <Text className="sr-timestamp">
            {globalUtils.getTimeFormat(data.timestamp, true)}
          </Text>
          <Text className="sr-parties-length">{data.bills.length} Bills </Text>
          <Text
            className="sr-status"
            style={{
              backgroundColor: statusColors[data.status],
            }}
          >
            {data?.status?.toUpperCase()}
          </Text>
        </div>
      </Button>
      <br />
    </>
  );
}
