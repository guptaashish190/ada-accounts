import { onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Text, Input } from '@fluentui/react-components';
import './style.css';
import Loader from '../../common/loader';
import { VerticalSpace1 } from '../../common/verticalSpace';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';
import constants from '../../constants';
import { useAuthUser } from '../../contexts/allUsersContext';

export default function ReceiveSupplyReportScreen() {
  const [receiveQueue, setReceiveQueue] = useState([]);

  const [filteredReceiveQueue, setFilteredReceiveQueue] = useState([]);
  const [querySR, setQuerySR] = useState('');

  const [loading, setLoading] = useState(false);

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();
  const { allUsers } = useAuthUser();

  const supplymanNameById = useMemo(() => {
    const map = {};
    (allUsers || []).forEach((user) => {
      map[user.uid] = user.username;
    });
    return map;
  }, [allUsers]);

  const groupedSupplyReports = useMemo(() => {
    const grouped = {};
    filteredReceiveQueue.forEach((report) => {
      const supplymanId = report.personId || 'unassigned';
      if (!grouped[supplymanId]) {
        grouped[supplymanId] = {
          supplymanName: supplymanNameById[supplymanId] || 'Unknown Supplyman',
          reports: [],
        };
      }
      grouped[supplymanId].reports.push(report);
    });
    return Object.entries(grouped).sort((a, b) =>
      a[1].supplymanName.localeCompare(b[1].supplymanName),
    );
  }, [filteredReceiveQueue, supplymanNameById]);

  useEffect(() => {
    if (!currentCompanyId) return;
    setLoading(true);

    const supplyReportsCollection = getCompanyCollection(
      currentCompanyId,
      DB_NAMES.SUPPLY_REPORTS,
    );
    const bundlesCollection = getCompanyCollection(
      currentCompanyId,
      DB_NAMES.BILL_BUNDLES,
    );

    let deliveredDocs = [];
    let dispatchedDocs = [];
    let handoverBundles = [];

    const merge = () => {
      const normalizedSupplyReports = [...deliveredDocs, ...dispatchedDocs].map(
        (doc) => ({
          ...doc,
          itemType: 'supplyReport',
          personId: doc.supplymanId || '',
          totalBills: [
            ...(doc.orders || []),
            ...(doc.supplementaryBills || []),
            ...(doc.attachedBills || []),
          ].length,
          sourceData: doc,
        }),
      );
      const normalizedBundles = handoverBundles.map((doc) => ({
        ...doc,
        itemType: 'bundle',
        personId: doc.assignedTo || '',
        totalBills: (doc.bills || []).length,
        sourceData: doc,
      }));
      const getPriority = (item) => {
        if (
          item.itemType === 'supplyReport' &&
          item.status === constants.firebase.supplyReportStatus.DELIVERED
        ) {
          return 0;
        }
        if (
          item.itemType === 'bundle' &&
          item.status === constants.firebase.billBundleFlowStatus.HANDOVER
        ) {
          return 1;
        }
        if (
          item.itemType === 'supplyReport' &&
          item.status === constants.firebase.supplyReportStatus.DISPATCHED
        ) {
          return 2;
        }
        return 3;
      };
      const merged = [...normalizedSupplyReports, ...normalizedBundles].sort(
        (a, b) => {
          const priorityDiff = getPriority(a) - getPriority(b);
          if (priorityDiff !== 0) return priorityDiff;
          return (b.timestamp || 0) - (a.timestamp || 0);
        },
      );
      setReceiveQueue(merged);
      setFilteredReceiveQueue(merged);
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
    const unsubHandoverBundles = onSnapshot(
      query(
        bundlesCollection,
        where('status', '==', constants.firebase.billBundleFlowStatus.HANDOVER),
      ),
      (snap) => {
        handoverBundles = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        merge();
      },
      (error) => console.error('Error listening to Handover Bundles:', error),
    );

    return () => {
      unsubDelivered();
      unsubDispatched();
      unsubHandoverBundles();
    };
  }, [currentCompanyId]);

  useEffect(() => {
    if (querySR.length === 0) {
      setFilteredReceiveQueue(receiveQueue);
    } else {
      setFilteredReceiveQueue(
        receiveQueue.filter((x) =>
          (x.receiptNumber || '')
            .toString()
            .toLowerCase()
            .includes(querySR.toLowerCase()),
        ),
      );
    }
  }, [querySR, receiveQueue]);

  if (loading) return <Loader />;

  return (
    <center>
      <div className="receive-supply-reports-container">
        <h3>Receive Supply Reports & Bundles</h3>

        <Input
          onChange={(_, e) => setQuerySR(e.value)}
          placeholder="Search by receipt number..."
        />
        <VerticalSpace1 />
        <SupplyRowListHeader />
        <VerticalSpace1 />
        {filteredReceiveQueue.length === 0 ? (
          <Text style={{ color: '#ddd' }}>No items to receive</Text>
        ) : (
          groupedSupplyReports.map(([supplymanId, groupedReports]) => (
            <div className="supplyman-group" key={`supplyman-group-${supplymanId}`}>
              <Text className="supplyman-group-title">
                {groupedReports.supplymanName} ({groupedReports.reports.length})
              </Text>
              <VerticalSpace1 />
              {groupedReports.reports.map((sr) => {
                return (
                  <SupplyReportRow
                    key={`recevie-sr-list-${sr.id}`}
                    data={sr}
                    supplymanName={groupedReports.supplymanName}
                  />
                );
              })}
              <VerticalSpace1 />
            </div>
          ))
        )}
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

export function SupplyReportRow({ data, supplymanName }) {
  const { allUsers } = useAuthUser();
  const resolvedSupplymanName =
    supplymanName ||
    allUsers?.find((user) => user.uid === data.personId)?.username ||
    '--';

  const isBundle = data.itemType === 'bundle';
  const isDelivered = isBundle
    ? data.status === constants.firebase.billBundleFlowStatus.HANDOVER
    : data.status === 'Delivered';
  return (
    <div
      className="supply-report-row"
      style={{ opacity: !isDelivered ? 0.4 : 1 }}
    >
      <Text className="sr-id">{data.receiptNumber}</Text>
      <Text className="sr-timestamp">
        {new Date(data.timestamp).toLocaleDateString()}
      </Text>
      <Text className="sr-parties-length">{resolvedSupplymanName}</Text>
      <Text>{data.totalBills || 0}</Text>
      <Text>{data.status}</Text>
      <Button
        disabled={!isDelivered}
        appearance="subtle"
        className="verify-button"
        onClick={() => {
          window.electron.ipcRenderer.sendMessage('new-window', {
            type: constants.windowConstants.RECEIVE_SUPPLY_REPORT,
            data: {
              supplyReport: data.sourceData || data,
              ...(isBundle ? { isBundle: true } : {}),
            },
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
