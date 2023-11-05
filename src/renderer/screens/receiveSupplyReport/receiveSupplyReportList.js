import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Text } from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import { VerticalSpace1 } from '../../common/verticalSpace';

export default function ReceiveSupplyReportScreen() {
  const [supplyReports, setSupplyReports] = useState([]);

  const [loading, setLoading] = useState(false);

  // Function to fetch supply reports where "isDispatched" is false
  const fetchDispatchedSupplyReports = async () => {
    setLoading(true);
    try {
      // Reference to the "supplyReports" collection
      const supplyReportsCollection = collection(firebaseDB, 'supplyReports');

      // Create a query to filter where "isDispatched" is false
      const q = query(
        supplyReportsCollection,
        where('status', '==', 'Delivered'),
        limit(30),
      );

      // Execute the query and get the documents
      const querySnapshot = await getDocs(q);

      // Extract the data from the querySnapshot
      const dispatchedSupplyReports = querySnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          // Compare the "dispatched" property
          if ((a.status === 'Dispatched') === (b.status === 'Dispatched')) {
            // If "dispatched" is the same, compare by timestamp
            return b.dispatchTimestamp - a.dispatchTimestamp;
          }
          // Sort by "dispatched" (false first)
          return a.status === 'Dispatched' ? -1 : 1;
        });

      setLoading(false);
      setSupplyReports(dispatchedSupplyReports);
    } catch (error) {
      console.error('Error fetching undispatched supply reports:', error);
      setLoading(false);
      throw error;
    }
  };
  useEffect(() => {
    fetchDispatchedSupplyReports();
  }, []);

  if (loading) return <Loader />;

  return (
    <center>
      <div className="receive-supply-reports-container">
        <h3>Receive Supply Report</h3>
        <VerticalSpace1 />
        <div className="supply-report-row-header">
          <Text className="sr-id">ID</Text>
          <Text className="sr-timestamp">DATE</Text>
          <Text className="sr-parties-length">SUPPLYMAN</Text>
          <Text>STATUS</Text>
          <Text>ACTION</Text>
        </div>
        <VerticalSpace1 />
        {supplyReports.map((sr) => {
          return <SupplyReportRow data={sr} />;
        })}

        {supplyReports.length === 0 ? (
          <Text style={{ color: '#ddd' }}>No Supply Reports to receive</Text>
        ) : null}
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
    <div className="supply-report-row">
      <Text className="sr-id">{data.receiptNumber}</Text>
      <Text className="sr-timestamp">
        {new Date(data.timestamp).toLocaleDateString()}
      </Text>
      <Text className="sr-parties-length">{supplyman?.username}</Text>
      <Text>{data.status}</Text>
      <Button
        appearance="subtle"
        className="verify-button"
        onClick={() => {
          navigate('/receiveSRScreen', {
            state: { supplyReport: data },
          });
        }}
      >
        <span style={{ color: '#F25C54' }}>Receive</span>
      </Button>
    </div>
  );
}
