/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// Precache semua aset (Dibutuhkan oleh VitePWA injectManifest)
precacheAndRoute(self.__WB_MANIFEST);

// Listener untuk menerima tembakan Web Push
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/logos/sps-logo-icon.png',
      badge: '/logos/sps-logo-icon.png',
      data: { url: payload.url || '/' } // Simpan URL untuk dibuka saat di-klik
    })
  );
});

// Listener saat pengguna men-klik notifikasi di layar kunci HP
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Fokus ke tab yang sudah terbuka, atau buka tab baru
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
