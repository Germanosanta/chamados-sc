// ══════════════════════════════════════════════════════════════
// STORAGE — Camada de persistência HÍBRIDA
// Fonte principal : Firebase Firestore (via src/firestoreStorage.js)
// Cache offline   : localStorage
//
// Modelo híbrido:
//   • get*()  → leem do cache local (SÍNCRONO, para manter compatibilidade
//                com todo o projeto). O cache é mantido espelhando o Firestore
//                pelo startup-sync + listeners em tempo real de assets/firebase.js
//                — ou seja, na prática o Firestore é a fonte que alimenta o cache.
//   • save*() → gravam no cache local (síncrono, resposta imediata na UI) E
//                empurram para o Firestore (assíncrono/best-effort, via
//                window.FirestoreStorage — src/firestoreStorage.js, único módulo
//                que fala com o Firestore). Funciona offline: se o Firestore não
//                estiver disponível, apenas o cache é gravado e a sincronização
//                ocorre quando a conexão voltar.
//
// Coleções PADRONIZADAS no Firestore (9):
//   usuarios · equipamentos · chamados · historico · pecas ·
//   movimentacoes · auditoria · configuracoes · tecnicos
//
//   Mapa cache(localStorage) → coleção/documento Firestore:
//     chm_local_v1   (chamados)      → chamados/{num}          (sem fotos base64)
//     chm_users_v1   (usuários)      → usuarios/{id}           (sem senha)
//     chm_pecas_v1   (peças)         → pecas/{id}
//     chm_movs_v1    (movimentações) → movimentacoes/{id}
//     chm_audit_v1   (auditoria)     → auditoria/{log_ts}
//     chm_cad_eq_v1  (equipamentos)  → equipamentos/{frota}
//     chm_events_v1  (timeline)      → historico/{num}.eventos
//     chm_closed_v1  (encerramentos) → historico/{num}.encerramento
//     chm_kb_v1      (soluções/KB)   → configuracoes/kb__{id}
//     chm_cad_tec_v1 (téc./resp.)    → tecnicos/{key}
//   A sessão de login permanece SOMENTE em sessionStorage — nunca vai ao Firestore.
// ══════════════════════════════════════════════════════════════

