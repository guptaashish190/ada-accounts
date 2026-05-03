import { getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Spinner,
  Combobox,
  Option,
  Input,
  Text,
} from '@fluentui/react-components';
import { ArrowUpload24Regular } from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';
import './style.css';
import PartySelector from '../../../common/partySelector';
import { VerticalSpace1 } from '../../../common/verticalSpace';
import { useDebounce } from '../../../services/globalUtils';
import { useCompany } from '../../../contexts/companyContext';
import {
  getCompanyCollection,
  DB_NAMES,
} from '../../../services/firestoreHelpers';
import ImportParties from './importParties';

export default function PartyListScreen({
  onPartySelected,
  descriptive,
  clearOnSelect,
}) {
  const [partyDetails, setPartyDetails] = useState([]);
  const [queryPartyName, setQueryPartyName] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const debouncedValue = useDebounce(queryPartyName, 500);
  const navigate = useNavigate();

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();

  // Initial load: fetch first 50 parties when the screen mounts or company changes.
  useEffect(() => {
    if (!currentCompanyId) return;
    const fetchInitial = async () => {
      const partiesRef = getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES);
      try {
        const snapshot = await getDocs(query(partiesRef, limit(50)));
        setPartyDetails(snapshot.docs.map((doc) => doc.data()));
      } catch (error) {
        console.error('Error fetching initial parties:', error);
      }
    };
    fetchInitial();
  }, [currentCompanyId]);

  // Search: filter by name when 3+ characters are typed; revert to initial 50 when cleared.
  useEffect(() => {
    if (!currentCompanyId) return;
    if (!debouncedValue || debouncedValue.length < 3) {
      if (!debouncedValue) {
        const partiesRef = getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES);
        getDocs(query(partiesRef, limit(50))).then((snap) =>
          setPartyDetails(snap.docs.map((doc) => doc.data()))
        );
      }
      return;
    }
    const fetchParties = async () => {
      const partiesRef = getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES);
      const q = query(
        partiesRef,
        where('name', '>=', debouncedValue.toUpperCase()),
        limit(10),
      );
      try {
        const querySnapshot = await getDocs(q);
        setPartyDetails(querySnapshot.docs.map((doc) => doc.data()));
      } catch (error) {
        console.error('Error fetching parties:', error);
      }
    };
    fetchParties();
  }, [debouncedValue, currentCompanyId]);

  const descriptiveTextStyle = { color: 'grey', textWrap: 'nowrap' };

  return (
    <center className="settings-party-list-container">
      <div className="party-list-header">
        <h3 style={{ margin: 0 }}>Party Details</h3>
        <Button
          icon={<ArrowUpload24Regular />}
          appearance="primary"
          onClick={() => setImportOpen(true)}
          disabled={!currentCompanyId}
        >
          Import from Excel / CSV
        </Button>
      </div>

      <Input
        className="filter-input"
        onChange={(e) => {
          setQueryPartyName(e.target.value);
        }}
        value={queryPartyName}
        placeholder="Party name"
        style={descriptive ? { width: '100%' } : {}}
      />
      <VerticalSpace1 />
      <ImportParties
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          // Retrigger search so newly imported matches show up.
          setQueryPartyName((q) => q);
        }}
      />
      <table className="app-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Area</th>
            <th>PIN</th>
            <th>Address</th>
            <th>File Number</th>
          </tr>
        </thead>
        <tbody>
          {partyDetails.map((party) => (
            <tr
              key={`party-list-screen-${party.id}`}
              onClick={() => {
                navigate('/partyDetails', {
                  state: {
                    partyId: party.id,
                  },
                });
              }}
            >
              <td>{party.name}</td>
              <td>{party.area || '--'}</td>
              <td>{party.pin || '--'}</td>
              <td>{party.addressline1 || '--'}</td>
              <td>{party.fileNumber || '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </center>
  );
}
