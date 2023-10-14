import React from 'react';
import './tabNavigator.css';
import { Tab, TabList, Text } from '@fluentui/react-components';
import { useNavigate } from 'react-router-dom';

export default function TabNavigator({ children }) {
  const navigate = useNavigate();
  const tabs = [
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
  ];

  return (
    <div className="tab-navigator">
      <div className="left">
        <TabList defaultSelectedValue={tabs[0].name} appearance="subtle">
          {tabs.map((tab) => {
            return (
              <Tab
                key={tab.key}
                value={tab.name}
                onClick={() => {
                  navigate(tab.route);
                }}
              >
                {tab.name}
              </Tab>
            );
          })}
        </TabList>
      </div>
      <div className="right">{children}</div>
    </div>
  );
}
