import React, { useEffect, useState } from 'react';
import { Button, Card } from '@fluentui/react-components';
import { VerticalSpace2 } from '../../common/verticalSpace';
import constants from '../../constants';

export default function PrinterSettings() {
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState();

  const sendMainMessage = async () => {
    const pr = await window.electron.ipcRenderer.sendMessage(
      'fetch-printers',
      [],
    );

    window.electron.ipcRenderer.on('all-printers', (args) => {
      console.log(args);
      setPrinters(args.list);
      setSelectedPrinter(args.selectedPrinter);
    });
  };

  useEffect(() => {
    sendMainMessage();
  }, []);

  const setSelectedPrinterHandler = (data) => {
    window.electron.ipcRenderer.sendMessage(
      'set-selected-printer',
      data.displayName,
    );
  };

  return (
    <div>
      <Button onClick={() => sendMainMessage()}>Reload Printers</Button>
      <VerticalSpace2 />
      {printers.map((pri, i) => (
        <Button
          appearance="subtle"
          onClick={() => {
            setSelectedPrinterHandler(pri);
          }}
        >
          {i + 1}.&nbsp;&nbsp;{pri.displayName} &nbsp;&nbsp;&nbsp;
          {selectedPrinter === pri.displayName ? (
            <span style={{ color: constants.colors.success }}>Selected</span>
          ) : null}
        </Button>
      ))}
    </div>
  );
}
