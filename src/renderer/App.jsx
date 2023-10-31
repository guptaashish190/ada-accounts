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
  createLightTheme,
  createDarkTheme,
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
import ReceiveSupplyReportScreen from './screens/receiveSupplyReport/receiveSupplyReportList';
import ReceiveSRScreen from './screens/receiveSupplyReport/receiveSRScreen/receiveSRScreen';
import AllBillsScreen from './screens/allBills/allBills';
import PaymentReceipts from './screens/paymentReceipts/paymentReceipts';
import CreatePaymentReceiptDialog from './screens/paymentReceipts/createPaymentReceiptDialog/createPaymentReceiptDialog';
import ChequesScreen from './screens/cheques/cheques';
import AssignBillScreen from './screens/assignBills/assignBillsScreen';
import SettingsScreen from './screens/settings/settings';
import SettingsContext from './contexts/settingsContext';
import AllBundlesScreen from './screens/bundles/bundlesScreen';
import ViewBundleScreen from './screens/bundles/viewBundle/viewBundle';
import ReceiveBundle from './screens/bundles/receiveBundle/receiveBundle';
import CreditNoteScreen from './screens/creditNote/creditNoteScreen';
import CreateCreditNoteScreen from './screens/creditNote/createCreditNotes/createCNScreen';
import PartyListScreen from './screens/settings/partyList/partyList';
import PartyDetailsScreen from './screens/settings/partyList/partyDetails/partyDetails';
import LoginWrapper from './loginWrapper';
import UpiScreen from './screens/upi/upiScreen';

const myNewTheme = {
  10: '#010304',
  20: '#0A191E',
  30: '#0C2934',
  40: '#0D3546',
  50: '#104258',
  60: '#174F6A',
  70: '#225D7C',
  80: '#2E6A8E',
  90: '#3D77A0',
  100: '#4D85B1',
  110: '#5F93C2',
  120: '#71A0D2',
  130: '#85AEE0',
  140: '#9BBCEC',
  150: '#B1CAF5',
  160: '#C8D8FB',
};

const lightTheme = {
  ...createLightTheme(myNewTheme),
};

const darkTheme = {
  ...createDarkTheme(myNewTheme),
};

export default function App({ routeProps, startRoute, printData }) {
  return (
    <FluentProvider theme={lightTheme}>
      <LoginWrapper>
        <AllUsersContext>
          <UserContext>
            <SettingsContext>
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
                    <Route path="/searchBills" element={<AllBillsScreen />} />
                    <Route
                      path="/receiveSRScreen"
                      element={<ReceiveSRScreen />}
                    />
                    <Route
                      path="/paymentReceipts"
                      element={<PaymentReceipts />}
                    />
                    <Route
                      path="/createPaymentReceipts"
                      element={<CreatePaymentReceiptDialog />}
                    />
                    <Route path="/chequesList" element={<ChequesScreen />} />
                    <Route path="/assignBills" element={<AssignBillScreen />} />
                    <Route path="/settings" element={<SettingsScreen />} />
                    <Route path="/bundles" element={<AllBundlesScreen />} />
                    <Route path="/viewBundle" element={<ViewBundleScreen />} />
                    <Route path="/receiveBundle" element={<ReceiveBundle />} />
                    <Route path="/creditNotes" element={<CreditNoteScreen />} />
                    <Route
                      path="/partyListSettings"
                      element={<PartyListScreen />}
                    />
                    <Route
                      path="/createCreditNotes"
                      element={<CreateCreditNoteScreen />}
                    />
                    <Route
                      path="/partyDetails"
                      element={<PartyDetailsScreen />}
                    />
                    <Route path="/upi" element={<UpiScreen />} />
                  </Routes>
                </TabNavigator>
              </Router>
            </SettingsContext>
          </UserContext>
        </AllUsersContext>
      </LoginWrapper>
    </FluentProvider>
  );
}