// ── Nomes padronizados das coleções (fonte única da verdade neste script clássico;
//    idêntico a src/firestoreStorage.js#COL, que ainda não existe no escopo global
//    quando este arquivo é avaliado — ver ordem de carregamento em index.html)
const FS_COL = {
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
if (typeof window !== 'undefined') window.FS_COL = FS_COL;

// ── Keys (cache local — formato inalterado, garante compatibilidade)
const LOCAL_KEY        = 'chm_local_v1';
const CLOSED_KEY       = 'chm_closed_v1';
const USERS_KEY        = 'chm_users_v1';
const SESSION_KEY      = 'chm_session_v1';   // sessionStorage
const KB_KEY           = 'chm_kb_v1';
const PECAS_KEY        = 'chm_pecas_v1';
const MOV_KEY          = 'chm_movs_v1';
const EVENTS_KEY       = 'chm_events_v1';
const AUDIT_KEY        = 'chm_audit_v1';
const CADASTRO_EQ_KEY  = 'chm_cad_eq_v1';
const CADASTRO_TEC_KEY = 'chm_cad_tec_v1';

// ── Ponte para o Firestore — toda comunicação passa por window.FirestoreStorage
//    (src/firestoreStorage.js). Best-effort: não bloqueia a UI, seguro offline.
function _fbReady() { return typeof window !== 'undefined' && !!window.FirestoreStorage; }
function _fbCall(label, promiseFactory) {
  if (!_fbReady()) { _pendingSyncMark(label); return; }
  try {
    Promise.resolve(promiseFactory())
      .then(res => {
        if (res && res.ok === false) { console.warn('[Storage]', label, 'falhou:', res.error); _pendingSyncMark(label); }
        else { _pendingSyncClear(label); }
      })
      .catch(e => { console.warn('[Storage]', label, 'falhou:', e.message); _pendingSyncMark(label); });
  } catch (e) { console.warn('[Storage]', label, 'falhou:', e.message); _pendingSyncMark(label); }
}

// ── Fila de sincronização pendente (Fase 4) — quando uma escrita falha (ou
// o Firebase ainda não terminou de inicializar), guarda só o RÓTULO do tipo
// de dado; os dados em si já estão salvos no localStorage (padrão local-
// primeiro de sempre, ver save*() abaixo), nada se perde na UI. O reenvio
// (flushPendingSync) refaz o push direto pelas funções de FirestoreStorage —
// não pelos save*() com diff (achado C2, Fase 1): depois de uma tentativa
// falha, "antes" e "depois" no localStorage já ficam iguais, então o diff
// não veria mais nada pra reenviar. Reenviar tudo de novo é seguro (setDoc
// é idempotente) e os conjuntos aqui são só dados criados localmente
// (pequenos) — nunca o histórico estático inteiro.
const SYNC_PENDING_KEY = 'chm_sync_pending_v1';

function _pendingSyncMark(label) {
  try {
    const set = new Set(JSON.parse(localStorage.getItem(SYNC_PENDING_KEY) || '[]'));
    set.add(label);
    localStorage.setItem(SYNC_PENDING_KEY, JSON.stringify([...set]));
  } catch (e) {}
}
function _pendingSyncClear(label) {
  try {
    const set = new Set(JSON.parse(localStorage.getItem(SYNC_PENDING_KEY) || '[]'));
    if (!set.has(label)) return;
    set.delete(label);
    localStorage.setItem(SYNC_PENDING_KEY, JSON.stringify([...set]));
  } catch (e) {}
}

const SYNC_FLUSH_ACTIONS = {
  'salvarChamado':                 () => Promise.all(getLocal().map(rec => window.FirestoreStorage.salvarChamado(rec))),
  'salvarHistorico(encerramento)': () => Promise.all(Object.entries(getClosedMap()).map(([num, ci]) => window.FirestoreStorage.salvarHistorico(num, { num, encerramento: ci }))),
  'salvarHistorico(eventos)':      () => Promise.all(Object.entries(getEvents()).map(([num, lst]) => window.FirestoreStorage.salvarHistorico(num, { num, eventos: lst }))),
  'salvarConfiguracao(kb)':        () => Promise.all(getKB().map(k => window.FirestoreStorage.salvarConfiguracao('kb__'+k.id, { __kind:'kb', ...k }))),
  'salvarPeca':                    () => Promise.all(getPecas().map(p => window.FirestoreStorage.salvarPeca(p))),
  'salvarMovimentacao':            () => Promise.all(getMovs().map(m => window.FirestoreStorage.salvarMovimentacao(m))),
  'registrarAuditoria':            () => { const a = getAudit(); const last = a[a.length-1]; return last ? window.FirestoreStorage.registrarAuditoria(last) : Promise.resolve({ok:true}); },
  'salvarEquipamento':             () => Promise.all(Object.entries(getCadEq()).map(([frota, data]) => window.FirestoreStorage.salvarEquipamento(frota, data))),
  'salvarTecnico':                 () => Promise.all(Object.entries(getCadTec()).map(([key, data]) => window.FirestoreStorage.salvarTecnico(key, data))),
};

// Disparado por: evento 'online', um intervalo de 60s, e o boot da app
// (core/init.js) — cobre o caso (iOS Safari, entre outros) onde a
// Background Sync API nativa do Service Worker não existe.
function flushPendingSync() {
  if (!_fbReady() || (typeof navigator!=='undefined' && navigator.onLine===false)) return;
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem(SYNC_PENDING_KEY) || '[]'); } catch (e) { return; }
  pending.forEach((label) => {
    const acao = SYNC_FLUSH_ACTIONS[label];
    if (!acao) { _pendingSyncClear(label); return; } // rótulo desconhecido (versão antiga) — descarta
    Promise.resolve(acao())
      .then((res) => {
        const results = Array.isArray(res) ? res : [res];
        const ok = results.every(r => !r || r.ok !== false);
        if (ok) _pendingSyncClear(label);
      })
      .catch(() => {}); // continua pendente, tenta de novo na próxima
  });
}

