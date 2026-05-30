import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Unregister stale service worker (public/sw.js v4.5.9) to prevent
// cached HTML shell with broken JS chunk references on user devices.
(async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active?.scriptURL?.includes('sw.js')) {
        await reg.unregister();
        console.log('Unregistered old service worker:', reg.active.scriptURL);
      }
    }
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
