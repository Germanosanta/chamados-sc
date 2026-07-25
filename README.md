# Central de Chamados — Santa Colomba Agropecuária

Portal único de Tecnologia para gestão de chamados, equipamentos, técnicos e frotas.

**Produção: Firebase Hosting** (`https://chamdos-sc.web.app` — ver aviso importante sobre o nome do projeto na seção Firebase abaixo). GitHub é usado apenas para versionamento; o deploy acontece automaticamente a cada push na `main` via GitHub Actions (ver seção CI/CD).

## Estrutura do Projeto

```
/
├── .github/workflows/
│   └── firebase-deploy.yml # Deploy automático no Firebase Hosting a cada push na main
├── firebase.json           # Config do Firebase Hosting/Firestore (hosting.public = "public")
├── .firebaserc              # Projeto Firebase padrão (chamdos-sc)
├── firestore.rules          # Regras do Firestore (revisar antes de deploy — ver aviso no arquivo)
│
├── public/                  # Tudo que é servido pelo Firebase Hosting
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
│           ├── chamados_historico.js  # 3.155 chamados (Jun/2022–Jul/2026)
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

## Uso

### Desenvolvimento (multi-file)
Sirva a pasta `public/` com qualquer servidor HTTP local (não abra `public/index.html` direto do disco — os módulos `firebase.js`/`firestore.js` são ES modules e exigem `http(s)://`, não `file://`):
```bash
cd public
npx serve .
# ou
python3 -m http.server 8080
```

### Deploy manual (Firebase Hosting)
Requer [Firebase CLI](https://firebase.google.com/docs/cli) instalado e autenticado:
```bash
npm install -g firebase-tools
firebase login
firebase use chamdos-sc
firebase deploy --only hosting
```
**Antes do primeiro deploy de regras** (`firebase deploy --only firestore:rules`), revise `firestore.rules` — o arquivo documenta por que está permissivo hoje (o app não usa Firebase Auth) e o que precisa ser decidido antes de aplicar em produção.

### Deploy automático (CI/CD — GitHub Actions)
`.github/workflows/firebase-deploy.yml` já está configurado para rodar `firebase deploy` a cada `git push origin main`. Só falta um passo manual (não pode ser feito por automação, exige acesso à conta Google/Firebase do dono do projeto):

1. Gerar uma conta de serviço: `firebase init hosting:github` (guiado) **ou** manualmente em [console.cloud.google.com](https://console.cloud.google.com) → IAM → Contas de serviço → criar uma com papel "Firebase Hosting Admin" → gerar chave JSON.
2. No GitHub: repositório → Settings → Secrets and variables → Actions → New repository secret → nome `FIREBASE_SERVICE_ACCOUNT`, valor = conteúdo do JSON gerado.
3. A partir daí, todo push na `main` dispara o deploy sozinho — sem precisar rodar `firebase deploy` manualmente de novo.

### Single-file legado (offline)
`legacy/chamados_sc.html` continua funcionando como build standalone (não recebe as correções feitas no app modular a partir da reorganização).

## Firebase

**⚠️ Atenção ao nome do projeto**: o projeto Firebase real (usado no SDK, `authDomain`, `storageBucket`) é **`chamdos-sc`** (sem o "a" de "chamados" — provavelmente um typo de quando o projeto foi criado no console do Firebase, mas é o nome real e não deve ser alterado sem migrar todos os dados). A URL padrão de Hosting desse projeto é `https://chamdos-sc.web.app`, **não** `https://chamados-sc.web.app`. Se você criou/pretende usar um projeto chamado literalmente `chamados-sc`, é um projeto **diferente**, sem os dados/coleções já existentes.

Coleções no Firestore (nomes reais, via `public/js/firebase/firestore.js`):
| Collection | Dados |
|---|---|
| `chamados` | Chamados criados no sistema |
| `historico` | Eventos de timeline + dados de encerramento por chamado |
| `usuarios` | Usuários (sem campo `senha`, mantido só localmente) |
| `equipamentos` | Cadastro de equipamentos/frotas |
| `tecnicos` | Cadastro de técnicos |
| `pecas` | Estoque de peças |
| `movimentacoes` | Entradas/saídas de estoque |
| `auditoria` | Log de ações (append-only) |
| `configuracoes` | Configurações gerais + Banco de Soluções (prefixo `kb__`) |

## Stack

- **Frontend**: HTML5 + CSS3 + JS vanilla (sem framework)
- **Dados históricos**: 3.155 chamados embutidos em JS
- **Persistência local**: localStorage (offline-first)
- **Nuvem**: Firebase Firestore (sync em background) + Firebase Hosting
- **Fontes**: Inter + JetBrains Mono (Google Fonts)
- **Charts**: Chart.js 4.4.1

## Credenciais padrão

| Login | Senha | Perfil |
|---|---|---|
| admin | admin123 | Administrador |
| guilherme | guilherme123 | Supervisor |
| walison | walison123 | Técnico |

## Módulos

- **Dashboard** — KPIs por status, charts mensais, painel operacional em tempo real, IA local
- **Chamados** — CRUD completo, timeline vertical, fotos, peças, checklist de encerramento
- **Equipamentos** — Cadastro de 445 equipamentos, frotas, peças e estoque, banco de soluções
- **Frotas** — Histórico de chamados por frota/equipamento
- **Técnicos** — Cards de performance, cadastro com telefone/email/área, ranking (lista de técnicos do formulário de chamado vem do cadastro real, não é fixa)
- **Usuários** — Gestão de usuários e perfis com 15 permissões granulares (criação/edição restrita a administradores)
- **Relatórios** — Por mês, por responsável, auditoria/logs, exportação CSV
- **Configurações** — E-mail, Firebase, tema, dados