// ── Comparação usada só para decidir o que precisa ser reenviado ao
// Firestore (nunca para lógica de negócio). "ignore" descarta campos que não
// vão pro Firestore mesmo (ex.: fotos em base64), pra não disparar um envio
// só porque um campo local-only mudou.
function _fsIgual(a, b, ignore) {
  if (!ignore || !ignore.length) return JSON.stringify(a) === JSON.stringify(b);
  const strip = o => { if (!o) return o; const c = {...o}; ignore.forEach(k => delete c[k]); return c; };
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

// Corrige o achado C2 do relatório técnico (29/07/2026): antes, todo save*()
// reenviava ao Firestore TODOS os itens do array/mapa a cada chamada, mesmo
// os que não mudaram desde o último save — como esses arrays só crescem
// (chamados tocados, peças, etc.), uma única ação disparava uma escrita por
// item já tocado. Agora só o que de fato mudou (novo ou alterado) é
// reenviado — mesma assinatura, mesmo resultado final no Firestore, só menos
// escritas. Nenhum chamador precisou mudar.
function _pushSoAlterados(oldArr, newArr, idField, pushFn, ignore) {
  const oldMap = new Map((Array.isArray(oldArr)?oldArr:[]).map(x => [x && x[idField], x]));
  (newArr||[]).forEach(item => {
    if (!item || item[idField] == null) return;
    if (_fsIgual(oldMap.get(item[idField]), item, ignore)) return;
    pushFn(item);
  });
}
function _pushMapSoAlterados(oldObj, newObj, pushFn) {
  const old = oldObj || {};
  Object.entries(newObj||{}).forEach(([k, v]) => {
    if (_fsIgual(old[k], v)) return;
    pushFn(k, v);
  });
}

// ── Chamados locais → chamados/{num}
function getLocal()     { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]'); } catch { return []; } }
function saveLocal(arr) {
  const old = getLocal();
  localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));               // cache
  _pushSoAlterados(old, arr, 'num', rec => {
    _fbCall('salvarChamado', () => window.FirestoreStorage.salvarChamado(rec));
  }, ['fotos']); // fotos (base64) não vão ao Firestore — ver salvarChamado()
}

// ── Encerramentos → historico/{num}.encerramento
function getClosedMap()  { try { return JSON.parse(localStorage.getItem(CLOSED_KEY)||'{}'); } catch { return {}; } }
function saveClosed(obj) {
  const old = getClosedMap();
  localStorage.setItem(CLOSED_KEY, JSON.stringify(obj));             // cache
  _pushMapSoAlterados(old, obj, (num, ci) => {
    _fbCall('salvarHistorico(encerramento)', () => window.FirestoreStorage.salvarHistorico(num, { num, encerramento: ci }));
  });
}

// getUsers/saveUsers/getSession/setSession/clearSession/currentUser: única declaração
// em js/modules/usuarios/index.js (script carregado depois deste, é a versão ativa).
// saveUsers ganha o push ao Firestore via _rewrapShadowed em js/firebase/firebase.js.

// ── Banco de Soluções (KB) → configuracoes/kb__{id}
function getKB()       { try { return JSON.parse(localStorage.getItem(KB_KEY)||'[]'); } catch { return []; } }
function saveKB(v)     {
  const old = getKB();
  localStorage.setItem(KB_KEY, JSON.stringify(v));                   // cache
  _pushSoAlterados(old, v, 'id', k => {
    _fbCall('salvarConfiguracao(kb)', () => window.FirestoreStorage.salvarConfiguracao('kb__'+k.id, { __kind:'kb', ...k }));
  });
}

