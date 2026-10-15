import { createRoot } from 'react-dom/client';
import { ChromeSettingsStore } from '../shared/settings';
import { Options } from './Options';

createRoot(document.getElementById('root')!).render(<Options store={new ChromeSettingsStore()} />);
