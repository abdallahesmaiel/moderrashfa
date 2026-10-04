/* Professional Admin Pro — PWA + Firebase Cloud Messaging */
const CACHE_NAME = 'professional-admin-pro-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon-32.png',
  './apple-touch-icon.png',
  './icon-72.png',
  './icon-96.png',
  './icon-120.png',
  './icon-144.png',
  './icon-152.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

/*
 * FCM background notifications.
 * If Firebase Messaging cannot load, the PWA service worker still continues
 * to work as a normal cache/service worker.
 */
let fcmMessagingReady = false;

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
    const notification = payload && payload.notification ? payload.notification : {};
    const data = payload && payload.data ? payload.data : {};

    const title = notification.title || data.title || 'تنبيه من لوحة التحكم';
    const body = notification.body || data.body || 'لديك تحديث جديد.';

    self.registration.showNotification(title, {
      body,
      icon: notification.icon || data.icon || './icon-192.png',
      badge: notification.badge || data.badge || './icon-72.png',
      tag: data.tag || notification.tag || 'admin-pro-notification',
      dir: 'rtl',
      lang: 'ar',
      renotify: true,
      data: {
        ...data,
        url: data.url || './index.html'
      }
    });
  });

  fcmMessagingReady = true;
} catch (error) {
  // Do not break PWA installation if Firebase Messaging is unavailable.
  console.warn('FCM background messaging unavailable:', error);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url ||
    './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
      .catch(() => {})
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const isNavigation = request.mode === 'navigate';

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (isNavigation) return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
