// ── INIT — Bootstrap da aplicação
// ── INIT
initTheme();
document.getElementById('f-data').value=new Date().toISOString().slice(0,10);
updateNovoNum();
preencherSolicitante();
populateTecnicoSelect();
tickFormClock();
setInterval(tickFormClock, 30000);
initDashboard();
initAbertoBadge();
loadEmailConfig();
filteredRecords=[...allRecords()];

// ── DEFAULT ADMIN (first run)
// Usado por getUsers() em js/modules/usuarios/index.js quando ainda não há
// nenhum usuário salvo no localStorage.
const DEFAULT_USERS = [
  {id:'u1',nome:'Administrador',login:'admin',senha:'admin123',email:'admin@santacolomba.com.br',cargo:'Administrador',perfil:'admin',status:'Ativo',perms:null},
  {id:'u2',nome:'Guilherme Otávio Vilas Boas Montalvão',login:'guilherme',senha:'guilherme123',email:'guilherme@santacolomba.com.br',cargo:'Técnico',perfil:'tecnico',status:'Ativo',perms:null},
  {id:'u3',nome:'Walison Almeida Santos Lima',login:'walison',senha:'walison123',email:'walison@santacolomba.com.br',cargo:'Técnico',perfil:'tecnico',status:'Ativo',perms:null},
];

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

// ══════════════════════════════════════════════════════════════
// NAVEGAÇÃO — shell do app (menu de portais, seções, grupos da sidebar)
// ══════════════════════════════════════════════════════════════
const SECTIONS=['dashboard','chamados','aberto','encerrados','pormes','responsaveis','criticidade','painel','auditoria','frotas','kb','pecas','novo','usuarios','irrigacao','chips','equipamentos','tecnicos','config'];
const TITLES={
  dashboard:'Dashboard',chamados:'Chamados',pormes:'Por Mês',
  aberto:'Em Aberto',encerrados:'Chamados Encerrados',responsaveis:'Responsáveis',criticidade:'Criticidade',painel:'Painel Operacional',auditoria:'Auditoria e Logs',frotas:'Histórico por Frota',kb:'Banco de Soluções',pecas:'Peças e Estoque',novo:'Novo Chamado',irrigacao:'Chamados de Irrigação',chips:'Chips de Abastecimento',equipamentos:'Equipamentos',tecnicos:'Técnicos',config:'Configurações',usuarios:'Usuários'
};
const SUBS={
  dashboard:'Visão geral · Santa Colomba Agropecuária',
  chamados:'Lista completa editável',
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
  if(id==='chamados') renderChamados();
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
    showSection('dashboard', document.querySelector('.nav-item'));
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
  if (active === 'sec-chamados')     applyFilters();
  if (active === 'sec-aberto')       renderAberto();
  if (active === 'sec-encerrados')   renderEncerrados();
  if (active === 'sec-responsaveis') renderRespSection();
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
