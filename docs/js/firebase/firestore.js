// ══════════════════════════════════════════════════════════════
// FIRESTORE STORAGE — único módulo com acesso direto ao Firestore
// Toda comunicação com o Firestore do projeto passa por aqui.
// Chamado por assets/firebase.js (bootstrap), que fornece a instância
// do banco via configure(db). Exposto em window.FirestoreStorage
// para uso pelos scripts clássicos (src/storage.js).
//
// Coleções padronizadas (9): usuarios, equipamentos, chamados,
// historico, pecas, movimentacoes, auditoria, configuracoes, tecnicos
// ══════════════════════════════════════════════════════════════

import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc,
  onSnapshot, serverTimestamp, query, where, orderBy, limit, startAfter, writeBatch,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export const COL = {
  USUARIOS:      'usuarios',
  EQUIPAMENTOS:  'equipamentos',
  CHAMADOS:      'chamados',
  HISTORICO:     'historico',
  PECAS:         'pecas',
  MOVIMENTACOES: 'movimentacoes',
  AUDITORIA:     'auditoria',
  CONFIGURACOES: 'configuracoes',
  TECNICOS:      'tecnicos',
};

let _db = null;

// ── Chamado por assets/firebase.js logo após criar a instância do Firestore.
export function configure(db) { _db = db; }

function _ready() {
  if (!_db) { console.warn('[FirestoreStorage] chamada antes de configure(db) — ignorando.'); return false; }
  return true;
}
function _err(op, ...ctx) {
  return (e) => { console.error('[FirestoreStorage]', op, 'falhou:', ...ctx, e.message); return { ok:false, data:null, error:e.message }; };
}

// ══════════════════════════════════════════════════════════════
// Primitivas genéricas internas
// ══════════════════════════════════════════════════════════════

async function _setMerge(col, id, data) {
  if (!_ready() || id == null || id === '') return { ok:false, data:null, error:'db não configurado ou id ausente' };
  try {
    await setDoc(doc(_db, col, String(id)), { ...data, _updatedAt: serverTimestamp() }, { merge:true });
    return { ok:true, data:{ id, ...data }, error:null };
  } catch (e) { return _err('_setMerge', col, id)(e); }
}

async function _getOne(col, id) {
  if (!_ready()) return { ok:false, data:null, error:'db não configurado' };
  try {
    const snap = await getDoc(doc(_db, col, String(id)));
    return { ok:true, data: snap.exists() ? { id: snap.id, ...snap.data() } : null, error:null };
  } catch (e) { return _err('_getOne', col, id)(e); }
}

// Busca documentos de uma coleção por igualdade num campo — usado no login
// para achar o doc antigo de "usuarios" pelo e-mail quando o id do doc não
// bate com o uid do Firebase Auth (ver docs/js/modules/usuarios/index.js).
async function _buscarPorCampo(col, campo, valor) {
  if (!_ready()) return { ok:false, data:null, error:'db não configurado' };
  try {
    const snap = await getDocs(query(collection(_db, col), where(campo, '==', valor)));
    return { ok:true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })), error:null };
  } catch (e) { return _err('_buscarPorCampo', col, campo)(e); }
}

// Lista uma coleção inteira ou paginada. opts: { pageSize, cursor, orderByField }
// cursor é o último doc snapshot retornado (para a próxima página); retorna também
// o cursor da página atual em data.nextCursor para permitir lazy-loading incremental.
async function _listPaginated(col, opts = {}) {
  if (!_ready()) return { ok:false, data:null, error:'db não configurado' };
  const { pageSize, cursor, orderByField } = opts;
  try {
    const clauses = [];
    if (orderByField) clauses.push(orderBy(orderByField));
    if (cursor)        clauses.push(startAfter(cursor));
    if (pageSize)      clauses.push(limit(pageSize));
    const q = clauses.length ? query(collection(_db, col), ...clauses) : collection(_db, col);
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const nextCursor = (pageSize && snap.docs.length === pageSize) ? snap.docs[snap.docs.length - 1] : null;
    return { ok:true, data:{ items, nextCursor }, error:null };
  } catch (e) { return _err('_listPaginated', col)(e); }
}

async function _deleteOne(col, id) {
  if (!_ready() || id == null || id === '') return { ok:false, data:null, error:'db não configurado ou id ausente' };
  try {
    await deleteDoc(doc(_db, col, String(id)));
    return { ok:true, data:{ id }, error:null };
  } catch (e) { return _err('_deleteOne', col, id)(e); }
}

// items: [{col, id, data}]. Usa write batch (limite do Firestore: 500 ops/batch).
async function _batchWrite(items) {
  if (!_ready()) return { ok:false, data:null, error:'db não configurado' };
  if (!items || !items.length) return { ok:true, data:{ count:0 }, error:null };
  try {
    let count = 0;
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500);
      const batch = writeBatch(_db);
      chunk.forEach(({ col, id, data }) => {
        batch.set(doc(_db, col, String(id)), { ...data, _updatedAt: serverTimestamp() }, { merge:true });
      });
      await batch.commit();
      count += chunk.length;
    }
    return { ok:true, data:{ count }, error:null };
  } catch (e) { return _err('_batchWrite')(e); }
}

// Listener em tempo real numa coleção inteira. Retorna a função de unsubscribe.
function _listen(col, callback) {
  if (!_ready()) return () => {};
  return onSnapshot(collection(_db, col), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, err => console.warn('[FirestoreStorage] listen erro:', col, err.message));
}

