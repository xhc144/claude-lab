import { createRoot } from 'react-dom/client';
import { AppProvider } from './lib/store.tsx';
import { App } from './App.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <App />
  </AppProvider>,
);
