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
import { app, BrowserWindow, shell, ipcMain } from 'electron';
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
let childWindow: BrowserWindow | null = null;
let allPrinters: Array<Object>;
const store = new Store();
let selectedPrinter: string;
let printerOptions: string = '{}';

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

  console.log(arg);

  event.sender.send('printer-options', { options: arg });
});

ipcMain.on('fetch-printer-options', async (event, arg) => {
  const opt = store.get('printer-options');
  console.log(opt);
  if (opt) {
    event.sender.send('printer-options', { options: opt });
  }
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
        marginType: 'custom',
        bottom: 100,
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
  if (childWindow) {
    // If the child window already exists, you can bring it to the front and pass args to it
    childWindow.show();
    childWindow.webContents.send('child-window-args', args);
  } else {
    // Create a new child window and pass args to it
    childWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        devTools: false,
        nodeIntegration: true,
        contextIsolation: true,
        preload: app.isPackaged
          ? path.join(__dirname, 'preload.js')
          : path.join(__dirname, '../../.erb/dll/preload.js'),
      },
    });
    childWindow.loadURL(resolveHtmlPath('childindex.html'));

    childWindow.webContents.on('did-finish-load', () => {
      childWindow?.webContents.send('child-window-args', args);
    });

    childWindow.on('closed', () => {
      childWindow = null;
    });
  }
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
