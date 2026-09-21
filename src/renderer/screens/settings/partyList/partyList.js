import React, { useState } from 'react';
import { Button, Input } from '@fluentui/react-components';
import { ArrowUpload24Regular } from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';
import './style.css';
import { VerticalSpace1 } from '../../../common/verticalSpace';
import { useCompany } from '../../../contexts/companyContext';
import { useAllParties } from '../../../contexts/allPartiesContext';
import ImportParties from './importParties';

export default function PartyListScreen({ descriptive }) {
  const [queryPartyName, setQueryPartyName] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();
  const { currentCompanyId } = useCompany();
  const { parties } = useAllParties();

  const q = queryPartyName.trim().toLowerCase();
  const partyDetails = q
    ? parties.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          String(p.fileNumber || '').toLowerCase().includes(q) ||
          (p.area || '').toLowerCase().includes(q),
      )
    : parties.slice(0, 50);

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
      <ImportParties open={importOpen} onClose={() => setImportOpen(false)} />
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
