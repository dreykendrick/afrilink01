// Winger Push Notification Service Worker Handler
// This file is imported by the main PWA service worker

self.addEventListener('push', (event) => {
  let data = { title: 'Winger', body: 'You have a new notification', type: 'info' };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    // If JSON parse fails, try text
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || `afrilink-${Date.now()}`,
    data: {
      url: data.url || data.link || '/',
      type: data.type || 'info',
    },
    vibrate: [200, 100, 200],
    actions: [],
    requireInteraction: data.type === 'warning' || data.type === 'error',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (url !== '/') {
            client.navigate(url);
          }
          return;
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  // Analytics tracking could go here
  console.log('[sw-push] Notification closed:', event.notification.tag);
});
