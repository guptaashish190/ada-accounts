import React, { useEffect, useState } from 'react';
import {
  Button,
  Dropdown,
  Option,
  Text,
  Textarea,
} from '@fluentui/react-components';
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

  const selectedPrinterLabel =
    printers.find((printer) => printer.displayName === selectedPrinter)
      ?.displayName || '';

  return (
    <div style={{ maxWidth: 760 }}>
      <Text size={200}>
        Select the default printer and update printer options.
      </Text>
      <VerticalSpace2 />

      <Text size={300} weight="semibold">
        Default Printer
      </Text>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Dropdown
          style={{ minWidth: 360 }}
          placeholder="Select printer"
          selectedOptions={selectedPrinter ? [selectedPrinter] : []}
          value={selectedPrinterLabel}
          onOptionSelect={(_, data) => {
            const picked = printers.find(
              (printer) => printer.displayName === data.optionValue,
            );
            if (picked) {
              setSelectedPrinterHandler(picked);
            }
          }}
        >
          {printers.map((printer) => (
            <Option key={printer.displayName} value={printer.displayName}>
              {printer.displayName}
            </Option>
          ))}
        </Dropdown>
        <Button onClick={() => sendMainMessage()} appearance="secondary">
          Reload Printers
        </Button>
      </div>

      <VerticalSpace2 />
      <Text size={300} weight="semibold">
        Printer Options
      </Text>
      <Textarea
        style={{ width: '100%', minHeight: '220px' }}
        size="large"
        placeholder="Printer Options"
        value={printerOptions}
        onChange={(e) => setPrinterOptions(e.target.value)}
      />
      <div style={{ marginTop: 8 }}>
        <Button onClick={() => setPrinterOptionsHandler()} appearance="primary">
          Save Printer Options
        </Button>
      </div>

      {selectedPrinter ? (
        <div style={{ marginTop: 12 }}>
          <Text size={200}>
            Current printer:{' '}
            <span style={{ color: constants.colors.success }}>
              {selectedPrinter}
            </span>
          </Text>
        </div>
      ) : null}
    </div>
  );
}
