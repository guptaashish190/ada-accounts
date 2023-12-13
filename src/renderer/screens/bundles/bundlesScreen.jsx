import { collection, getDocs, limit, query, where } from 'firebase/firestore';
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
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import constants from '../../constants';
import { VerticalSpace2 } from '../../common/verticalSpace';

const statusColors = {
  [constants.firebase.billBundleFlowStatus.CREATED]: '#00A9A5',
  [constants.firebase.billBundleFlowStatus.HANDOVER]: '#FFD166',
  [constants.firebase.billBundleFlowStatus.COMPLETED]: '#F25C54',
};

export default function AllBundlesScreen() {
  const [bundles, setbundles] = useState([]);

  const [date1, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const fetchbundles = async (date) => {
    setLoading(true);
    try {
      const bundlesCollection = collection(firebaseDB, 'billBundles');
      let dynamicQuery = bundlesCollection;
      const dateFrom = new Date(date);
      dateFrom.setHours(0);
      dateFrom.setMinutes(0);
      dateFrom.setSeconds(1);
      const dateTo = new Date(date);
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
          onSelectDate={(d) => fetchbundles(d)}
          placeholder="Date"
          value={date1}
        />
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
