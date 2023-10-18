import React, { useState } from 'react';
import './tabNavigator.css';
import { Tab, TabList, Text } from '@fluentui/react-components';
import { useNavigate } from 'react-router-dom';

export default function TabNavigator({ children }) {
  const navigate = useNavigate();
  const [currentMenu, setCurrentMenu] = useState(0);
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
      route: '/settings',
      key: 'tab-settings',
    },
  ];

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
