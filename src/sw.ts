/// <reference lib="webworker" />
import { clientsClaim, skipWaiting } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// Precache semua aset (Dibutuhkan oleh VitePWA injectManifest)
precacheAndRoute(self.__WB_MANIFEST);

// ─────────────────────────────────────────────────────
// Listener untuk menerima pesan dari halaman utama (foreground notification)
// ─────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'SPS Corner', { 
        body: body || '',
        icon: '/logos/sps-logo-icon.png',
        badge: '/logos/sps-logo-icon.png',
        tag: 'sps-notification',
        data: { url: url || '/' }
       } as any)
    );
  }
});

// Listener untuk menerima tembakan Web Push (dari server - app tertutup)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const payload = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification(payload.title || 'SPS Corner', { 
        body: payload.body || 'Anda memiliki pemberitahuan baru',
        icon: '/logos/sps-logo-icon.png',
        badge: '/logos/sps-logo-icon.png',
        vibrate: [200, 100, 200, 100, 200, 100, 200], // Memicu getar dan suara default OS
        requireInteraction: true, // Menempel di status bar / lockscreen
        data: { url: payload.url || '/' } // Simpan URL untuk dibuka saat di-klik
       } as any)
    );
  } catch (error) {
    console.error("Push payload error", error);
  }
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
