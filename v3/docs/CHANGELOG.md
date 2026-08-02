# Changelog — Central de Chamados V3

Datas/commits reais (`git log -- v3/`). Cada linha resume o que o commit
mudou; detalhe completo em cada mensagem de commit.

## Fase 7 — reorganização de UX (Chamados em Aberto, Centro Operacional, Equipamentos)
Sem navegador disponível nesta sessão — mudanças de estrutura/hierarquia
de informação, verificadas por leitura de código + CI (type-check/lint/
build), não por inspeção visual. Ver `ROADMAP.md` para o que ainda
depende de um navegador real.

- **Design system**: `KpiCard` ganhou variante `compact` (menos padding/
  peso — pra indicador secundário que não deve competir com o KPI
  primário); `DataTable` ganhou `rowClassName` (classe extra por linha,
  ex. faixa de SLA); novo helper `diasBorderClass()` (`chamado-helpers.ts`)
  — mesma paleta/limiares de `diasVariant`, como classe Tailwind de borda
  pronta pra usar. As 3 mudanças propagam pra qualquer tela que já usa
  esses componentes, sem quebrar quem não passa as novas props (todas
  opcionais).
- **Chamados em Aberto**: os indicadores que só apareciam como texto
  pequeno dentro dos cards de Cultura (críticos) viraram uma faixa de
  "Indicadores" própria — Total/Críticos/SLA Vencido/Sem Responsável —,
  cada um clicável como atalho de filtro (mesmo padrão dos cards de
  Cultura/Fazenda). O checkbox "SLA crítico" dentro de "Filtros
  avançados" foi removido — duplicava exatamente o novo KPI "SLA
  Vencido" controlando o mesmo estado. Cards do Kanban e linhas da lista
  ganharam uma faixa de cor na borda esquerda (verde/amber/vermelho,
  `diasBorderClass`) pro SLA ficar visível sem precisar ler o número de
  dias; no Kanban, número do chamado e frota/equipamento agora ficam
  juntos no cabeçalho do card (identificação em 1 linha, não mais
  espalhada entre 2 linhas).
- **Centro Operacional**: "Responsável"/"Técnico"/"Assumido por" saíram
  da grade de metadados do cabeçalho (que tinha 7 campos) e viraram uma
  seção própria "Responsáveis" na coluna lateral, ao lado de "Equipamento
  vinculado" — mesmo agrupamento conceitual (quem/o quê está envolvido no
  chamado), cabeçalho com 2 campos a menos. O cabeçalho também ganhou a
  mesma faixa de SLA na borda esquerda da lista/Kanban.
- **Equipamentos**: os 3 botões "✏️ Editar" (Cadastro, Ficha do
  Equipamento, Por Frota) trocaram o emoji por `Pencil` (lucide-react) —
  mesmo ícone usado nas demais ações do sistema; o badge de contagem de
  chamados em "Cadastro de Equipamentos" (que era um `<span>` reescrito
  na mão) passou a usar o componente `Badge` compartilhado (mesma classe
  computada, sem mudança visual, menos código duplicado).

## Fase 6 — estabilização, UX e performance
Com o CI 100% verde (TypeScript + ESLint + Build), esta rodada focou em 2
frentes concretas e verificáveis sem precisar de navegador:

- **Performance da Kanban** (`useChamados.ts`, `KanbanCard.tsx`,
  `KanbanColumn.tsx`, `AbertoPage.tsx`): `useReatribuirResponsavel`/
  `useAlterarStatusChamado`/`useAssumirChamado`/`useRegistrarEvento`/
  `useEncerrarChamado`/`useReabrirChamado` devolviam uma função nova a
  cada render (nenhum estava memoizado), e `KanbanColumn` recriava um
  closure por card a cada render (`() => onCardClick(c)`). Resultado:
  toda a Kanban de "Chamados em Aberto" — a tela operacional principal —
  re-renderizava por completo a cada tecla digitada em qualquer filtro,
  mesmo sem nenhuma mudança real nos cards. Corrigido estabilizando as
  referências (`useCallback` nos hooks de ação, usando
  `mutation.mutateAsync`, que o TanStack Query já garante estável, como
  dependência) e eliminando os closures por card em `KanbanColumn`
  (`KanbanCard` passa a receber `onClick`/`onAssumir` como
  `(chamado) => void` e resolve o `chamado` internamente). `KanbanCard` e
  `KanbanColumn` agora são `React.memo`. Nenhuma mudança de comportamento
  — só referência de função.
