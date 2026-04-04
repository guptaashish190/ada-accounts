/* eslint-disable no-restricted-syntax */
import { getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Spinner,
  Card,
  CardHeader,
  CardPreview,
  Text,
  Badge,
  Combobox,
  Option,
} from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
import './style.css';
import { useSettingsContext } from '../../../contexts/settingsContext';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import { useCompany } from '../../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../../services/firestoreHelpers';

export default function RouteSettings() {
  const [routes, setRoutes] = useState([]);
  const [parties, setParties] = useState({});
  const [loading, setLoading] = useState(true);
  const [partiesLoading, setPartiesLoading] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(true);

  const { currentCompanyId } = useCompany();

  const fetchParties = async () => {
    setPartiesLoading(true);
    try {
      const partiesCollection = getCompanyCollection(currentCompanyId, DB_NAMES.PARTIES);
      const partiesSnapshot = await getDocs(partiesCollection);
      const partiesData = {};

      partiesSnapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        partiesData[docSnapshot.id] =
          data.name || data.partyName || 'Unknown Party';
      });

      setParties(partiesData);
    } catch (error) {
      console.error('Error fetching parties: ', error);
    } finally {
      setPartiesLoading(false);
    }
  };

  const fetchRoutes = async () => {
    setRoutesLoading(true);
    try {
      const routesCollection = getCompanyCollection(currentCompanyId, DB_NAMES.MR_ROUTES);
      const routesSnapshot = await getDocs(routesCollection);
      const routesData = routesSnapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));
      setRoutes(routesData);
    } catch (error) {
      console.error('Error fetching routes: ', error);
    } finally {
      setRoutesLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchParties(), fetchRoutes()]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentCompanyId]);

  const getPartyName = (partyId) => {
    return parties[partyId] || `Party ID: ${partyId}`;
  };

  const updateRouteInFirestore = async (routeId, updatedRouteArray) => {
    try {
      const routeRef = getCompanyDoc(currentCompanyId, DB_NAMES.MR_ROUTES, routeId);
      await updateDoc(routeRef, { route: updatedRouteArray });
    } catch (error) {
      console.error('Error updating route:', error);
      throw error;
    }
  };

  const addPartyToDay = async (routeId, dayIndex, partyId) => {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const updatedRoute = route.route.map((day, i) => {
      if (i !== dayIndex) return day;
      if (day.parties?.includes(partyId)) return day;
      return { ...day, parties: [...(day.parties || []), partyId] };
    });

    await updateRouteInFirestore(routeId, updatedRoute);
    setRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, route: updatedRoute } : r)),
    );
  };

  const removePartyFromDay = async (routeId, dayIndex, partyId) => {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const updatedRoute = route.route.map((day, i) => {
      if (i !== dayIndex) return day;
      return { ...day, parties: (day.parties || []).filter((p) => p !== partyId) };
    });

    await updateRouteInFirestore(routeId, updatedRoute);
    setRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, route: updatedRoute } : r)),
    );
  };

  if (loading) {
    return (
      <center>
        <h3>Route Settings</h3>
        <div className="loading-container">
          <Spinner size="large" />
          <Text size={400} style={{ marginTop: '16px' }}>
            Loading routes and parties...
          </Text>
        </div>
      </center>
    );
  }

  return (
    <center>
      <h3>Route Settings</h3>
      <div className="route-container">
        {routes.length === 0 ? (
          <div className="no-data-container">
            <Text size={400} style={{ color: '#666' }}>
              No routes found
            </Text>
          </div>
        ) : (
          routes.map((route) => (
            <RouteComponent
              key={`route-${route.id}`}
              route={route}
              parties={parties}
              getPartyName={getPartyName}
              partiesLoading={partiesLoading}
              onAddParty={(dayIndex, partyId) =>
                addPartyToDay(route.id, dayIndex, partyId)
              }
              onRemoveParty={(dayIndex, partyId) =>
                removePartyFromDay(route.id, dayIndex, partyId)
              }
            />
          ))
        )}
      </div>
    </center>
  );
}

