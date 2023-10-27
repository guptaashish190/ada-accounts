import { createRoot } from 'react-dom/client';
import ChildApp from './ChildApp';

const container = document.getElementById('root-child') as HTMLElement;
const root = createRoot(container);

root.render(<ChildApp />);
