import React, { useState } from 'react';
import './tabNavigator.css';
import { Button, Tab, TabList, Text } from '@fluentui/react-components';
import { SignOut20Filled } from '@fluentui/react-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { useCurrentUser } from '../contexts/userContext';

const tabs = [
  {
    name: 'Supply Report',
    route: '/',
    key: 'tab-supply-report',
    submenu: [
      {
        name: 'Create Supply Report',
        route: '/',
        key: 'tab-create-supply-report',
      },
      {
        name: 'All Supply Reports',
        route: '/allSupplyReports',
        key: 'tab-allSupplyReports',
      },
      {
        name: 'Pending Supply Reports',
        route: '/pendingSupplyReports',
        key: 'tab-pendingSupplyReports',
      },
      {
        name: 'Receive Supply Reports',
        route: '/receiveSupplyReports',
        key: 'tab-receiveSupplyReports',
      },
    ],
  },
  {
    name: 'Search Bills',
    route: '/searchBills',
    key: 'tab-searchBills',
  },
  {
    name: 'UPI',
    route: '/upi',
    key: 'tab-upi',
  },
  {
    name: 'Payment Receipts',
    route: '/paymentReceipts',
    key: 'tab-paymentreceipts',
  },
  {
    name: 'Cheques',
    route: '/chequesList',
    key: 'tab-chequesList',
  },
  {
    name: 'Bundles',
    route: '/bundles',
    key: 'tab-bundles',
    submenu: [
      {
        name: 'All Bundles',
        route: '/bundles',
        key: 'tab-bundles',
      },
      {
        name: 'Create Bill Bundle',
        route: '/assignBills',
        key: 'tab-assignbills',
      },
    ],
  },
  {
    name: 'Settings',
    route: '/partyListSettings',
    key: 'tab-settings',
    submenu: [
      {
        name: 'Parties',
        route: '/partyListSettings',
        key: 'tab-settings',
      },
      {
        name: 'File Numbers',
        route: '/settings',
        key: 'tab-settings-filen',
      },
    ],
  },
  {
    name: 'Credit Notes',
    route: '/creditNotes',
    key: 'tab-creditNotes',
    submenu: [
      {
        name: 'Credit Notes',
        route: '/creditNotes',
        key: 'tab-creditNotes',
      },
      {
        name: 'Create C/N',
        route: '/createCreditNotes',
        key: 'tab-createcreditNotes',
      },
    ],
  },
];
export default function TabNavigator({ children }) {
  const navigate = useNavigate();
  const [currentMenu, setCurrentMenu] = useState(0);
  const location = useLocation();
  const { user } = useCurrentUser();
  const { pathname, search, hash } = location;

  return (
    <div className="tab-navigator">
      <div className="left">
        <TabList className="menu-container">
          {tabs.map((tab, i) => {
            return (
              <Tab
                key={tab.key}
                value={tab.name}
                onClick={() => {
                  setCurrentMenu(i);
                  navigate(tab.route);
                }}
              >
                {tab.name}
              </Tab>
            );
          })}
          <Button
            key="logout-buttpn"
            appearance="subtle"
            onClick={() => {
              getAuth().signOut();
            }}
          >
            <SignOut20Filled /> {user?.username}
          </Button>
        </TabList>
        <TabList className="submenu-container">
          {tabs[currentMenu].submenu?.map((sb) => {
            return (
              <Tab
                key={sb.key}
                value={sb.name}
                onClick={() => {
                  navigate(sb.route);
                }}
              >
                {sb.name}
              </Tab>
            );
          })}
        </TabList>
      </div>
      <div className="right">{children}</div>
    </div>
  );
}
