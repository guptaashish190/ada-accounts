import { Combobox, Option, Text } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import globalUtils, { useDebounce } from '../services/globalUtils';
import { firebaseDB } from '../firebaseInit';

export default function PartySelector({
  onPartySelected,
  descriptive,
  clearOnSelect,
}) {
  const [partyDetails, setPartyDetails] = useState([]);
  const [queryPartyName, setQueryPartyName] = useState('');
  const debouncedValue = useDebounce(queryPartyName, 500);

  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 3) return;
    const fetchParties = async () => {
      // Define a reference to the "parties" collection
      const partiesRef = collection(firebaseDB, 'parties');

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
  }, [debouncedValue]);

  const descriptiveTextStyle = { color: 'grey', textWrap: 'nowrap' };

  return (
    <Combobox
      className="filter-input"
      onInput={(e) => {
        setQueryPartyName(e.target.value);
      }}
      freeform
      value={queryPartyName}
      onOptionSelect={(_, e) => {
        setQueryPartyName(e.optionText);
        onPartySelected(e.optionValue);
        if (clearOnSelect) {
          setQueryPartyName(null);
          setPartyDetails(null);
        }
      }}
      placeholder="Party name"
      style={descriptive ? { width: '100%' } : {}}
    >
      {partyDetails?.length ? (
        partyDetails.map((option1) => (
          <Option
            value={option1}
            text={option1.name}
            key={`search-bill-${option1.id}`}
          >
            <Text style={{ width: '100%' }}>
              {option1.name}{' '}
              {option1.area?.length > 0 ? `(${option1.area})` : ''}
            </Text>
            {descriptive ? (
              <div style={descriptiveTextStyle} className="descriptive-text">
                {option1.fileNumber}
              </div>
            ) : null}
            <Text>
              {option1.partyBalance !== 0
                ? globalUtils.getCurrencyFormat(option1.partyBalance)
                : ''}
            </Text>
          </Option>
        ))
      ) : (
        <Option key="!212231">None</Option>
      )}
    </Combobox>
  );
}
