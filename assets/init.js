// ── INIT — Bootstrap da aplicação
// ── INIT
initTheme();
document.getElementById('f-data').value=new Date().toISOString().slice(0,10);
updateNovoNum();
preencherSolicitante();
tickFormClock();
setInterval(tickFormClock, 30000);
initDashboard();
initAbertoBadge();
loadEmailConfig();
filteredRecords=[...allRecords()];

// ── ENCERRAR CHAMADO (100% offline / localStorage)
// CLOSED_KEY/USERS_KEY/SESSION_KEY já são declaradas por src/storage.js (carregado
// antes deste script) — reaproveitadas aqui, não redeclaradas (const é compartilhada
// entre <script> clássicos no mesmo documento; redeclarar lança SyntaxError e quebra
// o parse deste arquivo inteiro).

// ── DEFAULT ADMIN (first run)
const DEFAULT_USERS = [
  {id:'u1',nome:'Administrador',login:'admin',senha:'admin123',email:'admin@santacolomba.com.br',cargo:'Administrador',perfil:'admin',status:'Ativo',perms:null},
  {id:'u2',nome:'Guilherme Otávio Vilas Boas Montalvão',login:'guilherme',senha:'guilherme123',email:'guilherme@santacolomba.com.br',cargo:'Técnico',perfil:'tecnico',status:'Ativo',perms:null},
  {id:'u3',nome:'Walison Almeida Santos Lima',login:'walison',senha:'walison123',email:'walison@santacolomba.com.br',cargo:'Técnico',perfil:'tecnico',status:'Ativo',perms:null},
];

function getUsers(){ try{ const u=JSON.parse(localStorage.getItem(USERS_KEY)); return u&&u.length?u:DEFAULT_USERS; }catch(e){ return DEFAULT_USERS; } }
function saveUsers(u){ localStorage.setItem(USERS_KEY,JSON.stringify(u)); }
function getSession(){ try{ return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; } }
function setSession(u){ sessionStorage.setItem(SESSION_KEY,JSON.stringify(u)); }
function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }
function currentUser(){ return getSession(); }

// Perfil permissions
const PERFIL_LABEL = {admin:'Administrador',supervisor:'Supervisor',tecnico:'Técnico',visualizador:'Visualizador'};

// All available permissions with labels
const ALL_PERMS = {
  'p_dashboard':'Dashboard','p_chamados':'Chamados','p_aberto':'Chamados em Aberto',
  'p_encerrados':'Chamados Encerrados','p_novo':'Novo Chamado','p_responsaveis':'Responsáveis',
  'p_relatorios':'Relatórios','p_usuarios':'Cadastro de Usuários','p_config':'Configurações',
  'p_abrir':'Abrir Chamados','p_editar':'Editar Chamados','p_encerrar':'Encerrar Chamados',
  'p_reabrir':'Reabrir Chamados','p_excluir':'Excluir Chamados','p_exportar':'Exportar Relatórios'
};

// Default perms per profile (used when user has no explicit perms)
const PERFIL_PERMS = {
  admin: Object.keys(ALL_PERMS),
  supervisor: ['p_dashboard','p_chamados','p_aberto','p_encerrados','p_novo','p_responsaveis','p_relatorios','p_abrir','p_editar','p_encerrar','p_reabrir','p_exportar'],
  tecnico:    ['p_dashboard','p_chamados','p_aberto','p_encerrados','p_novo','p_abrir','p_editar'],
  visualizador:['p_dashboard','p_chamados','p_aberto','p_encerrados','p_responsaveis','p_relatorios','p_exportar'],
};
function pode(acao){
  const u=currentUser(); if(!u) return false;
  // Map old acao strings to new perm keys
  const map={abrir:'p_abrir',editar:'p_editar',encerrar:'p_encerrar',reabrir:'p_reabrir',
             excluir:'p_excluir',ver:'p_dashboard',atualizar:'p_editar',exportar:'p_exportar'};
  const key = map[acao] || 'p_'+acao;
  const perms = u.perms || PERFIL_PERMS[u.perfil] || [];
  return perms.includes(key);
}
function temAcesso(perm){
  const u=currentUser(); if(!u) return false;
  const perms = u.perms || PERFIL_PERMS[u.perfil] || [];
  return perms.includes(perm);
}

function getClosedMap() {
  try { return JSON.parse(localStorage.getItem(CLOSED_KEY) || '{}'); } catch(e) { return {}; }
}
function saveClosed(map) {
  localStorage.setItem(CLOSED_KEY, JSON.stringify(map));
}

function openEncerrar() {
  // Close other modals to avoid stacking
  document.getElementById('modal-detalhe')?.classList.remove('open');
  document.getElementById('modal-checklist')?.classList.remove('open');

  document.getElementById('enc-input').value = '';
  document.getElementById('enc-result').className = 'modal-result';
  document.getElementById('enc-not-found').className = 'modal-not-found';
  document.getElementById('enc-btn-confirmar').disabled = true;
  const cm0 = document.getElementById('enc-confirm-msg');
  if (cm0) cm0.style.display = 'none';

  const m = document.getElementById('modal-encerrar');
  m.classList.add('open');
  m.setAttribute('aria-modal','true');
  m.setAttribute('role','dialog');
  // Focus the search input
  setTimeout(() => document.getElementById('enc-input')?.focus(), 150);
}
function closeEncerrar(e) {
  if (e && e.target !== document.getElementById('modal-encerrar')) return;
  document.getElementById('modal-encerrar').classList.remove('open');
}