- **Dashboard executivo** (`DashboardPage.tsx`): `useComputeStats()` já
  calculava `byYear`, `issues`, `vencidos` e `cancelados`, mas nenhuma
  tela usava — o próprio código antigo documentava isso como pendente.
  Adicionados, com os mesmos dados já calculados (nada novo buscado no
  Firestore, nada inventado): KPIs "Cancelados" e "Vencidos (+7d)",
  gráfico "Comparativo Anual" (Total/Concluídos/Em Aberto por ano) e
  ranking "Principais Problemas" (mesmo keyword-matching da V2), mais um
  filtro de Cultura que reaproveita o parâmetro `records` que o hook já
  aceitava. De caminho, corrigido um bug real de UX pré-existente: os
  gráficos de barra com mais de 1 dataset (Evolução Mensal por Cultura, e
  agora também o Comparativo Anual) herdavam `legend: { display: false }`
  de `chartBaseOptions` — sem legenda, as séries empilhadas eram cores
  sem significado. Agora usam uma variante com legenda ligada.

Auditoria estática cobrindo o restante do escopo pedido (Centro
Operacional, DataTable, dead code, acessibilidade) não encontrou mais
nada de concreto e seguro pra mudar sem um navegador real disponível
nesta sessão — ver `ROADMAP.md`.

