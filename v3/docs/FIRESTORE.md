# Firestore — Coleções (Central de Chamados V3)

Mesmas 9 coleções + auxiliares da V2 (`services/firebase/firestore.ts::COL`).
Os tipos TypeScript abaixo (`v3/src/types/*.ts`) foram conferidos contra
o código-fonte real da V2 antes de qualquer primeira escrita nova, para
não inventar nomes de campo. Nenhuma estrutura foi alterada pela V3.

## `chamados/{num}`

"Registro local" — só existe para chamados abertos pela V3/V2 em tempo
real (o histórico antigo vive só em `src/data/chamados_historico.json`,
nunca no Firestore). Tipo: `types/chamado.ts::Chamado`.

Campos: `num, titulo, cultura, resp, data, status, bucket, desc?, prior?,
categoria?, tecnico?, solicitante?, observacoes?, fotos?[], pecasUsadas?[],
equipCodigo?, equipModelo?, equipGrupo?, equipStatus?, abertoPor?,
dataHoraAbertura?, dataHoraISO?, assumidoPor?, assumidoEm?`.

`fotos` é `{name, type, data(base64)}[]` — nunca gravado de fato no
documento (removido antes do `setMerge`, mesma limitação de tamanho de
documento da V2); fica só em estado local/sessão.

## `historico/{num}`

- `.encerramento`: `{encerradoEm, dataEncerramento, horaEncerramento,
  encerradoPor, status:'Encerrado', solucao, tecnicos, materiais,
  equipamentos, observacoes, checklist:{problemaResolvido,
  testeRealizado, equipamentoLiberado, usuarioInformado}}`.
- `.eventos[]`: `{ts, type, actor, detail?}` — acrescentado via
  `arrayUnion` (`appendToArrayField`), nunca reescrito por inteiro.

Reabrir um chamado limpa `.encerramento` (`encerramento: null` via
`setMerge`) e volta `status` para `'Em Andamento'`.

## `usuarios/{uid}`

Chave = uid do Firebase Auth. Tipo: `types/usuario.ts::Usuario`.

Campos: `id(=uid), nome, login, email, perfil, status, cargo?, perms?[],
precisaTrocarSenha?, migrado?, migradoParaUid?, migradoDeId?, fcmToken?`.
Nunca tem campo `senha` — a senha vive só no Firebase Auth.

## `logins/{loginId}`

Coleção pública auxiliar — `login` (texto curto) → `{email, uid?}`,
usada para resolver o login antes de autenticar por e-mail.

## `tecnicos/{key}`

Chave = apelido (ou primeiro nome) — precisa bater com o que é gravado
no campo `resp` dos chamados. Tipo: `types/tecnico.ts::Tecnico`.

Campos: `key, nome, apelido?, telefone?, email?, area?, cargo?, status
('Ativo'|'Inativo'|'Férias'|'Afastado'), admissao?, obs?, atualizadoEm?,
atualizadoPor?`.

Única fonte dos seletores de "Responsável"/"Técnico" em todo o app
(`hooks/useTecnicos.ts::useTecnicosAtivos()`, filtra `status !== 'Inativo'`)
— não existe nenhuma lista fixa/hardcoded de nomes na V3.

## `equipamentos/{frota}`

Overrides do cadastro por cima da base estática (`src/data/equipamentos.json`
+ `equip_idx.json`). Tipo: `types/equipamento.ts::Equipamento`.

Campos: `frota, patrimonio?, serie?, modelo?, fabricante?, ano?, tipo?,
horimetro?, status?, fazenda?, cultura?, responsavel?, obs?,
atualizadoEm?, atualizadoPor?`.

## `pecas/{id}`

Tipo: `types/peca.ts::Peca`. Campos: `id, nome, qtd, codigo?, categoria?,
unidade, minimo?, local?, fornecedor?, obs?, criadoEm?`.

## `movimentacoes/{id}`

Tipo: `types/peca.ts::Movimentacao`. Campos: `id, pecaId, pecaNome, tipo
('entrada'|'saida'), qtd, before, after, chamado?, obs?, ts, usuario`.
Toda saída/entrada dispara uma movimentação com o saldo antes/depois —
não é só um log de intenção.

## `auditoria/{log_<timestamp>}`

Tipo: `types/auditoria.ts::Auditoria`. Campos: `id, ts, tipo, usuario,
login?, detalhe?, chamado?`. Append-only, gravado por
`services/firebase/audit.ts::audit()`.

## `configuracoes/{id}`

Coleção genérica. Também hospeda o **Banco de Soluções**, com prefixo
`kb__` no id do documento (`configuracoes/kb__{id}`) — mesma convenção
da V2. Tipo do conteúdo KB: `types/auditoria.ts::SolucaoKB` (`id,
problema, categoria, sistema?, solucao, materiais?, tempo?, obs?,
criadoEm?, atualizadoEm?`).

## `_ping`

Documento/coleção de sanidade de conectividade — sem tipo próprio,
não é dado de domínio.

## Dados estáticos (não são Firestore)

`src/data/`: `chamados_historico.json` (tupla posicional `[num, titulo,
cultura, resp, data, status, bucket]`), `equipamentos.json`,
`equip_idx.json` (índice rápido por código), `match_map.json` (chamado→
código de equipamento). Copiados verbatim de `projeto/data/` — mesmo
dataset embutido no bundle da V2.
