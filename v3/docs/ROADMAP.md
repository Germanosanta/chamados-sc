# Roadmap / Pendências reais — Central de Chamados V3

Só itens que dependem de infraestrutura externa, decisão de negócio, ou
de uma capacidade que a própria V2 também não tem hoje. Nenhum "TODO" de
código — se algo estava faltando e era corrigível sem essas dependências,
já foi corrigido nas rodadas anteriores (ver `CHANGELOG.md`).

## Bloqueado por ambiente

- **`npm run typecheck`/`lint`/`build` já rodaram de verdade no GitHub
  Actions e estão 100% verdes** (Node 22 e 24) — mas nunca rodaram
  localmente nem num navegador real, porque o ambiente onde a V3 vem
  sendo trabalhada não tem Node.js/npm/browser instalado. Isso significa
  que responsividade real (320px–1440px), fluxos de clique (login, CRUD,
  drag-and-drop do Kanban) e comportamento do PWA (instalação, offline,
  atualização) nunca foram verificados visualmente — só por leitura de
  código (classes Tailwind, lógica dos handlers). É a lacuna real que
  falta pra fechar a Fase 6: alguém rodar `npm install && npm run dev`
  num navegador de verdade e passar pela tela em cada breakpoint/fluxo.
- **Reorganização visual completa de "Chamados em Aberto" e "Centro
  Operacional"** (pedida na Fase 6) foi deliberadamente **não executada
  às cegas**: as duas telas já refletem decisões de layout tomadas em
  rodadas anteriores (cards de KPI limitados a Cultura+Fazenda, ordem dos
  blocos do Centro Operacional) e uma reconstrução completa de interface
  sem conseguir renderizar o resultado é risco real de regressão visual
  não detectável por `tsc`/`eslint`. Nesta rodada, o ganho de performance
  da Kanban (memoização) e as adições ao Dashboard (dados já calculados,
  antes não exibidos) foram priorizados por serem verificáveis sem
  navegador; a reorganização visual mais ampla das duas telas fica para
  quando houver como testar visualmente antes de publicar.
- Sem `package-lock.json` ainda (nunca gerado, mesma causa acima) — o CI
  usa `npm install`; ao gerar e commitar o lockfile, o workflow já troca
  sozinho para `npm ci`.

## Bloqueado por decisão de negócio

- **Onde a V3 será publicada** — nenhum site de Hosting definido ainda.
  Ver `DEPLOY.md` para os passos já preparados (job de deploy comentado,
  pronto pra ativar).
- **Quando a V3 substitui a V2 oficialmente** — até essa decisão, a V2
  continua em produção e é a referência para qualquer divergência de
  comportamento encontrada na V3.

## Bloqueado por infraestrutura externa (Firebase)

- **Notificações push reais** — o Service Worker já inicializa Firebase
  Messaging e sabe mostrar uma notificação (`src/sw.ts`), mas não existe
  Cloud Function do lado servidor enviando nada ainda — precisa de plano
  Blaze (mesma pendência de longa data da V2).
- **Firebase Storage para fotos** — hoje fotos ficam só em base64 local
  (mesma limitação da V2, nunca gravadas no Firestore por causa do
  limite de tamanho de documento). Usar Storage de verdade seria uma
  capacidade **nova**, não uma paridade — decisão de negócio em aberto.

## Diferenças conscientes vs. a engine da V2 (não são bugs)

- **Fila de escrita offline** — a V2 tem uma fila própria persistida
  entre reloads, com reenvio automático do que falhou. A V3 usa o
  pause/retry padrão de mutation do TanStack Query, que cobre o caso
  comum (perda de conexão no meio de uma escrita) mas não sobrevive a um
  fechamento de aba. Reconstruir a engine completa da V2 é um projeto à
  parte, não uma correção pontual.
- **"Sugestão de IA" no Painel Operacional** — a V2 tem uma busca por
  keyword-matching entre sintomas e o Banco de Soluções/histórico. Fica
  pendente até o Banco de Soluções da V3 acumular conteúdo suficiente
  pra a sugestão valer a pena (hoje o KB está funcional mas com base de
  dados pequena).
- **`irrigacao` e `chips`** continuam como placeholder — não é lacuna de
  migração, são módulos que a própria V2 também trata como "Em breve".
