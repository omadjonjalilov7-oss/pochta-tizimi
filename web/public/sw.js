/* Asaka EDO — PWA service worker (web-push).
   iPhone Safari (16.4+) "Bosh ekranga qo'shish"dan keyin va brauzerlarda
   push bildirishnomalarni ko'rsatadi. Ilova yopiq/fonda bo'lsa ham ishlaydi. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Asaka EDO', body: 'Yangi bildirishnoma', data: {} };
  try {
    if (event.data) {
      payload = Object.assign(payload, event.data.json());
    }
  } catch (e) {
    try {
      payload.body = event.data ? event.data.text() : payload.body;
    } catch (e2) {
      // matnni ham ololmasak — standart matn qoladi
    }
  }

  const title = payload.title || 'Asaka EDO';
  const options = {
    body: payload.body || '',
    icon: '/asaka-logo.png',
    badge: '/asaka-logo.png',
    data: payload.data || {},
    tag: (payload.data && payload.data.tag) || undefined,
    renotify: !!(payload.data && payload.data.tag),
  };

  // Ilova ikonkasidagi o'qilmaganlar soni (Badging API) — push ichidagi
  // data.badge dan olinadi (ilova yopiq bo'lganда ham yangilanadi).
  const rawBadge = payload.data && payload.data.badge;
  const badgeCount =
    rawBadge !== undefined && rawBadge !== null && rawBadge !== ''
      ? parseInt(rawBadge, 10)
      : null;

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      try {
        if (badgeCount !== null && !isNaN(badgeCount) && self.navigator) {
          if (badgeCount > 0 && self.navigator.setAppBadge) {
            await self.navigator.setAppBadge(badgeCount);
          } else if (badgeCount <= 0 && self.navigator.clearAppBadge) {
            await self.navigator.clearAppBadge();
          }
        }
      } catch (e) {
        // Badging qo'llab-quvvatlanmasa — e'tiborsiz
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            if (client.navigate) {
              try {
                client.navigate(target);
              } catch (e) {
                // navigate qo'llab-quvvatlanmasa — shunchaki fokus
              }
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
      }),
  );
});
