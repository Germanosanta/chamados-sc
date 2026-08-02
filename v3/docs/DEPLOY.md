# Deploy — Central de Chamados V3

## Estado atual: V3 não publica em lugar nenhum

A V3 roda **CI apenas** (`.github/workflows/v3-ci.yml`, na raiz do
projeto): instala dependências, type-checka, linta, builda e publica o
artefato do build (`v3-dist-node22`/`v3-dist-node24`) a cada push/PR que
toque `v3/**` — em matrix de 2 versões de Node. Não existe passo de
deploy ativo — decisão explícita, porque o destino de Hosting da V3
ainda não foi definido. Detalhe completo do pipeline: `BUILD.md`.

`firebase.json` (raiz do projeto) só conhece um site de Hosting hoje:

```json
{ "hosting": { "site": "chamados-sc", "public": "docs", ... } }
```

`public: "docs"` é a V2 — a pasta `v3/` não é publicada por acidente em
nenhum deploy existente.

## Job de deploy já preparado (comentado)

O fim de `v3-ci.yml` tem um job `deploy` inteiro comentado, pronto para
ativar quando a V3 for promovida a substituir a V2 oficialmente:

```yaml
#  deploy:
#    needs: verify
#    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
#    ...
#    - uses: FirebaseExtended/action-hosting-deploy@v0
#      with:
#        projectId: chamdos-sc
#        target: v3
#        entryPoint: v3
#        channelId: live
```

## Passos para ativar (quando a decisão de negócio for tomada)

1. Criar um **segundo site de Hosting** no mesmo projeto Firebase
   (`chamdos-sc`) — ex. `chamados-sc-v3` — via `firebase hosting:sites:create`.
2. Adicionar um **target** multi-site em `firebase.json`/`.firebaserc`
   apontando esse novo site para `v3/dist`, **sem alterar** o target/site
   existente da V2 (`chamados-sc` → `docs`).
3. Descomentar o job `deploy` em `v3-ci.yml`, ajustar `target`/`entryPoint`
   conforme o nome real do target criado.
4. Confirmar que o secret `FIREBASE_SERVICE_ACCOUNT` (já usado pelo
   deploy da V2) tem permissão de deploy nesse novo site.
5. Só então — e não antes — a V3 passa a ter uma URL pública.

## Deploy da V2 (contexto, não é escopo da V3)

`.github/workflows/firebase-deploy.yml` publica `docs/` em
`chamados-sc.web.app` a cada push em `main`, via
`FirebaseExtended/action-hosting-deploy@v0` + `FIREBASE_SERVICE_ACCOUNT`.
Esse workflow não foi alterado por nenhuma das mudanças da V3.

## Rodando localmente (sem publicar)

```bash
cd v3
npm install
cp .env.example .env.local
npm run dev       # http://localhost:5173
npm run build     # build de produção (tsc -b && vite build), gera v3/dist
npm run preview   # serve o build local
```
