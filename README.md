# Central de Chamados — Santa Colomba Agropecuária

Portal único de Tecnologia para gestão de chamados, equipamentos, técnicos e frotas.

**Produção: Firebase Hosting** (`https://chamados-sc.web.app`). GitHub é usado apenas para versionamento; o deploy acontece automaticamente a cada `git push` na `main` via GitHub Actions — **sem precisar instalar nada localmente** (ver seção "Deploy automático" abaixo, incluindo o único passo manual necessário).

## Estrutura do Projeto

```
/
├── .github/workflows/
│   └── firebase-deploy.yml # Deploy automático no Firebase Hosting a cada push na main
├── firebase.json           # Config do Firebase Hosting/Firestore — hosting é uma lista de 2 sites:
│                           #   [0] site "chamados-sc" / public "docs" (V2, produção — inalterado)
│                           #   [1] target "v3" / public "v3/dist" (V3, homologação — ver v3/docs/DEPLOY.md)
├── .firebaserc              # Projeto Firebase padrão (chamdos-sc — ver aviso na seção Firebase)
├── firestore.rules          # Regras do Firestore (revisar antes de deploy — ver aviso no arquivo)
│
├── docs/                    # Tudo que é servido pelo Firebase Hosting
│   ├── index.html           # Shell principal (carrega todos os módulos)
│   ├── manifest.json        # Metadados do app (PWA básico)
│   ├── assets/img/
│   │   └── coa.jpeg         # Logo/imagem institucional (login, favicon)
│   ├── css/
│   │   ├── style.css        # Base compartilhada (tokens, dark mode, shell, sidebar, topbar, tabela, form, modal)
│   │   ├── login.css / dashboard.css / chamados.css / equipamentos.css /
│   │   │   usuarios.css / relatorios.css / config.css   # CSS específico de cada módulo
│   │   └── responsivo.css   # Media queries — carregado por último (ver aviso no arquivo)
│   └── js/
│       ├── firebase/
│       │   ├── firebase.js  # Bootstrap do SDK + sync layer (módulo ES)
│       │   └── firestore.js # Camada única de acesso ao Firestore
│       ├── core/
│       │   ├── storage.js   # Persistência (localStorage + Firestore) — fonte única de get*/save*
│       │   └── init.js      # Bootstrap da aplicação, navegação, menu de portais
│       ├── modules/
│       │   ├── dashboard/index.js     # KPIs, charts, painel operacional, IA local
│       │   ├── chamados/index.js      # CRUD chamados, timeline, checklist, encerramento
│       │   ├── equipamentos/index.js  # Cadastro equipamentos, frotas, peças, KB
│       │   ├── relatorios/index.js    # Por mês, por responsável, auditoria, exportação
│       │   ├── usuarios/index.js      # Login, sessão, perfis, permissões
│       │   └── config/index.js        # Configurações, e-mail, Firebase, técnicos
│       └── data/
│           ├── chamados_historico.js  # 3.214 chamados (Jun/2022–Jul/2026)
│           ├── equipamentos.js        # 445 equipamentos (planilha xlsx)
│           ├── match_map.js           # Vínculo chamado → frota (125 entries)
│           └── equip_idx.js           # Índice equipamentos por código
│
├── data/                    # data/*.json — usados por legacy/importar.html (../data/*.json), não apagar
│
└── legacy/                  # Artefatos legados, fora do app servido (não vão para o deploy)
    ├── chamados_sc.html     # Build standalone single-file (cópia própria da lógica Firebase)
    ├── app.js               # JS consolidado antigo (não referenciado por nenhum HTML ativo)
    └── importar.html        # Ferramenta avulsa de importação em massa
```

> Módulos ainda são `<script>` clássicos com escopo global compartilhado (sem duplicação — cada função tem uma única declaração). Conversão para ES modules reais (import/export) é etapa futura, feita isolada por ser a de maior risco de regressão.

## Deploy automático (GitHub Actions — sem instalar nada localmente)

Já está tudo configurado no repositório (`.github/workflows/firebase-deploy.yml`, `firebase.json`, `.firebaserc`). Faltam **dois passos manuais, feitos uma única vez, direto no navegador** — nenhum dos dois exige instalar programa nenhum no computador:

