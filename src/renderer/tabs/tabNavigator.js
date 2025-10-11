import React, { useEffect, useState } from 'react';
import './tabNavigator.css';
import { Button, Image, Tab, TabList, Text, Badge } from '@fluentui/react-components';
import {
  SignOut20Filled,
  ArrowLeft12Filled as ArrowIcon,
  Person20Filled,
} from '@fluentui/react-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from '../assets/images/logo.png';

import { useCurrentUser } from '../contexts/userContext';
import constants from '../constants';
import tabs from './tabs';
import config from '../config';
import { firebaseAuth } from '../firebaseInit';

export default function TabNavigator({ children }) {
  const navigate = useNavigate();

  const [currentMenu, setCurrentMenu] = useState(0);
  const location = useLocation();
  const { user } = useCurrentUser();
  const { pathname, search, hash } = location;

  const filterJobs = (toFilter) => {
    if (toFilter) {
      return toFilter.filter((t) =>
        t.allowJob ? t.allowJob.some((x) => user.jobs?.includes(x)) : true,
      );
    }
    return [];
  };

  const filteredTabs =
    config.enableAllTabs || user.isManager ? tabs : filterJobs(tabs);
  const filteredSubmenu =
    config.enableAllTabs || user.isManager
      ? filteredTabs[currentMenu]?.submenu
      : filterJobs(filteredTabs[currentMenu]?.submenu);

  return (
    <div className="tab-navigator">
      <header className="tab-header">
        <div className="header-content">
          <div className="header-left">
            <Button
              size="small"
              appearance="subtle"
              className="back-button"
              onClick={() => navigate(-1)}
            >
              <ArrowIcon />
            </Button>
            <div className="logo-section">
              <Image width={32} height={32} src={Logo} className="logo" />
              <Text weight="semibold" className="app-title">ADA Accounts</Text>
            </div>
          </div>
          
          <div className="header-center">
            <TabList className="main-tabs" size="small">
              {filteredTabs.map((tab, i) => (
                <Tab
                  key={user.uid + tab.key}
                  value={tab.name}
                  className={`main-tab ${currentMenu === i ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentMenu(i);
                    navigate(tab.route || tab.submenu[0].route);
                  }}
                >
                  {tab.name}
                </Tab>
              ))}
            </TabList>
          </div>

          <div className="header-right">
            <div className="user-section">
              <div className="user-info">
                <Text size={200} weight="medium">{user?.username?.split(' ')[0]}</Text>
                {user.isManager && (
                  <Badge appearance="filled" color="brand" size="small">Manager</Badge>
                )}
              </div>
              <Button
                size="small"
                appearance="subtle"
                className="logout-button"
                onClick={() => {
                  firebaseAuth.signOut();
                }}
              >
                <SignOut20Filled />
              </Button>
            </div>
          </div>
        </div>
        
        {filteredSubmenu && filteredSubmenu.length > 0 && (
          <div className="submenu-section">
            <TabList className="submenu-tabs" size="small">
              {filteredSubmenu.map((sb) => (
                <Tab
                  key={user.uid + sb.key}
                  value={sb.name}
                  className="submenu-tab"
                  onClick={() => navigate(sb.route)}
                >
                  {sb.name}
                </Tab>
              ))}
            </TabList>
          </div>
        )}
      </header>
      
      <main className={`tab-content ${filteredSubmenu && filteredSubmenu.length > 0 ? 'with-submenu' : ''}`}>
        {children}
      </main>
    </div>
  );
}
