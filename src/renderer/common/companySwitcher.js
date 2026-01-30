/**
 * Company Switcher Component
 * Story 0.4 Desktop Implementation
 *
 * Dropdown for owners to switch between companies.
 * Shows in the header/toolbar area.
 */

import React from 'react';
import {
  Dropdown,
  Option,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { BuildingMultiple20Regular } from '@fluentui/react-icons';
import { useCompany } from '../contexts/companyContext';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dropdown: {
    minWidth: '200px',
  },
  icon: {
    color: tokens.colorBrandForeground1,
  },
  label: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
});

export default function CompanySwitcher() {
  const { currentCompanyId, companies, canSwitchCompany, switchCompany } =
    useCompany();
  const styles = useStyles();

  // Guard against null/undefined companies
  const safeCompanies = Array.isArray(companies) ? companies : [];

  // Don't render if user can't switch companies
  if (!canSwitchCompany || safeCompanies.length <= 1) {
    // Show current company name as static text
    const currentCompany = safeCompanies.find((c) => c.id === currentCompanyId);
    if (currentCompany) {
      return (
        <div className={styles.container}>
          <BuildingMultiple20Regular className={styles.icon} />
          <Text>{currentCompany.name}</Text>
        </div>
      );
    }
    return null;
  }

  const handleCompanyChange = (event, data) => {
    console.log('Company switcher - event:', event, 'data:', data);
    
    // Handle both data.optionValue and data.selectedOptions patterns
    const selectedCompanyId = data?.optionValue || data?.selectedOptions?.[0];
    
    if (!selectedCompanyId) {
      console.warn('No company ID found in selection data');
      return;
    }

    if (selectedCompanyId === currentCompanyId) {
      console.log('Same company selected, no change needed');
      return;
    }

    console.log('Switching company from', currentCompanyId, 'to', selectedCompanyId);
    switchCompany(selectedCompanyId);
  };

  const currentCompany = safeCompanies.find((c) => c.id === currentCompanyId);

  return (
    <div className={styles.container}>
      <BuildingMultiple20Regular className={styles.icon} />
      <Dropdown
        key={`company-switcher-${currentCompanyId}`}
        className={styles.dropdown}
        value={currentCompany?.name || ''}
        selectedOptions={[currentCompanyId]}
        onOptionSelect={handleCompanyChange}
        placeholder="Select company"
      >
        {safeCompanies.map((company) => (
          <Option key={company.id} value={company.id}>
            {company.name}
          </Option>
        ))}
      </Dropdown>
    </div>
  );
}

/**
 * Compact version for toolbar
 */
export function CompanySwitcherCompact() {
  const { currentCompanyId, companies, canSwitchCompany, switchCompany } =
    useCompany();
  const styles = useStyles();

  // Guard against null/undefined companies
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const currentCompany = safeCompanies.find((c) => c.id === currentCompanyId);

  const handleCompactChange = (event, data) => {
    const selectedCompanyId = data?.optionValue || data?.selectedOptions?.[0];
    if (selectedCompanyId && selectedCompanyId !== currentCompanyId) {
      console.log('Compact switcher - switching to:', selectedCompanyId);
      switchCompany(selectedCompanyId);
    }
  };

  if (!canSwitchCompany) {
    return (
      <Text size={200} className={styles.label}>
        {currentCompany?.name || 'Company'}
      </Text>
    );
  }

  return (
    <Dropdown
      key={`company-switcher-compact-${currentCompanyId}`}
      size="small"
      appearance="underline"
      value={currentCompany?.name || ''}
      selectedOptions={[currentCompanyId]}
      onOptionSelect={handleCompactChange}
    >
      {safeCompanies.map((company) => (
        <Option key={company.id} value={company.id}>
          {company.name}
        </Option>
      ))}
    </Dropdown>
  );
}
