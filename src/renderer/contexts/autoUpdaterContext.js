/* eslint-disable react/jsx-no-constructed-context-values */
import { createContext, useContext, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import {
  Spinner,
  Toaster,
  useId,
  useToastController,
} from '@fluentui/react-components';
import globalUtils from '../services/globalUtils';
import firebaseApp from '../firebaseInit';
import Loader from '../common/loader';
import { showToast } from '../common/toaster';

export default function AutoUpdaterWrapper({ children }) {
  const [version, setVersion] = useState('');
  const [progressPercentage, setProgressPercentage] = useState(0);
  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('app_version');
    window.electron.ipcRenderer.on('app_version', (arg) => {
      setVersion(arg.version);
    });
    window.electron.ipcRenderer.on('update_available', () => {
      showToast(dispatchToast, 'New update available!', 'success');
      showToast(dispatchToast, 'Downloading new update', 'success');
    });
    window.electron.ipcRenderer.on('update_downloaded', () => {
      showToast(dispatchToast, 'Downloaded new update', 'success');
      showToast(dispatchToast, 'Restart to install', 'success');
    });
    window.electron.ipcRenderer.on('download_progress', (progressObj) => {
      setProgressPercentage(Math.round(progressObj.progress));
    });
  }, []);

  return (
    <>
      <Toaster toasterId={toasterId} />
      {children}
      <div className="version-name">
        Version {version}{' '}
        {progressPercentage
          ? `(Downloading Update ${progressPercentage}%)`
          : ''}
      </div>
    </>
  );
}
