# Rotas — Central de Chamados V3

Definidas em `v3/src/router.tsx`, geradas a partir de `utils/sections.ts::SECTIONS`
(21 ids, os mesmos 21 da V2 — `docs/js/core/init.js`). Cada seção vira uma
rota `/{id}`, todas carregadas via `React.lazy` (code splitting por tela).

## Árvore

```
/                         → redirect /home
/login                    → AuthLayout > LoginPage
/portal                   → ProtectedRoute > PortalPage
/{section}                → ProtectedRoute > AppShell > [ProtectedRoute perm?] > Page
*                         → redirect /home
```

`AppShell` (sidebar + topbar + `<Suspense>` + `CentroOperacionalModal`
global) envolve todas as 21 seções — inclusive as ainda placeholder, que
já abrem dentro do shell certo em vez de tela em branco.

## Páginas reais (19/21)

| Seção | Página | Permissão |
|---|---|---|
| `home` | HomePage | — |
| `dashboard` | DashboardPage | `p_dashboard` |
| `chamados` | ChamadosPage | `p_chamados` |
| `area-tecnico` | AreaTecnicoPage | — |
| `aberto` | AbertoPage | `p_aberto` |
| `encerrados` | EncerradosPage | `p_encerrados` |
| `pormes` | PorMesPage | — |
| `responsaveis` | ResponsaveisPage | `p_responsaveis` |
| `criticidade` | CriticidadePage | — |
| `painel` | PainelPage | — |
| `auditoria` | AuditoriaPage | — |
| `frotas` | FrotasPage | — |
| `kb` | KBPage | — |
| `pecas` | PecasPage | — |
| `novo` | NovoChamadoPage | `p_novo` |
| `usuarios` | UsuariosPage | `p_usuarios` |
| `equipamentos` | EquipamentosPage | — |
| `tecnicos` | TecnicosPage | — |
| `config` | ConfigPage | `p_config` |

Seções sem permissão listada ficam liberadas para qualquer sessão
autenticada (o guard de `/` já exige login) — mesmo padrão da V2, que só
restringe as seções mais sensíveis por permissão nomeada.

## Placeholders (2/21)

`irrigacao` e `chips` renderizam `PlaceholderPage` — mesmo tratamento
"Em breve" que a própria V2 já dá a esses dois módulos (não são telas
reais na V2 hoje, não é uma lacuna de migração).

## Guards

- `ProtectedRoute` (sem `perm`): exige `usuario` na sessão, senão
  `Navigate to="/login"`.
- `ProtectedRoute perm={p}`: exige também `temPermissao(p)`, senão
  `Navigate to="/home"` (mesmo comportamento de "esconder e redirecionar"
  da V2, que ocultava o item de menu).
- Enquanto a sessão ainda carrega (`carregando`), mostra um spinner em
  vez de decidir precocemente — evita redirecionar pro login durante o
  boot do `onAuthStateChanged`.

## Centro Operacional não é uma rota

O detalhe de um chamado é um modal global (`CentroOperacionalModal`,
montado 1x em `AppShell`), aberto via `useDetalheStore.abrir(num)` de
qualquer lista — não existe `/chamado/:num`. Mesma UX da V2
(`#modal-detalhe`).
