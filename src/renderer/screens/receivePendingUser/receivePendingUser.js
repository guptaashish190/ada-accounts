import { Dropdown, Option, Spinner } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthUser } from '../../contexts/allUsersContext';
import { firebaseDB } from '../../firebaseInit';
import constants from '../../constants';
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

  const fetchbundles = async (date) => {
    setLoading(true);
    try {
      const bundlesCollection = collection(firebaseDB, 'billBundles');

      const q = query(
        bundlesCollection,
        where('status', '==', constants.firebase.billBundleFlowStatus.HANDOVER),
        where('assignedTo', '==', selectedUser.uid),
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
      const supplyReportColl = collection(firebaseDB, 'supplyReports');
      // Create a query with a "name" field filter
      const q = query(
        supplyReportColl,
        where('status', '==', constants.firebase.supplyReportStatus.DELIVERED),
        where('supplymanId', '==', selectedUser.uid),
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
    if (selectedUser?.uid) fetchPending();
  }, [selectedUser]);

  return (
    <center>
      <Dropdown
        size="large"
        onOptionSelect={(_, e) => setSelectedUser(e.optionValue)}
        className="dropdown  filter-input"
        placeholder="Select User"
      >
        <Option text={null} value={null} key="accounts-none-dropdown">
          None
        </Option>
        {allUsers.map((user) => (
          <Option text={user.username} value={user} key={user.uid}>
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
