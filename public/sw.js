// Sehwa Buddha Academy Service Worker (PWA & Push Notifications)
const CACHE_NAME = 'sehwa-buddha-cache-v1';

// 1. Install & Activate Lifecycle
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 2. Local App Message (Trigger OS Push Notification from Web App)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const notificationOptions = {
      icon: '/images/logo.png',
      badge: '/images/favicon-96x96.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: options.tag || 'sehwa-enrollment-alert',
      renotify: true,
      requireInteraction: true, // Keep notification until user dismisses or clicks
      data: options.data || { url: '/#admin' },
      ...options
    };

    event.waitUntil(
      self.registration.showNotification(title, notificationOptions)
    );
  }
});

// 3. Web Push Event Listener (For remote push server triggers)
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 [세화붓다아카데미] 새로운 수강신청 접수',
    body: '새로운 강좌 수강신청이 도착했습니다. 관리자 CMS에서 확인하세요.',
    url: '/#admin'
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/images/logo.png',
    badge: '/images/favicon-96x96.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { url: data.url || '/#admin' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Notification Click Event -> Focus or Open PWA Window to /#admin
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/#admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this app
      for (let client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
