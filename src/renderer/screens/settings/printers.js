import React, { useEffect, useState } from 'react';
import { Button, Card, Textarea } from '@fluentui/react-components';
import { VerticalSpace2 } from '../../common/verticalSpace';
import constants from '../../constants';

export default function PrinterSettings() {
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState();
  const [printerOptions, setPrinterOptions] = useState('');

  const sendMainMessage = async () => {
    const pr = await window.electron.ipcRenderer.sendMessage(
      'fetch-printers',
      [],
    );
    const pr1 = await window.electron.ipcRenderer.sendMessage(
      'fetch-printer-options',
      [],
    );

    window.electron.ipcRenderer.on('all-printers', (args) => {
      console.log(args);
      setPrinters(args.list);
      setSelectedPrinter(args.selectedPrinter);
    });
    window.electron.ipcRenderer.on('printer-options', (args) => {
      setPrinterOptions(args.options);
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
  const setPrinterOptionsHandler = (data) => {
    window.electron.ipcRenderer.sendMessage(
      'set-printer-options',
      printerOptions,
    );
  };

  return (
    <div>
      <Button onClick={() => sendMainMessage()}>Reload Printers</Button>
      <br />
      <br />
      <Textarea
        style={{ width: '300px', height: '400px' }}
        size="large"
        placeholder="Printer Options"
        value={printerOptions}
        onChange={(e) => setPrinterOptions(e.target.value)}
      />
      <Button onClick={() => setPrinterOptionsHandler()}>
        Set Printer Options
      </Button>
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
