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
// Anti-spam: simpan tag notifikasi yang baru ditampilkan; payload identik
// (retry jaringan / double-trigger backend) tidak akan memunculkan notifikasi ulang.
const recentlyShownTags = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;

self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil(
    (async () => {
      try {
        const payload = event.data.json();
        // Tag mengandung path (biasanya memuat ID transaksi/event) → unik per kejadian.
        const tag = payload.tag || `sps-${payload.url || 'notif'}`;
        const now = Date.now();
        const lastShown = recentlyShownTags.get(tag);
        if (lastShown && now - lastShown < DEDUP_WINDOW_MS) return; // duplikat: abaikan
        recentlyShownTags.set(tag, now);
        // Bersihkan entri lama agar map tidak tumbuh tanpa batas.
        for (const [key, ts] of recentlyShownTags) {
          if (now - ts > DEDUP_WINDOW_MS) recentlyShownTags.delete(key);
        }

        await self.registration.showNotification(payload.title || 'SPS Corner', {
          body: payload.body || 'Anda memiliki pemberitahuan baru',
          icon: '/logos/sps-logo-icon.png',
          badge: '/logos/sps-logo-icon.png',
          vibrate: [200, 100, 200],
          // renotify:false → notifikasi dengan tag yang sama TIDAK bergetar/muncul ulang;
          // notifikasi lama cukup diganti isinya, bukan mengganggu lagi.
          renotify: false,
          tag,
          data: { url: payload.url || '/' } // Simpan URL untuk dibuka saat di-klik
        } as any);
      } catch (error) {
        console.error("Push payload error", error);
      }
    })()
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
