# Central de Chamados — Santa Colomba Agropecuária

Portal único de Tecnologia para gestão de chamados, equipamentos, técnicos e frotas.

**Versão oficial: V3 (React/TypeScript)** — **Produção: Firebase Hosting** (`https://chamados-sc-v3.web.app`). GitHub é usado apenas para versionamento; o deploy acontece automaticamente a cada `git push` na `main` via GitHub Actions — **sem precisar instalar nada localmente** (ver seção "Deploy automático" abaixo).

> **A V2 (pasta `docs/`, vanilla JS) foi desativada** — não é mais publicada (o workflow `firebase-deploy.yml` e a entrada de Hosting correspondente em `firebase.json` foram removidos). O código continua no repositório para consulta/histórico, mas nenhum novo push publica mais nada em `chamados-sc.web.app`. Toda a documentação de arquitetura/deploy/uso da V3 está em `v3/docs/`.

## Estrutura do Projeto

```
/
├── .github/workflows/
│   ├── v3-ci.yml            # Type-check/lint/build da V3 em toda alteração de v3/**
│   └── v3-deploy.yml        # Build + deploy automático da V3 a cada push na main
├── firebase.json           # Config do Firebase Hosting/Firestore — hosting tem 1 site ativo:
│                           #   target "v3" / public "v3/dist" (V3, produção — ver v3/docs/DEPLOY.md)
├── .firebaserc              # Projeto Firebase padrão (chamdos-sc — ver aviso na seção Firebase)
├── firestore.rules          # Regras do Firestore (revisar antes de deploy — ver aviso no arquivo)
│
├── docs/                    # V2 (legado, DESATIVADA) — código mantido no repo só para consulta,
│                           # não é mais publicada pelo Firebase Hosting (ver aviso acima)
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

Já está tudo configurado no repositório (`.github/workflows/v3-ci.yml`, `v3-deploy.yml`, `firebase.json`, `.firebaserc`). Todo `git push origin main` que toque `v3/**` builda e publica sozinho em `https://chamados-sc-v3.web.app` — não requer nenhum passo manual novo (o secret `FIREBASE_SERVICE_ACCOUNT` já está configurado no repositório, com o papel "Firebase Hosting Admin" no projeto `chamdos-sc`, e cobre qualquer site de Hosting dentro dele). Detalhe completo — arquitetura, como rodar localmente, como o CI/deploy funcionam, como fazer rollback: **`v3/docs/DEPLOY.md`**.

### Deploy manual, se algum dia precisar (não obrigatório)
Só é possível com o [Firebase CLI](https://firebase.google.com/docs/cli) instalado (requer Node.js) — não se aplica ao seu computador corporativo bloqueado, mas documentado aqui por completude:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

**Antes de qualquer deploy de regras do Firestore** (`firebase deploy --only firestore:rules` — separado do deploy de Hosting, não roda automaticamente pelo GitHub Actions), revise `firestore.rules` no Console. O login é feito via Firebase Authentication (e-mail/senha) — o papel de cada usuário (perfil/status/perms) mora em `usuarios/{uid}` e as regras usam `get()` nesse doc pra decidir permissão, sem custom claims nem Cloud Functions (100% compatível com o plano Spark). Um push que altera `firestore.rules` **não é aplicado sozinho** — é fácil esquecer esse passo manual depois de uma sessão de correções.

## V3 (produção — React/TypeScript, pasta `v3/`)

Reescrita em React 19 + TypeScript + Vite, isolada em `v3/`, lendo/
escrevendo no **mesmo** Firestore/Auth que a V2 sempre usou (mesmas
coleções, mesmas regras, mesmas permissões — nada duplicado). É a
**versão oficial em produção**, publicada em `chamados-sc-v3.web.app`,
dentro do mesmo projeto Firebase (`chamdos-sc`). Detalhe completo —
arquitetura, como rodar localmente, como o CI/deploy funcionam, como
fazer rollback: **`v3/docs/DEPLOY.md`** e **`v3/docs/BUILD.md`**.

Resumo:
- CI (`.github/workflows/v3-ci.yml`): type-check/lint/build em toda
  alteração de `v3/**`, não publica nada.
- Deploy (`.github/workflows/v3-deploy.yml`): builda e publica
  automaticamente em `chamados-sc-v3.web.app` a cada push em `main` que
  toque `v3/**`.

## V2 (legado — desativada, pasta `docs/`)

A V2 (HTML5 + CSS3 + JS vanilla, sem framework) foi a versão em produção
até a V3 assumir esse papel. **Não é mais publicada**: o workflow que a
fazia deploy (`firebase-deploy.yml`) e a entrada de Hosting
correspondente em `firebase.json` foram removidos — nenhum push publica
mais nada em `chamados-sc.web.app`. O código permanece na pasta `docs/`
só para consulta/histórico durante a transição; nada nela foi apagado.

### Uso local da V2 (só para consulta, não publica nada)
Sirva a pasta `docs/` com qualquer servidor HTTP local (não abra `docs/index.html` direto do disco — os módulos `firebase.js`/`firestore.js` são ES modules e exigem `http(s)://`, não `file://`).

### Single-file legado (offline)
`legacy/chamados_sc.html` continua funcionando como build standalone (não recebe as correções feitas no app modular a partir da reorganização, nem nenhuma correção da V3).

## Firebase

**⚠️ Atenção ao nome do projeto**: o projeto Firebase real (usado no SDK, `authDomain`, `storageBucket`, todas as coleções e dados já existentes) é **`chamdos-sc`** (sem o "a" de "chamados" — provavelmente um typo de quando o projeto foi criado no console, mas é o nome real e não deve ser alterado sem migrar todos os dados). O site de Hosting da V3 (`chamados-sc-v3`, URL `chamados-sc-v3.web.app`) vive **dentro** desse mesmo projeto `chamdos-sc` — são coisas diferentes: `chamdos-sc` é o ID do projeto/banco de dados, `chamados-sc-v3` é só o nome do site de Hosting. Esse mesmo projeto/banco é compartilhado com a V2 (desativada, mas os dados históricos continuam nele) — desativar a V2 não mexeu em nada aqui.

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

## Stack, Contas de acesso e Módulos (V2, legado)

> As três seções abaixo (`Stack`, `Contas de acesso`, `Módulos`) descrevem especificamente a implementação da **V2** (`docs/`), mantidas como documentação histórica do que existe naquela pasta — não são mais a descrição do sistema em produção. O equivalente atual da V3 está em `v3/docs/` (ver `ARQUITETURA.md`, `GUIA_ADMINISTRADOR.md`, `ROTAS.md`).

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
