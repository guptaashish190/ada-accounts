/* eslint-disable react/jsx-no-constructed-context-values */
import { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firebaseDB } from '../firebaseInit';
import Loader from '../common/loader';
import { useCompany } from './companyContext';

const Context = createContext('');

export const useAuthUser = () => {
  return useContext(Context);
};

export default function AllUsersContext({ children }) {
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState();
  const { currentCompanyId } = useCompany();

  useEffect(() => {
    setLoading(true);
    const usersCollection = collection(firebaseDB, 'users');
    const q = query(
      usersCollection,
      where('companyId', '==', currentCompanyId),
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userList = [];
      querySnapshot.forEach((doc) => {
        const userData = { ...doc.data(), id: doc.id };
        userList.push(userData);
      });
      setAllUsers(userList);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [currentCompanyId]);

  if (loading) {
    return <Loader />;
  }
  return <Context.Provider value={{ allUsers }}>{children}</Context.Provider>;
}
