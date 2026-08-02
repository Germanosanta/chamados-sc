/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */

// Service Worker da V3 — mesma estratégia de docs/sw.js (V2), adaptada
// pro build hash-versionado do Vite:
// - Precache do build inteiro via self.__WB_MANIFEST (injetado pelo
//   vite-plugin-pwa/workbox-build no build de produção) — diferente da
//   V2 (que precache só o shell mínimo à mão, pra não manter uma lista
//   manual sincronizada a cada deploy), aqui a lista já vem
//   automaticamente do build e cada arquivo tem hash no nome, então
//   precachear tudo é seguro e não fica desatualizado.
// - Runtime: imagens em cache-first; navegação (HTML) em network-first
//   com fallback pro shell cacheado quando offline — mesmo princípio da
//   V2, via workbox-strategies em vez de escrito à mão.
// - Nunca skipWaiting() sozinho — só quando o usuário confirma no banner
//   de atualização (src/main.tsx registra isso via virtual:pwa-register).
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// self.__WB_MANIFEST não existe no tipo padrão de ServiceWorkerGlobalScope —
// é injetado em build-time pelo vite-plugin-pwa/workbox-build (padrão
// documentado do plugin para o modo injectManifest).
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'chm-v3-images',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
  new NetworkFirst({ cacheName: 'chm-v3-shell' }),
);

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

// ── Firebase Cloud Messaging (background) — mesma config real da V2,
// necessária mesmo antes do envio servidor-side existir (getToken() do
// SDK de Messaging exige um Service Worker registrado). Fica pronto e
// inerte até a Cloud Function de envio existir (ver Pendências).
try {
  importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');
  // @ts-expect-error — firebase compat scripts anexam `firebase` no escopo global do worker
  firebase.initializeApp({
    apiKey: 'AIzaSyDalH6I1uHQyW5cfZresj-Q9EieGk58g54',
    authDomain: 'chamdos-sc.firebaseapp.com',
    projectId: 'chamdos-sc',
    storageBucket: 'chamdos-sc.firebasestorage.app',
    messagingSenderId: '813048921429',
    appId: '1:813048921429:web:5cccf543918d5b0dbb83dc',
  });
  // @ts-expect-error — idem
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload: any) => {
    const title = payload.notification?.title || 'Central de Chamados';
    const body = payload.notification?.body || '';
    self.registration.showNotification(title, { body, icon: '/assets/icons/icon-192x192.png' });
  });
} catch (e) {
  console.warn('[SW] Firebase Messaging não inicializado:', e);
}
