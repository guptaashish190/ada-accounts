/* eslint-disable import/extensions */
/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import fs from 'fs';
import {
  PosPrintData,
  PosPrinter,
  PosPrintOptions,
} from '@3ksy/electron-pos-printer';
import Store from 'electron-store';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
const childWindows = new Map<string, BrowserWindow>();
let allPrinters: Array<Object>;
const store = new Store();
let selectedPrinter: string;
let printerOptions: string = '{}';

const getChildWindowKey = (args: any): string => {
  const type = args?.type || 'UNKNOWN';
  const data = args?.data || {};

  if (data.windowInstanceId) {
    return `${type}:${data.windowInstanceId}`;
  }

  if (type === 'VIEW_SUPPLY_REPORT') {
    const reportId = data?.prefillSupplyReport?.id || data?.supplyReportId;
    return reportId ? `${type}:${reportId}` : `${type}:${Date.now()}`;
  }

  if (type === 'RECEIVE_SUPPLY_REPORT') {
    const entityId = data?.supplyReport?.id;
    const scope = data?.isBundle ? 'bundle' : 'sr';
    return entityId ? `${type}:${scope}:${entityId}` : `${type}:${Date.now()}`;
  }

  if (type === 'VIEW_VOUCHER') {
    const voucherId = data?.voucherData?.id;
    return voucherId ? `${type}:${voucherId}` : `${type}:${Date.now()}`;
  }

  if (type === 'MR_DETAIL') {
    const mrUid = data?.mrUid || 'unknown';
    const selectedDate = data?.selectedDate || 'today';
    const isSupplyman = data?.isSupplyman ? 'supply' : 'mr';
    return `${type}:${isSupplyman}:${mrUid}:${selectedDate}`;
  }

  // For forms/workflows, default to unique instances so in-progress work
  // is never overridden by a fresh open action.
  if (type === 'CREATE_SUPPLY_REPORT' || type === 'ASSIGN_BILLS') {
    return `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  }

  return `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
};

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.on('fetch-printers', async (event, arg) => {
  let list;
  if (mainWindow) {
    list = await mainWindow.webContents.getPrintersAsync();
    allPrinters = list;
  }
  event.sender.send('all-printers', { list, selectedPrinter });
});

ipcMain.on('set-selected-printer', async (event, arg) => {
  store.set('selected-printer', arg);
  selectedPrinter = arg;

  event.sender.send('all-printers', { list: allPrinters, selectedPrinter });
});

ipcMain.on('set-printer-options', async (event, arg) => {
  store.set('printer-options', arg);
  printerOptions = arg;
  event.sender.send('printer-options', { options: arg });
});

ipcMain.on('fetch-printer-options', async (event, arg) => {
  const opt = store.get('printer-options');
  console.log(opt);
  if (opt) {
    event.sender.send('printer-options', { options: opt });
  }
});
ipcMain.on('goBack', async (event, arg) => {
  mainWindow?.webContents.goBack();
  console.log('Go back trigger');
});

ipcMain.on('open-file-dialog', (event) => {
  if (!mainWindow) return;
  dialog
    .showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }],
    })
    .then((result) => {
      if (!result.canceled) {
        event.reply('selected-files', result.filePaths);
        console.log(result.filePaths);
      }
    })
    .catch((err) => {
      console.error(err);
    });
});

const onPrint = async (data: PosPrintData[]) => {
  const options: PosPrintOptions = {
    preview: true,
    copies: 1,
    silent: false,
    printerName: selectedPrinter,
    timeOutPerLine: 400,
    pageSize: '58mm',
  };

  PosPrinter.print(data, { ...options, ...JSON.parse(printerOptions) });
};
function printCurrentPage() {
  if (mainWindow) {
    mainWindow.webContents.print({
      pageSize: 'A4',
      margins: {
        marginType: 'none',
      },
      landscape: false,
      printBackground: true,
    });
    // mainWindow.webContents
    //   .printToPDF({
    //     pageSize: 'A4',
    //     landscape: false,
    //     margins: {
    //       top: 0,
    //       left: 2,
    //       right: 2,
    //       bottom: 10,
    //     },
    //     printBackground: true,
    //   })
    //   .then((val) => {
    //     fs.writeFile('output.pdf', val, (error) => {
    //       // getTitle of Window

    //       if (error) throw error;
    //       console.log('Write PDF successfully.');
    //     });
    //   })
    //   .catch((e) => {
    //     console.log(e);
    //   });
  }
}

