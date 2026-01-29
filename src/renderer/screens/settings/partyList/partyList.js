import { getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Card,
  Spinner,
  Combobox,
  Option,
  Input,
  Text,
} from '@fluentui/react-components';
import { useNavigate } from 'react-router-dom';
import './style.css';
import PartySelector from '../../../common/partySelector';
import { VerticalSpace1 } from '../../../common/verticalSpace';
import { useDebounce } from '../../../services/globalUtils';
import { useCompany } from '../../../contexts/companyContext';
import { getCompanyCollection, DB_NAMES } from '../../../services/firestoreHelpers';

export default function PartyListScreen({
  onPartySelected,
  descriptive,
  clearOnSelect,
}) {
  const [partyDetails, setPartyDetails] = useState([]);
  const [queryPartyName, setQueryPartyName] = useState('');
  const debouncedValue = useDebounce(queryPartyName, 500);
  const navigate = useNavigate();

  // Company context for company-scoped queries
  const { currentCompanyId } = useCompany();

  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 3) return;
    const fetchParties = async () => {
      // Define a reference to the company-scoped "parties" collection
      const partiesRef = getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES);

      // Create a query with a "name" field filter
      const q = query(
        partiesRef,
        where('name', '>=', debouncedValue.toUpperCase()),
        limit(10),
      );

      try {
        const querySnapshot = await getDocs(q);
        const partyData = querySnapshot.docs.map((doc) => doc.data());
        setPartyDetails(partyData);
        console.log(partyData);
      } catch (error) {
        console.error('Error fetching parties:', error);
      }
    };

    fetchParties();
  }, [debouncedValue, currentCompanyId]);

  const descriptiveTextStyle = { color: 'grey', textWrap: 'nowrap' };

  return (
    <center className="settings-party-list-container">
      <h3>Party Details</h3>

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
      <table>
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