function RouteComponent({
  route,
  parties,
  getPartyName,
  partiesLoading,
  onAddParty,
  onRemoveParty,
}) {
  const { settings } = useSettingsContext();
  const [expandedDays, setExpandedDays] = useState({});

  const toggleDayExpansion = (dayIndex) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayIndex]: !prev[dayIndex],
    }));
  };

  const daysOfWeek = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  return (
    <Card className="route-card">
      <CardHeader
        header={
          <Text size={500} weight="semibold">
            {route.name || 'Unnamed Route'}
          </Text>
        }
      />
      <CardPreview>
        <div className="route-days-container">
          {route.route && route.route.length > 0 ? (
            route.route.map((routeDay, index) => (
              <RouteDayComponent
                key={`${route.id}-day-${routeDay.day || index}`}
                routeDay={routeDay}
                dayIndex={index}
                dayName={daysOfWeek[index] || `Day ${index + 1}`}
                parties={parties}
                getPartyName={getPartyName}
                isExpanded={expandedDays[index]}
                onToggleExpansion={() => toggleDayExpansion(index)}
                partiesLoading={partiesLoading}
                onAddParty={(partyId) => onAddParty(index, partyId)}
                onRemoveParty={(partyId) => onRemoveParty(index, partyId)}
              />
            ))
          ) : (
            <Text>No route data available</Text>
          )}
        </div>
      </CardPreview>
    </Card>
  );
}

function RouteDayComponent({
  routeDay,
  dayIndex,
  dayName,
  parties,
  getPartyName,
  isExpanded,
  onToggleExpansion,
  partiesLoading,
  onAddParty,
  onRemoveParty,
}) {
  const partyCount = routeDay.parties ? routeDay.parties.length : 0;
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const assignedPartyIds = new Set(routeDay.parties || []);
  const availableParties = Object.entries(parties)
    .filter(([id]) => !assignedPartyIds.has(id))
    .filter(
      ([, name]) =>
        !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => a[1].localeCompare(b[1]));

  const handleAddParty = async (partyId) => {
    setSaving(true);
    try {
      await onAddParty(partyId);
    } finally {
      setSaving(false);
      setSearchQuery('');
    }
  };

  const handleRemoveParty = async (partyId) => {
    setSaving(true);
    try {
      await onRemoveParty(partyId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="route-day-component">
      <div
        className="route-day-header"
        onClick={onToggleExpansion}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onToggleExpansion();
          }
        }}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
      >
        <div className="day-info">
          <Text size={400} weight="medium">
            {dayName}
          </Text>
          <Badge appearance="filled" color="brand">
            {partyCount} {partyCount === 1 ? 'Party' : 'Parties'}
          </Badge>
        </div>
        <Text size={300}>{isExpanded ? '▼' : '▶'}</Text>
      </div>
      {isExpanded && (
        <div className="parties-list">
          {(() => {
            if (partiesLoading) {
              return (
                <div className="parties-loading">
                  <Spinner size="small" />
                  <Text size={300} style={{ marginLeft: '8px' }}>
                    Loading party names...
                  </Text>
                </div>
              );
            }

            return (
              <>
                {routeDay.parties && routeDay.parties.length > 0 ? (
                  routeDay.parties.map((partyId) => (
                    <div key={`party-${partyId}`} className="party-item-row">
                      <Text size={300}>{getPartyName(partyId)}</Text>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<DismissRegular />}
                        disabled={saving}
                        onClick={() => handleRemoveParty(partyId)}
                        title="Remove party"
                      />
                    </div>
                  ))
                ) : (
                  <Text size={300} style={{ color: '#666', padding: '4px 0' }}>
                    No parties assigned
                  </Text>
                )}

                <div className="add-party-row">
                  <Combobox
                    placeholder="Search & add party..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) {
                        handleAddParty(data.optionValue);
                      }
                    }}
                    disabled={saving}
                    size="small"
                    style={{ flex: 1, minWidth: 0 }}
                    freeform
                  >
                    {availableParties.length > 0 ? (
                      availableParties.slice(0, 50).map(([id, name]) => (
                        <Option key={id} value={id} text={name}>
                          {name}
                        </Option>
                      ))
                    ) : (
                      <Option disabled value="" text="No parties available">
                        {searchQuery
                          ? 'No matching parties'
                          : 'All parties assigned'}
                      </Option>
                    )}
                  </Combobox>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
