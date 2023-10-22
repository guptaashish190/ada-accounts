import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Text } from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';

export default function PendingSupplyReports() {
  const [supplyReports, setSupplyReports] = useState([]);

  const [loading, setLoading] = useState(false);

  // Function to fetch supply reports where "isDispatched" is false
  const fetchUndispatchedSupplyReports = async () => {
    setLoading(true);
    try {
      // Reference to the "supplyReports" collection
      const supplyReportsCollection = collection(firebaseDB, 'supplyReports');

      // Create a query to filter where "isDispatched" is false
      const q = query(
        supplyReportsCollection,
        where('status', '==', 'To Accounts'),
        orderBy('timestamp', 'desc'),
      );

      // Execute the query and get the documents
      const querySnapshot = await getDocs(q);

      // Extract the data from the querySnapshot
      const undispatchedReports = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setLoading(false);
      setSupplyReports(undispatchedReports);
    } catch (error) {
      console.error('Error fetching undispatched supply reports:', error);
      setLoading(false);
      throw error;
    }
  };
  useEffect(() => {
    fetchUndispatchedSupplyReports();
  }, []);

  if (loading) return <Loader />;

  return (
    <center>
      <div className="pending-supply-reports-container">
        <h3>Pending Supply Reports</h3>
        {supplyReports.map((sr) => {
          return <SupplyReportRow data={sr} />;
        })}
      </div>
    </center>
  );
}

function SupplyReportRow({ data }) {
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
      <div className="supply-report-row">
        <div style={{ width: '100%' }}>
          <div className="top-row">
            <Text className="sr-id">{data.receiptNumber}</Text>
            <Text className="sr-timestamp">
              {new Date(data.timestamp).toLocaleString()}
            </Text>
          </div>
          <div className="bottom-row">
            <Text className="sr-parties-length">
              {data.orders.length} Parties{' '}
              <Text className="sr-supplyman">{supplyman?.username}</Text>
            </Text>
            <Text className="sr-bags">
              {data.numPolybags} Polybags, {data.numCases} Cases,{' '}
              {data.numPackets} Packets
            </Text>
          </div>
        </div>
        <Button
          size="large"
          appearance="subtle"
          className="verify-button"
          onClick={() => {
            navigate('/verifySupplyReport', { state: { supplyReport: data } });
          }}
        >
          <span style={{ color: '#F25C54' }}>Verify</span>
        </Button>
      </div>
      <br />
    </>
  );
}