ipcMain.on('printCurrentPage', async (event, arg) => {
  printCurrentPage();
});
ipcMain.on('print', async (event, arg) => {
  onPrint(arg);
});

ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', {
    version: autoUpdater.currentVersion.version,
  });
});
autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update_downloaded');
});
autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('download_progress', {
    progress: progressObj.percent,
  });
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}
const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    icon: getAssetPath('icon.png'),

    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          frame: false,
          fullscreenable: false,
          backgroundColor: 'white',
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
          },
        },
      };
    }
    return { action: 'deny' };
  });

  selectedPrinter = store.get('selected-printer');

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });
  ipcMain.emit('main-window-route');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle the "new-window" event
ipcMain.on('new-window', (event, args) => {
  const isMrDetail = args && args.type === 'MR_DETAIL';
  const isViewSupplyReport = args && args.type === 'VIEW_SUPPLY_REPORT';
  const isReceiveSupplyReport =
    args && args.type === 'RECEIVE_SUPPLY_REPORT';
  const isCreateSupplyReport = args && args.type === 'CREATE_SUPPLY_REPORT';
  const isViewVoucher = args && args.type === 'VIEW_VOUCHER';
  const isAssignBills = args && args.type === 'ASSIGN_BILLS';
  const isPrintCashReceipt = args && args.type === 'PRINT_CASH_RECEIPT';
  const winWidth = isMrDetail
    ? 1100
    : isViewSupplyReport
      ? 1200
      : isPrintCashReceipt
        ? 700
      : isAssignBills
        ? 1300
      : isViewVoucher
        ? 950
      : isCreateSupplyReport
        ? 1200
      : isReceiveSupplyReport
        ? 1150
        : 800;
  const winHeight = isMrDetail
    ? 750
    : isViewSupplyReport
      ? 850
      : isPrintCashReceipt
        ? 900
      : isAssignBills
        ? 850
      : isViewVoucher
        ? 820
      : isCreateSupplyReport
        ? 850
      : isReceiveSupplyReport
        ? 760
        : 600;
  const childTitle = isViewSupplyReport
    ? 'Supply Report'
    : isPrintCashReceipt
      ? 'Print Cash Receipt'
    : isAssignBills
      ? 'Assign Bills'
    : isViewVoucher
      ? 'View Voucher'
    : isCreateSupplyReport
      ? 'Create Supply Report'
    : isMrDetail
      ? 'MR Detail'
      : isReceiveSupplyReport
        ? 'Receive Supply Report'
        : 'Child Window';

  const childWindowKey = getChildWindowKey(args);
  const existingWindow = childWindows.get(childWindowKey);

  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.isMinimized()) {
      existingWindow.restore();
    }
    existingWindow.focus();
    return;
  }

  const newChildWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    title: childTitle,
    webPreferences: {
      devTools:
        isMrDetail ||
        isViewSupplyReport ||
        isPrintCashReceipt ||
        isAssignBills ||
        isViewVoucher ||
        isReceiveSupplyReport ||
        isCreateSupplyReport,
      nodeIntegration: true,
      webSecurity: true,
      contextIsolation: true,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  childWindows.set(childWindowKey, newChildWindow);
  newChildWindow.loadURL(resolveHtmlPath('childindex.html'));

  newChildWindow.webContents.on('did-finish-load', () => {
    newChildWindow.webContents.send('child-window-args', args);
  });

  newChildWindow.on('closed', () => {
    childWindows.delete(childWindowKey);
  });
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
