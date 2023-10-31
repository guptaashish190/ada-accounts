import { createRoot } from 'react-dom/client';
import ChildApp from './ChildApp';

try {
  window.electron.ipcRenderer.on('child-window-args', (arg) => {
    const container = document.getElementById('root-child') as HTMLElement;
    const root = createRoot(container);
    root.render(<ChildApp args={arg} />);
  });
} catch (e) {
  console.log(e);
}
