// ── INIT — Bootstrap da aplicação
// ── INIT
initTheme();
initSidebarCollapsed();
document.getElementById('f-data').value=new Date().toISOString().slice(0,10);
updateNovoNum();
preencherSolicitante();
populateTecnicoSelect();
tickFormClock();
atualizarProgressoNovo();
setInterval(tickFormClock, 30000);
initDashboard();
initAbertoBadge();
loadEmailConfig();
filteredRecords=[...allRecords()];
toggleViewMode(viewMode); // Fase 3 · Kanban — restaura o modo de visualização salvo (lista/kanban)

// ── Usado por getUsers() em js/modules/usuarios/index.js só como placeholder
// antes do primeiro sync com o Firestore (fonte real dos usuários agora que o
// login é feito via Firebase Authentication — não existe mais "usuário seed"
// com senha embutida no código).
const DEFAULT_USERS = [];

// Perfil permissions
const PERFIL_LABEL = {admin:'Administrador',supervisor:'Supervisor',tecnico:'Técnico',visualizador:'Visualizador'};

// Restaura sessão persistida (F5 na mesma aba) — Fase 3: bug real
// corrigido aqui. Esse mesmo bloco vivia, por engano, DENTRO de
// renderChamados() (chamados/index.js), rodando de novo a cada filtro/
// ordenação/página em vez de só 1x no carregamento — sem efeito errado
// na maioria das vezes, mas redundante e com risco de reabrir o overlay
// de login no meio do uso se getSession() alguma vez retornasse vazio
// por um instante. O login novo continua 100% via finalizarLogin()
// (js/modules/usuarios/index.js), intocado.
(function(){
  const u = getSession();
  if (u) {
    document.getElementById('login-overlay').style.display='none';
    document.getElementById('topbar-user').textContent = u.nome.split(' ')[0]+' · '+(PERFIL_LABEL[u.perfil]||u.perfil);
    aplicarNavPerms();
  } else {
    document.getElementById('login-overlay').style.display='flex';
    setTimeout(()=>document.getElementById('login-user')?.focus(), 100);
  }
})();

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

// ══════════════════════════════════════════════════════════════
// NAVEGAÇÃO — shell do app (menu de portais, seções, grupos da sidebar)
// ══════════════════════════════════════════════════════════════
const SECTIONS=['home','dashboard','chamados','area-tecnico','aberto','encerrados','pormes','responsaveis','criticidade','painel','auditoria','frotas','kb','pecas','novo','usuarios','irrigacao','chips','equipamentos','tecnicos','config'];
const TITLES={
  home:'Início',dashboard:'Dashboard',chamados:'Chamados','area-tecnico':'Área do Técnico',pormes:'Por Mês',
  aberto:'Em Aberto',encerrados:'Chamados Encerrados',responsaveis:'Responsáveis',criticidade:'Criticidade',painel:'Painel Operacional',auditoria:'Auditoria e Logs',frotas:'Histórico por Frota',kb:'Banco de Soluções',pecas:'Peças e Estoque',novo:'Novo Chamado',irrigacao:'Chamados de Irrigação',chips:'Chips de Abastecimento',equipamentos:'Equipamentos',tecnicos:'Técnicos',config:'Configurações',usuarios:'Usuários'
};
const SUBS={
  home:'Visão geral operacional · atalhos rápidos',
  dashboard:'Visão geral · Santa Colomba Agropecuária',
  chamados:'Lista completa editável',
  'area-tecnico':'Meu painel de trabalho · ações rápidas',
  pormes:'Relatório mensal por cultura',
  aberto:'Chamados não concluídos · atualizado em tempo real',
  criticidade:'Distribuição e acompanhamento por nível de criticidade',
  encerrados:'Histórico de chamados concluídos',
  usuarios:'Cadastro e gerenciamento de usuários',
  responsaveis:'Atendimentos por responsável',
  novo:'Abrir novo chamado',
  irrigacao:'Gestão de chamados do sistema de irrigação',
  chips:'Cadastro e controle de chips de abastecimento',
  equipamentos:'Cadastro de equipamentos e frotas',
  tecnicos:'Performance e ranking por técnico',
  config:'Configurações do sistema',
};

