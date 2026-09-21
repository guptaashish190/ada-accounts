import { Combobox, Option, Text } from '@fluentui/react-components';
import React, { useEffect, useRef, useState } from 'react';
import globalUtils from '../services/globalUtils';
import { useAllParties } from '../contexts/allPartiesContext';

export default function PartySelector({
  onPartySelected,
  descriptive,
  clearOnSelect,
  autoFocus,
}) {
  const inputRef = useRef(null);
  const [queryPartyName, setQueryPartyName] = useState('');
  const { parties } = useAllParties();

  const q = (queryPartyName || '').trim().toLowerCase();
  const partyDetails = q
    ? parties
        .filter(
          (p) =>
            (p.name || '').toLowerCase().includes(q) ||
            String(p.fileNumber || '').toLowerCase().includes(q) ||
            (p.area || '').toLowerCase().includes(q),
        )
        .slice(0, 20)
    : [];

  useEffect(() => {
    if (!autoFocus) return undefined;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  return (
    <Combobox
      className="filter-input"
      listbox={{
        style: {
          minWidth: 720,
          width: 720,
          boxSizing: 'border-box',
          paddingRight: 12,
        },
      }}
      onInput={(e) => {
        setQueryPartyName(e.target.value);
      }}
      freeform
      value={queryPartyName}
      input={{ ref: inputRef }}
      onOptionSelect={(_, e) => {
        setQueryPartyName(e.optionText);
        onPartySelected(e.optionValue);
        if (clearOnSelect) {
          setQueryPartyName('');
        }
      }}
      placeholder="Party name"
      style={descriptive ? { width: '100%' } : {}}
    >
      {partyDetails.length ? (
        partyDetails.map((option1) => (
          <Option
            value={option1}
            text={option1.name}
            key={`search-bill-${option1.id}`}
            style={{ width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                width: '100%',
                minWidth: 0,
              }}
            >
              <Text wrap={false} style={{ minWidth: 0 }}>
                {option1.name}{' '}
                {option1.area?.length > 0 ? `(${option1.area})` : ''}
                {descriptive && option1.fileNumber
                  ? `  ${option1.fileNumber}`
                  : ''}
              </Text>
              {option1.partyBalance !== 0 ? (
                <Text wrap={false} weight="bold" style={{ flexShrink: 0 }}>
                  {globalUtils.getCurrencyFormat(option1.partyBalance)}
                </Text>
              ) : null}
            </div>
          </Option>
        ))
      ) : (
        <Option key="!212231">None</Option>
      )}
    </Combobox>
  );
}
