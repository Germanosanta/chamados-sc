// ══════════════════════════════════════════
// SERVICE WORKER — Central de Chamados SC (Fase 4)
// ══════════════════════════════════════════
//
// Estratégia deliberadamente conservadora — é o primeiro Service Worker
// deste site em produção, e um SW mal escrito é o tipo de erro que
// "gruda" no navegador do usuário até o próximo deploy corrigir:
//
// - Pré-cache só dos pontos de entrada garantidos (index.html/
//   manifest.json). Todo o resto (CSS/JS/dados/imagens) é cacheado em
//   tempo real conforme o uso normal do app (network-first) — sem lista
//   fixa de arquivos versionados pra manter sincronizada a cada deploy,
//   e sem risco de a instalação inteira falhar por causa de 1 arquivo.
// - Nunca chama skipWaiting() sozinho — só quando o usuário clica no
//   banner "Nova versão disponível" (core/init.js). Ninguém é recarregado
//   sem confirmar.
// - Mesma intenção dos headers HTTP já definidos em firebase.json:
//   HTML/CSS/JS/dados = network-first (sempre tenta o mais recente,
//   cache só entra offline); imagens = cache-first (coerente com o
//   max-age=86400 já configurado lá).

const CACHE_VERSION = '20260802a';
const CACHE_NAME    = 'chm-shell-' + CACHE_VERSION;
const CORE_ASSETS   = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((e) => console.warn('[SW] Precache do app shell falhou:', e.message))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith('chm-shell-') && n !== CACHE_NAME)
             .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Disparado pelo banner de atualização (core/init.js) só depois do clique
// explícito do usuário — nunca automático.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const IMG_EXT = /\.(png|jpe?g|svg|gif|webp|ico)(\?|$)/i;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // escrita não passa por aqui (Firestore usa seu próprio canal, não fetch)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // só o próprio site — Firestore/gstatic seguem direto pra rede

  if (IMG_EXT.test(url.pathname)) {
    // Imagens — cache-first
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // HTML/CSS/JS/dados — network-first, cai pro cache só se a rede falhar
  event.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      return res;
    }).catch(() =>
      caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
    )
  );
});

// ── Firebase Cloud Messaging (Fase 4) ──────────────────────────────────
// Necessário mesmo nesta etapa (só notificação local via onSnapshot, ver
// chamados/index.js) porque getToken() do SDK de Messaging exige um
// Service Worker registrado para funcionar. O handler de mensagem em
// segundo plano abaixo é o mínimo padrão do Firebase — só passa a
// receber alguma coisa quando o envio servidor-side (Cloud Function,
// pendência desta fase) existir; até lá fica pronto e inerte.
try {
  importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: "AIzaSyDalH6I1uHQyW5cfZresj-Q9EieGk58g54",
    authDomain: "chamdos-sc.firebaseapp.com",
    projectId: "chamdos-sc",
    storageBucket: "chamdos-sc.firebasestorage.app",
    messagingSenderId: "813048921429",
    appId: "1:813048921429:web:5cccf543918d5b0dbb83dc",
  });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Central de Chamados';
    const body  = payload.notification?.body  || '';
    self.registration.showNotification(title, { body, icon: 'assets/img/coa.jpeg' });
  });
} catch (e) {
  console.warn('[SW] Firebase Messaging não inicializado:', e.message);
}