// ══════════════════════════════════════════════════════════════
// CHAMADOS
// ══════════════════════════════════════════════════════════════

export async function listarChamados(opts) { return _listPaginated(COL.CHAMADOS, opts); }

export async function salvarChamado(chamado) {
  if (!chamado || !chamado.num) return { ok:false, data:null, error:'chamado sem número (num)' };
  const { fotos, ...safe } = chamado; // fotos (base64) excedem o limite de tamanho de documento do Firestore
  return _setMerge(COL.CHAMADOS, chamado.num, safe);
}

export async function atualizarChamado(num, patch) {
  if (!num) return { ok:false, data:null, error:'num ausente' };
  const { fotos, ...safe } = patch || {};
  return _setMerge(COL.CHAMADOS, num, safe);
}

export async function excluirChamado(num) { return _deleteOne(COL.CHAMADOS, num); }

// ══════════════════════════════════════════════════════════════
// EQUIPAMENTOS
// ══════════════════════════════════════════════════════════════

export async function listarEquipamentos(opts) { return _listPaginated(COL.EQUIPAMENTOS, opts); }
export async function salvarEquipamento(frota, data) { return _setMerge(COL.EQUIPAMENTOS, frota, data); }

// ══════════════════════════════════════════════════════════════
// USUÁRIOS
// ══════════════════════════════════════════════════════════════

export async function listarUsuarios(opts) { return _listPaginated(COL.USUARIOS, opts); }

export async function salvarUsuario(usuario) {
  if (!usuario || !usuario.id) return { ok:false, data:null, error:'usuário sem id' };
  const { senha, ...safe } = usuario; // senha nunca é enviada ao Firestore
  return _setMerge(COL.USUARIOS, usuario.id, safe);
}

// ══════════════════════════════════════════════════════════════
// TÉCNICOS
// ══════════════════════════════════════════════════════════════

export async function listarTecnicos(opts) { return _listPaginated(COL.TECNICOS, opts); }
export async function salvarTecnico(key, data) { return _setMerge(COL.TECNICOS, key, data); }

// ══════════════════════════════════════════════════════════════
// PEÇAS
// ══════════════════════════════════════════════════════════════

export async function listarPecas(opts) { return _listPaginated(COL.PECAS, opts); }

export async function salvarPeca(peca) {
  if (!peca || !peca.id) return { ok:false, data:null, error:'peça sem id' };
  return _setMerge(COL.PECAS, peca.id, peca);
}

// ══════════════════════════════════════════════════════════════
// HISTÓRICO (timeline de eventos + encerramento por chamado)
// ══════════════════════════════════════════════════════════════

export async function listarHistorico(opts) { return _listPaginated(COL.HISTORICO, opts); }

export async function salvarHistorico(num, data) {
  if (!num) return { ok:false, data:null, error:'num ausente' };
  return _setMerge(COL.HISTORICO, num, data);
}

// ══════════════════════════════════════════════════════════════
// Extras de paridade — MOVIMENTAÇÕES, AUDITORIA, CONFIGURAÇÕES (KB/email)
// Necessários para não quebrar nenhuma chamada existente do restante do app.
// ══════════════════════════════════════════════════════════════

export async function listarMovimentacoes(opts) { return _listPaginated(COL.MOVIMENTACOES, opts); }
export async function salvarMovimentacao(mov) {
  if (!mov || !mov.id) return { ok:false, data:null, error:'movimentação sem id' };
  return _setMerge(COL.MOVIMENTACOES, mov.id, mov);
}

export async function listarAuditoria(opts) { return _listPaginated(COL.AUDITORIA, opts); }
export async function registrarAuditoria(entry) {
  if (!entry) return { ok:false, data:null, error:'entrada de auditoria vazia' };
  return _setMerge(COL.AUDITORIA, 'log_' + Date.now(), entry);
}

export async function listarConfiguracoes(opts) { return _listPaginated(COL.CONFIGURACOES, opts); }
export async function salvarConfiguracao(id, data) { return _setMerge(COL.CONFIGURACOES, id, data); }

// ══════════════════════════════════════════════════════════════
// Genéricas (uso por assets/firebase.js para fsSave/fsGet/fsList/fsListen/batch)
// ══════════════════════════════════════════════════════════════

export const salvarDocumento   = _setMerge;
export const lerDocumento      = _getOne;
export const listarColecao     = _listPaginated;
export const excluirDocumento  = _deleteOne;
export const gravarEmLote      = _batchWrite;
export const escutarColecao    = _listen;
export const buscarPorCampo    = _buscarPorCampo;

const FirestoreStorage = {
  configure, COL,
  listarChamados, salvarChamado, atualizarChamado, excluirChamado,
  listarEquipamentos, salvarEquipamento,
  listarUsuarios, salvarUsuario,
  listarTecnicos, salvarTecnico,
  listarPecas, salvarPeca,
  listarHistorico, salvarHistorico,
  listarMovimentacoes, salvarMovimentacao,
  listarAuditoria, registrarAuditoria,
  listarConfiguracoes, salvarConfiguracao,
  salvarDocumento, lerDocumento, listarColecao, excluirDocumento, gravarEmLote, escutarColecao,
  buscarPorCampo,
};
if (typeof window !== 'undefined') window.FirestoreStorage = FirestoreStorage;
export default FirestoreStorage;
