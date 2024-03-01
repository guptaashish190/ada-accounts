/* eslint-disable react/jsx-no-constructed-context-values */
import { createContext, useContext, useEffect, useState } from 'react';
import { Spinner } from '@fluentui/react-components';
import globalUtils from '../services/globalUtils';
import firebaseApp, { firebaseAuth } from '../firebaseInit';
import Loader from '../common/loader';

const Context = createContext('');

export const useCurrentUser = () => {
  return useContext(Context);
};

export default function UserContext({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const getUser = async () => {
    try {
      const user1 = await globalUtils.fetchUserById(
        firebaseAuth.currentUser.uid,
      );
      setUser(user1);
      setLoading(false);
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    getUser();
  }, []);

  if (loading) {
    return <Loader />;
  }
  return <Context.Provider value={{ user }}>{children}</Context.Provider>;
}
