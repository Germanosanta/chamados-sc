# Deploy — Central de Chamados V3

## Estado atual: infraestrutura pronta, falta 1 passo manual

`firebase.json`/`.firebaserc` (raiz do projeto) e o workflow
`.github/workflows/v3-deploy.yml` já estão configurados para publicar a
V3 num **segundo site de Hosting** (`chamados-sc-v3`), dentro do mesmo
projeto Firebase da V2 (`chamdos-sc`), sem tocar no site/target da V2
(`chamados-sc` → `docs`). O único passo que falta é manual e não pode
ser feito por automação: **criar o site `chamados-sc-v3` de verdade no
Firebase** (ver "Passo 1" abaixo). Até isso acontecer, `v3-deploy.yml`
falha no passo de deploy com "site not found" — o resto do pipeline
(type-check/lint/build) roda normalmente.

## Como o Hosting multi-site está configurado

`firebase.json` (raiz do projeto) — `hosting` agora é uma **lista** com
2 entradas, uma por site, cada uma com seu próprio `public`/`headers`:

```json
{
  "hosting": [
    { "site": "chamados-sc", "public": "docs", "...": "V2 — inalterado" },
    { "target": "v3", "public": "v3/dist", "...": "V3 — novo" }
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

A entrada da V2 em `firebase.json` continua com o mesmo `public`/
`ignore`/`cleanUrls`/`trailingSlash`/`headers` de sempre — só passou a
ser o primeiro item de uma lista em vez de um objeto único (exigência do
Firebase para hospedar mais de um site no mesmo projeto). O `.firebaserc`
da V2 (`"default": "chamdos-sc"`) não foi tocado.

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

## Passo 1 — Criar o site de Hosting "chamados-sc-v3" (uma vez só)

Mesmo procedimento já documentado no `README.md` da raiz para o site da
V2, aplicado a um site novo:

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
`v3-deploy.yml` só builda e publica. Nenhum dos dois altera ou substitui
`.github/workflows/firebase-deploy.yml` (deploy da V2).

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

# Deploy manual só da V3 (não toca no site da V2)
firebase deploy --only hosting:v3

# Deploy manual só da V2 (não toca no site da V3) — equivalente ao que
# firebase-deploy.yml já faz automaticamente
firebase deploy --only hosting:chamados-sc

# Deploy dos dois sites de uma vez (raramente necessário — os workflows
# já fazem isso separadamente e automaticamente)
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
"Reverter". Não afeta o site da V2 (`chamados-sc`) de forma alguma —
são históricos de release completamente independentes.

## Como trocar V2 por V3 no futuro (quando a V3 for promovida)

Isso é uma decisão de negócio, não um passo técnico — quando ela for
tomada:

1. A forma mais simples e reversível: publicar o build da V3 no MESMO
   site `chamados-sc` que a V2 usa hoje, substituindo `docs` por
   `v3/dist` como `public` daquela entrada em `firebase.json`. Nesse
   ponto a V2 deixa de ser publicada (mas o código continua no repo,
   revertível).
2. Alternativa com corte mais controlado: usar
   [canais de preview do Firebase Hosting](https://firebase.google.com/docs/hosting/test-preview-deploy)
   ou trocar o domínio customizado (se houver um configurado) do site
   `chamados-sc` para apontar pro conteúdo da V3 gradualmente.
3. Em qualquer um dos dois casos, **não é preciso mexer em Firestore,
   Authentication ou nas regras** — V2 e V3 sempre leram/escreveram no
   mesmo projeto/coleções; a troca é só de qual build de frontend é
   servido.

## Como manter as duas versões publicadas ao mesmo tempo (hoje)

É exatamente o estado atual desta configuração: `chamados-sc.web.app`
(V2, produção) e `chamados-sc-v3.web.app` (V3, homologação) são sites de
Hosting independentes, com deploys independentes (`firebase-deploy.yml`
e `v3-deploy.yml`), lendo/escrevendo no mesmo Firestore/Auth. Não há
prazo pra isso mudar — os dois continuam publicados em paralelo até uma
decisão explícita de promover a V3.

## Rodando localmente (sem publicar)

```bash
cd v3
npm install
cp .env.example .env.local
npm run dev       # http://localhost:5173
npm run build     # build de produção (tsc -b && vite build), gera v3/dist
npm run preview   # serve o build local
```

## Deploy da V2 (contexto, não é escopo da V3)

`.github/workflows/firebase-deploy.yml` publica `docs/` em
`chamados-sc.web.app` a cada push em `main`, via
`FirebaseExtended/action-hosting-deploy@v0` + `FIREBASE_SERVICE_ACCOUNT`.
Esse workflow não foi alterado por nenhuma das mudanças da V3.
