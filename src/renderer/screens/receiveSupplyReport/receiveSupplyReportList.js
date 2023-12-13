import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Text, Input } from '@fluentui/react-components';
import { firebaseDB } from '../../firebaseInit';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import { VerticalSpace1 } from '../../common/verticalSpace';

export default function ReceiveSupplyReportScreen() {
  const [supplyReports, setSupplyReports] = useState([]);
  const [filteredSupplyReports, setFilteredSupplyReports] = useState([]);
  const [querySR, setQuerySR] = useState('');

  const [loading, setLoading] = useState(false);

  const fetchDispatchedSupplyReports = async () => {
    setLoading(true);
    try {
      const supplyReportsCollection = collection(firebaseDB, 'supplyReports');

      const q = query(
        supplyReportsCollection,
        where('status', '==', 'Delivered'),
        limit(30),
      );

      const querySnapshot = await getDocs(q);

      const dispatchedSupplyReports = querySnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          if ((a.status === 'Dispatched') === (b.status === 'Dispatched')) {
            return b.dispatchTimestamp - a.dispatchTimestamp;
          }
          return a.status === 'Dispatched' ? -1 : 1;
        });

      setLoading(false);
      setSupplyReports(dispatchedSupplyReports);
      setFilteredSupplyReports(dispatchedSupplyReports);
    } catch (error) {
      console.error('Error fetching undispatched supply reports:', error);
      setLoading(false);
      throw error;
    }
  };
  useEffect(() => {
    fetchDispatchedSupplyReports();
  }, []);

  useEffect(() => {
    if (querySR.length === 0) {
      setFilteredSupplyReports(supplyReports);
    } else {
      setFilteredSupplyReports(
        filteredSupplyReports.filter((x) => x.receiptNumber.includes(querySR)),
      );
    }
  }, [querySR]);

  if (loading) return <Loader />;

  return (
    <center>
      <div className="receive-supply-reports-container">
        <h3>Receive Supply Reports</h3>

        <Input
          onChange={(_, e) => setQuerySR(e.value)}
          contentBefore="SR-"
          placeholder="00"
        />
        <VerticalSpace1 />
        <SupplyRowListHeader />
        <VerticalSpace1 />
        {filteredSupplyReports.map((sr) => {
          return <SupplyReportRow key={`recevie-sr-list-${sr.id}`} data={sr} />;
        })}

        {filteredSupplyReports.length === 0 ? (
          <Text style={{ color: '#ddd' }}>No Supply Reports to receive</Text>
        ) : null}
      </div>
    </center>
  );
}

export function SupplyRowListHeader() {
  return (
    <div className="supply-report-row-header">
      <Text className="sr-id">ID</Text>
      <Text className="sr-timestamp">DATE</Text>
      <Text className="sr-parties-length">SUPPLYMAN</Text>
      <Text className="sr-parties-length">BILLS</Text>
      <Text>STATUS</Text>
      <Text>ACTION</Text>
    </div>
  );
}

export function SupplyReportRow({ data }) {
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
      <Text>
        {[...data.orders, ...data.supplementaryBills, ...data.attachedBills]
          ?.length || 0}
      </Text>
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
