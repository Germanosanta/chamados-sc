# Central de Chamados Enterprise — V3

[![V3 CI](https://github.com/Germanosanta/chamados-sc/actions/workflows/v3-ci.yml/badge.svg?branch=main)](https://github.com/Germanosanta/chamados-sc/actions/workflows/v3-ci.yml)
[![V3 Deploy](https://github.com/Germanosanta/chamados-sc/actions/workflows/v3-deploy.yml/badge.svg?branch=main)](https://github.com/Germanosanta/chamados-sc/actions/workflows/v3-deploy.yml)

Reescrita da Central de Chamados em React 19 + TypeScript + Vite,
lendo/gravando o **mesmo Firebase** (projeto `chamdos-sc`) já usado pela
V2 (`../docs/`). Enquanto a V3 não for promovida oficialmente, a **V2
continua sendo a versão em produção** (`chamados-sc.web.app`) — a V3
publica em **homologação**, num site de Hosting separado
(`chamados-sc-v3.web.app`), sem afetar a V2. Detalhe completo do deploy:
[`docs/DEPLOY.md`](docs/DEPLOY.md).

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

## CI e Deploy

- [`v3-ci.yml`](../.github/workflows/v3-ci.yml) — roda em todo push/PR
  que toque `v3/**`: instala dependências (`npm ci` assim que
  `package-lock.json` existir, `npm install` até lá), type-check, lint e
  build, em 2 versões de Node — nessa ordem, parando no primeiro que
  falhar. Não publica nada.
- [`v3-deploy.yml`](../.github/workflows/v3-deploy.yml) — roda a cada
  push em `main` que toque `v3/**`: builda e publica em
  `chamados-sc-v3.web.app` (Firebase Hosting, canal `live`).

Detalhe completo de ambos + comandos do Firebase CLI + rollback:
[`docs/BUILD.md`](docs/BUILD.md) e [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Pendências conhecidas

Ver [`docs/ROADMAP.md`](docs/ROADMAP.md) para a lista completa e
atualizada (sync offline com paridade total à V2, notificações push
reais, "Sugestão de IA" no Painel Operacional).
