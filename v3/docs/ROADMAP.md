# Roadmap / Pendências reais — Central de Chamados V3

Só itens que dependem de infraestrutura externa, decisão de negócio, ou
de uma capacidade que a própria V2 também não tem hoje. Nenhum "TODO" de
código — se algo estava faltando e era corrigível sem essas dependências,
já foi corrigido nas rodadas anteriores (ver `CHANGELOG.md`).

## Bloqueado por ambiente

- **`npm install && npm run lint && npm run build` nunca rodaram de
  verdade** — o ambiente onde a V3 foi escrita não tem Node.js/npm
  instalado. Todo o código foi revisado manualmente (resolução de
  imports/exports, balanceamento de sintaxe, conferência de que cada
  export importado existe de fato no módulo de origem) a cada
  checkpoint, mas isso não substitui o compilador/linter reais. Rodar
  essas 3 checagens localmente é o próximo passo obrigatório antes de
  qualquer promoção da V3 a produção — ver `GUIA_DESENVOLVEDOR.md`.
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
