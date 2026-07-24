# Central de Chamados — Santa Colomba Agropecuária

Portal único de Tecnologia para gestão de chamados, equipamentos, técnicos e frotas.

## Estrutura do Projeto

```
/
├── index.html              # Shell principal (carrega todos os módulos)
├── chamados_sc.html        # Build standalone (single-file, funciona offline sem servidor)
│
├── assets/
│   ├── styles.css          # Design system completo (45 KB)
│   ├── app.js              # JS consolidado (617 KB)
│   ├── firebase.js         # Firebase SDK + sync layer (módulo ES)
│   └── init.js             # Bootstrap da aplicação
│
├── src/
│   ├── storage.js          # Camada de persistência (localStorage + Firestore)
│   ├── dashboard/
│   │   └── index.js        # KPIs, charts, painel operacional, IA local
│   ├── chamados/
│   │   └── index.js        # CRUD chamados, timeline, checklist, encerramento
│   ├── equipamentos/
│   │   └── index.js        # Cadastro equipamentos, frotas, peças, KB
│   ├── relatorios/
│   │   └── index.js        # Por mês, por responsável, auditoria, exportação
│   ├── usuarios/
│   │   └── index.js        # Login, sessão, perfis, permissões
│   └── config/
│       └── index.js        # Configurações, e-mail, Firebase, técnicos
│
└── data/
    ├── chamados_historico.json   # 3.155 chamados (Jun/2022–Jul/2026)
    ├── equipamentos.json         # 445 equipamentos (planilha xlsx)
    ├── match_map.json            # Vínculo chamado → frota (125 entries)
    └── equip_idx.json            # Índice equipamentos por código
```

## Uso

### Single-file (recomendado para uso local/offline)
Abra `chamados_sc.html` diretamente no navegador. Não precisa de servidor.

### Multi-file (desenvolvimento)
Sirva com qualquer servidor HTTP local:
```bash
npx serve .
# ou
python3 -m http.server 8080
```
Acesse: `http://localhost:8080`

## Firebase

Projeto: **chamdos-sc** (`chamdos-sc.firebaseapp.com`)

Coleções no Firestore:
| Collection | Dados |
|---|---|
| `chamados` | Chamados criados no sistema |
| `encerramentos` | Closedmap com checklist |
| `kb` | Banco de soluções |
| `pecas` | Estoque de peças |
| `movimentacoes` | Entradas/saídas de estoque |
| `events` | Timeline de cada chamado |
| `auditoria` | Log de ações |
| `cad_eq` | Cadastro de equipamentos |
| `cad_tec` | Cadastro de técnicos |
| `usuarios` | Usuários (sem senhas) |

## Stack

- **Frontend**: HTML5 + CSS3 + JS vanilla (sem framework)
- **Dados históricos**: 3.155 chamados embutidos em JSON
- **Persistência local**: localStorage (offline-first)
- **Nuvem**: Firebase Firestore (sync em background)
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
