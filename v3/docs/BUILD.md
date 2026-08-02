# Build & CI — Central de Chamados V3

## Como o CI funciona

Workflow: `.github/workflows/v3-ci.yml` (raiz do projeto). Dispara em
todo push/PR que toque `v3/**`. Roda em **matrix de 2 versões de
Node** (`22` — LTS, `24` — Current) — cada perna é um job independente
chamado **"Verificar (Node 22)"** / **"Verificar (Node 24)"** na aba
Actions do GitHub.

Fluxo de cada perna, na ordem, parando imediatamente se qualquer etapa
falhar (comportamento padrão do GitHub Actions — nenhuma etapa usa
`continue-on-error`):

```
Checkout
  ↓
Configurar Node.js (versão da matrix)
  ↓
Cache do npm (~/.npm, chaveado por SO+versão do Node+hash do lockfile/package.json)
  ↓
Instalar dependências — npm ci (se existir package-lock.json) ou npm install
  ↓
Type-check — npm run typecheck  (tsc -b: 3 projetos — app, node, sw)
  ↓
Lint — npm run lint  (ESLint)
  ↓
Preparar .env  (config pública do Firebase, ver .env.example)
  ↓
Build — npm run build  (tsc -b && vite build)
  ↓
Publicar artefato — v3-dist-node{22,24} (v3/dist, retenção 14 dias)
  ↓
Job Summary  (roda mesmo se algo falhou — if: always())
```

`fail-fast: true` na matrix: se uma perna falhar, a outra é cancelada
imediatamente também (não desperdiça minutos de runner numa combinação
já sabidamente quebrada).

`concurrency` cancela qualquer execução anterior ainda rodando para o
mesmo branch/PR a cada novo push — nunca acumula execuções obsoletas.

`permissions: contents: read` no topo do workflow — o CI só lê código e
publica artefato/summary, nunca escreve no repositório.

`timeout-minutes: 15` por job — evita um job travado consumir minutos
de runner indefinidamente.

## Como interpretar um erro do CI

1. Abra a aba **Actions** do repositório → a execução falhada → o job
   **"Verificar (Node ...)"** que ficou vermelho.
2. O **Job Summary** (parte de cima da página do job) mostra uma tabela
   com o resultado de cada etapa (`success`/`failure`/`skipped`) e o
   tempo total — identifica em qual etapa parou sem precisar ler o log
   inteiro.
3. Abra a etapa vermelha nos logs para o erro completo:
   - **Type-check** vermelho → erro de TypeScript real (tipo errado,
     import quebrado, etc.) — mesma classe de erro que a revisão manual
     desta sessão tentou antecipar, mas sem certeza total sem o
     compilador rodando de verdade.
   - **Lint** vermelho → erro de ESLint (raramente bloqueia sozinho,
     já que a maioria das regras de import/variável não usada está em
     `warn`, não `error` — mas alguma regra `error` pode pegar algo
     real).
   - **Build** vermelho → geralmente um erro de `vite build` (import de
     asset inexistente, config do PWA inválida) já que o type-check
     roda antes e teria pego a maioria dos erros de tipo primeiro.
4. Se só uma das 2 versões de Node falhar e a outra passar, é
   provavelmente uma incompatibilidade real de versão de Node (rara
   nesta stack, mas é exatamente pra isso que a matrix existe).

## Rodando localmente (mesmos passos do CI, no seu terminal)

```bash
cd v3
npm install                 # ou "npm ci" se já existir package-lock.json
cp .env.example .env.local
npm run typecheck
npm run lint
npm run build
npm run preview              # opcional — serve v3/dist localmente
```

Rodar `npm run typecheck && npm run lint && npm run build` localmente
antes de dar push é o jeito mais rápido de não esperar o CI pra
descobrir um erro.

## Publicando a V3 no futuro

O CI **não publica nada** hoje — só valida. Existe um job `deploy`
inteiro já escrito, porém comentado, no fim de `v3-ci.yml`, pronto para
ativar quando a V3 for promovida a substituir a V2 oficialmente. Ver
`DEPLOY.md` para os passos completos (criar site de Hosting dedicado,
configurar target multi-site, descomentar o job, confirmar o secret
`FIREBASE_SERVICE_ACCOUNT`).

## Limitação desta sessão de trabalho

O ambiente onde a V3 foi escrita não tem Node.js/npm instalado — este
workflow de CI **nunca rodou de verdade** ainda. Toda a validação até
aqui foi manual (ver `ROADMAP.md`): resolução de import/export
conferida em todos os módulos do projeto, balanceamento de sintaxe,
ausência de `TODO`/`FIXME`/`console.log`, conferência de
`tsconfig`/`vite.config`/`eslint.config`/`tailwind.config` linha por
linha. Isso reduz o risco, mas não substitui a primeira execução real
do pipeline acima.
