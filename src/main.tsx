import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { IndexedDbRepository } from './persistence/repository';
import { StoreProvider } from './state/store';
import './styles.css';

const repo = new IndexedDbRepository();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider repo={repo}><App /></StoreProvider>
  </StrictMode>,
);

// Pedir almacenamiento persistente: reduce el riesgo de que el navegador borre los datos solo.
navigator.storage?.persist?.().catch(() => {});

// Service worker solo en producción y en contexto seguro (https/localhost).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin offline, la app igual funciona */ });
}
