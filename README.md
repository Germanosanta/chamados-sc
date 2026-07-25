# Central de Chamados — Santa Colomba Agropecuária

Portal único de Tecnologia para gestão de chamados, equipamentos, técnicos e frotas.

## Estrutura do Projeto

```
/
├── firebase.json           # Config do Firebase Hosting/Firestore (deploy)
├── .firebaserc              # Projeto Firebase padrão (chamdos-sc)
├── firestore.rules          # Regras do Firestore (revisar antes de deploy — ver aviso no arquivo)
│
├── public/                  # Tudo que é servido pelo Firebase Hosting
│   ├── index.html           # Shell principal (carrega todos os módulos)
│   ├── manifest.json        # Metadados do app (PWA básico)
│   ├── img/
│   │   └── coa.jpeg         # Logo/imagem institucional (login, favicon)
│   ├── css/
│   │   └── style.css        # Design system completo
│   └── js/
│       ├── firebase/
│       │   ├── firebase.js  # Bootstrap do SDK + sync layer (módulo ES)
│       │   └── firestore.js # Camada única de acesso ao Firestore
│       ├── core/
│       │   ├── storage.js   # Persistência (localStorage + Firestore)
│       │   └── init.js      # Bootstrap da aplicação, navegação, menu
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
├── data/                    # Sobras vazias (*.json) — não usadas, candidatas a remoção futura
│
└── legacy/                  # Artefatos legados, fora do app servido
    ├── chamados_sc.html     # Build standalone single-file (cópia própria da lógica Firebase)
    ├── app.js               # JS consolidado antigo (não referenciado por nenhum HTML ativo)
    └── importar.html        # Ferramenta avulsa de importação em massa
```

> Reorganização em andamento (migração para Firebase Hosting). Ver roadmap completo no plano da sessão. Módulos ainda são `<script>` clássicos com escopo global compartilhado — conversão para ES modules reais é etapa futura, separada.

## Uso

### Desenvolvimento (multi-file)
Sirva a pasta `public/` com qualquer servidor HTTP local (não abra `public/index.html` direto do disco — os módulos `firebase.js`/`firestore.js` são ES modules e exigem `http(s)://`, não `file://`):
```bash
cd public
npx serve .
# ou
python3 -m http.server 8080
```
Acesse: `http://localhost:8080`

### Deploy (Firebase Hosting)
Requer [Firebase CLI](https://firebase.google.com/docs/cli) autenticado (`firebase login`) com acesso ao projeto `chamdos-sc`:
```bash
firebase deploy --only hosting
```
**Antes do primeiro deploy de regras** (`firebase deploy --only firestore:rules`), revise `firestore.rules` — o arquivo documenta por que está permissivo hoje (o app não usa Firebase Auth) e o que precisa ser decidido antes de aplicar em produção.

### Single-file legado (offline)
`legacy/chamados_sc.html` continua funcionando como build standalone (não recebe as correções feitas no app modular a partir desta reorganização).

## Firebase

Projeto: **chamdos-sc** (`chamdos-sc.firebaseapp.com`)

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
- **Técnicos** — Cards de performance, cadastro com telefone/email/área, ranking
- **Usuários** — Gestão de usuários e perfis com 15 permissões granulares
- **Relatórios** — Por mês, por responsável, auditoria/logs, exportação CSV
- **Configurações** — E-mail, Firebase, tema, dados