function showSection(id,el){
  SECTIONS.forEach(s=>{
    document.getElementById('sec-'+s).classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('sec-'+id).classList.add('active');
  if(el) el.classList.add('active');
  document.getElementById('page-title').textContent=TITLES[id]||id;
  document.getElementById('page-sub').textContent=SUBS[id]||'';
  if(id==='home') renderHome();
  if(id==='chamados') renderChamados();
  if(id==='area-tecnico') renderAreaTecnico();
  if(id==='aberto') renderAberto();
  if(id==='criticidade') renderCriticidade();
  if(id==='painel') renderPainel();
  if(id==='auditoria') renderAuditoria();
  if(id==='frotas') renderFrotas();
  if(id==='equipamentos') renderEquipamentos();
  if(id==='tecnicos') renderTecnicos();
  if(id==='config') renderConfig();
  if(id==='kb') renderKB();
  if(id==='pecas') renderPecas();
  if(id==='encerrados') renderEncerrados();
  if(id==='usuarios') renderUsuarios();
  if(id==='pormes') renderMesCharts();
  if(id==='responsaveis') renderRespSection();
}

function toggleNavGroup(id, toggleEl) {
  const sub = document.getElementById(id);
  if (!sub) return;
  const isOpen = sub.classList.contains('open');
  // Close all groups first
  document.querySelectorAll('.nav-sub.open').forEach(s => {
    s.classList.remove('open');
    s.previousElementSibling?.classList.remove('open');
  });
  if (!isOpen) {
    sub.classList.add('open');
    toggleEl.classList.add('open');
  }
}

const MODULOS_CONFIG = {
  campo:    { label:'Chamados de Campo',       cor:'campo',    secao:'dashboard' },
  irrigacao:{ label:'Chamados de Irrigação',   cor:'irrigacao',secao:'irrigacao' },
  chips:    { label:'Chips de Abastecimento',  cor:'chips',    secao:'chips'     },
};

let _moduloAtivo = null;

function mostrarMenu() {
  const overlay = document.getElementById('menu-overlay');
  if (!overlay) return;
  overlay.classList.add('show');
  // position:fixed + z-index:490 covers .app — no visibility change needed

  // Esconder botão voltar ao portal
  const backBtn = document.getElementById('menu-back-btn');
  if (backBtn) backBtn.classList.remove('show');

  // Atualizar info do usuário e data
  const u = currentUser();
  const lbl = document.getElementById('menu-user-label');
  if (lbl && u) lbl.textContent = u.nome + ' · ' + (PERFIL_LABEL[u.perfil]||u.perfil);

  const fd = document.getElementById('menu-footer-date');
  if (fd) fd.textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

  // Remove badge de módulo da topbar
  const existingBadge = document.getElementById('topbar-module-badge');
  if (existingBadge) existingBadge.remove();

  _moduloAtivo = null;
}

// ── Abrir módulo específico
function abrirModulo(id) {
  const cfg = MODULOS_CONFIG[id];
  if (!cfg) return;

  // Esconde menu
  const overlay = document.getElementById('menu-overlay');
  if (overlay) overlay.classList.remove('show');

  // Mostra botão voltar ao portal
  const backBtn = document.getElementById('menu-back-btn');
  if (backBtn) backBtn.classList.add('show');

  // Adiciona badge de módulo ativo na topbar
  const existingBadge = document.getElementById('topbar-module-badge');
  if (existingBadge) existingBadge.remove();
  if (id !== 'campo') {
    const badge = document.createElement('span');
    badge.id = 'topbar-module-badge';
    badge.className = 'module-badge ' + id;
    badge.textContent = cfg.label;
    const tl = document.querySelector('.topbar-left');
    if (tl) tl.appendChild(badge);
  }

  _moduloAtivo = id;

  // Navigate to the module's home section
  if (id === 'campo') {
    // Show full sidebar nav for campo
    document.querySelector('.sidebar')?.style.removeProperty('display');
    // Fase 4.6 — tela inicial pós-login passa a ser a Home Operacional
    // (antes ia direto pro Dashboard, que continua existindo, só deixa
    // de ser o primeiro destino).
    showSection('home', document.getElementById('nav-home'));
  } else if (id === 'irrigacao') {
    // For irrigation/chips: show minimal nav (just portal back button)
    showSection('irrigacao', null);
  } else if (id === 'chips') {
    showSection('chips', null);
  }
}

// ── Voltar ao Menu
function voltarMenu() {
  mostrarMenu();
}

// ── Toast de notificação (usado por todos os módulos)
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}

// ── SINGLE REFRESH ENTRY POINT
// Call this after any data mutation (abrir, encerrar, reabrir).
// Each section only re-renders if currently visible.
function refreshAfterAction() {
  initAbertoBadge(); // always update all nav badges + totals
  populateTecnicoSelect(); // mantém a lista de técnicos em sincronia com o Firestore
  const active = document.querySelector('.section.active')?.id;
  if (active === 'sec-home')         renderHome();
  if (active === 'sec-chamados')     applyFilters();
  if (active === 'sec-area-tecnico') renderAreaTecnico();
  if (active === 'sec-aberto')       renderAberto();
  if (active === 'sec-encerrados')   renderEncerrados();
  if (active === 'sec-criticidade')  renderCriticidade();
  if (active === 'sec-responsaveis') renderRespSection();
  if (active === 'sec-frotas')       renderFrotas();
  if (active === 'sec-tecnicos')     renderTecnicos();
  // Histórico do equipamento selecionado no formulário de Novo Chamado —
  // atualiza em tempo real se outro usuário abrir/encerrar um chamado dele.
  const equipSelecionado = document.getElementById('equip-selected-codigo')?.value;
  if (active === 'sec-novo' && equipSelecionado) renderHistoricoEquip(equipSelecionado);
  if (active === 'sec-dashboard') {
    // Refresh dashboard KPIs without re-rendering charts
    const S = computeStats();
    const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    setEl('k-total',    S.total.toLocaleString('pt-BR'));
    setEl('k-conc',     S.concluidos.toLocaleString('pt-BR'));
    setEl('k-conc-pct',(S.total>0?(S.concluidos/S.total*100).toFixed(1):'0')+'%');
    setEl('k-media',    S.media_mes);
    setEl('k-aberto',   S.em_aberto+S.em_and);
    setEl('donut-n',    S.total.toLocaleString('pt-BR'));
  }
}

// ══════════════════════════════════════════════════════════════
// FASE 4 — PWA / OFFLINE
// ══════════════════════════════════════════════════════════════

// Atalhos do manifest.json (?section=novo/aberto/area-tecnico) — navegação
// pura, reaproveita showSection() já existente, sem lógica nova.
(function _abrirAtalhoDaURL() {
  const params = new URLSearchParams(location.search);
  const sec = params.get('section');
  if (sec) setTimeout(() => showSection(sec, document.getElementById('nav-' + sec)), 200);
})();

// Service Worker — registro conservador (ver docs/sw.js): nunca recarrega
// a página sozinho; só mostra o banner de atualização quando há uma
// versão nova pronta, e só troca quando o usuário clica.
function _initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) {
          document.getElementById('sw-update-banner')?.classList.add('show');
        }
      });
    });
  }).catch((e) => console.warn('[SW] Registro falhou:', e.message));

  let _swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swReloaded) return;
    _swReloaded = true;
    location.reload();
  });
}
function aplicarAtualizacaoSW() {
  navigator.serviceWorker.getRegistration().then((reg) => {
    reg?.waiting?.postMessage('SKIP_WAITING');
  });
}
_initServiceWorker();

