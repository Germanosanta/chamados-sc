# Permissões (RBAC) — Central de Chamados V3

Tabela portada 1:1 de `docs/js/core/init.js` (`ALL_PERMS`/`PERFIL_PERMS`)
para `v3/src/types/permissoes.ts`. **Esta tabela precisa continuar
manualmente sincronizada com `firestore.rules::permsPadrao()`** na raiz
do projeto — mesmo risco que a V2 já tinha, não é uma regressão
introduzida pela V3. Se um perfil ganhar/perder uma permissão aqui sem
espelhar nas regras, o Firestore vai aceitar ou rejeitar escritas de
forma inconsistente com o que a UI mostra.

## Perfis

| Chave interna | Rótulo exibido |
|---|---|
| `admin` | Administrador |
| `supervisor` | **Gestor** (nome interno mantido, rótulo trocado — mesma decisão da V2) |
| `tecnico` | Técnico |
| `visualizador` | Visualizador |

## Permissões nomeadas (15)

| Chave | Rótulo |
|---|---|
| `p_dashboard` | Dashboard |
| `p_chamados` | Chamados |
| `p_aberto` | Chamados em Aberto |
| `p_encerrados` | Chamados Encerrados |
| `p_novo` | Novo Chamado |
| `p_responsaveis` | Responsáveis |
| `p_relatorios` | Relatórios |
| `p_usuarios` | Cadastro de Usuários |
| `p_config` | Configurações |
| `p_abrir` | Abrir Chamados |
| `p_editar` | Editar Chamados |
| `p_encerrar` | Encerrar Chamados |
| `p_reabrir` | Reabrir Chamados |
| `p_excluir` | Excluir Chamados |
| `p_exportar` | Exportar Relatórios |

## Padrão por perfil (`PERFIL_PERMS`)

| Permissão | admin | supervisor (Gestor) | tecnico | visualizador |
|---|:---:|:---:|:---:|:---:|
| p_dashboard | ✓ | ✓ | ✓ | ✓ |
| p_chamados | ✓ | ✓ | ✓ | ✓ |
| p_aberto | ✓ | ✓ | ✓ | ✓ |
| p_encerrados | ✓ | ✓ | ✓ | ✓ |
| p_novo | ✓ | ✓ | ✓ | |
| p_responsaveis | ✓ | ✓ | | ✓ |
| p_relatorios | ✓ | ✓ | | ✓ |
| p_usuarios | ✓ | | | |
| p_config | ✓ | | | |
| p_abrir | ✓ | ✓ | ✓ | |
| p_editar | ✓ | ✓ | ✓ | |
| p_encerrar | ✓ | ✓ | | |
| p_reabrir | ✓ | ✓ | | |
| p_excluir | ✓ | | | |
| p_exportar | ✓ | ✓ | | ✓ |

`admin` sempre recebe todas as 15 (`[...ALL_PERMS_KEYS]`), não uma cópia
manual — não pode divergir por esquecimento.

## Onde isso é aplicado

- **Guard de rota** — `layouts/ProtectedRoute.tsx` + mapa
  `PERM_BY_SECTION` (`router.tsx`), construído a partir de
  `utils/sections.ts::NAV_TOP/NAV_GROUPS/NAV_BOTTOM` (ver `ROTAS.md`).
- **UI condicional** — `hooks/usePermission.ts` (`usePermission('p_x')`),
  usado por exemplo para esconder os botões de Encerrar/Reabrir no
  Centro Operacional.
- **Resolução efetiva** — `store/session.ts::temPermissao()`: usa
  `usuario.perms` se o documento tiver um override explícito gravado;
  senão cai no padrão do perfil (`permsPadrao()`). Usuário sem sessão
  nunca tem permissão nenhuma (nega por padrão).
- **Firestore** — `firestore.rules` (raiz do projeto, não faz parte da
  V3, não foi tocado) aplica a mesma lógica no servidor.
