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
  if (!_fbReady()) return;
  try {
    Promise.resolve(promiseFactory())
      .then(res => { if (res && res.ok === false) console.warn('[Storage]', label, 'falhou:', res.error); })
      .catch(e => console.warn('[Storage]', label, 'falhou:', e.message));
  } catch (e) { console.warn('[Storage]', label, 'falhou:', e.message); }
}

// ── Chamados locais → chamados/{num}
function getLocal()     { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]'); } catch { return []; } }
function saveLocal(arr) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));               // cache
  (arr||[]).forEach(rec => {
    if (!rec || !rec.num) return;
    _fbCall('salvarChamado', () => window.FirestoreStorage.salvarChamado(rec));
  });
}

// ── Encerramentos → historico/{num}.encerramento
// (init.js redefine estas duas; o hook remoto é reaplicado em firebase.js — ver nota no topo)
function getClosedMap()  { try { return JSON.parse(localStorage.getItem(CLOSED_KEY)||'{}'); } catch { return {}; } }
function saveClosed(obj) {
  localStorage.setItem(CLOSED_KEY, JSON.stringify(obj));             // cache
  Object.entries(obj||{}).forEach(([num, ci]) => {
    _fbCall('salvarHistorico(encerramento)', () => window.FirestoreStorage.salvarHistorico(num, { num, encerramento: ci }));
  });
}

// ── Usuários → usuarios/{id} (senha NUNCA é enviada ao Firestore — removida dentro de salvarUsuario)
function getUsers()    { try { const u=JSON.parse(localStorage.getItem(USERS_KEY)); return u||DEFAULT_USERS; } catch { return DEFAULT_USERS; } }
function saveUsers(u)  {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));                // cache
  (u||[]).forEach(usr => {
    if (!usr || !usr.id) return;
    _fbCall('salvarUsuario', () => window.FirestoreStorage.salvarUsuario(usr));
  });
}

// ── Session (sessionStorage — local apenas, fora do Firestore)
function getSession()  { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function setSession(u) { sessionStorage.setItem(SESSION_KEY,JSON.stringify(u)); }
function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }

// ── Banco de Soluções (KB) → configuracoes/kb__{id}
function getKB()       { try { return JSON.parse(localStorage.getItem(KB_KEY)||'[]'); } catch { return []; } }
function saveKB(v)     {
  localStorage.setItem(KB_KEY, JSON.stringify(v));                   // cache
  (v||[]).forEach(k => {
    if (!k || !k.id) return;
    _fbCall('salvarConfiguracao(kb)', () => window.FirestoreStorage.salvarConfiguracao('kb__'+k.id, { __kind:'kb', ...k }));
  });
}

// ── Peças e Estoque → pecas/{id}
function getPecas()    { try { return JSON.parse(localStorage.getItem(PECAS_KEY)||'[]'); } catch { return []; } }
function savePecas(v)  {
  localStorage.setItem(PECAS_KEY, JSON.stringify(v));                // cache
  (v||[]).forEach(p => {
    if (!p || !p.id) return;
    _fbCall('salvarPeca', () => window.FirestoreStorage.salvarPeca(p));
  });
}

// ── Movimentações → movimentacoes/{id}
function getMovs()     { try { return JSON.parse(localStorage.getItem(MOV_KEY)||'[]'); } catch { return []; } }
function saveMovs(v)   {
  localStorage.setItem(MOV_KEY, JSON.stringify(v));                  // cache
  (v||[]).forEach(m => {
    if (!m || !m.id) return;
    _fbCall('salvarMovimentacao', () => window.FirestoreStorage.salvarMovimentacao(m));
  });
}

// ── Events log (timeline) → historico/{num}.eventos
function getEvents()   { try { return JSON.parse(localStorage.getItem(EVENTS_KEY)||'{}'); } catch { return {}; } }
function saveEvents(v) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(v));               // cache
  Object.entries(v||{}).forEach(([num, evs]) => {
    _fbCall('salvarHistorico(eventos)', () => window.FirestoreStorage.salvarHistorico(num, { num, eventos: evs }));
  });
}
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
  if (last) _fbCall('registrarAuditoria', () => window.FirestoreStorage.registrarAuditoria(last));
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
  localStorage.setItem(CADASTRO_EQ_KEY, JSON.stringify(v));          // cache
  Object.entries(v||{}).forEach(([frota, data]) => {
    _fbCall('salvarEquipamento', () => window.FirestoreStorage.salvarEquipamento(frota, data));
  });
}

// ── Cadastro Técnicos → tecnicos/{key}
function getCadTec()   { try { return JSON.parse(localStorage.getItem(CADASTRO_TEC_KEY)||'{}'); } catch { return {}; } }
function saveCadTec(v) {
  localStorage.setItem(CADASTRO_TEC_KEY, JSON.stringify(v));         // cache
  Object.entries(v||{}).forEach(([key, data]) => {
    _fbCall('salvarTecnico', () => window.FirestoreStorage.salvarTecnico(key, data));
  });
}
