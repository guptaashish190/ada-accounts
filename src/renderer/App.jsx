import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import './firebaseInit';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  FluentProvider,
  webLightTheme,
  Button,
  Toaster,
  useId,
} from '@fluentui/react-components';
import { useEffect } from 'react';
import icon from '../../assets/icon.svg';
import CreateSupplyReportScreen from './screens/createSupplyReport/createSupplyReport';
import UserContext from './contexts/userContext';
import AllUsersContext from './contexts/allUsersContext';
import constants from './constants';
import TabNavigator from './screens/tabNavigator';
import AllSupplyReportsScreen from './screens/allSupplyReports/allSupplyReports';

export default function App() {
  const testLogin = async () => {
    const auth = getAuth();
    await signInWithEmailAndPassword(auth, 'pintu@gmail.com', 'password');
  };
  useEffect(() => {
    testLogin();
  }, []);

  return (
    <FluentProvider theme={webLightTheme}>
      <AllUsersContext>
        <UserContext>
          <Router>
            <TabNavigator>
              <Routes>
                <Route path="/" element={<CreateSupplyReportScreen />} />
                <Route
                  path="/allSupplyReports"
                  element={<AllSupplyReportsScreen />}
                />
              </Routes>
            </TabNavigator>
          </Router>
        </UserContext>
      </AllUsersContext>
    </FluentProvider>
  );
}
