import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import { patchGlobalFetch } from './lib/api';

patchGlobalFetch();

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    sendDefaultPii: true,
    beforeSend(event) {
      if (
        event.message?.includes('updateFrom') ||
        event.exception?.values?.some(v => v.stacktrace?.frames?.some(f =>
          f.filename?.includes('backbone') || f.filename?.includes('chunk')
        ))
      ) {
        return null;
      }
      return event;
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
