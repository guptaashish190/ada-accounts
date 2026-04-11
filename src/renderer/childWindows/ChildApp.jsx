import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';

import { signInWithEmailAndPassword } from 'firebase/auth';
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
import MrDetailPanel from './mrDetailPanel/mrDetailPanel';

export default function App({ args }) {
  const isPrint = args.type === constants.printConstants.PRINT_CASHRECEIPT;

  useEffect(() => {
    if (isPrint) {
      window.print();
    }
  }, []);

  if (args.type === constants.windowConstants.MR_DETAIL) {
    return (
      <FluentProvider theme={webLightTheme}>
        <MrDetailPanel data={args.data} />
      </FluentProvider>
    );
  }

  if (isPrint) {
    return (
      <>
        <PrintCashReceipt data={args.printData} />

        <Button className="print-button" onClick={() => window.print()}>
          Print
        </Button>
      </>
    );
  }

  return <div>Type not found</div>;
}
