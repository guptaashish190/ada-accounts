import { Dropdown, Option, Spinner } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { getDocs, query, where } from 'firebase/firestore';
import { useAuthUser } from '../../contexts/allUsersContext';
import constants from '../../constants';
import { useCompany } from '../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../services/firestoreHelpers';
import {
  SupplyReportRow,
  SupplyRowListHeader,
} from '../receiveSupplyReport/receiveSupplyReportList';
import { BundlesRow } from '../bundles/bundlesScreen';
import { VerticalSpace2 } from '../../common/verticalSpace';

export default function ReceivePendingUser() {
  const [selectedUser, setSelectedUser] = useState();
  const { allUsers } = useAuthUser();
  const [loading, setLoading] = useState(false);
  const [pendingSupplyReport, setPendingSupplyReport] = useState([]);
  const [pendingBundles, setPendingBundles] = useState([]);
  const { currentCompanyId } = useCompany();

  const fetchbundles = async (date) => {
    setLoading(true);
    try {
      const bundlesCollection = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.BILL_BUNDLES,
      );

      const q = query(
        bundlesCollection,
        where('status', '==', constants.firebase.billBundleFlowStatus.HANDOVER),
        where('assignedTo', '==', selectedUser),
      );

      const querySnapshot = await getDocs(q);

      const reportsData = [];
      querySnapshot.forEach((doc) => {
        reportsData.push({ id: doc.id, ...doc.data() });
      });

      setPendingBundles(reportsData);
      console.log(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching supply reports:', error);
      setLoading(false);
    }
  };
  const fetchSupplyReport = async (date) => {
    setLoading(true);
    try {
      const supplyReportColl = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.SUPPLY_REPORTS,
      );
      // Create a query with a "name" field filter
      const q = query(
        supplyReportColl,
        where('status', '==', constants.firebase.supplyReportStatus.DELIVERED),
        where('supplymanId', '==', selectedUser),
      );
      const querySnapshot = await getDocs(q);

      const reportsData = [];
      querySnapshot.forEach((doc) => {
        reportsData.push({ id: doc.id, ...doc.data() });
      });

      setPendingSupplyReport(reportsData);
      console.log(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching supply reports:', error);
      setLoading(false);
    }
  };

  const fetchPending = async () => {
    setLoading(true);
    await fetchbundles();
    await fetchSupplyReport();
    setLoading(false);
  };

  useEffect(() => {
    if (selectedUser) fetchPending();
  }, [selectedUser]);

  return (
    <center>
      <Dropdown
        size="large"
        onOptionSelect={(_, e) => setSelectedUser(e.optionValue)}
        className="dropdown filter-input"
        placeholder="Select User"
      >
        {allUsers
          .filter((x) => !x.isDeactivated)
          .map((user) => (
            <Option text={user.username} value={user.uid} key={user.uid}>
              {user.username}
            </Option>
          ))}
      </Dropdown>
      {loading ? <Spinner /> : null}
      <VerticalSpace2 />
      <h3>Supply Reports</h3>
      <div className="receive-supply-reports-container">
        {pendingSupplyReport?.map((sr) => (
          <SupplyReportRow key={`pending-user-${sr.id}`} data={sr} />
        ))}
      </div>
      {!loading && pendingSupplyReport.length === 0 ? (
        <div>No Supply Reports found</div>
      ) : null}
      <VerticalSpace2 />
      <h3>Bundles</h3>
      <div className="all-bundles-container">
        {pendingBundles.map((bu, i) => {
          return <BundlesRow key={`bundle-row-${bu.id}`} index={i} data={bu} />;
        })}
      </div>
      {!loading && pendingBundles.length === 0 ? (
        <div>No Bundles found</div>
      ) : null}
    </center>
  );
}
