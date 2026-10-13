import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AccountProvider } from './cloud/account';
import { StoreProvider } from './state/store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>{(repo, key) => <StoreProvider key={key} repo={repo}><App /></StoreProvider>}</AccountProvider>
  </StrictMode>,
);

// Pedir almacenamiento persistente: reduce el riesgo de que el navegador borre los datos solo.
navigator.storage?.persist?.().catch(() => {});

// Service worker solo en producción y en contexto seguro (https/localhost).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* sin offline, la app igual funciona */ });
}
