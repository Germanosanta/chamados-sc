import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Central de Chamados Enterprise V3 — mesma identidade visual/PWA da V2
// (docs/manifest.json + docs/sw.js), servida a partir de uma pasta
// separada (v3/) sem afetar o deploy atual (firebase.json aponta
// hosting.public para "docs").
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest (não generateSW): o Service Worker é escrito à mão
      // em src/sw.ts, replicando a estratégia da V2 (precache mínimo do
      // shell, network-first para HTML/CSS/JS, cache-first para imagens,
      // fallback de navegação offline, handler de FCM em background) —
      // o plugin só injeta self.__WB_MANIFEST com os assets do build.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // dados históricos são grandes (chamados_historico.json ~340KB);
        // o precache do App Shell não deve tentar embutir tudo — o SW
        // decide o que cachear em runtime (mesma filosofia da V2).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      registerType: 'prompt', // nunca skipWaiting sozinho — mesmo princípio da V2
      manifest: {
        id: '/',
        name: 'Central de Chamados Enterprise — Santa Colomba',
        short_name: 'Chamados SC V3',
        description:
          'Central de Chamados da Santa Colomba Agropecuária — abertura, atendimento e histórico de chamados de campo.',
        // vite-plugin-pwa usa "en" por padrão se não for setado — o app
        // inteiro é pt-BR (mesmo idioma de <html lang="pt-BR"> em
        // index.html), confirmado divergente ao inspecionar o
        // manifest.webmanifest já publicado.
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f6fa',
        theme_color: '#2f6b4f',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          { src: 'assets/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: 'assets/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: 'assets/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: 'assets/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: 'assets/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: 'assets/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'assets/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: 'assets/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'assets/icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
