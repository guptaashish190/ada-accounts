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
import ViewSupplyReportScreen from './screens/viewSupplyReport/viewSupplyReport';
import PendingSupplyReports from './screens/pendingSupplyReports/pendingSupplyReports';
import VerifySupplyReport from './screens/verifySupplyReport/verifySupplyReport';
import ReceiveSupplyReportScreen from './screens/receiveSupplyReport/receiveSupplyReport';

export default function App() {
  const testLogin = async () => {
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, 'pintu@gmail.com', 'password');
    } catch (e) {
      console.log(e);
    }
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
                  path="/viewSupplyReport"
                  element={<ViewSupplyReportScreen />}
                />
                <Route
                  path="/allSupplyReports"
                  element={<AllSupplyReportsScreen />}
                />
                <Route
                  path="/pendingSupplyReports"
                  element={<PendingSupplyReports />}
                />
                <Route
                  path="/verifySupplyReport"
                  element={<VerifySupplyReport />}
                />
                <Route
                  path="/receiveSupplyReports"
                  element={<ReceiveSupplyReportScreen />}
                />
              </Routes>
            </TabNavigator>
          </Router>
        </UserContext>
      </AllUsersContext>
    </FluentProvider>
  );
}