## Correção do segundo grupo de erros reais do CI (`tsc -b`, TS4058)
Depois do primeiro erro corrigido, o `tsc -b` avançou e encontrou 5
ocorrências de TS4058 ("Return type of exported function has or is using
name 'State' ... but cannot be named") em `useEquipamentos.ts`,
`usePecas.ts` (2x), `useTecnicos.ts` e `useUsuarios.ts`. Causa raiz: a
interface `State<T>` de `useFirestoreCollection.ts` não era exportada, mas
5 hooks (`useCadastroEquipamentos`, `usePecas`, `useMovimentacoes`,
`useTecnicos`, `useUsuarios`) repassam o retorno de
`useFirestoreCollection` direto, sem envolver num objeto novo — o
TypeScript exige poder nomear o tipo de retorno de toda função exportada
pra emitir os `.d.ts` dos project references (`tsc -b`), e um tipo interno
não-exportado não pode ser nomeado. Corrigido exportando a interface como
`FirestoreCollectionState<T>` (renomeada de `State<T>`) e anotando
explicitamente o tipo de retorno de `useFirestoreCollection` e dos 5 hooks
que a repassam — sem `any`/`unknown`/`@ts-ignore`. Revisão dos demais
hooks do projeto (todo `export function use...`) não achou outra função
que exponha um tipo interno inferido: os que usam `useMutation` retornam
um tipo público do TanStack Query, e os que compõem `{ data, carregando }`
a partir de `useChamados`/`useFirestoreCollection` já usam tipos públicos
(`Chamado[]`, `Tecnico[]`, `SolucaoKB[]`, `boolean`) nesse objeto novo.

## Correção do primeiro erro real do CI (`tsc -b`)
Primeira execução real do GitHub Actions (Node 22/24) pegou um erro de
tipagem que a revisão manual (sem Node no ambiente de escrita) não
capturou: `AuditoriaPage.tsx` montava a lista de usuários do filtro com
`logs.map(l => l.login).filter(Boolean)` — `login` é opcional em
`Auditoria` (`login?: string`), e `.filter(Boolean)` não estreita o tipo
pro TypeScript (ele não sabe que `Boolean` removeu os `undefined`), então
o array continuava `(string | undefined)[]` e quebrava no `value={u}` do
`SelectItem`, que exige `string`. Corrigido com um predicado de tipo
(`.filter((v): v is string => Boolean(v))`), sem `as`/`!`/`@ts-ignore`.
Revisão estática dos outros ~12 usos do mesmo padrão (`.filter(Boolean)`,
`.get()`, `.find()`) no projeto não achou outra ocorrência real — todos os
demais já filtram/mapeiam campos obrigatórios ou já têm fallback
(`|| ''`, `?? 0`, `|| null`).

## RC-FINAL + CI/CD — preparação para produção
Corrigido um erro real de `tsc -b` que não tinha sido pego nas rodadas
anteriores: `sw.ts` era type-checado sob o mesmo projeto do app (lib
`DOM`), que conflita com os tipos de Service Worker que o arquivo usa —
isolado agora em `tsconfig.sw.json` próprio (lib `WebWorker`), e
`self.__WB_MANIFEST` (usado sem estar tipado) ganhou a augmentação
correta. Adicionado `composite: true` nos 3 projetos referenciados por
`tsc -b` (exigência do TypeScript para project references, ausente até
aqui). `v3-ci.yml` reescrito: matrix de Node (22/24), cache chaveado por
versão de Node, permissões mínimas (`contents: read`), timeout por job,
nomes de job amigáveis, publicação do artefato de build
(`v3-dist-node22`/`v3-dist-node24`), Job Summary por perna da matrix.
Nova varredura de import/export cobrindo os 105 módulos do projeto (2
falsos-positivos de alias verificados manualmente, 0 problemas reais).
Novo documento `BUILD.md`.

## `bbe4409` — RC1: auditoria completa
Code splitting por rota (`React.lazy` + `Suspense`), listeners Firestore
compartilhados por coleção (`useFirestoreCollection`), correções de
acessibilidade (teclado/ARIA em `DataTable`, `KanbanCard`, `Pagination`,
botões só-ícone), e correção de UX obsoleta no Kanban (dropar em
"Concluído" agora abre o Centro Operacional em vez de um aviso de
"funcionalidade futura" que já não era mais verdade).

## `e018d56` — CI da V3
Workflow `.github/workflows/v3-ci.yml`: type-check + lint + build a cada
push/PR em `v3/**`, cache de npm, troca automática para `npm ci` quando o
lockfile existir, Job Summary, job de deploy preparado (comentado).

## `2d634c0` — Dashboard, Painel Operacional e Por Mês
`useDashboardStats` (port de `computeStats()`), gráficos Chart.js
(evolução mensal, distribuição por cultura/fazenda, heatmap), ranking de
responsáveis/equipamentos, KPIs em tempo real do Painel Operacional.

## `607d5a6` — Auditoria/Logs e Relatórios → Responsáveis
Tela de auditoria completa + relatório de atendimentos por responsável.

## `d2b9e8d` — Técnicos (RH), Usuários e Configurações
CRUD de técnicos com ranking de performance; CRUD de usuários com
criação real de conta no Firebase Auth (app secundário descartável) e
grade de permissões granulares; tela de Configurações.

## `b5d545d` — Módulo de Equipamentos
Cadastro, Por Frota, Peças e Estoque (com movimentação de
entrada/saída), Banco de Soluções, Ficha do Equipamento.

## `1d01f37` — Fundação + módulo de Chamados completo
Primeiro commit da V3: scaffold (Vite+React 19+TS strict+Tailwind+
shadcn escrito à mão+Firebase modular+PWA), design system, RBAC, rotas,
e o módulo de Chamados inteiro (Em Aberto Lista+Kanban, Todos,
Encerrados, Criticidade, Novo Chamado, Centro Operacional com
checklist/timeline/galeria/auditoria, Área do Técnico) já lendo/gravando
no Firebase real.

---

Todos os commits acima mantêm `docs/` (V2) intacta e não tocam em
Firebase/Firestore/regras/coleções — confirmado a cada checkpoint via
`git status` restrito a `v3/`.
