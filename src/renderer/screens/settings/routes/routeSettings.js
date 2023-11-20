/* eslint-disable no-restricted-syntax */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Dropdown,
  Input,
  Option,
  Spinner,
} from '@fluentui/react-components';
import { CheckmarkCircle16Filled } from '@fluentui/react-icons';
import './style.css';
import { firebaseDB } from '../../../firebaseInit';
import { useSettingsContext } from '../../../contexts/settingsContext';
import { VerticalSpace1, VerticalSpace2 } from '../../../common/verticalSpace';

export default function RouteSettings() {
  const [routes, setRoutes] = useState([]);

  const [loading, setLoading] = useState(false);
  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const routesCollection = collection(firebaseDB, 'mr_routes');
      const routesSnapshot = await getDocs(routesCollection);
      const routesData = routesSnapshot.docs.map((doc1) => ({
        id: doc1.id,
        ...doc1.data(),
      }));
      setRoutes(routesData);
    } catch (error) {
      console.error('Error fetching routes: ', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRoutes();
  }, []);
  return (
    <center>
      <h3>Route Settings</h3>
      {loading ? <Spinner /> : null}
      <div className="route-container">
        {routes.map((r, routeIndex) => {
          return (
            <RouteComponent
              key={`routesettings-${r.id}`}
              routeData={r}
              routeIndex={routeIndex}
              setLoading={setLoading}
              refreshRoutes={fetchRoutes}
            />
          );
        })}
      </div>
    </center>
  );
}

function RouteComponent({ routeData, routeIndex, setLoading, refreshRoutes }) {
  const { settings } = useSettingsContext();
  const [fileNumberSettings, setFileNumberSettings] = useState(routeData);

  const onFileNumberChange = (index, value) => {
    const newData = { ...fileNumberSettings };
    newData.route[index].fileNumber = value;
    setFileNumberSettings(newData);
  };
  const onSave = async () => {
    setLoading(true);
    try {
      const batch = [];

      for (const { fileNumber, parties } of fileNumberSettings.route) {
        for (const partyId of parties) {
          const partyRef = doc(firebaseDB, 'parties', partyId);
          batch.push({
            ref: partyRef,
            data: {
              fileNumber: fileNumber || '',
            },
          });
        }
      }

      // Commit the batched updates
      await runTransaction(firebaseDB, async (transaction) => {
        batch.forEach(({ ref, data }) => {
          transaction.update(ref, data);
        });
      });

      // Update fileNumber in the route data
      const routeRef = doc(firebaseDB, 'mr_routes', routeData.id);
      const routeDataSnapshot = await getDoc(routeRef);
      const routeDataSnapshot1 = routeDataSnapshot.data();
      routeDataSnapshot1.route = fileNumberSettings.route;
      await updateDoc(routeRef, routeDataSnapshot1); // Update with the new file number

      refreshRoutes();
      console.log('Parties updated successfully!');
    } catch (error) {
      console.error('Error updating parties: ', error);
      setLoading(false);
    }
  };

  return (
    <div className="route-day-container">
      <h3>{fileNumberSettings.name}</h3>

      {fileNumberSettings.route.map((routeDay, i) => {
        return (
          <RouteDayRow
            fileNumberSettings={fileNumberSettings}
            routeDay={routeDay}
            originalRouteDay={routeData.route[i]}
            onFileNumberChange={(v) => onFileNumberChange(i, v)}
          />
        );
      })}
      <VerticalSpace1 />
      <Button onClick={() => onSave()}>Save</Button>
      <VerticalSpace2 />
    </div>
  );
}

function RouteDayRow({
  fileNumberSettings,
  routeDay,
  originalRouteDay,
  onFileNumberChange,
}) {
  return (
    <div
      className="routesettingsday"
      key={`routesettingsday-${fileNumberSettings.name}${routeDay.day}`}
    >
      {routeDay.day}&nbsp;&nbsp;
      <Input
        contentAfter={
          routeDay?.fileNumber === originalRouteDay?.fileNumber ? (
            <CheckmarkCircle16Filled color="lightgreen" />
          ) : null
        }
        style={{
          border: '1px solid #ddd',
        }}
        placeholder="File Number"
        value={routeDay.fileNumber || ''}
        onChange={(e) => onFileNumberChange(e.target.value)}
      />
    </div>
  );
}