### Passo 1 — Criar o site de Hosting "chamados-sc" (uma vez só)
O deploy é direcionado para um site chamado `chamados-sc` (ver `firebase.json` → `hosting.site`), que é diferente do site padrão do projeto. Ele precisa existir antes do primeiro deploy:
1. Acesse [console.firebase.google.com](https://console.firebase.google.com) → projeto **chamdos-sc**.
2. Menu lateral → **Hosting**.
3. Botão **"Adicionar outro site"** (Add another site).
4. Digite o Site ID: **`chamados-sc`** → Adicionar.

Depois disso o site existe (mesmo vazio) em `https://chamados-sc.web.app`, pronto para receber o deploy.

### Passo 2 — Gerar a chave de serviço e colar no GitHub (o passo que você já esperava)
1. Acesse [console.cloud.google.com/iam-admin/serviceaccounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=chamdos-sc) (mesmo projeto, `chamdos-sc`).
2. **Criar conta de serviço** → nome sugerido `github-actions-deploy` → Criar e continuar.
3. Em "Conceder acesso a esta conta de serviço", adicione o papel **`Firebase Hosting Admin`** → Continuar → Concluído.
4. Clique na conta de serviço recém-criada → aba **Chaves** (Keys) → **Adicionar chave** → **Criar nova chave** → tipo **JSON** → Criar. Um arquivo `.json` será baixado no seu computador.
5. Abra esse arquivo `.json` num editor de texto, copie **todo o conteúdo**.
6. No GitHub: repositório → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Nome: **`FIREBASE_SERVICE_ACCOUNT`** (exatamente assim, é o nome que o workflow espera)
   - Valor: cole o JSON inteiro copiado no passo 5.
7. Salvar.

**A partir daqui, todo `git push origin main` publica sozinho em `https://chamados-sc.web.app`.** Pode apagar o arquivo `.json` baixado do computador depois de colar no GitHub — ele não precisa ficar salvo em lugar nenhum.

### Deploy manual, se algum dia precisar (não obrigatório)
Só é possível com o [Firebase CLI](https://firebase.google.com/docs/cli) instalado (requer Node.js) — não se aplica ao seu computador corporativo bloqueado, mas documentado aqui por completude:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

**Antes de qualquer deploy de regras do Firestore** (`firebase deploy --only firestore:rules` — separado do deploy de Hosting, não roda automaticamente pelo GitHub Actions), revise `firestore.rules` no Console. O login é feito via Firebase Authentication (e-mail/senha) — o papel de cada usuário (perfil/status/perms) mora em `usuarios/{uid}` e as regras usam `get()` nesse doc pra decidir permissão, sem custom claims nem Cloud Functions (100% compatível com o plano Spark). Um push que altera `firestore.rules` **não é aplicado sozinho** — é fácil esquecer esse passo manual depois de uma sessão de correções.

### Uso local (desenvolvimento, opcional)
Sirva a pasta `docs/` com qualquer servidor HTTP local (não abra `docs/index.html` direto do disco — os módulos `firebase.js`/`firestore.js` são ES modules e exigem `http(s)://`, não `file://`).

### Single-file legado (offline)
`legacy/chamados_sc.html` continua funcionando como build standalone (não recebe as correções feitas no app modular a partir da reorganização).

## V3 (homologação — React/TypeScript, pasta `v3/`)

Reescrita em React 19 + TypeScript + Vite, isolada em `v3/`, lendo/
escrevendo no **mesmo** Firestore/Auth da V2 (mesmas coleções, mesmas
regras, mesmas permissões — nada duplicado). Publica num site de
Hosting **separado** (`chamados-sc-v3.web.app`), dentro do mesmo projeto
Firebase (`chamdos-sc`), sem afetar a V2 (`chamados-sc.web.app`, que
continua sendo produção). Detalhe completo — arquitetura, como rodar
localmente, como o CI/deploy funcionam, como fazer rollback, como
promover a V3 a produção no futuro: **`v3/docs/DEPLOY.md`** e
**`v3/docs/BUILD.md`**.

Resumo:
- CI (`.github/workflows/v3-ci.yml`): type-check/lint/build em toda
  alteração de `v3/**`, não publica nada.
- Deploy (`.github/workflows/v3-deploy.yml`): builda e publica
  automaticamente em `chamados-sc-v3.web.app` a cada push em `main` que
  toque `v3/**` — reusa o mesmo secret `FIREBASE_SERVICE_ACCOUNT` da V2.
- O site `chamados-sc-v3` já foi criado no Console do Firebase (mesmo
  procedimento do "Passo 1" acima, nome diferente) — deploy automático
  ativo. Ver `v3/docs/DEPLOY.md`.

## Firebase

**⚠️ Atenção ao nome do projeto**: o projeto Firebase real (usado no SDK, `authDomain`, `storageBucket`, todas as coleções e dados já existentes) é **`chamdos-sc`** (sem o "a" de "chamados" — provavelmente um typo de quando o projeto foi criado no console, mas é o nome real e não deve ser alterado sem migrar todos os dados). O site de Hosting `chamados-sc` (URL `chamados-sc.web.app`, criado no Passo 1 acima) vive **dentro** desse mesmo projeto `chamdos-sc` — são coisas diferentes: `chamdos-sc` é o ID do projeto/banco de dados, `chamados-sc` é só o nome do site de Hosting.

Coleções no Firestore (nomes reais, via `docs/js/firebase/firestore.js`):
| Collection | Dados |
|---|---|
| `usuarios` | Perfil, cargo, permissões — chave é o UID do Firebase Auth. Sem campo `senha` (vive só no Firebase Auth, nunca no Firestore) |
| `logins` | Mapa `{login → email/uid}`, leitura aberta — resolve nome de usuário para e-mail antes do login (o app ainda loga por usuário, não por e-mail) |
| `chamados` | Chamados criados no sistema |
| `historico` | Eventos de timeline + dados de encerramento por chamado |
| `equipamentos` | Cadastro de equipamentos/frotas |
| `tecnicos` | Cadastro de técnicos |
| `pecas` | Estoque de peças |
| `movimentacoes` | Entradas/saídas de estoque |
| `auditoria` | Log de ações (append-only) |
| `configuracoes` | Configurações gerais + Banco de Soluções (prefixo `kb__`) |

## Stack

- **Frontend**: HTML5 + CSS3 + JS vanilla (sem framework)
- **Dados históricos**: 3.214 chamados embutidos em JS
- **Persistência local**: localStorage (offline-first)
- **Nuvem**: Firebase Firestore (sync em background) + Firebase Hosting
- **Fontes**: Inter + JetBrains Mono (Google Fonts)
- **Charts**: Chart.js 4.4.1

## Contas de acesso

Não existem mais credenciais padrão/seed embutidas no código — login é feito via Firebase Authentication (e-mail/senha), com contas reais criadas pela tela **Usuários** (acesso restrito a administradores) ou pelo bootstrap manual abaixo. Perfis disponíveis: Administrador, Supervisor, Técnico, Visualizador — cada um com um conjunto padrão de permissões (`PERFIL_PERMS` em `docs/js/core/init.js`), customizável por usuário na própria tela de cadastro.

### Bootstrap do primeiro admin (uma vez só, direto no Console)
1. Console do Firebase → projeto **chamdos-sc** → Authentication → Users → **Add user** (e-mail real + senha).
2. Firestore → criar doc `usuarios/{UID gerado}` com `nome, login, email, perfil:"admin", status:"Ativo", perms:null`.
3. Firestore → criar doc `logins/{login}` com `{ email, uid: UID }`.
4. A partir daí, esse admin cadastra os demais usuários pela tela do próprio app.

## Módulos

- **Dashboard** — KPIs por status, charts mensais, painel operacional em tempo real, IA local
- **Chamados** — CRUD completo, timeline vertical, fotos, peças, checklist de encerramento
- **Equipamentos** — Cadastro de 445 equipamentos, frotas, peças e estoque, banco de soluções
- **Frotas** — Histórico de chamados por frota/equipamento
- **Técnicos** — Cards de performance, cadastro com telefone/email/área, ranking (lista de técnicos do formulário de chamado vem do cadastro real, não é fixa)
- **Usuários** — Gestão de usuários e perfis com 15 permissões granulares (criação/edição restrita a administradores)
- **Relatórios** — Por mês, por responsável, auditoria/logs, exportação CSV
- **Configurações** — E-mail, Firebase, tema, dados
