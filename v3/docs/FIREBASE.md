# Firebase — Central de Chamados V3

**A V3 usa o mesmo projeto Firebase que a V2, sem nenhuma alteração de
configuração, regras ou dados.** Projeto real: `chamdos-sc` (nome
grafado assim mesmo, com o "d" antes do "o" — não é erro de digitação
deste documento, é o id real do projeto). Site de Hosting da V2:
`chamados-sc` (`chamados-sc.web.app`), definido em `firebase.json` na
raiz do repositório — a V3 **não** está nesse Hosting ainda (ver
`DEPLOY.md`).

## Config do client

`v3/src/services/firebase/app.ts` lê a config via variáveis de ambiente
do Vite (`VITE_FIREBASE_*`, ver `v3/.env.example`). Não é segredo: é a
mesma config pública já publicada no bundle da V2
(`docs/js/firebase/firebase.js`) — só migrou de "hardcoded no JS" para
"env do Vite", prática padrão do ecossistema.

## Auth

- `signInWithEmailAndPassword`, com login resolvido antes via lookup na
  coleção pública `logins` (login curto → e-mail real).
- Sessão com `browserSessionPersistence` — dura só enquanto a aba fica
  aberta (decisão de segurança operacional da V2, preservada).
- `useAuthListener()` (`hooks/useAuth.ts`), montado 1x em `App.tsx`,
  escuta `onAuthStateChanged` e só materializa sessão se o doc
  `usuarios/{uid}` existir **e** `status === 'ativo'` — usuário inativo
  com credencial válida no Auth não ganha sessão.
- Criação de conta (`criarContaAuth`, `services/firebase/auth.ts`) usa um
  app Firebase secundário descartável
  (`initializeApp(firebaseConfig, nomeUnico)` + `deleteApp()` no fim) —
  necessário porque `createUserWithEmailAndPassword` autentica
  automaticamente com a conta nova no app em que é chamado, o que
  derrubaria a sessão do admin que está criando o usuário se fosse
  chamado no app principal.

## Firestore — primitivas do client

`services/firebase/firestore.ts` expõe as mesmas operações genéricas da
V2 (`docs/js/firebase/firestore.js`), tipadas:

| Função | Uso |
|---|---|
| `setMerge(col, id, data)` | grava com `merge:true` + `_updatedAt: serverTimestamp()` |
| `getOne(col, id)` | leitura pontual |
| `list(col)` | leitura de coleção inteira, uma vez |
| `buscarPorCampo(col, campo, valor)` | query com `where` |
| `escutarColecao(col, cb)` | `onSnapshot` da coleção inteira (usado por `useFirestoreCollection`) |
| `appendToArrayField(col, id, campo, item, extra?)` | `arrayUnion` — usado para `historico/{num}.eventos` |
| `excluirDocumento(col, id)` | delete |
| `gravarEmLote(col, items)` | `writeBatch`, em blocos de 500 |

Nenhuma dessas funções aceita coleção fora da lista `COL` (as mesmas 9
coleções + `logins`/`_ping` da V2) — ver `FIRESTORE.md`.

## Auditoria

`services/firebase/audit.ts` grava em `auditoria/log_{Date.now()}` a
cada ação sensível (abrir, assumir, registrar evento, encerrar, reabrir,
criar/editar usuário, etc.), só quando há `auth.currentUser` — mesmo
padrão da V2, mesma coleção.

## O que a V3 explicitamente não muda

- `firestore.rules` (raiz do projeto) — não tocado.
- Nenhuma coleção nova, nenhum campo renomeado nos documentos já
  existentes.
- Firebase Storage não é usado (mesma limitação da V2 — fotos ficam só
  em base64 local).
