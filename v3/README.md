# Central de Chamados Enterprise — V3

[![V3 CI](https://github.com/Germanosanta/chamados-sc/actions/workflows/v3-ci.yml/badge.svg?branch=main)](https://github.com/Germanosanta/chamados-sc/actions/workflows/v3-ci.yml)

Reescrita da Central de Chamados em React 19 + TypeScript + Vite,
lendo/gravando o **mesmo Firebase** (projeto `chamdos-sc`) já usado pela
V2 (`../docs/`). Enquanto a V3 não for promovida oficialmente, a **V2
continua sendo a versão em produção** — esta pasta é isolada, não entra
no deploy do Firebase Hosting atual (`firebase.json` só publica `docs/`).

## Stack

React 19 · TypeScript (strict) · Vite 6 · Tailwind CSS · shadcn/ui ·
React Router · TanStack Query · Zustand · Firebase SDK modular v12 · PWA
(`vite-plugin-pwa`, `injectManifest`).

## Rodando localmente

```bash
cd v3
npm install
cp .env.example .env.local   # config pública do client Firebase — não é segredo
npm run dev
```

Outros scripts: `npm run typecheck` (tsc, sem emitir), `npm run lint`,
`npm run build` (type-check + build de produção), `npm run preview`.

## CI

O workflow [`v3-ci.yml`](../.github/workflows/v3-ci.yml) roda em todo
push/PR que toque `v3/**`: instala dependências (`npm ci` assim que
`package-lock.json` existir, `npm install` até lá), type-check, lint e
build — nessa ordem, parando no primeiro que falhar. Ainda não publica
nada; o job de deploy já está preparado no arquivo, porém comentado, para
quando a V3 substituir a V2 oficialmente.

## Pendências conhecidas

Ver plano/relatórios da sessão de migração para a lista completa
(sync offline com paridade total à V2, notificações push reais, "Sugestão
de IA" no Painel Operacional, decisão de onde a V3 será publicada).
