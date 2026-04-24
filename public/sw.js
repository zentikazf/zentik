// Service Worker para Web Push Notifications
// Recibe pushes del servidor, muestra notificaciones del SO, y maneja clicks.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Zentik', body: event.data.text() };
  }

  const title = payload.title || 'Zentik';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-badge.png',
    tag: payload.tag,
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
    // silent false para que el SO reproduzca su sonido por default
    silent: false,
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));

  // Si hay un cliente abierto, avisar via postMessage (para sonido custom si quisieran)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((c) => {
        try {
          c.postMessage({ type: 'push-received', payload });
        } catch {}
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Si ya hay una ventana abierta en la misma origin, enfocarla y navegar
        for (const client of clients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              return client.navigate(url);
            }
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // El navegador invalido la suscripcion — el cliente debera re-suscribirse al reabrir.
  // No podemos llamar al backend sin auth valida desde aca. Solo loggear.
  console.log('[SW] pushsubscriptionchange — el cliente debera re-subscribirse');
});
