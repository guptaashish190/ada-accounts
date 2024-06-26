import React, { useEffect, useState } from 'react';
import './tabNavigator.css';
import { Button, Image, Tab, TabList, Text } from '@fluentui/react-components';
import {
  SignOut20Filled,
  ArrowLeft12Filled as ArrowIcon,
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
      <div className="left">
        <TabList className="menu-container">
          <div className="tab-options">
            <Button
              size="small"
              onClick={() => {
                navigate(-1);
              }}
            >
              <ArrowIcon />
            </Button>
            {filteredTabs.map((tab, i) => {
              return (
                <Tab
                  key={user.uid + tab.key}
                  value={tab.name}
                  onClick={() => {
                    setCurrentMenu(i);
                    navigate(tab.route || tab.submenu[0].route);
                  }}
                >
                  {tab.name}
                </Tab>
              );
            })}
          </div>
          <div className="tab-options right-options">
            <Image className="profile-pic-tab" src={user.profilePicture} />
            <Button
              key="logout-buttpn"
              appearance="subtle"
              onClick={() => {
                firebaseAuth.signOut();
              }}
            >
              <SignOut20Filled />
              {user?.username?.split(' ')[0]}
            </Button>
            <Image width={40} src={Logo} />
          </div>
        </TabList>
        <TabList className="submenu-container">
          {filteredSubmenu?.map((sb) => {
            return (
              <Tab
                key={user.uid + sb.key}
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
