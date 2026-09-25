import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DbProvider } from './db/context';
import { App } from './ui/App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider>
      <App />
    </DbProvider>
  </StrictMode>,
);
