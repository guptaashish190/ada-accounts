import { collection, getDocs, limit } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Tab, TabList, Text } from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import constants from '../../constants';

const statusColors = {
  [constants.firebase.billBundleFlowStatus.CREATED]: '#00A9A5',
  [constants.firebase.billBundleFlowStatus.HANDOVER]: '#FFD166',
  [constants.firebase.billBundleFlowStatus.COMPLETED]: '#F25C54',
};

export default function AllBundlesScreen() {
  const [bundles, setbundles] = useState([]);

  const [loading, setLoading] = useState(false);

  const fetchbundles = async () => {
    setLoading(true);
    try {
      const bundlesCollection = collection(firebaseDB, 'billBundles');
      const querySnapshot = await getDocs(bundlesCollection, limit(30));

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

  if (loading) return <Loader />;

  return (
    <center>
      <div className="all-bundles-container">
        <h3>All Bundles</h3>
        {bundles.map((sr, i) => {
          return <BundlesRow key={`bundle-row-${sr.id}`} index={i} data={sr} />;
        })}
      </div>
    </center>
  );
}

function BundlesRow({ data, index }) {
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
              backgroundColor: statusColors[data.status?.toUpperCase()],
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
