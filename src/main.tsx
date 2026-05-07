import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

let updateSW: (reload?: boolean) => Promise<void>;

// Register service workermanually (bypass virtual:pwa-register type issues)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (confirm('Versi baru aplikasi tersedia. Muat ulang untuk memperbarui?')) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        });
      }
    });
    updateSW = (reload = false) => {
      if (reload) window.location.reload();
      return registration.update();
    };
    console.log('Service Worker registered:', registration.scope);
  }).catch((err) => {
    console.warn('Service Worker registration failed:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
