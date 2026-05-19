/* eslint-disable no-restricted-syntax */
import { addDoc, getDocs, updateDoc } from 'firebase/firestore';
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
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Input,
  Label,
} from '@fluentui/react-components';
import { AddRegular, DismissRegular } from '@fluentui/react-icons';
import './style.css';
import { useSettingsContext } from '../../../contexts/settingsContext';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';
import { useCompany } from '../../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../../services/firestoreHelpers';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const EMPTY_WEEK = DAYS_OF_WEEK.map((day) => ({
  day,
  parties: [],
  fileNumber: '',
}));

const normalizePhone = (value) => {
  if (!value) return '';
  const text = value.toString().trim();
  if (!text) return '';

  const candidateMatches = text.match(/\+?\d[\d\s\-()]{7,}\d/g) || [];
  const candidates = candidateMatches.length > 0 ? candidateMatches : [text];

  const firstValidCandidate = candidates.find((candidate) => {
    const digitsOnly = candidate.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  });

  if (!firstValidCandidate) return '';

  const startsWithPlus = firstValidCandidate.trim().startsWith('+');
  const digitsOnly = firstValidCandidate.replace(/\D/g, '');
  return startsWithPlus ? `+${digitsOnly}` : digitsOnly;
};

const resolvePartyPhone = (partyData = {}) => {
  const phoneCandidates = [
    partyData.contact,
    partyData.phone1,
    partyData.phone2,
    partyData.phone3,
    partyData.phone4,
  ];

  const firstValidPhone = phoneCandidates
    .map((candidate) => normalizePhone(candidate))
    .find((phone) => !!phone);

  return firstValidPhone || '';
};

export default function RouteSettings() {
  const [routes, setRoutes] = useState([]);
  const [parties, setParties] = useState({});
  const [loading, setLoading] = useState(true);
  const [partiesLoading, setPartiesLoading] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [creating, setCreating] = useState(false);

  const { currentCompanyId } = useCompany();

  const fetchParties = async () => {
    setPartiesLoading(true);
    try {
      const partiesCollection = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.PARTIES,
      );
      const partiesSnapshot = await getDocs(partiesCollection);
      const partiesData = {};

      partiesSnapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        partiesData[docSnapshot.id] = {
          name: data.name || data.partyName || 'Unknown Party',
          phone: resolvePartyPhone(data),
        };
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
      const routesCollection = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.MR_ROUTES,
      );
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

  const getPartyDetails = (partyId) => {
    return (
      parties[partyId] || {
        name: `Party ID: ${partyId}`,
        phone: '',
      }
    );
  };

  const getPartyName = (partyId) => {
    return getPartyDetails(partyId).name;
  };

  const getPartyPhone = (partyId) => {
    return getPartyDetails(partyId).phone;
  };

  const updateRouteInFirestore = async (routeId, updatedRouteArray) => {
    try {
      const routeRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.MR_ROUTES,
        routeId,
      );
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
      if (i !== dayIndex) return { ...day, day: DAYS_OF_WEEK[i] };
      if (day.parties?.includes(partyId))
        return { ...day, day: DAYS_OF_WEEK[i] };
      return {
        ...day,
        day: DAYS_OF_WEEK[i],
        parties: [...(day.parties || []), partyId],
      };
    });

    await updateRouteInFirestore(routeId, updatedRoute);
    setRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, route: updatedRoute } : r)),
    );
  };

  const removePartyFromDay = async (routeId, dayIndex, partyId) => {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const updatedRoute = route.route.map((day, i) => ({
      ...day,
      day: DAYS_OF_WEEK[i],
      parties:
        i === dayIndex
          ? (day.parties || []).filter((p) => p !== partyId)
          : day.parties || [],
    }));

    await updateRouteInFirestore(routeId, updatedRoute);
    setRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, route: updatedRoute } : r)),
    );
  };

  const savePartyPhone = async (partyId, phoneValue) => {
    const normalizedPhone = normalizePhone(phoneValue);
    try {
      const partyRef = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.PARTIES,
        partyId,
      );
      await updateDoc(partyRef, { contact: normalizedPhone });
      setParties((prev) => ({
        ...prev,
        [partyId]: {
          ...(prev[partyId] || { name: `Party ID: ${partyId}` }),
          phone: normalizedPhone,
        },
      }));
    } catch (error) {
      console.error('Error saving party phone:', error);
      throw error;
    }
  };

  const handleCreateRoute = async () => {
    const name = newRouteName.trim();
    if (!name || !currentCompanyId) return;
    setCreating(true);
    try {
      const routesCollection = getCompanyCollection(
        currentCompanyId,
        DB_NAMES.MR_ROUTES,
      );
      const newRoute = {
        name,
        route: EMPTY_WEEK.map((d) => ({ ...d, parties: [] })),
      };
      const created = await addDoc(routesCollection, newRoute);
      setRoutes((prev) => [...prev, { id: created.id, ...newRoute }]);
      setNewRouteName('');
      setAddDialogOpen(false);
    } catch (error) {
      console.error('Error creating route:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleCloseAddDialog = () => {
    if (creating) return;
    setNewRouteName('');
    setAddDialogOpen(false);
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
      <div className="route-settings-toolbar">
        <Button
          appearance="primary"
          icon={<AddRegular />}
          onClick={() => setAddDialogOpen(true)}
          disabled={!currentCompanyId}
        >
          Add Route
        </Button>
      </div>
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
              getPartyPhone={getPartyPhone}
              partiesLoading={partiesLoading}
              onAddParty={(dayIndex, partyId) =>
                addPartyToDay(route.id, dayIndex, partyId)
              }
              onRemoveParty={(dayIndex, partyId) =>
                removePartyFromDay(route.id, dayIndex, partyId)
              }
              onSavePartyPhone={savePartyPhone}
            />
          ))
        )}
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(_, data) => {
          if (!data.open) handleCloseAddDialog();
        }}
      >
        <DialogSurface style={{ maxWidth: 420 }}>
          <DialogBody>
            <DialogTitle>Add Route</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label htmlFor="new-route-name" required>
                  Route Name
                </Label>
                <Input
                  id="new-route-name"
                  value={newRouteName}
                  placeholder="e.g. North Route"
                  onChange={(e) => setNewRouteName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newRouteName.trim()) {
                      handleCreateRoute();
                    }
                  }}
                  autoFocus
                  disabled={creating}
                />
                <Text size={200} style={{ color: '#666' }}>
                  A new route is created with 7 empty days (Monday–Sunday). You
                  can add parties to each day after creating it.
                </Text>
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={handleCloseAddDialog}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleCreateRoute}
                disabled={creating || !newRouteName.trim()}
              >
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </center>
  );
}

