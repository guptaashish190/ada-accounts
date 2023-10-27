import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';

import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  FluentProvider,
  webLightTheme,
  Button,
  Toaster,
  useId,
  createLightTheme,
  createDarkTheme,
} from '@fluentui/react-components';
import { useEffect } from 'react';

export default function App({ printData }) {
  useEffect(() => {
    console.log(printData);
  }, []);

  return <div>Test di</div>;
}
