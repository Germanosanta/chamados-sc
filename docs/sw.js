// A V2 foi desativada: a Central de Chamados agora é
// https://chamados-sc-v3.web.app. Este service worker substitui o antigo
// só para desligá-lo: apaga o cache, remove o próprio registro e recarrega
// as abas abertas, que caem no redirecionamento do index.html.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.map((n) => caches.delete(n))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((abas) => Promise.all(abas.map((aba) => aba.navigate(aba.url).catch(() => undefined)))),
  );
});
