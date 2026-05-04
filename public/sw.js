// SPS Corner Service Worker v4.5.9
// Handles background push notifications and navigation

const CACHE_NAME = 'sps-corner-v4.5.9';
const OFFLINE_URL = '/offline.html';

// ─── INSTALL: cache critical assets ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/logos/sps-logo-icon.png',
      ]).catch(() => {
        // Ignore cache failures on install
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE: clear old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── FETCH: network-first strategy ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return; // Never cache API calls

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── PUSH: receive and display push notification ───────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'SPS Corner', body: event.data ? event.data.text() : 'Ada notifikasi baru', url: '/' };
  }

  const title = data.title || 'SPS Corner';
  const options = {
    body: data.body || data.message || 'Ada notifikasi baru',
    icon: '/logos/sps-logo-icon.png',
    badge: '/logos/sps-logo-icon.png',
    tag: data.tag || 'sps-notif',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || data.path || '/',
      notificationId: data.notificationId
    },
    actions: [
      { action: 'view', title: 'Lihat' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── NOTIFICATION CLICK: navigate to specific URL ─────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';
  const fullUrl = targetUrl.startsWith('http') ? targetUrl : self.location.origin + targetUrl;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open, focus and navigate
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// ─── MESSAGE: handle navigate command from notification click ──────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
