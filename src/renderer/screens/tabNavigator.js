import React from 'react';
import './tabNavigator.css';
import { Text } from '@fluentui/react-components';
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
  ];

  return (
    <div className="tab-navigator">
      <div className="left">
        {tabs.map((tab) => {
          return (
            <button
              type="button"
              onClick={() => {
                navigate(tab.route);
              }}
              onKeyDown={() => {
                navigate(tab.route);
              }}
              className="tab-container"
            >
              {tab.name}
            </button>
          );
        })}
      </div>
      <div className="right">{children}</div>
    </div>
  );
}
