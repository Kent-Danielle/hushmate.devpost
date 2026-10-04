// Hushmate service worker. No offline caching: it exists for push notifications only.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const FALLBACK = { title: 'Hushmate', body: 'Someone nearby could use some quiet.' };

// Reads the declarative envelope {web_push, notification: {title, body, tag, navigate, data}}.
// Anything unreadable falls back to a generic notification: a push with no notification makes Safari revoke permission.
function readEnvelope(event) {
  try {
    const n = event.data && event.data.json().notification;
    if (n && typeof n.title === 'string') return n;
  } catch (err) {
    // fall through to the fallback
  }
  return FALLBACK;
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const n = readEnvelope(event);
      const type = (n.data && n.data.type) || 'nudge';
      await self.registration.showNotification(n.title || FALLBACK.title, {
        body: n.body || FALLBACK.body,
        tag: n.tag || 'nudge',
        renotify: true,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        lang: 'en',
        data: { type, url: n.navigate || '/schedule' },
      });
      // Tell open pages, so the nudge overlay shows without waiting for a refocus.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '/schedule';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: data.type || 'nudge', url, clicked: true });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
