# PWA — Central de Chamados V3

## Estratégia

`vite-plugin-pwa` com `strategies: 'injectManifest'` (não
`generateSW`) — o Service Worker é escrito à mão em `v3/src/sw.ts`,
igual à V2 (`docs/sw.js`); o plugin só injeta `self.__WB_MANIFEST` (lista
de precache com hash) no build de produção. Configurado em
`vite.config.ts`.

## Manifest

Campos principais (`vite.config.ts::VitePWA({ manifest: {...} })`):

| Campo | Valor |
|---|---|
| `name` | Central de Chamados Enterprise — Santa Colomba |
| `short_name` | Chamados SC V3 |
| `start_url` / `scope` | `/` |
| `display` | `standalone` |
| `background_color` | `#f4f6fa` |
| `theme_color` | `#2f6b4f` |
| `categories` | business, productivity, utilities |

## Ícones

9 tamanhos declarados no manifest, todos presentes em
`v3/public/assets/icons/` (servidos como caminho absoluto — por isso
ficam em `public/`, não em `src/assets/`, que é para assets importados
via JS e hasheados no build): `72, 96, 128, 144, 152, 192, 384, 512` +
`512-maskable` (`purpose: 'maskable'`, para Android adaptativo).
`index.html` referencia separadamente `favicon.ico`, `favicon-16x16.png`,
`favicon-32x32.png` e `apple-touch-icon.png` (mesma pasta).

## Tipagem do Service Worker

`self.__WB_MANIFEST` (a lista de precache injetada em build-time pelo
plugin) não existe no tipo padrão `ServiceWorkerGlobalScope` — é
aumentado manualmente em `sw.ts`
(`declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: ... }`,
padrão documentado do `vite-plugin-pwa`). `sw.ts` também é type-checado
sob seu próprio projeto de referência (`tsconfig.sw.json`, lib
`WebWorker`), separado do app principal — ver `ARQUITETURA.md`.

## Service Worker (`src/sw.ts`)

- **Precache**: `precacheAndRoute(self.__WB_MANIFEST)` — todo o build,
  já versionado por hash de arquivo (diferente da V2, que faz uma lista
  manual mínima do shell para não precisar manter sincronizada a cada
  deploy; aqui o build já gera a lista automaticamente).
- **Runtime — imagens**: `CacheFirst` (`chm-v3-images`).
- **Runtime — navegação (HTML)**: `NetworkFirst` (`chm-v3-shell`) — tenta
  rede primeiro, cai pro shell cacheado quando offline.
- **Atualização**: nunca chama `skipWaiting()` sozinho — só via mensagem
  `SKIP_WAITING` disparada pelo botão "Atualizar" do toast (ver abaixo).
  Mesma disciplina da V2: usuário nunca é recarregado sem confirmar.
- **FCM em background**: inicializa Firebase Messaging via scripts
  `compat` carregados por `importScripts` (SDK modular não roda dentro de
  Service Worker) com a mesma config pública do projeto. Fica pronto e
  inerte — não há Cloud Function do lado servidor enviando notificações
  ainda (ver `ROADMAP.md`).

## Registro e fluxo de atualização (`src/main.tsx`)

`registerSW()` (`virtual:pwa-register`) com:
- `onNeedRefresh()` → toast persistente ("Nova versão disponível") com
  ação "Atualizar" que chama `updateSW(true)`.
- `onOfflineReady()` → toast informativo ("App pronto para uso
  offline.").

## Offline

Cobertura atual: precache do shell + assets do build + cache-first de
imagens + fallback de navegação. **Não** existe fila de escrita offline
persistida entre reloads (a V2 tem uma engine própria de fila/reenvio) —
a V3 depende do pause/retry padrão de mutation do TanStack Query, que
cobre o caso comum (perdeu conexão no meio de uma escrita) mas não
sobrevive a um fechamento de aba. Ver `ROADMAP.md`.

## Instalação

Sem customização de prompt de instalação além do que o manifest padrão
do browser já oferece (`display: standalone` + ícones + `start_url`
habilitam o prompt nativo "Instalar app" em navegadores compatíveis).
