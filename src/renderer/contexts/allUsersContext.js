/* eslint-disable react/jsx-no-constructed-context-values */
import { createContext, useContext, useEffect, useState } from 'react';
import { Spinner } from '@fluentui/react-components';
import { collection, onSnapshot } from 'firebase/firestore';
import globalUtils from '../services/globalUtils';
import firebaseApp, { firebaseDB } from '../firebaseInit';
import Loader from '../common/loader';

const Context = createContext('');

export const useAuthUser = () => {
  return useContext(Context);
};

export default function AllUsersContext({ children }) {
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState();

  useEffect(() => {
    // Create a reference to the "users" collection
    const usersCollection = collection(firebaseDB, 'users');

    // Use onSnapshot to listen for changes in the collection
    const unsubscribe = onSnapshot(usersCollection, (querySnapshot) => {
      const userList = [];

      // Loop through the documents in the collection
      querySnapshot.forEach((doc) => {
        // Extract the data for each user
        const userData = doc.data();
        userList.push(userData);
      });

      // Update the state with the list of users
      setAllUsers(userList);
      setLoading(false);
    });

    // Clean up the listener when the component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <Loader />;
  }
  return <Context.Provider value={{ allUsers }}>{children}</Context.Provider>;
}
