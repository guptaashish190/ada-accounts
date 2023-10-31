import { createRoot } from 'react-dom/client';
import App from './App';

try {
  const container = document.getElementById('root') as HTMLElement;
  const root = createRoot(container);
  root.render(<App />);
} catch (e) {
  console.log(e);
}