let encCurrentNum = null;

function buscarChamado() {
  let raw = document.getElementById('enc-input').value.trim().toUpperCase();
  // Accept "2961" or "CHM-2961" or "CHM2961"
  if (!raw.startsWith('CHM-')) {
    raw = 'CHM-' + raw.replace(/^CHM/i, '').replace(/^-/, '');
  }
  // Pad number part
  const parts = raw.split('-');
  if (parts[1]) raw = 'CHM-' + parts[1].padStart(4, '0');

  const all = allRecords();
  const closed = getClosedMap();
  const rec = all.find(r => r[0] === raw);

  const resultEl  = document.getElementById('enc-result');
  const notFound  = document.getElementById('enc-not-found');
  const confirmBtn= document.getElementById('enc-btn-confirmar');
  encCurrentNum   = null;

  if (!rec) {
    resultEl.className = 'modal-result';
    notFound.className = 'modal-not-found show';
    confirmBtn.disabled = true;
    const cm = document.getElementById('enc-confirm-msg');
    if (cm) cm.style.display = 'none';
    return;
  }

  notFound.className = 'modal-not-found';
  const isClosed = rec[5] === 'Concluída' || closed[raw];
  resultEl.className = 'modal-result show' + (isClosed ? ' already-done' : '');

  document.getElementById('enc-res-num').textContent   = rec[0];
  document.getElementById('enc-res-titulo').textContent = rec[1] || '—';
  document.getElementById('enc-res-cult').textContent   = rec[2] || 'Sem cultura';
  document.getElementById('enc-res-resp').textContent   = (rec[3]||'Sem responsável').replace(',', ' e ');
  document.getElementById('enc-res-data').textContent   = rec[4] ? rec[4].split('-').reverse().join('/') : '—';
  document.getElementById('enc-res-status').textContent = isClosed ? '✓ Já encerrado' : '⏳ ' + (rec[5] || 'Não iniciado');

  const confirmMsg = document.getElementById('enc-confirm-msg');
  if (isClosed) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '✓ Já está Concluída';
    if (confirmMsg) confirmMsg.style.display = 'none';
  } else {
    confirmBtn.disabled = false;
    confirmBtn.textContent = '✓ Confirmar Encerramento';
    if (confirmMsg) confirmMsg.style.display = 'block';
    encCurrentNum = raw;
  }
}

function confirmarEncerramento() {
  if (!encCurrentNum) return;
  // Open checklist first — _doEncerramento is called on submit
  openChecklist('modal');
}

// Patch allRecords to apply closed map
const _origAllRecords = allRecords;
// Override allRecords to merge closed statuses


// ── VÍNCULO CHAMADOS × FROTA
// Match map: chamado num -> código do equipamento (extraído do título por código numérico)
// Cobertura: 125 chamados históricos com código identificável

// Equip index: código -> {d, m, g, s} (fonte: planilha equipamentos.xlsx)

// ── Função utilitária: retorna equipamento vinculado a um chamado
// Prioridade: (1) chamado local com equipCodigo, (2) MATCH_MAP histórico
function getChamadoEquip(num, localRec) {
  const code = (localRec && localRec.equipCodigo) || MATCH_MAP[num];
  if (!code) return null;
  const eq = EQUIP_IDX[code];
  if (!eq) return null;
  return { codigo:code, descricao:eq.d, modelo:eq.m, grupo:eq.g, status:eq.s };
}

// ── Formata identificador curto da frota (ex: "6007 · CDB 207")
function frotaLabel(num, localRec) {
  const eq = getChamadoEquip(num, localRec);
  if (!eq) return '';
  return eq.codigo + ' · ' + eq.descricao;
}

// ── BANCO DE SOLUÇÕES (KB)
// KB_KEY já é declarada por src/storage.js — reaproveitada aqui, não redeclarada.
function getKB() { try { return JSON.parse(localStorage.getItem(KB_KEY)||'[]'); } catch { return []; } }
function saveKB(v) { localStorage.setItem(KB_KEY, JSON.stringify(v)); }

// ── CONTROLE DE PEÇAS
// PECAS_KEY já é declarada por src/storage.js — reaproveitada aqui, não redeclarada.
function getPecas() { try { return JSON.parse(localStorage.getItem(PECAS_KEY)||'[]'); } catch { return []; } }
function savePecas(v) { localStorage.setItem(PECAS_KEY, JSON.stringify(v)); }

// ── TIMELINE EVENTS
// EVENTS_KEY já é declarada por src/storage.js — reaproveitada aqui, não redeclarada.
function getEvents() { try { return JSON.parse(localStorage.getItem(EVENTS_KEY)||'{}'); } catch { return {}; } }
function saveEvents(v) { localStorage.setItem(EVENTS_KEY, JSON.stringify(v)); }
function addEvent(num, type, actor, detail) {
  const ev = getEvents();
  if (!ev[num]) ev[num] = [];
  ev[num].push({ ts: new Date().toISOString(), type, actor, detail: detail||'' });
  saveEvents(ev);
}
function allRecords() {
  const base = [...DATA, ...getLocal().map(r => [r.num, r.titulo, r.cultura, r.resp, r.data, r.status, r.bucket])];
  const closed = getClosedMap();
  return base.map(r => {
    if (closed[r[0]]) {
      const updated = [...r];
      updated[5] = 'Concluída';
      return updated;
    }
    return r;
  });
}
