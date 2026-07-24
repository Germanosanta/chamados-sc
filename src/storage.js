// ══════════════════════════════════════════════════════════════
// STORAGE — Camada de persistência
// Fonte primária: localStorage (offline-first)
// Sincronização: Firebase Firestore (via firebase.js)
// ══════════════════════════════════════════════════════════════

// ── Keys
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

// ── Chamados locais
function getLocal()     { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]'); } catch { return []; } }
function saveLocal(arr) { localStorage.setItem(LOCAL_KEY,JSON.stringify(arr)); }

// ── Encerramentos
function getClosedMap()      { try { return JSON.parse(localStorage.getItem(CLOSED_KEY)||'{}'); } catch { return {}; } }
function saveClosed(obj)     { localStorage.setItem(CLOSED_KEY,JSON.stringify(obj)); }

// ── Usuários
function getUsers()    { try { const u=JSON.parse(localStorage.getItem(USERS_KEY)); return u||DEFAULT_USERS; } catch { return DEFAULT_USERS; } }
function saveUsers(u)  { localStorage.setItem(USERS_KEY,JSON.stringify(u)); }

// ── Session (sessionStorage)
function getSession()  { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function setSession(u) { sessionStorage.setItem(SESSION_KEY,JSON.stringify(u)); }
function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }

// ── Banco de Soluções (KB)
function getKB()       { try { return JSON.parse(localStorage.getItem(KB_KEY)||'[]'); } catch { return []; } }
function saveKB(v)     { localStorage.setItem(KB_KEY,JSON.stringify(v)); }

// ── Peças e Estoque
function getPecas()    { try { return JSON.parse(localStorage.getItem(PECAS_KEY)||'[]'); } catch { return []; } }
function savePecas(v)  { localStorage.setItem(PECAS_KEY,JSON.stringify(v)); }

// ── Movimentações
function getMovs()     { try { return JSON.parse(localStorage.getItem(MOV_KEY)||'[]'); } catch { return []; } }
function saveMovs(v)   { localStorage.setItem(MOV_KEY,JSON.stringify(v)); }

// ── Events log (timeline)
function getEvents()   { try { return JSON.parse(localStorage.getItem(EVENTS_KEY)||'{}'); } catch { return {}; } }
function saveEvents(v) { localStorage.setItem(EVENTS_KEY,JSON.stringify(v)); }
function addEvent(num,type,actor,detail) {
  const ev=getEvents();
  if(!ev[num])ev[num]=[];
  ev[num].push({ts:new Date().toISOString(),type,actor,detail:detail||''});
  saveEvents(ev);
}

// ── Auditoria
function getAudit()    { try { return JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]'); } catch { return []; } }
function saveAudit(v)  { if(v.length>2000)v=v.slice(-2000); localStorage.setItem(AUDIT_KEY,JSON.stringify(v)); }
function audit(tipo,detalhe,chamado) {
  const u=currentUser();
  const logs=getAudit();
  logs.push({ts:new Date().toISOString(),tipo,usuario:u?.nome||'Sistema',login:u?.login||'—',detalhe:detalhe||'',chamado:chamado||''});
  saveAudit(logs);
}

// ── Cadastro Equipamentos
function getCadEq()    { try { return JSON.parse(localStorage.getItem(CADASTRO_EQ_KEY)||'{}'); } catch { return {}; } }
function saveCadEq(v)  { localStorage.setItem(CADASTRO_EQ_KEY,JSON.stringify(v)); }

// ── Cadastro Técnicos
function getCadTec()   { try { return JSON.parse(localStorage.getItem(CADASTRO_TEC_KEY)||'{}'); } catch { return {}; } }
function saveCadTec(v) { localStorage.setItem(CADASTRO_TEC_KEY,JSON.stringify(v)); }
