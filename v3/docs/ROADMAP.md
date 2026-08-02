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
- **Fase 7 reorganizou a hierarquia de informação de "Chamados em
  Aberto", "Centro Operacional" e "Equipamentos"** (indicadores
  secundários promovidos, faixa de SLA na borda, agrupamento de
  Responsáveis) **por leitura/reescrita de código, sem poder renderizar o
  resultado num navegador**. É estrutural (o que aparece, onde, e como é
  agrupado) e não cosmético (nenhuma cor/espaçamento trocado só por
  preferência), mas a única verificação real disponível foi `tsc`/
  `eslint`/`vite build` via GitHub Actions — nenhum dos três detecta um
  layout quebrado, uma classe Tailwind com efeito inesperado, ou um
  problema de contraste/overflow. **Dashboard executivo** (reformulado na
  Fase 6) e o pedido de reconstrução do **Kanban Card**/**Timeline**
  também ficaram sem essa verificação. Continua sendo o item que falta
  pra fechar as Fases 6+7: alguém abrir a V3 num navegador de verdade
  (`npm install && npm run dev`) e conferir cada tela alterada nos
  breakpoints pedidos (320–1440px) antes de considerar pronto pra
  produção.
- **Não coberto nesta rodada** (Fase 7 pedia também): reconstrução
  completa do Dashboard como "painel de gestão" além do que a Fase 6 já
  ligou (byYear/issues/vencidos/cancelados — ver entrada anterior do
  Changelog); modernização das demais ~15 telas fora de Chamados em
  Aberto/Centro Operacional/Equipamentos; auditoria de responsividade
  tela a tela. Não foram tocadas por não haver como fazer isso com
  qualidade real e verificável no volume pedido numa única entrega sem
  navegador — melhor entregar um conjunto menor e sólido do que muitas
  telas alteradas às cegas.
- Sem `package-lock.json` ainda (nunca gerado, mesma causa acima) — o CI
  usa `npm install`; ao gerar e commitar o lockfile, o workflow já troca
  sozinho para `npm ci`.

## Bloqueado por ação manual (não é decisão de negócio — só falta executar)

- **Site de Hosting `chamados-sc-v3` ainda não existe de verdade** —
  `firebase.json`/`.firebaserc`/`v3-deploy.yml` já estão prontos e
  apontando pra ele (homologação, site separado da V2), mas criar um
  site de Hosting é uma ação no Console/CLI do Firebase que exige
  credenciais reais — não pode ser feita por automação. Até alguém
  rodar o "Passo 1" de `DEPLOY.md`, `v3-deploy.yml` builda com sucesso
  mas falha no passo de publicação. Depois de criado, todo push em
  `main` publica sozinho — não precisa repetir esse passo.

## Bloqueado por decisão de negócio

- **Quando a V3 substitui a V2 oficialmente** — até essa decisão, a V2
  continua em produção (`chamados-sc.web.app`) e é a referência para
  qualquer divergência de comportamento encontrada na V3, que por
  enquanto publica só em homologação (`chamados-sc-v3.web.app`). Passos
  de promoção já documentados em `DEPLOY.md`.

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
