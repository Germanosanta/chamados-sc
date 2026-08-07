# Deploy — Central de Chamados V3

## Estado atual: V3 é a versão oficial em produção

`firebase.json`/`.firebaserc` (raiz do projeto) e o workflow
`.github/workflows/v3-deploy.yml` publicam a V3 no site de Hosting
`chamados-sc-v3`, dentro do projeto Firebase `chamdos-sc`. **A V2 foi
desativada** — o workflow `firebase-deploy.yml` e a entrada de Hosting
que publicavam `docs/` em `chamados-sc.web.app` foram removidos de
`firebase.json`; a pasta `docs/` continua no repositório só para
consulta/histórico, sem ser mais publicada. Todo push em `main` que
toque `v3/**`, `firebase.json` ou `.firebaserc` builda e publica a V3
automaticamente.

## Como o Hosting está configurado

`firebase.json` (raiz do projeto) — `hosting` é uma lista com 1 entrada
ativa (a V3):

```json
{
  "hosting": [
    { "target": "v3", "public": "v3/dist", "...": "V3 — único site publicado" }
  ]
}
```

`.firebaserc` mapeia o `target` lógico `v3` (usado em `firebase.json` e
no workflow) para o site real:

```json
{
  "targets": {
    "chamdos-sc": {
      "hosting": { "v3": ["chamados-sc-v3"] }
    }
  }
}
```

### Por que os headers de cache da V3 são diferentes dos da V2

A V2 (`docs/`) não tem hash de conteúdo no nome dos arquivos JS/CSS —
por isso usa `no-cache, must-revalidate` para forçar o navegador a
sempre checar se há versão nova (é o mecanismo por trás do `?v=` que
`docs/index.html` já usa como cache-busting manual). A V3 (build do
Vite) gera nomes com hash de conteúdo em `v3/dist/assets/*.js`/`*.css`
(ex. `index-a1b2c3d4.js`) — um arquivo com esse nome nunca muda de
conteúdo, então pode (e deve) ser cacheado por 1 ano com `immutable`.
Só `index.html`, `sw.js` e `manifest.webmanifest` continuam
`no-cache` — são os arquivos que referenciam os hashes atuais e disparam
o fluxo de atualização do PWA; se o navegador os cachear,
usuários ficam presos numa versão antiga do app.

## Passo 1 — Criar o site de Hosting "chamados-sc-v3" (já feito ✅)

**Já executado — este site existe.** Mantido aqui só como referência do
procedimento (mesmo já documentado no `README.md` da raiz para o site
da V2), caso seja preciso recriar num outro projeto Firebase no futuro:

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) → projeto **chamdos-sc**.
2. Menu lateral → **Hosting** → **Adicionar site**.
3. Site ID: **`chamados-sc-v3`** (precisa ser exatamente esse — é o valor
   já escrito em `.firebaserc`) → Adicionar.

Ou via CLI, num computador com Node.js/Firebase CLI instalado e já
logado (`firebase login`):

```bash
firebase hosting:sites:create chamados-sc-v3 --project chamdos-sc
```

Depois disso o site existe (vazio) em `https://chamados-sc-v3.web.app`,
pronto para receber o primeiro deploy.

**Não é preciso criar nenhum secret novo** — `FIREBASE_SERVICE_ACCOUNT`
(já configurado no repositório para o deploy da V2, ver `README.md`) usa
o papel "Firebase Hosting Admin" concedido no nível do **projeto**
`chamdos-sc`, que já cobre qualquer site de Hosting dentro dele,
incluindo o novo `chamados-sc-v3`.

## Deploy automático (depois do Passo 1)

`.github/workflows/v3-deploy.yml` roda a cada push em `main` que toque
`v3/**`, `firebase.json` ou `.firebaserc`: instala dependências,
type-checka, linta, builda (`npm run build`, gera `v3/dist`) e publica
via `FirebaseExtended/action-hosting-deploy@v0` no alvo `v3` (site
`chamados-sc-v3`), canal `live`. Também pode ser disparado manualmente
(aba Actions → "V3 Deploy (Homologação)" → "Run workflow").

Continua existindo, separado, o `v3-ci.yml` (type-check/lint/build em 2
versões de Node, sem publicar nada) — ele valida PRs e pushes, o
`v3-deploy.yml` só builda e publica. O workflow que publicava a V2
(`firebase-deploy.yml`) foi removido — a V2 não é mais publicada (ver
"V2 desativada" abaixo).

## Comandos do Firebase CLI (referência — precisa de Node.js/Firebase CLI local)

```bash
# Autenticar (uma vez por máquina)
firebase login

# Selecionar o projeto (já é o "default" em .firebaserc)
firebase use chamdos-sc

# Conferir os targets configurados
firebase target

# Aplicar/reaplicar o mapeamento target -> site (já está em .firebaserc,
# só necessário se precisar recriar do zero)
firebase target:apply hosting v3 chamados-sc-v3

# Build local antes de um deploy manual
cd v3 && npm install && cp .env.example .env && npm run build && cd ..

# Deploy manual da V3 (único site publicado hoje)
firebase deploy --only hosting:v3
# equivalente, já que "hosting" só tem esse alvo configurado:
firebase deploy --only hosting
```

## Rollback

Hosting do Firebase mantém as publicações anteriores por site — dá pra
reverter sem precisar reverter o commit/re-buildar:

```bash
# Ver o histórico de releases do site da V3
firebase hosting:releases:list --project chamdos-sc --site chamados-sc-v3

# Reverter para a release anterior (pelo console é mais simples: Hosting
# > chamados-sc-v3 > aba "Release history" > "..." na release desejada > Rollback)
```

Alternativa sem CLI: Console do Firebase → Hosting → site
`chamados-sc-v3` → histórico de versões → escolher uma versão anterior →
"Reverter".

## V2 desativada (histórico)

A V2 (`docs/`, `chamados-sc.web.app`) foi a versão em produção até a V3
assumir esse papel. A desativação foi feita removendo só a **publicação**
— `.github/workflows/firebase-deploy.yml` e a entrada de Hosting
correspondente em `firebase.json` — sem apagar o código da pasta `docs/`
(mantido pra consulta durante a transição) nem mexer em Firestore,
Authentication ou nas regras. V2 e V3 sempre leram/escreveram no mesmo
projeto/coleções, então nenhum dado foi movido ou precisou de migração
nessa troca — foi só uma questão de qual build de frontend continua
sendo publicado.

Se um dia a pasta `docs/` for de fato removida do repositório, isso é um
passo separado (limpeza de código), sem nenhum efeito nos dados.

## Rodando localmente (sem publicar)

```bash
cd v3
npm install
cp .env.example .env.local
npm run dev       # http://localhost:5173
npm run build     # build de produção (tsc -b && vite build), gera v3/dist
npm run preview   # serve o build local
```

