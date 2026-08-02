# Changelog — Central de Chamados V3

Datas/commits reais (`git log -- v3/`). Cada linha resume o que o commit
mudou; detalhe completo em cada mensagem de commit.

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