// Indicador Online/Offline — distinto do #fb-status (que mede latência do
// Firestore via ping); este usa navigator.onLine + eventos online/offline,
// não usado em nenhum outro lugar do app até a Fase 4.
function _atualizarIndicadorRede() {
  const dot = document.getElementById('net-status');
  if (!dot) return;
  const online = navigator.onLine;
  dot.style.background = online ? 'var(--green)' : 'var(--red)';
  dot.title = online ? 'Conectado à internet' : 'Sem internet — dados salvos localmente, sincroniza ao voltar';
}
window.addEventListener('online',  () => { _atualizarIndicadorRede(); flushPendingSync(); });
window.addEventListener('offline', _atualizarIndicadorRede);
_atualizarIndicadorRede();

// Fila de reenvio pendente (ver _pendingSyncMark em core/storage.js) —
// dispara ao voltar a ficar online e periodicamente, cobrindo o caso
// (iOS Safari, entre outros) onde a Background Sync API nativa não existe.
setInterval(flushPendingSync, 60000);
setTimeout(flushPendingSync, 5000); // tenta uma vez logo no boot, se já houver pendência de uma sessão anterior

// SLA crítico (Item 3, Push Notifications) — checagem periódica, já que
// não é um evento de sync como os outros 5 gatilhos.
setInterval(() => { if (typeof _checarSlaCritico === 'function') _checarSlaCritico(); }, 60000);
setTimeout(() => { if (typeof _checarSlaCritico === 'function') _checarSlaCritico(); }, 8000);
