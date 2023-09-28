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
    },
    {
      name: 'All Supply Reports',
      route: '/allSupplyReports',
    },
    {
      name: 'Pending Supply Reports',
      route: '/pendingSupplyReports',
    },
    {
      name: 'Receive Supply Reports',
      route: '/receiveSupplyReports',
    },
    {
      name: 'Search Bills',
      route: '/searchBills',
    },
  ];

  return (
    <div className="tab-navigator">
      <div className="left">
        <TabList defaultSelectedValue={tabs[0].name} appearance="subtle">
          {tabs.map((tab) => {
            return (
              <Tab
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
