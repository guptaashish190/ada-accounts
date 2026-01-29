/**
 * Company Selection Screen
 * Story 0.3 Desktop Implementation
 *
 * Shown to employees on first login to select their company.
 */

import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  Title1,
  Title3,
} from '@fluentui/react-components';
import { BuildingMultiple24Regular } from '@fluentui/react-icons';
import { useCompany } from '../../contexts/companyContext';
import './style.css';

export default function CompanySelectionScreen() {
  const { companies, saveSelectedCompany } = useCompany();
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Guard against null/undefined companies
  const safeCompanies = companies || [];

  const handleSave = async () => {
    if (!selectedCompanyId) {
      setError('Please select a company');
      return;
    }

    setSaving(true);
    setError('');

    const success = await saveSelectedCompany(selectedCompanyId);

    if (!success) {
      setError('Failed to save company selection. Please try again.');
      setSaving(false);
    }
    // If success, the context will update and redirect
  };

  return (
    <div className="company-selection-container">
      <Card className="company-selection-card">
        <CardHeader
          image={<BuildingMultiple24Regular />}
          header={<Title1>Select Your Company</Title1>}
          description="Please select the company you work for"
        />

        <div className="company-selection-content">
          <Text>
            This is a one-time selection. Contact your manager if you need to
            change this later.
          </Text>

          <RadioGroup
            value={selectedCompanyId}
            onChange={(e, data) => setSelectedCompanyId(data.value)}
            className="company-radio-group"
          >
            {safeCompanies.map((company) => (
              <Card
                key={company.id}
                className={`company-option-card ${
                  selectedCompanyId === company.id ? 'selected' : ''
                }`}
                onClick={() => setSelectedCompanyId(company.id)}
              >
                <Radio value={company.id} label="" />
                <div className="company-option-content">
                  <Title3>{company.name}</Title3>
                  {company.shortCode && (
                    <Text size={200} className="company-code">
                      Code: {company.shortCode}
                    </Text>
                  )}
                </div>
              </Card>
            ))}
          </RadioGroup>

          {error && <Text className="error-text">{error}</Text>}

          <Button
            appearance="primary"
            size="large"
            onClick={handleSave}
            disabled={saving || !selectedCompanyId}
            className="save-button"
          >
            {saving ? <Spinner size="tiny" /> : 'Continue'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
