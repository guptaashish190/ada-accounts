/* eslint-disable no-restricted-syntax */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Spinner,
  Card,
  CardHeader,
  CardPreview,
  Text,
  Badge,
} from '@fluentui/react-components';
import './style.css';
import { firebaseDB } from '../../../firebaseInit';
import { useSettingsContext } from '../../../contexts/settingsContext';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';

export default function RouteSettings() {
  const [routes, setRoutes] = useState([]);
  const [parties, setParties] = useState({});
  const [loading, setLoading] = useState(true);
  const [partiesLoading, setPartiesLoading] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(true);

  const fetchParties = async () => {
    setPartiesLoading(true);
    try {
      const partiesCollection = collection(firebaseDB, 'parties');
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
      const routesCollection = collection(firebaseDB, 'mr_routes');
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
  }, []);

  const getPartyName = (partyId) => {
    return parties[partyId] || `Party ID: ${partyId}`;
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
              getPartyName={getPartyName}
              partiesLoading={partiesLoading}
            />
          ))
        )}
      </div>
    </center>
  );
}

function RouteComponent({ route, getPartyName, partiesLoading }) {
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
                getPartyName={getPartyName}
                isExpanded={expandedDays[index]}
                onToggleExpansion={() => toggleDayExpansion(index)}
                partiesLoading={partiesLoading}
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
  getPartyName,
  isExpanded,
  onToggleExpansion,
  partiesLoading,
}) {
  const partyCount = routeDay.parties ? routeDay.parties.length : 0;

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

            if (routeDay.parties && routeDay.parties.length > 0) {
              return routeDay.parties.map((partyId) => (
                <div key={`party-${partyId}`} className="party-item">
                  <Text size={300}>{getPartyName(partyId)}</Text>
                </div>
              ));
            }

            return (
              <Text size={300} style={{ color: '#666' }}>
                No parties assigned to this day
              </Text>
            );
          })()}
        </div>
      )}
    </div>
  );
}
