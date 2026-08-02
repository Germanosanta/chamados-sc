# Guia do Desenvolvedor — Central de Chamados V3

## Rodando localmente

```bash
cd v3
npm install
cp .env.example .env.local   # config pública do Firebase — não é segredo
npm run dev                   # http://localhost:5173
```

Login com qualquer usuário real da V2 funciona — é o mesmo Firebase
Auth/Firestore.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc -b`, só type-check (sem emitir) |
| `npm run build` | `tsc -b && vite build` — type-check + build de produção (PWA incluso) |
| `npm run preview` | serve `dist/` localmente |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Regras que não têm exceção

1. **Nunca alterar** `docs/` (V2), `firestore.rules`, coleções ou
   estrutura de campos do Firestore sem decisão de negócio explícita —
   ver `FIREBASE.md`/`FIRESTORE.md`. Qualquer campo novo precisa ser
   conferido contra o código-fonte real da V2 antes da primeira escrita.
2. **Nunca** adicionar um novo `useQuery` só para ler uma coleção
   inteira — o padrão da V3 é `useFirestoreCollection` (tempo real,
   listener compartilhado). `useQuery`/`useMutation` do TanStack Query
   são só para orquestrar **escritas**.
3. **Nunca** duplicar um par label+campo — usar `Campo`/`Meta` de
   `components/shared/FormField.tsx`. Se o campo for um input/select/
   textarea real, passar `htmlFor` no `Campo` **e** `id` igual no
   controle (associação programática com leitor de tela). Se for um
   grupo de botões-toggle sem um único input associável, usar
   `role="group"` + `aria-label` no container.
4. Todo `Dialog`/`Sheet` novo precisa de `DialogTitle` (pode ser
   `className="sr-only"` se o título já aparece visualmente por outro
   elemento) — sem isso o Radix não expõe nome acessível.
5. Toda página nova de listagem entra no roteiro de `React.lazy` em
   `router.tsx` (não import estático) e usa `DataTable` + `Pagination`
   em vez de reinventar tabela/paginação.

## CI

Todo push/PR que toque `v3/**` roda `.github/workflows/v3-ci.yml`
automaticamente (type-check + lint + build, em 2 versões de Node) — é a
principal ferramenta de validação da V3 hoje. Detalhe completo do
pipeline e como interpretar um erro: `BUILD.md`.

## Sem Node.js no ambiente de build da sessão que gerou este código

Várias rodadas de trabalho nesta V3 foram feitas num ambiente sem
Node.js/npm instalado — todo o código foi revisado manualmente (
resolução de imports, balanceamento de chaves/parênteses, conferência de
que cada import realmente existe no módulo de origem) em vez de validado
por `tsc`/`eslint`/`vite build`. Isso **não substitui** rodar
`npm install && npm run lint && npm run build` de verdade antes de
considerar qualquer entrega definitivamente pronta — é a verificação
obrigatória que falta. Ver `ROADMAP.md`.

## Onde procurar cada coisa

- Regra de negócio de chamado (transições de status, cálculo de dias em
  aberto, etc.) → `utils/chamado-helpers.ts`.
- Merge do dataset histórico + Firestore num único `Chamado` →
  `hooks/useChamados.ts`.
- Permissões → `types/permissoes.ts` + `PERMISSOES.md`.
- Estrutura de rota/menu → `utils/sections.ts` + `ROTAS.md`.