function RouteComponent({
  route,
  parties,
  getPartyName,
  getPartyPhone,
  partiesLoading,
  onAddParty,
  onRemoveParty,
  onSavePartyPhone,
}) {
  const { settings } = useSettingsContext();
  const [expandedDays, setExpandedDays] = useState({});

  const toggleDayExpansion = (dayIndex) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayIndex]: !prev[dayIndex],
    }));
  };

  const daysOfWeek = DAYS_OF_WEEK;

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
                getPartyPhone={getPartyPhone}
                isExpanded={expandedDays[index]}
                onToggleExpansion={() => toggleDayExpansion(index)}
                partiesLoading={partiesLoading}
                onAddParty={(partyId) => onAddParty(index, partyId)}
                onRemoveParty={(partyId) => onRemoveParty(index, partyId)}
                onSavePartyPhone={onSavePartyPhone}
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
  getPartyPhone,
  isExpanded,
  onToggleExpansion,
  partiesLoading,
  onAddParty,
  onRemoveParty,
  onSavePartyPhone,
}) {
  const partyCount = routeDay.parties ? routeDay.parties.length : 0;
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPhoneForPartyId, setSavingPhoneForPartyId] = useState('');
  const [phoneDrafts, setPhoneDrafts] = useState({});

  const assignedPartyIds = new Set(routeDay.parties || []);
  const availableParties = Object.entries(parties)
    .filter(([id]) => !assignedPartyIds.has(id))
    .filter(
      ([, party]) =>
        !searchQuery ||
        (party?.name || '').toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => (a[1]?.name || '').localeCompare(b[1]?.name || ''));

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

  const handleSavePhone = async (partyId) => {
    setSavingPhoneForPartyId(partyId);
    try {
      await onSavePartyPhone(partyId, phoneDrafts[partyId] || '');
    } finally {
      setSavingPhoneForPartyId('');
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
                      <Text size={300} className="party-name-inline">
                        {getPartyName(partyId)}
                      </Text>
                      <Input
                        size="small"
                        placeholder="Enter phone number"
                        value={
                          phoneDrafts[partyId] !== undefined
                            ? phoneDrafts[partyId]
                            : getPartyPhone(partyId)
                        }
                        onChange={(e) =>
                          setPhoneDrafts((prev) => ({
                            ...prev,
                            [partyId]: e.target.value,
                          }))
                        }
                        disabled={savingPhoneForPartyId === partyId}
                        className="party-phone-input-inline"
                      />
                      <Button
                        appearance="primary"
                        size="small"
                        disabled={savingPhoneForPartyId === partyId}
                        onClick={() => handleSavePhone(partyId)}
                      >
                        {savingPhoneForPartyId === partyId
                          ? 'Saving...'
                          : 'Save'}
                      </Button>
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
                      availableParties.slice(0, 50).map(([id, party]) => (
                        <Option key={id} value={id} text={party.name}>
                          {party.name}
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