// ── Peças e Estoque → pecas/{id}
function getPecas()    { try { return JSON.parse(localStorage.getItem(PECAS_KEY)||'[]'); } catch { return []; } }
function savePecas(v)  {
  const old = getPecas();
  localStorage.setItem(PECAS_KEY, JSON.stringify(v));                // cache
  _pushSoAlterados(old, v, 'id', p => {
    _fbCall('salvarPeca', () => window.FirestoreStorage.salvarPeca(p));
  });
}

// ── Movimentações → movimentacoes/{id}
function getMovs()     { try { return JSON.parse(localStorage.getItem(MOV_KEY)||'[]'); } catch { return []; } }
function saveMovs(v)   {
  const old = getMovs();
  localStorage.setItem(MOV_KEY, JSON.stringify(v));                  // cache
  _pushSoAlterados(old, v, 'id', m => {
    _fbCall('salvarMovimentacao', () => window.FirestoreStorage.salvarMovimentacao(m));
  });
}

// ── Events log (timeline) → historico/{num}.eventos
function getEvents()   { try { return JSON.parse(localStorage.getItem(EVENTS_KEY)||'{}'); } catch { return {}; } }
// addEvent() abaixo grava direto (localStorage + push ao Firestore só do
// chamado alterado) sem passar por um saveEvents(objeto inteiro) — não existe
// mais essa função genérica, era código morto (nenhuma chamada em lugar nenhum).
function addEvent(num,type,actor,detail) {
  const ev=getEvents();
  if(!ev[num])ev[num]=[];
  ev[num].push({ts:new Date().toISOString(),type,actor,detail:detail||''});
  localStorage.setItem(EVENTS_KEY, JSON.stringify(ev));              // cache
  _fbCall('salvarHistorico(eventos)', () => window.FirestoreStorage.salvarHistorico(num, { num, eventos: ev[num] })); // grava só o chamado alterado
}

// ── Auditoria → auditoria/{log_ts}
function getAudit()    { try { return JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]'); } catch { return []; } }
function saveAudit(v)  {
  if(v.length>2000)v=v.slice(-2000);
  localStorage.setItem(AUDIT_KEY, JSON.stringify(v));                // cache
  const last=v[v.length-1];                                          // grava só a entrada nova (log append-only)
  // Só tenta gravar no Firestore se já existir um usuário autenticado no
  // Firebase Auth (window._auth, exposto por js/firebase/firebase.js) —
  // evita o erro "Missing or insufficient permissions" quando audit() é
  // chamado antes/sem autenticação (ex.: tentativa de login que falhou).
  if (last && window._auth?.currentUser) {
    _fbCall('registrarAuditoria', () => window.FirestoreStorage.registrarAuditoria(last));
  }
}
function audit(tipo,detalhe,chamado) {
  const u=currentUser();
  const logs=getAudit();
  logs.push({ts:new Date().toISOString(),tipo,usuario:u?.nome||'Sistema',login:u?.login||'—',detalhe:detalhe||'',chamado:chamado||''});
  saveAudit(logs);
}

// ── Cadastro Equipamentos → equipamentos/{frota}
function getCadEq()    { try { return JSON.parse(localStorage.getItem(CADASTRO_EQ_KEY)||'{}'); } catch { return {}; } }
function saveCadEq(v)  {
  const old = getCadEq();
  localStorage.setItem(CADASTRO_EQ_KEY, JSON.stringify(v));          // cache
  _pushMapSoAlterados(old, v, (frota, data) => {
    _fbCall('salvarEquipamento', () => window.FirestoreStorage.salvarEquipamento(frota, data));
  });
}

// ── Cadastro Técnicos → tecnicos/{key}
function getCadTec()   { try { return JSON.parse(localStorage.getItem(CADASTRO_TEC_KEY)||'{}'); } catch { return {}; } }
function saveCadTec(v) {
  const old = getCadTec();
  localStorage.setItem(CADASTRO_TEC_KEY, JSON.stringify(v));         // cache
  _pushMapSoAlterados(old, v, (key, data) => {
    _fbCall('salvarTecnico', () => window.FirestoreStorage.salvarTecnico(key, data));
  });
}
