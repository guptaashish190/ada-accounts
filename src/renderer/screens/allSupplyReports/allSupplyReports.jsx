import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Card, Text } from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';

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
        {supplyReports.map((sr) => {
          return <SupplyReportRow data={sr} />;
        })}
      </div>
    </center>
  );
}

function SupplyReportRow({ data }) {
  const [supplyman, setSupplyman] = useState();

  const getSupplyman = async () => {
    const user = await globalUtils.fetchUserById(data.supplymanId);
    setSupplyman(user);
  };

  useEffect(() => {
    getSupplyman();
  }, []);
  return (
    <Card className="supply-report-row">
      <div className="top-row">
        <Text className="sr-id">{data.timestamp}</Text>
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
          {data.numPolybags} Polybags, {data.numCases} Cases, {data.numPackets}{' '}
          Packets
        </Text>
      </div>
    </Card>
  );
}
