import { onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Button, Card, Text, Input } from '@fluentui/react-components';
import './style.css';
import Loader from '../../common/loader';
import globalUtils from '../../services/globalUtils';
import { VerticalSpace1 } from '../../common/verticalSpace';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';
import constants from '../../constants';

export default function ReceiveSupplyReportScreen() {
  const [supplyReports, setSupplyReports] = useState([]);

  const [filteredSupplyReports, setFilteredSupplyReports] = useState([]);
  const [querySR, setQuerySR] = useState('');

  const [loading, setLoading] = useState(false);

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();

  useEffect(() => {
    if (!currentCompanyId) return;
    setLoading(true);

    const supplyReportsCollection = getCompanyCollection(
      currentCompanyId,
      DB_NAMES.SUPPLY_REPORTS,
    );

    let deliveredDocs = [];
    let dispatchedDocs = [];

    const merge = () => {
      const merged = [...deliveredDocs, ...dispatchedDocs];
      setSupplyReports(merged);
      setFilteredSupplyReports(merged);
      setLoading(false);
    };

    const unsubDelivered = onSnapshot(
      query(supplyReportsCollection, where('status', '==', 'Delivered')),
      (snap) => {
        deliveredDocs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        merge();
      },
      (error) => console.error('Error listening to Delivered SRs:', error),
    );

    const unsubDispatched = onSnapshot(
      query(supplyReportsCollection, where('status', '==', 'Dispatched')),
      (snap) => {
        dispatchedDocs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        merge();
      },
      (error) => console.error('Error listening to Dispatched SRs:', error),
    );

    return () => {
      unsubDelivered();
      unsubDispatched();
    };
  }, [currentCompanyId]);

  useEffect(() => {
    if (querySR.length === 0) {
      setFilteredSupplyReports(supplyReports);
    } else {
      setFilteredSupplyReports(
        supplyReports.filter((x) => x.receiptNumber.includes(querySR)),
      );
    }
  }, [querySR, supplyReports]);

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
  const [supplyman, setSupplyman] = useState();

  const getSupplyman = async () => {
    const user = await globalUtils.fetchUserById(data.supplymanId);
    setSupplyman(user);
  };

  useEffect(() => {
    getSupplyman();
  }, []);

  const isDelivered = data.status === 'Delivered';
  return (
    <div
      className="supply-report-row"
      style={{ opacity: !isDelivered ? 0.4 : 1 }}
    >
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
        disabled={!isDelivered}
        appearance="subtle"
        className="verify-button"
        onClick={() => {
          window.electron.ipcRenderer.sendMessage('new-window', {
            type: constants.windowConstants.RECEIVE_SUPPLY_REPORT,
            data: { supplyReport: data },
          });
        }}
      >
        <span style={{ color: '#F25C54' }}>
          {!isDelivered ? '--' : 'Receive'}
        </span>
      </Button>
    </div>
  );
}
