# Componentes — Central de Chamados V3

## Primitivos (`components/ui/`)

Escritos à mão (sem CLI do shadcn, já que o ambiente não tem Node/npm),
sobre Radix UI (`@radix-ui/react-*`) + `class-variance-authority` +
`tailwind-merge`. Um arquivo por primitivo: `avatar`, `badge`, `button`,
`card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`,
`select`, `separator`, `sheet`, `skeleton`, `sonner` (wrapper do toast),
`switch`, `tooltip`.

Todos os `Dialog`/`Sheet` fecham com `X` acessível (`sr-only`
"Fechar" já incluso) e usam `DialogTitle`/`DialogDescription` do Radix —
qualquer dialog novo **precisa** de um `DialogTitle` (mesmo que
`sr-only`), senão o Radix não expõe nome acessível ao dialog.

## Compartilhados (`components/shared/`)

| Componente | Usado em | Papel |
|---|---|---|
| `CentroOperacionalModal` | montado 1x em `AppShell` | Modal global do chamado — cabeçalho, ações rápidas, timeline, equipamento vinculado, anexos, observações, auditoria. Abre via `useDetalheStore.abrir(num)` de qualquer tela. |
| `ChecklistDialog` | dentro do Centro Operacional | Encerramento com checklist obrigatório de 4 itens + técnicos + solução. |
| `KanbanBoard` / `KanbanColumn` / `KanbanCard` | só em `AbertoPage` | Drag-and-drop (`@dnd-kit`) entre as 4 raias, transições restritas a `KANBAN_TRANSICOES`. |
| `DataTable` | toda tela de listagem | Tabela genérica: colunas tipadas, ordenação opcional, loading (skeleton), estado vazio, linha/cabeçalho operáveis por teclado. |
| `Pagination` | toda tela paginada | Janela de páginas com reticências. |
| `FilterBar` / `FilterBarSeparator` / `FilterLabel` | toda tela com filtros | Container padrão para busca/selects/checkboxes. |
| `KpiCard` | cards de topo | Card numérico, opcionalmente clicável (atua como filtro). |
| `StatusBadge` / `CulturaBadge` / `PrioridadeBadge` / `DiasChip` | listas de chamados | Badges de domínio (`components/shared/StatusBadge.tsx`) — única fonte de cor/rótulo por status/cultura/prioridade/dias em aberto. |
| `RankingBars` | Dashboard, Painel | Lista de ranking com barra de progresso (`.prog-item` da V2). |
| `Timeline` | Centro Operacional | Linha do tempo (`<ol>`) — abertura + eventos + encerramento, nessa ordem. |
| `StatusStepper` | Centro Operacional | Progresso visual do status atual do chamado. |
| `PhotoUploader` / `PhotoGallery` | Novo Chamado / Centro Operacional | Upload com preview (base64, sem Storage) e lightbox de anexos. |
| `EquipAutocomplete` | Novo Chamado, CRUD de Equipamento | Combobox (ARIA 1.2: `role="combobox"` + `listbox`/`option`) sobre `useEquipUniverso()`. |
| `EquipCrudDialog` / `FichaEquipamentoModal` | Equipamentos, Por Frota | CRUD de cadastro e ficha somente-leitura (KPIs + histórico + atalho para Novo Chamado). |
| `FormField` (`Campo`, `Meta`) | todo formulário/CRUD da V3 | Par label+campo (`Campo`, com `htmlFor` opcional para associação real com leitor de tela) e par label+valor somente-leitura (`Meta`) — únicos, reaproveitados em vez de redefinidos por tela. |
| `GlobalSearch` | Topbar | Busca global sobre os chamados já carregados. |
| `NetworkStatus` | Topbar | Indicador online/offline. |
| `ThemeToggle` | Topbar | Alterna `useThemeStore` (claro/escuro). |
| `EmptyState` | qualquer lista vazia | Estado vazio padrão com ícone. |
| `RouteLoading` | `Suspense` de rota | Fallback leve durante o download do chunk (`React.lazy`) de cada página. |

## Convenção de formulário

Todo campo de formulário usa `<Campo label="..." htmlFor="id-unico">` +
um controle com o mesmo `id`. Grupos de botões-toggle (Prioridade,
Fazenda/Sistema, Responsável) não têm um único input associável — usam
`role="group"` + `aria-label` no container e `aria-pressed` em cada
botão, em vez de `htmlFor`.
