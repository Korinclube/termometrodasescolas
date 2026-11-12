/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Service Worker: Termômetro das Escolas RJ
 * Notificações Push & Alertas de Estresse Térmico Crítico
 */

const CACHE_NAME = 'termometro-escolas-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

// 1. Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Aviso no precache estático:', err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Ativação e limpeza de caches obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Recebimento de Notificação Push Remota (Web Push API)
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'Alerta de Calor Escolar', body: event.data.text() };
    }
  }

  const title = payload.title || '🚨 ALERTA DE PERIGO TÉRMICO — RJ';
  const schoolName = payload.schoolName || 'Escola Monitorada';
  const heatIndex = payload.heatIndex ? Number(payload.heatIndex).toFixed(1) : '44.0';
  const level = payload.level || 'NC4 / NC5';
  const body = payload.body || `Índice de Calor previsto de ${heatIndex} ºC em ${schoolName}. Limite de perigo da Secretaria ultrapassado!`;

  const options = {
    body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: `thermal-alert-${payload.schoolId || 'general'}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 400],
    data: {
      url: payload.url || `/?schoolId=${payload.schoolId || ''}&tab=school`,
      schoolId: payload.schoolId,
      heatIndex,
      level,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'view_school', title: '📋 Ver Ficha & Protocolo' },
      { action: 'dismiss', title: '✕ Dispensar' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 4. Interação do Usuário ao Clicar na Notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se houver uma aba aberta, foca nela e envia a mensagem com os dados da escola
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_OPEN_SCHOOL',
            schoolId: notificationData.schoolId,
            heatIndex: notificationData.heatIndex,
            level: notificationData.level,
            action: event.action || 'view_school',
          });
          return client.focus();
        }
      }
      // Caso não haja aba aberta, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 5. Comunicação Direta com a Aplicação React (Message Channel)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Disparo de notificação local acionado pelo frontend
  if (event.data.type === 'TRIGGER_THERMAL_ALERT') {
    const { title, body, schoolId, schoolName, heatIndex, level, rioLevel, peakHour } = event.data;

    const notificationTitle = title || `🚨 PERIGO TÉRMICO — ${schoolName || 'Escola'}`;
    const notificationBody =
      body ||
      `Previsão de Índice de Calor de ${heatIndex ? Number(heatIndex).toFixed(1) : ''} ºC (${rioLevel || 'Nível Crítico'}). Limite da Secretaria ultrapassado no turno!`;

    const options = {
      body: notificationBody,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: `thermal-alert-${schoolId || 'general'}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 200, 400],
      data: {
        url: `/?schoolId=${schoolId || ''}&tab=school`,
        schoolId,
        schoolName,
        heatIndex,
        level,
        peakHour,
        timestamp: Date.now(),
      },
      actions: [
        { action: 'view_school', title: '📋 Ver Ficha & Protocolo' },
        { action: 'dismiss', title: '✕ Dispensar' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, options).then(() => {
        // Confirma envio de volta ao cliente se uma porta foi fornecida
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true, timestamp: Date.now() });
        }
      })
    );
  }

  // Ping de status
  if (event.data.type === 'PING_SW') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        type: 'PONG_SW',
        version: '1.0.0',
        active: true,
        timestamp: Date.now(),
      });
    }
  }
});
