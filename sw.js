/* Professional Admin Pro — PWA + Firebase Cloud Messaging */
const CACHE_NAME = 'professional-admin-pro-v4';
const APP_SHELL = [
  './', './index.html', './manifest.json', './favicon-32.png',
  './apple-touch-icon.png', './icon-72.png', './icon-96.png',
  './icon-120.png', './icon-144.png', './icon-152.png', './icon-180.png',
  './icon-192.png', './icon-512.png'
];

try {
  importScripts(
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js'
  );
  firebase.initializeApp({
    apiKey: 'AIzaSyARX12v1lvgKaFhIoYWRtv1Nqxpt8zz8HE',
    authDomain: 'rashfa-9d95d.firebaseapp.com',
    databaseURL: 'https://rashfa-9d95d-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'rashfa-9d95d',
    storageBucket: 'rashfa-9d95d.firebasestorage.app',
    messagingSenderId: '973516999258',
    appId: '1:973516999258:web:e71f8d42efd8e461e0a663'
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const data = payload?.data || {};
    const title = data.title || 'تنبيه من لوحة التحكم';
    const body = data.body || 'لديك تحديث جديد.';
    self.registration.showNotification(title, {
      body,
      icon: data.icon || './icon-192.png',
      badge: data.badge || './icon-72.png',
      tag: data.tag || `admin-${Date.now()}`,
      renotify: true,
      requireInteraction: false,
      dir: 'rtl',
      lang: 'ar',
      data: { ...data, url: data.url || './index.html' },
      vibrate: [200, 100, 200]
    });
  });
} catch (error) {
  console.warn('FCM background messaging unavailable:', error);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : null;
    }).catch(() => {})
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const request = event.request;
  const isNavigation = request.mode === 'navigate';
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        if (response?.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || (isNavigation ? caches.match('./index.html') : Response.error())))
  );
});
