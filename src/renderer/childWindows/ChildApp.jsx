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
import constants from '../constants';
import PrintCashReceipt from './printCashReceipt/printCasheReceipt';

export default function App({ args }) {
  useEffect(() => {
    window.print();
  }, []);

  if (args.type === constants.printConstants.PRINT_CASHRECEIPT) {
    return <PrintCashReceipt data={args.printData} />;
  }

  return <div>Type not found</div>;
}
