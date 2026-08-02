# Arquitetura — Central de Chamados V3

> Reflete o estado real do código em `v3/src` neste commit. A V2 (`docs/`,
> na raiz do projeto) é a versão em produção até a V3 ser promovida —
> nenhum destes documentos descreve a V2.

## Stack

| Camada | Tecnologia |
|---|---|
| Build | Vite 6 |
| UI | React 19 + TypeScript (strict) |
| Estilo | Tailwind CSS 3 + tokens próprios (`styles/globals.css`) + primitivos shadcn/ui escritos à mão (sem CLI, sem Node no ambiente de build) |
| Rotas | React Router 7 (`createBrowserRouter`, data router) |
| Estado de servidor (escrita) | TanStack Query 5 — só `useMutation` |
| Estado de servidor (leitura) | listener próprio sobre `onSnapshot` (`useFirestoreCollection`), tempo real |
| Estado de cliente | Zustand 5 (5 stores pequenos) |
| Backend | Firebase JS SDK 12 modular — **mesmo projeto/coleções da V2** |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/utilities` (Kanban) |
| Gráficos | `chart.js` + `react-chartjs-2` |
| Toasts | `sonner` |
| PWA | `vite-plugin-pwa` (`injectManifest`) + `src/sw.ts` próprio |

## Por que TanStack Query só para mutações

A V2 mantém um cache local (localStorage) sincronizado por `onSnapshot`
sobre coleções inteiras. A V3 reproduz esse mesmo padrão de "escutar a
coleção inteira em tempo real", mas via um hook próprio
(`hooks/useFirestoreCollection.ts`) que expõe o resultado como estado
React comum. TanStack Query entra só para dar loading/erro/retry a
**escritas** (`useMutation`), porque não há necessidade de um cache de
leitura adicional por cima de dados que já chegam em tempo real —
duplicaria a fonte de verdade. Não existe nenhum `useQuery` no código;
`QueryClient.defaultOptions.queries` fica configurado com valores
sensatos para o dia em que uma tela precisar de fato de uma leitura
não-realtime (paginação server-side, por exemplo).

## Deduplicação de listeners Firestore

Várias telas pedem a mesma coleção ao mesmo tempo — por exemplo
`chamados` é lido por Aberto, Todos, Encerrados, Criticidade, Dashboard,
Painel e pelo Centro Operacional (modal global sempre montado). Em vez
de cada `useFirestoreCollection('chamados')` abrir seu próprio
`onSnapshot`, existe um registro compartilhado em módulo
(`hooks/useFirestoreCollection.ts`): o primeiro componente que assina uma
coleção cria o listener; os seguintes reaproveitam o mesmo; o listener só
é desligado quando o último assinante desmonta.

## Fluxo de dados de um "chamado"

1. **Dataset histórico estático** — `src/data/chamados_historico.json`
   (array posicional de 7 campos, o mesmo formato embutido no bundle da
   V2) — nunca esteve no Firestore.
2. **Overrides em tempo real** — `chamados/{num}` no Firestore (criado a
   partir de Novo Chamado ou por qualquer edição feita na V2/V3).
3. **Encerramento/eventos** — `historico/{num}` (`.encerramento`,
   `.eventos[]`).

`hooks/useChamados.ts` faz o merge dessas três fontes num único tipo
`Chamado` (`types/chamado.ts`) por número de chamado — é só uma
normalização no cliente; os documentos gravados no Firestore continuam
exatamente no formato que a V2 já lê/escreve (ver `FIRESTORE.md`).

## `tsc -b` — 3 projetos, não 2

`tsconfig.json` referencia 3 sub-projetos: `tsconfig.app.json` (`src/`,
exceto `sw.ts`; lib `DOM`+`DOM.Iterable`), `tsconfig.node.json`
(`vite.config.ts`; lib `ES2023`) e `tsconfig.sw.json` (só `src/sw.ts`;
lib `WebWorker`, sem `DOM`). `sw.ts` precisa de tipos de Service Worker
(`ServiceWorkerGlobalScope`, `self.clients`, etc.) que colidem com a lib
`DOM` do projeto principal (as duas declaram `self` de formas
incompatíveis) — por isso ele fica isolado no próprio projeto de
referência, com sua própria lib e sem misturar com o app. Os 3 projetos
têm `composite: true` (exigência do TypeScript para qualquer projeto
referenciado por `tsc -b`).

## Estrutura de pastas

```
v3/src/
  components/
    ui/        primitivos shadcn (button, dialog, select, ...)
    shared/    componentes de domínio reutilizados entre páginas
  layouts/     AppShell, AuthLayout, ProtectedRoute, Sidebar, Topbar
  pages/       1 pasta por rota
  hooks/       useChamados, useEquipamentos, useUsuarios, useTecnicos,
               usePecas, useBancoSolucoes, useFirestoreCollection,
               useAuth, usePermission, useDashboardStats, useDebounce
  services/firebase/   app.ts, auth.ts, firestore.ts, audit.ts
  store/       session, theme, ui, detalhe, novoChamadoPrefill (Zustand)
  types/       1 tipo por domínio, espelhando os campos do Firestore
  utils/       chamado-helpers, sections, csv, chartSetup, cn
  data/        4 JSONs estáticos copiados de `projeto/data/`
  styles/      globals.css (tokens de cor/tipografia)
  sw.ts        Service Worker (ver PWA.md)
  router.tsx, App.tsx, main.tsx
```

## Decisões que não mudam sem decisão explícita de negócio

- Firebase/Firestore/Authentication/regras/coleções/estrutura de dados:
  idênticos aos da V2. A V3 lê e escreve os mesmos documentos.
- Fotos de chamados continuam só base64 em cache local (nunca vão ao
  Firestore) — mesma limitação de tamanho de documento da V2. Firebase
  Storage seria uma capacidade nova, não portada.
- Sessão em `browserSessionPersistence` (dura só a aba aberta) — decisão
  de segurança operacional preservada da V2 (terminais compartilhados).
