/* eslint-disable react/jsx-no-constructed-context-values */
import { createContext, useContext, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Spinner } from '@fluentui/react-components';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import globalUtils from '../services/globalUtils';
import firebaseApp, { firebaseDB } from '../firebaseInit';

const Context = createContext('');

export const useSettingsContext = () => {
  return useContext(Context);
};

export default function SettingsContext({ children }) {
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState();

  useEffect(() => {
    const settingsCollection = collection(firebaseDB, 'settings');

    const unsubscribe = onSnapshot(settingsCollection, (querySnapshot) => {
      const settingsList = {};

      querySnapshot.forEach((doc1) => {
        settingsList[doc1.id] = doc1.data();
      });

      console.log(settingsList);

      setSettings(settingsList);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <Spinner />;
  }
  return <Context.Provider value={{ settings }}>{children}</Context.Provider>;
}
