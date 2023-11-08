import React, { useEffect, useState } from 'react';
import firebase from 'firebase/app'; // Make sure to import the Firebase SDK
import { getAuth } from 'firebase/auth';
import { Spinner } from '@fluentui/react-components';
import LoginScreen from './login/login';

function LoginWrapper({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if a user is already signed in using Firebase
    const unsubscribe = getAuth().onAuthStateChanged((authUser) => {
      if (authUser) {
        // User is signed in
        setUser(authUser);
        setLoading(false);
      } else {
        // User is not signed in
        setUser(null);
        setLoading(false);
      }
    });

    // Clean up the subscription when the component unmounts
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  if (user) {
    // User is logged in, render the children
    return <div>{children}</div>;
  }
  // User is not logged in, show the LoginScreen
  return <LoginScreen />;
}

export default LoginWrapper;
