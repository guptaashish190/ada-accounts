import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Input,
  Label,
  Option,
  Spinner,
} from '@fluentui/react-components';
import { useCompany } from '../../contexts/companyContext';
import {
  ROUTE_WEEKDAYS,
  fetchPartyRouteAssignment,
  weekdayIndexFromDate,
} from './collectionService';

export default function PartyEditDialog({
  open,
  party,
  routes,
  defaultWeekday,
  onClose,
  onSave,
}) {
  const { currentCompanyId } = useCompany();
  const fallbackWeekday =
    defaultWeekday ?? weekdayIndexFromDate(new Date());
  const [creditDays, setCreditDays] = useState('');
  const [contact, setContact] = useState('');
  const [routeId, setRouteId] = useState('miscellaneous');
  const [routeWeekday, setRouteWeekday] = useState(fallbackWeekday);
  const [saving, setSaving] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    if (!open || !party) return undefined;
    setCreditDays(
      party.creditDays != null && party.creditDays !== ''
        ? String(party.creditDays)
        : '',
    );
    setContact(party.contact || '');
    setRouteId(party.routeId || 'miscellaneous');
    setRouteWeekday(
      party.routeWeekday != null ? party.routeWeekday : fallbackWeekday,
    );

    const needsRoute = !party.routeId || party.routeId === 'miscellaneous';
    const needsWeekday = party.routeWeekday == null;
    if (!needsRoute && !needsWeekday) return undefined;

    let cancelled = false;
    const load = async () => {
      setLoadingRoute(true);
      try {
        const assignment = await fetchPartyRouteAssignment(
          currentCompanyId,
          party.partyId,
        );
        if (cancelled || !assignment) return;
        setRouteId((current) =>
          current === 'miscellaneous' ? assignment.routeId : current,
        );
        setRouteWeekday((current) =>
          party.routeWeekday == null ? assignment.routeWeekday : current,
        );
      } catch (error) {
        console.error('Error loading party route:', error);
      } finally {
        if (!cancelled) setLoadingRoute(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, party, currentCompanyId, fallbackWeekday]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ creditDays, contact, routeId, routeWeekday });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const routeLabel =
    routeId === 'miscellaneous'
      ? 'Miscellaneous'
      : routes.find((route) => route.id === routeId)?.name || 'Miscellaneous';
  const weekdayLabel =
    ROUTE_WEEKDAYS[routeWeekday] || ROUTE_WEEKDAYS[fallbackWeekday];

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{party?.partyName || 'Party'}</DialogTitle>
          <DialogContent>
            <div className="party-edit-field">
              <Label htmlFor="party-contact">Contact</Label>
              <Input
                id="party-contact"
                type="tel"
                value={contact}
                placeholder="Phone number"
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div className="party-edit-field">
              <Label htmlFor="party-credit-days">Credit days</Label>
              <Input
                id="party-credit-days"
                type="number"
                min={1}
                max={120}
                value={creditDays}
                placeholder="Not set"
                onChange={(e) => setCreditDays(e.target.value)}
              />
            </div>
            <div className="party-edit-field">
              <Label htmlFor="party-route">Route</Label>
              <Dropdown
                id="party-route"
                value={routeLabel}
                selectedOptions={[routeId]}
                disabled={loadingRoute}
                onOptionSelect={(_, data) => setRouteId(data.optionValue)}
              >
                <Option value="miscellaneous">Miscellaneous</Option>
                {routes.map((route) => (
                  <Option key={route.id} value={route.id}>
                    {route.name}
                  </Option>
                ))}
              </Dropdown>
            </div>
            <div className="party-edit-field">
              <Label htmlFor="party-weekday">Weekday</Label>
              <Dropdown
                id="party-weekday"
                value={weekdayLabel}
                selectedOptions={[String(routeWeekday)]}
                disabled={loadingRoute || routeId === 'miscellaneous'}
                onOptionSelect={(_, data) =>
                  setRouteWeekday(parseInt(data.optionValue, 10))
                }
              >
                {ROUTE_WEEKDAYS.map((day, index) => (
                  <Option key={day} value={String(index)}>
                    {day}
                  </Option>
                ))}
              </Dropdown>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="subtle" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            {saving || loadingRoute ? (
              <Spinner size="tiny" />
            ) : (
              <Button appearance="primary" onClick={handleSave}>
                Save
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
