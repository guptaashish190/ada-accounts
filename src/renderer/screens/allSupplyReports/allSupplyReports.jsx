import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Text } from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';

const statusColors = {
  Completed: '#00A9A5',
  Dispatched: '#FFD166',
  'To Accounts': '#F25C54',
};

export default function AllSupplyReportsScreen() {
  const [supplyReports, setSupplyReports] = useState([]);

  const [loading, setLoading] = useState(false);

  const fetchSupplyReports = async () => {
    setLoading(true);
    try {
      const supplyReportsCollection = collection(firebaseDB, 'supplyReports');
      const querySnapshot = await getDocs(supplyReportsCollection);

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
  useEffect(() => {
    fetchSupplyReports();
  }, []);

  if (loading) return <Loader />;

  return (
    <center>
      <div className="all-supply-reports-container">
        <h3>All Supply Reports</h3>
        {supplyReports.map((sr, i) => {
          return <SupplyReportRow index={i} data={sr} />;
        })}
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
          <Text className="sr-id">
            {index + 1}.&nbsp;{data.timestamp}
          </Text>
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
