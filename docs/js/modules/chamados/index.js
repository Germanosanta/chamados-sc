// ══════════════════════════════════════════
// MÓDULO: CHAMADOS
// Santa Colomba — Central de Chamados SC
// ══════════════════════════════════════════

// Escapa texto controlado pelo usuário (ex: nome de arquivo) antes de inserir em innerHTML
function _escHtml(s) {
  return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

let filteredRecords=[], page=1;
const PER_PAGE=50;
let abPage = 1;
const AB_PER_PAGE = 50;
let critPage=1;
const CRIT_PER_PAGE=50;
let encPage = 1;
const ENC_PER_PAGE = 50;

// Variáveis de estado do módulo — existiam declaradas no legado (assets/app.js)
// mas ficaram de fora ao migrar para o app modular; restauradas aqui.
let _gsTimeout = null;
let _equipFocusIdx = -1;   // navegação por teclado no dropdown de equipamento
let _equipValid    = false; // se um equipamento válido está selecionado
let _chkTarget = null;      // 'modal' | 'detalhe'
let _fotosNovo = [];        // [{name, type, data:base64}]
let _pecasNovo = [];        // [{id, nome, unidade, qtd}]
let _pendingEvtType = null;
let encCurrentNum = null;   // chamado em foco no modal de Encerrar
let detCurrentNum = null;   // chamado em foco no modal de Detalhe
let _fotosAtuais = [];      // fotos do chamado aberto no momento (lightbox — Etapa 2C-ii)

// Limiares de atraso — antes repetidos como número mágico (7 e 3) em vários
// pontos (renderAberto, renderPainel, diasChip); centralizados aqui, Fase 2
// · Etapa 2A, mesmos valores de sempre, só numa fonte única agora.
const DIAS_ATRASO_ALERTA  = 3;
const DIAS_ATRASO_CRITICO = 7;

function diasAberto(dataStr) {
  if (!dataStr) return 0;
  const d = new Date(dataStr + 'T00:00:00');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.floor((hoje - d) / 86400000);
}

// Chip de atraso — reescrito na Fase 2 · Etapa 2A pra usar a família .badge
// (Etapa 1) em vez de cor hardcoded, que ficava sempre clara mesmo no modo
// escuro. Mesmos limiares de sempre (DIAS_ATRASO_ALERTA/CRITICO), só o
// jeito de pintar mudou.
function diasChip(dias) {
  if (dias > DIAS_ATRASO_CRITICO)  return 'class="badge badge-red"';
  if (dias >= DIAS_ATRASO_ALERTA)  return 'class="badge badge-amber"';
  return 'class="badge badge-green"';
}

// priorPill/getPrior removidas na Fase 4 — getPrior(r) lia r[9], que nunca
// existe (array de 7 posições), e o único chamador restante (busca do
// modal de Encerrar Chamado) foi corrigido para usar o par certo abaixo
// (prioridadeReal/prioridadeBadge, já usado em todas as outras telas
// desde a Etapa 2A). Confirmado, por grep em todo o projeto, que nenhum
// outro arquivo chamava priorPill/getPrior antes de remover.

// Lê a prioridade de verdade de um chamado — o valor real vive no
// registro local (getLocal()), gravado por submitChamado() no campo
// "prior". Mesmo caminho que buildTimeline() já usa corretamente
// (localRec.prior).
function prioridadeReal(num) {
  return getLocal().find(r => r.num === num)?.prior || '';
}

// Badge de prioridade — substitui priorPill() nas telas reescritas na
// Fase 2 · Etapa 2A, usando a família .badge (Etapa 1) e recebendo o
// valor já lido corretamente via prioridadeReal(num).
function prioridadeBadge(p) {
  if (p === 'Urgente') return '<span class="badge badge-red">⚡ Urgente</span>';
  if (p === 'Alta')    return '<span class="badge badge-amber">🔴 Alta</span>';
  if (p === 'Baixa')   return '<span class="badge badge-green">🟢 Baixa</span>';
  return '<span class="badge badge-neutral">🟡 Média</span>';
}

// Linha de progresso do status (Fase 2 · Etapa 2C-ii) — "utilizar
// exatamente os estados existentes": os únicos valores reais de `status`
// no sistema formam essa sequência (Cancelado é um ramo terminal à parte,
// não faz parte da linha). "Assumido"/"Reaberto" NÃO são status — são
// selos complementares (ver openDetalhe: assumidoPor / evento 'reabriu')
// desenhados ao lado da linha, não como um passo dela, pra não inventar
// 2 estados que não existem no modelo de dados.
// Desenhado pra ser reaproveitado como cabeçalho de card no Kanban da
// Etapa 2D — mesma função, sem tocar nela quando o board for construído.
const STATUS_STEPS = [
  { key:'aberto',      label:'Aberto' },
  { key:'atendimento', label:'Em Atendimento' },
  { key:'peca',        label:'Aguardando Peça' },
  { key:'concluido',   label:'Encerrado' },
];
function _statusStepIndex(status) {
  if (status==='Concluída'||status==='Encerrado'||status==='Concluído') return 3;
  if (status==='Aguardando Peça') return 2;
  if (status==='Em Andamento'||status==='Em Atendimento') return 1;
  return 0; // Não iniciado / Aberto
}
function statusStepperHTML(status, selosHTML) {
  if (status === 'Cancelado') {
    return `<div class="status-stepper is-cancelado"><span class="status-step done">🚫 Cancelado</span></div>${selosHTML||''}`;
  }
  const atual = _statusStepIndex(status);
  const nodes = STATUS_STEPS.map((s,i) => {
    const cls = i < atual ? 'done' : i === atual ? 'current' : 'todo';
    return `<span class="status-step ${cls}">${s.label}</span>`;
  }).join('<span class="status-step-sep"></span>');
  return `<div class="status-stepper">${nodes}</div>${selosHTML||''}`;
}

// Rótulo de fazenda — antes escrito 2x diferente (openDetalhe tinha essa
// mesma lógica inline; renderEncerrados usava só o <option> do filtro).
// Centralizado aqui, mesmo mapeamento de sempre (KRT→Karitel, RDM→Rio do
// Meio, senão o valor cru).
function fazendaLabel(bucket) {
  if (bucket === 'Solinftec KRT') return 'Karitel';
  if (bucket === 'Solinftec RDM') return 'Rio do Meio';
  return bucket || '—';
}

// Paginação — helper único (Fase 2 · Etapa 2A). As 4 telas de listagem
// (chamados/aberto/criticidade/encerrados) tinham essa mesma sequência de
// botões "← 1 … → " copiada e colada em cada renderX(); mesmo resultado
// de sempre, só numa função só agora — gotoFn é o nome (string) da função
// de navegação de cada tela (gotoPage/abGotoPage/critGotoPage/encGotoPage).
function _paginacaoHTML(page, totalItens, perPage, gotoFn) {
  const pages = Math.ceil(totalItens / perPage) || 1;
  let btns = `<button class="pag-btn" onclick="${gotoFn}(${page-1})" ${page===1?'disabled':''}>←</button>`;
  const start = Math.max(1, page-2), end = Math.min(pages, page+2);
  if (start > 1) btns += `<button class="pag-btn" onclick="${gotoFn}(1)">1</button>${start>2?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}`;
  for (let p = start; p <= end; p++) btns += `<button class="pag-btn ${p===page?'active':''}" onclick="${gotoFn}(${p})">${p}</button>`;
  if (end < pages) btns += `${end<pages-1?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}<button class="pag-btn" onclick="${gotoFn}(${pages})">${pages}</button>`;
  btns += `<button class="pag-btn" onclick="${gotoFn}(${page+1})" ${page===pages?'disabled':''}>→</button>`;
  return btns;
}
// Estado vazio padronizado (Fase 2 · Etapa 2C-ii) — achado: só
// renderAberto() e a timeline tinham mensagem de "nada encontrado"; as
// outras 3 tabelas (renderChamados/renderEncerrados/renderCriticidade)
// simplesmente ficavam em branco quando o filtro não batia com nada.
// Mesmo padrão visual em todo lugar agora, via essa função só.
function _estadoVazioHTML(colspan, msg) {
  return `<tr><td colspan="${colspan}" style="text-align:center;padding:32px;color:var(--text3)">${msg}</td></tr>`;
}
function _pagInfoTexto(page, totalItens, perPage) {
  const de = totalItens ? (page-1)*perPage+1 : 0;
  const ate = Math.min(page*perPage, totalItens);
  return `Exibindo ${de}–${ate} de ${totalItens.toLocaleString('pt-BR')} registros`;
}

const EVT_NEEDS_INPUT = {
  iniciou:          false,
  peca_solicitada:  true,   // ask: which part?
  peca_recebida:    true,   // confirm: which part arrived
  obs:              true,   // free text
};
const EVT_LABELS = {
  iniciou:          'Iniciar Atendimento',
  peca_solicitada:  'Solicitar Peça',
  peca_recebida:    'Peça Recebida',
  obs:              'Observação',
};
const EVT_PLACEHOLDERS = {
  peca_solicitada: 'Descreva a peça solicitada (ex: Fusível 5A, Cabo USB…)',
  peca_recebida:   'Confirme a peça recebida (ex: Fusível 5A recebido)',
  obs:             'Digite a observação…',
};
// Status that each event sets on the local record
const EVT_STATUS_CHANGE = {
  iniciou:         'Em Atendimento',
  peca_solicitada: 'Aguardando Peça',
  peca_recebida:   'Em Atendimento',   // resumes after part arrives
};

const emailService = {
  // ── Configuração (preencher para integração real)
  config: {
    provider: 'none',          // 'smtp' | 'ms365' | 'none'
    smtpEndpoint: '',          // Ex: 'https://api.seuservidor.com/email'
    ms365ClientId: '',         // Azure App Client ID
    ms365TenantId: '7d6ecda9-dc17-43c8-9780-41da0a54daf4',
    fromName: 'Central de Chamados – Santa Colomba',
    fromEmail: 'chamados@santacolomba.com.br',
  },

  // ── Enviar e-mail (stub — substitua pelo provider real)
  async send(payload) {
    // payload: { to:[], subject:'', body:'', chamadoNum:'' }
    if (this.config.provider === 'none') {
      console.info('[emailService] E-mail simulado:', payload);
      return { ok: true, simulated: true };
    }
    if (this.config.provider === 'smtp') {
      // Integração SMTP via endpoint próprio
      const res = await fetch(this.config.smtpEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.json();
    }
    if (this.config.provider === 'ms365') {
      // Microsoft Graph — requer token Bearer (já existente na plataforma)
      const token = document.getElementById('cfg-token')?.value;
      if (!token) return { ok: false, error: 'Token não configurado' };
      const msg = {
        message: {
          subject: payload.subject,
          body: { contentType: 'HTML', content: payload.body },
          toRecipients: payload.to.map(e => ({ emailAddress: { address: e } })),
        }
      };
      const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      });
      return { ok: res.ok, status: res.status };
    }
  },

  // ── Templates de e-mail

  templateAbertura(rec, abertoPor) {
    const num     = rec[0];
    const titulo  = rec[1] || '—';
    const cultura = rec[2] || 'Sem cultura';
    const resp    = (rec[3]||'').replace(/,/g,' e ') || '—';
    const fazenda = rec[6]==='Solinftec KRT'?'Karitel':rec[6]==='Solinftec RDM'?'Rio do Meio':(rec[6]||'—');
    const prior   = rec[9] || 'Média';
    const data    = rec[4] ? rec[4].split('-').reverse().join('/') : '—';

    return {
      subject: `[${num}] Novo Chamado: ${titulo}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px">
          <h2 style="color:#2563eb">📋 Novo Chamado Aberto</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280;width:140px">Número</td><td><strong>${num}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Título</td><td>${titulo}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Prioridade</td><td>${prior}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Cultura</td><td>${cultura}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Fazenda</td><td>${fazenda}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Responsável(is)</td><td>${resp}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Data de abertura</td><td>${data}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Aberto por</td><td>${abertoPor}</td></tr>
          </table>
          <p style="margin-top:20px;color:#6b7280;font-size:12px">Central de Chamados – Santa Colomba Agropecuária</p>
        </div>`,
    };
  },

  templateEncerramento(rec, closedInfo) {
    const num     = rec[0];
    const titulo  = rec[1] || '—';
    const resp    = (rec[3]||'').replace(/,/g,' e ') || '—';
    const tecnicos  = closedInfo.tecnicos   || '—';
    const encPor    = closedInfo.encerradoPor || '—';
    const dataEnc   = (closedInfo.dataEncerramento||'')+ ' às '+(closedInfo.horaEncerramento||'');
    const solucao   = closedInfo.solucao    || '—';

    return {
      subject: `[${num}] Chamado Encerrado: ${titulo}`,
      body: `
        <div style="font-family:Arial,sans-serif;max-width:600px">
          <h2 style="color:#16a34a">✅ Chamado Encerrado</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280;width:160px">Número</td><td><strong>${num}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Status</td><td>Encerrado</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Data/hora</td><td>${dataEnc}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Técnico(s)</td><td>${tecnicos}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Encerrado por</td><td>${encPor}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Solução</td><td>${solucao}</td></tr>
          </table>
          <p style="margin-top:20px;color:#6b7280;font-size:12px">Central de Chamados – Santa Colomba Agropecuária</p>
        </div>`,
    };
  },

  // ── Obter destinatários de um chamado
  getRecipients(rec) {
    const users = getUsers();
    const resps = (rec[3]||'').split(',').map(s=>s.trim()).filter(Boolean);
    const emails = [];
    resps.forEach(name => {
      const u = users.find(u => u.nome.includes(name) || u.nome.split(' ')[0]===name);
      if (u?.email) emails.push(u.email);
    });
    return [...new Set(emails)];
  },

  // ── Disparar e-mail de abertura
  async notificarAbertura(rec, abertoPor) {
    const to  = this.getRecipients(rec);
    if (!to.length) return;
    const tpl = this.templateAbertura(rec, abertoPor);
    return this.send({ ...tpl, to, chamadoNum: rec[0] });
  },

  // ── Disparar e-mail de encerramento
  async notificarEncerramento(rec, closedInfo) {
    const to  = this.getRecipients(rec);
    if (!to.length) return;
    const tpl = this.templateEncerramento(rec, closedInfo);
    return this.send({ ...tpl, to, chamadoNum: rec[0] });
  },
};

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

function getAbertos() {
  // "Open" = anything not conclusively closed or cancelled
  // Includes: Aberto, Não iniciado, Em Atendimento, Em Andamento, Aguardando Peça
  const closed = getClosedMap();
  const terminal = new Set(['Concluída','Encerrado','Concluído','Cancelado']);
  return allRecords().filter(r => !terminal.has(r[5]) && !closed[r[0]]);
}

function getEncerrados() {
  const closed = getClosedMap();
  const all    = allRecords(); // already merges local + closed map
  return all.filter(r =>
    r[5] === 'Concluída' ||
    r[5] === 'Encerrado' ||
    !!closed[r[0]]
  );
}

// Ordenação dinâmica da lista principal (Fase 2 · Etapa 2A) — client-side,
// sobre o array já filtrado (filteredRecords), sem tocar em nenhum dado.
// Clicar no mesmo campo inverte a direção; campo novo começa ascendente.
let _sortField = null, _sortDir = 1;
const _SORT_IDX = { num:0, titulo:1, cultura:2, resp:3, data:4, status:5, bucket:6 };
function _aplicarOrdenacao(arr) {
  if (!_sortField) return arr;
  const idx = _SORT_IDX[_sortField];
  return [...arr].sort((a, b) => {
    const va = (a[idx]||'').toString(), vb = (b[idx]||'').toString();
    return va.localeCompare(vb, 'pt-BR', {numeric:true}) * _sortDir;
  });
}
function sortChamados(field) {
  if (_sortField === field) _sortDir *= -1; else { _sortField = field; _sortDir = 1; }
  filteredRecords = _aplicarOrdenacao(filteredRecords);
  renderChamados();
  if (viewMode === 'kanban') renderKanban();
}

function renderChamados(){
  if(!filteredRecords.length) filteredRecords=[...allRecords()];
  const total=filteredRecords.length;
  const slice=filteredRecords.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const _closedMapC = getClosedMap();

  document.getElementById('pag-info').textContent = _pagInfoTexto(page, total, PER_PAGE);

  // Cabeçalhos ordenáveis — marca visualmente qual coluna está ativa
  document.querySelectorAll('#tbl-chamados-head [data-sort]').forEach(th=>{
    th.classList.toggle('sorted', th.dataset.sort===_sortField);
    th.classList.toggle('sorted-desc', th.dataset.sort===_sortField && _sortDir===-1);
  });

  document.getElementById('tbl-chamados').innerHTML = !slice.length ? _estadoVazioHTML(7, 'Nenhum chamado encontrado com esses filtros.') : slice.map(r=>{
    const _lrC=getLocal().find(x=>x.num===r[0]);
    const _frC=frotaLabel(r[0],_lrC);
    const isClosedC = r[5]==='Concluída' || r[5]==='Encerrado' || r[5]==='Concluído' || !!_closedMapC[r[0]];
    const diasC = diasAberto(r[4]);
    const prior = prioridadeReal(r[0]);
    const resps = (r[3]||'').split(',').map(s=>s.trim()).filter(Boolean);
    return `<tr class="ticket-row" data-num="${r[0]}" onclick="openDetalhe('${r[0]}')">
      <td class="td-num">
        <div style="display:flex;align-items:center;gap:6px">${r[0]}${prior?prioridadeBadge(prior):''}</div>
        ${_frC?`<div style="font-size:9px;color:var(--accent);font-family:var(--font-mono);margin-top:1px">${_frC}</div>`:''}
      </td>
      <td class="td-titulo">${_escHtml(r[1])}</td>
      <td><span class="badge ${cultPill(r[2])}">${r[2]||'—'}</span></td>
      <td style="white-space:nowrap">${resps.length ? resps.map(n=>`<span class="badge badge-neutral" style="margin-right:3px">${_escHtml(n)}</span>`).join('') : '—'}</td>
      <td style="white-space:nowrap">
        <span style="font-family:var(--font-mono);font-size:11px">${r[4]?r[4].split('-').reverse().join('/'):'—'}</span>
        ${!isClosedC && diasC>=DIAS_ATRASO_ALERTA ? `<span ${diasChip(diasC)} style="margin-left:5px">${diasC}d</span>` : ''}
      </td>
      <td><span class="badge ${statusPill(r[5])}">${r[5]}</span></td>
      <td style="color:var(--text3);font-size:11px">${fazendaLabel(r[6])}</td>
    </tr>`;}).join('');

  document.getElementById('pag-row').innerHTML = _paginacaoHTML(page, total, PER_PAGE, 'gotoPage');
}

// Painel de filtros avançados (Fase 2 · Etapa 2A) — só mostra/esconde o
// bloco de campos extras; a filtragem em si acontece em applyFilters().
function toggleFiltrosAvancados() {
  const el = document.getElementById('filtros-avancados');
  const btn = document.getElementById('btn-filtros-avancados');
  if (!el) return;
  const open = el.style.display === 'none';
  el.style.display = open ? 'flex' : 'none';
  if (btn) btn.classList.toggle('btn-ghost-active', open);
}

function clearFilters(){
  document.getElementById('srch').value='';
  document.getElementById('f-cultura').value='';
  document.getElementById('f-status').value='';
  document.getElementById('f-bucket').value='';
  const fr = document.getElementById('flt-resp'); if (fr) fr.value = '';
  const fd = document.getElementById('f-de');   if (fd) fd.value = '';
  const fa = document.getElementById('f-ate');  if (fa) fa.value = '';
  applyFilters();
}

function applyFilters(){
  const q=(document.getElementById('srch').value||'').toLowerCase();
  const fc=document.getElementById('f-cultura').value;
  const fs=document.getElementById('f-status').value;
  const fb=document.getElementById('f-bucket').value;
  // Filtros avançados (Fase 2 · Etapa 2A) — mesmos campos que já existem
  // em rec[], só não eram filtráveis por aqui ainda: responsável e período
  // de abertura.
  const fresp = (document.getElementById('flt-resp')?.value || '').toLowerCase();
  const fde   = document.getElementById('f-de')?.value  || '';
  const fate  = document.getElementById('f-ate')?.value || '';
  const _closed=getClosedMap();
  const _matchStatus=(r,fs)=>{
    if(!fs) return true;
    const s=r[5];
    if(fs==='Concluído')       return s==='Concluída'||s==='Encerrado'||s==='Concluído'||!!_closed[r[0]];
    if(fs==='Aberto')          return (s==='Não iniciado'||s==='Aberto')&&!_closed[r[0]];
    if(fs==='Em Atendimento')  return s==='Em Andamento'||s==='Em Atendimento';
    if(fs==='Aguardando Peça') return s==='Aguardando Peça';
    if(fs==='Cancelado')       return s==='Cancelado';
    return s===fs; // exact match for legacy options
  };
  filteredRecords=allRecords().filter(r=>{
    if(fc && r[2]!==fc) return false;
    if(fs && !_matchStatus(r,fs)) return false;
    if(fb && r[6]!==fb) return false;
    if(fresp && !(r[3]||'').toLowerCase().includes(fresp)) return false;
    if(fde  && (!r[4] || r[4] < fde))  return false;
    if(fate && (!r[4] || r[4] > fate)) return false;
    if(q && !(r[0].toLowerCase().includes(q)||r[1].toLowerCase().includes(q))) return false;
    return true;
  });
  filteredRecords = _aplicarOrdenacao(filteredRecords); // preserva a ordenação ativa, se houver
  page=1;
  renderChamados();
  if (viewMode === 'kanban') renderKanban();
}

function gotoPage(p){
  const pages=Math.ceil(filteredRecords.length/PER_PAGE);
  if(p<1||p>pages) return;
  page=p;renderChamados();
}

// ══════════════════════════════════════════════════════════════
// KANBAN ENTERPRISE (Fase 3) — mesmos dados/filtros de filteredRecords,
// nenhum campo novo, nenhuma lógica de leitura nova. Colunas = as 4 fases
// já formalizadas em STATUS_STEPS (Etapa 2C-ii), reaproveitadas como
// definição das raias, sem redefinir o que cada status significa.
// ══════════════════════════════════════════════════════════════
let viewMode = localStorage.getItem('chm_view_mode') || 'lista';

function toggleViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('chm_view_mode', mode);
  document.getElementById('btn-view-lista')?.classList.toggle('active', mode==='lista');
  document.getElementById('btn-view-kanban')?.classList.toggle('active', mode==='kanban');
  const listCard = document.getElementById('chamados-list-card');
  const board    = document.getElementById('kanban-board');
  if (listCard) listCard.style.display = mode==='lista' ? '' : 'none';
  if (board)    board.style.display    = mode==='kanban' ? '' : 'none';
  if (mode === 'kanban') renderKanban();
}

// Raia (lane) de um chamado a partir do status real — mesmo mapeamento de
// _statusStepIndex(), só devolvendo a key da raia em vez de um índice.
function _kbLaneKey(status) {
  if (status === 'Cancelado') return 'cancelado';
  return STATUS_STEPS[_statusStepIndex(status)].key;
}

function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  const lanes = [...STATUS_STEPS, {key:'cancelado', label:'Cancelado'}];
  const closedMap = getClosedMap();
  board.innerHTML = lanes.map(l => {
    const itens = filteredRecords.filter(r => _kbLaneKey(r[5]) === l.key);
    const readonly = l.key === 'cancelado';
    return `<div class="kanban-lane" data-lane="${l.key}"
        ${readonly ? '' : `ondragover="_kbAllowDrop(event)" ondragleave="_kbDragLeave(event)" ondrop="_kbDrop(event,'${l.key}')"`}>
      <div class="kanban-lane-head">
        <span>${l.label}</span>
        <span class="badge badge-neutral">${itens.length}</span>
      </div>
      <div class="kanban-lane-body">${itens.length ? itens.map(r=>_ticketCardHTML(r, closedMap)).join('') : '<div class="kanban-lane-empty">Nenhum chamado</div>'}</div>
    </div>`;
  }).join('');
}

// Card do Kanban — compartilhado com a Área do Técnico (mesmo componente,
// não dois). Clique abre o Centro Operacional (openDetalhe), igual ao
// clique de linha nas tabelas hoje. `comAcoes=true` (usado pela Área do
// Técnico) acrescenta um rodapé de botões grandes; o Kanban usa só o
// botão "Assumir" (o resto é feito arrastando o card).
function _ticketCardHTML(rec, closedMap, comAcoes) {
  const num = rec[0];
  closedMap = closedMap || getClosedMap();
  const _lr = getLocal().find(x=>x.num===num);
  const fr = frotaLabel(num, _lr);
  // Fase 4.5: card do Kanban ganha a descrição do equipamento (antes só
  // mostrava o código/frota) — mesma função já usada no Centro Operacional.
  const _equip = getChamadoEquip(num, _lr);
  const dias = diasAberto(rec[4]);
  const prior = prioridadeReal(num);
  const isClosed = rec[5]==='Concluída'||rec[5]==='Encerrado'||rec[5]==='Concluído'||!!closedMap[num];
  const jaAssumido = !!(_lr && _lr.assumidoPor);
  const resp1 = (rec[3]||'').split(',').map(s=>s.trim()).filter(Boolean)[0] || '—';
  const lane = _kbLaneKey(rec[5]);
  return `<div class="kanban-card" draggable="true"
      ondragstart="_kbDragStart(event,'${num}')" onclick="openDetalhe('${num}')">
    <div class="kanban-card-top">
      <span class="kanban-card-num">${num}</span>
      ${prior ? prioridadeBadge(prior) : ''}
    </div>
    <div class="kanban-card-titulo">${_escHtml(rec[1]||'—')}</div>
    ${_equip ? `<div class="kanban-card-equip">🔧 ${_escHtml(_equip.descricao||'—')}</div>` : ''}
    ${fr ? `<div class="kanban-card-frota">${fr}</div>` : ''}
    <div class="kanban-card-meta">
      <span>🏭 ${fazendaLabel(rec[6])}</span>
      <span>👤 ${_escHtml(resp1)}</span>
    </div>
    <div class="kanban-card-foot">
      ${!isClosed && dias>=DIAS_ATRASO_ALERTA ? `<span ${diasChip(dias)}>${dias}d em aberto</span>` : `<span class="badge badge-neutral">${dias}d</span>`}
      ${!jaAssumido && !isClosed ? `<button type="button" class="kanban-card-btn" onclick="event.stopPropagation();assumirChamado('${num}')">Assumir</button>` : ''}
    </div>
    ${comAcoes ? `<div class="kanban-card-acoes">${_acoesRapidasHTML(num, lane, isClosed)}</div>` : ''}
  </div>`;
}

// Botões de ação rápida da Área do Técnico — cada um chama EXATAMENTE a
// mesma função que o botão correspondente já chama dentro do Centro
// Operacional (via _abrirAcaoRapida, ver acima), só orquestrada a partir
// do card. "Anexar Fotos" abre o Centro Operacional na Galeria — não
// existe hoje upload de foto num chamado já aberto (só na abertura),
// então o botão não finge uma capacidade que o sistema não tem.
function _acoesRapidasHTML(num, lane, isClosed) {
  if (isClosed) return '';
  const btn = (label, onclick) => `<button type="button" class="kanban-card-btn" onclick="event.stopPropagation();${onclick}">${label}</button>`;
  if (lane === 'aberto') {
    return btn('▶️ Iniciar', `_abrirAcaoRapida('${num}','iniciou')`);
  }
  if (lane === 'atendimento') {
    return [
      btn('📦 Pausar', `_abrirAcaoRapida('${num}','peca_solicitada')`),
      btn('✅ Concluir', `_abrirAcaoRapida('${num}','checklist')`),
      btn('💬 Observação', `_abrirAcaoRapida('${num}','obs')`),
      btn('📷 Fotos', `openDetalhe('${num}')`),
    ].join('');
  }
  if (lane === 'peca') {
    return [
      btn('✔️ Retomar', `_abrirAcaoRapida('${num}','peca_recebida')`),
      btn('✅ Concluir', `_abrirAcaoRapida('${num}','checklist')`),
    ].join('');
  }
  if (lane === 'concluido') return btn('↩️ Reabrir', `reabrirChamado('${num}')`);
  return '';
}

// ── Drag and drop nativo (HTML5) — sem lib de terceiros (nenhuma existe no
// projeto). Transições compatíveis com a lógica já existente (ver mapa
// abaixo); o resto abre o Centro Operacional em vez de tentar reescrever a
// validação das funções originais para aceitar um número arbitrário.
function _kbDragStart(ev, num) {
  ev.dataTransfer.setData('text/plain', num);
  ev.dataTransfer.effectAllowed = 'move';
}
function _kbAllowDrop(ev) { ev.preventDefault(); ev.currentTarget.classList.add('kanban-lane-over'); }
function _kbDragLeave(ev) { ev.currentTarget.classList.remove('kanban-lane-over'); }

// Mapa de transições compatíveis → ação real já existente que a completa.
// 'checklist' = abre o encerramento (openChecklist), que já não exige
// nenhum status prévio específico — por isso tanto atendimento quanto
// peça podem ir direto pra concluído.
const _KB_TRANSICOES = {
  'aberto>atendimento':    'iniciou',
  'atendimento>peca':      'peca_solicitada',
  'peca>atendimento':      'peca_recebida',
  'atendimento>concluido': 'checklist',
  'peca>concluido':        'checklist',
};

function _kbDrop(ev, laneDestino) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('kanban-lane-over');
  const num = ev.dataTransfer.getData('text/plain');
  if (!num) return;
  const rec = allRecords().find(r => r[0]===num);
  if (!rec) return;
  const laneOrigem = _kbLaneKey(rec[5]);
  if (laneOrigem === laneDestino) return;
  if (laneOrigem === 'cancelado') return; // raia só-leitura

  // Única transição instantânea: sair de "Concluído" chama reabrirChamado()
  // direto — é a única ação já existente que recebe o número do chamado
  // como parâmetro e é autocontida (não depende do Centro Operacional
  // estar aberto), confirmado por leitura direta do código.
  if (laneOrigem === 'concluido') {
    reabrirChamado(num);
    return;
  }

  const acao = _KB_TRANSICOES[laneOrigem + '>' + laneDestino];
  if (!acao) { showToast('⚠ Ação não disponível — avance uma etapa por vez.'); return; }
  _abrirAcaoRapida(num, acao);
}

// Orquestra duas chamadas já existentes (abrir o Centro Operacional +
// preparar a ação) — as mesmas que os botões do modal já disparam hoje,
// só iniciadas a partir de fora dele (card do Kanban/Área do Técnico).
// Nenhuma validação das funções originais é duplicada ou reimplementada.
function _abrirAcaoRapida(num, acao) {
  openDetalhe(num);
  if (acao === 'checklist') { openChecklist('detalhe'); return; }
  if (acao) registrarEvento(acao);
}

// ══════════════════════════════════════════════════════════════
// NOTIFICAÇÕES LOCAIS (Fase 4) — entrega real desta fase: dispara via
// Notification API quando o sync em tempo real (fsStartRealtime, já
// existente em js/firebase/firebase.js) detecta uma mudança relevante pro
// usuário logado, com a aba aberta em qualquer lugar (não precisa estar
// na tela de chamados). Push de verdade (app fechado, outro dispositivo)
// depende de Cloud Function + plano Blaze — decidido com o usuário que
// fica fora do escopo desta fase (ver relatório final).
// ══════════════════════════════════════════════════════════════
function _notificarLocal(titulo, corpo, num) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(titulo, { body: corpo, icon: 'assets/img/coa.jpeg', tag: 'chm-' + (num || Date.now()) });
    n.onclick = () => { window.focus(); if (num) openDetalhe(num); n.close(); };
  } catch (e) {}
}

// Mesma comparação já usada em _atEhMeu() (Área do Técnico, Fase 3), aqui
// recebendo um objeto simples em vez de rec[] pra funcionar tanto com
// registro local quanto com o item recém-sincronizado do Firestore.
function _souEnvolvido(recLike, nome) {
  if (!nome || !recLike) return false;
  const resps = (recLike.resp || '').split(',').map(s => s.trim());
  return resps.includes(nome) || recLike.tecnico === nome || recLike.assumidoPor === nome;
}

// Chamado pelo hook em fsStartRealtime() — "antes" é o estado local antes
// do merge desta leitura; "itemsNovos" é o snapshot que acabou de chegar
// do Firestore. Detecta só o que já é dado real (nenhum campo/cálculo novo).
window._chmDetectarNotificacoes = function(col, itemsNovos, antes) {
  const u = currentUser();
  if (!u) return;
  const nome = u.nome;

  if (col === 'chamados') {
    const antesMap = new Map((antes || []).map(r => [r.num, r]));
    itemsNovos.forEach(rec => {
      const prev = antesMap.get(rec.num);
      if (!prev) {
        if (_souEnvolvido(rec, nome) && rec.abertoPor !== nome) {
          _notificarLocal('📋 Novo chamado atribuído', `${rec.num} · ${rec.titulo || ''}`, rec.num);
        }
        return;
      }
      if (!_souEnvolvido(prev, nome) && _souEnvolvido(rec, nome)) {
        _notificarLocal('⚡ Chamado atribuído a você', `${rec.num} · ${rec.titulo || ''}`, rec.num);
      } else if (prev.status !== rec.status && _souEnvolvido(rec, nome)) {
        _notificarLocal('🔄 Status alterado', `${rec.num} agora está "${rec.status}"`, rec.num);
      }
    });
  }

  if (col === 'historico') {
    const local = getLocal();
    itemsNovos.forEach(item => {
      const rec = local.find(r => r.num === item.id) || {};
      if (!_souEnvolvido(rec, nome)) return;
      if (item.encerramento && !antes?.closed?.[item.id]) {
        _notificarLocal('✅ Chamado encerrado', `${item.id} foi encerrado`, item.id);
      }
      const eventosAntes = (antes?.events?.[item.id] || []).length;
      const eventosNovos = item.eventos || [];
      if (eventosNovos.length > eventosAntes) {
        const novoEvt = eventosNovos[eventosNovos.length - 1];
        if (novoEvt?.type === 'peca_recebida') {
          _notificarLocal('📦 Peça recebida', `${item.id}: ${novoEvt.detail || ''}`, item.id);
        }
      }
    });
  }
};

// SLA crítico — checagem periódica (não é evento de sync), mesmo limiar já
// usado em diasChip()/DIAS_ATRASO_CRITICO. Notifica 1x por chamado por
// sessão, pra não repetir a cada checagem enquanto o atraso persiste.
const _slaNotificados = new Set();
function _checarSlaCritico() {
  const u = currentUser();
  if (!u) return;
  const local = getLocal();
  getAbertos().forEach(r => {
    if (_slaNotificados.has(r[0])) return;
    const lr = local.find(x => x.num === r[0]);
    if (!_souEnvolvido({ resp: r[3], tecnico: lr?.tecnico, assumidoPor: lr?.assumidoPor }, u.nome)) return;
    if (diasAberto(r[4]) > DIAS_ATRASO_CRITICO) {
      _slaNotificados.add(r[0]);
      _notificarLocal('🔴 SLA crítico', `${r[0]} está aberto há mais de ${DIAS_ATRASO_CRITICO} dias`, r[0]);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// ÁREA DO TÉCNICO (Fase 3) — espaço de trabalho pessoal, separado do
// cadastro administrativo #sec-tecnicos (RH). Reaproveita getAbertos()/
// getEncerrados()/prioridadeReal() já existentes; o único filtro
// genuinamente novo é "Meus Chamados" (comparação por nome contra
// resp/tecnico/assumidoPor), que hoje só existia como um "if" isolado
// pra esconder o botão Assumir — vira filtro de lista aqui, sem nenhuma
// escrita nova nem mudança de regra de negócio.
// ══════════════════════════════════════════════════════════════
let _atFiltroAtivo = 'meus';

function _atEhMeu(r, nome) {
  if (!nome) return false;
  const lr = getLocal().find(x => x.num === r[0]);
  const resps = (r[3]||'').split(',').map(s=>s.trim());
  return resps.includes(nome) || lr?.tecnico === nome || lr?.assumidoPor === nome;
}

function atFiltro(f) { renderAreaTecnico(f); }

function renderAreaTecnico(filtro) {
  filtro = filtro || _atFiltroAtivo;
  _atFiltroAtivo = filtro;

  const nome = currentUser()?.nome || '';
  const abertos = getAbertos();
  const encerrados = getEncerrados();

  // Fase 4.5: os 5 conjuntos calculados 1x só, reaproveitados tanto pra
  // mostrar a contagem em cada chip quanto pra listar o filtro ativo —
  // nenhum deles é filtrado 2x.
  const conjuntos = {
    meus:        abertos.filter(r => _atEhMeu(r, nome)),
    urgentes:    abertos.filter(r => prioridadeReal(r[0]) === 'Urgente'),
    atendimento: abertos.filter(r => _kbLaneKey(r[5]) === 'atendimento'),
    peca:        abertos.filter(r => _kbLaneKey(r[5]) === 'peca'),
    concluidos:  encerrados.filter(r => _atEhMeu(r, nome)),
  };

  document.querySelectorAll('#at-chips .view-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.at === filtro);
    const n = conjuntos[b.dataset.at]?.length;
    if (n === undefined) return;
    let cnt = b.querySelector('.at-chip-count');
    if (!cnt) { cnt = document.createElement('span'); cnt.className = 'at-chip-count'; b.appendChild(cnt); }
    cnt.textContent = n;
  });

  const itens = conjuntos[filtro] || conjuntos.meus;
  const wrap = document.getElementById('at-lista');
  if (!wrap) return;
  const closedMap = getClosedMap();
  wrap.innerHTML = itens.length
    ? itens.map(r => _ticketCardHTML(r, closedMap, true)).join('')
    : `<div class="kanban-lane-empty" style="grid-column:1/-1">Nenhum chamado encontrado para este filtro.</div>`;
}

function openDetalhe(num) {
  const all = allRecords();
  const rec = all.find(r => r[0] === num);
  if (!rec) { showToast('Chamado não encontrado'); return; }

  const closed  = getClosedMap();
  const isClosed = rec[5] === 'Concluída' || rec[5] === 'Encerrado' || !!closed[num];
  const closedInfo = closed[num];

  detCurrentNum = num;

  // Fill header
  document.getElementById('det-num').textContent    = rec[0];
  document.getElementById('det-titulo').textContent = rec[1] || '—';
  // Frota/Equipamento
  const _detLocalRec = getLocal().find(x=>x.num===rec[0]);
  const _detEquip    = getChamadoEquip(rec[0], _detLocalRec);
  const _detFrotaEl  = document.getElementById('det-frota-wrap');
  if (_detFrotaEl) {
    if (_detEquip) {
      _detFrotaEl.style.display='block';
      document.getElementById('det-frota-codigo').textContent  = _detEquip.codigo;
      document.getElementById('det-frota-descr').textContent   = _detEquip.descricao;
      document.getElementById('det-frota-modelo').textContent  = _detEquip.modelo||'—';
      document.getElementById('det-frota-grupo').textContent   = _detEquip.grupo||'—';
      const stEl=document.getElementById('det-frota-status');
      if(stEl){stEl.textContent=_detEquip.status;stEl.style.color=_detEquip.status==='Ativo'?'var(--green)':'var(--amber)';}
    } else {
      _detFrotaEl.style.display='none';
    }
  }

  // Grid fields
  const statusEl = document.getElementById('det-status');
  // Selos complementares — "Assumido por X"/"Reaberto" não são valores de
  // status (ver comentário de statusStepperHTML acima), então aparecem
  // aqui como badges à parte, lidos de dado que já existe.
  let _selos = '';
  if (_detLocalRec?.assumidoPor) _selos += `<span class="status-selo">⚡ Assumido por ${_escHtml(_detLocalRec.assumidoPor)}</span>`;
  if ((getEvents()[num]||[]).some(e => e.type === 'reabriu')) _selos += `<span class="status-selo">↩ Reaberto</span>`;
  statusEl.innerHTML = statusStepperHTML(rec[5] || 'Não iniciado', _selos ? `<div class="status-selos">${_selos}</div>` : '');
  // det-prior preenchido mais abaixo via prioridadeReal(num) — achado da
  // Etapa 2A (rec[9] nunca existe, sempre "Média"), corrigido também aqui.
  document.getElementById('det-resp').textContent   = (rec[3]||'').replace(/,/g,' e ') || '—';

  // New fields from local record — Fase 4: reaproveita _detLocalRec
  // (calculado uma vez, acima) em vez de repetir getLocal().find() pelo
  // mesmo registro várias vezes nesta função (hot path — roda a cada
  // abertura de chamado).
  const _lr = _detLocalRec;
  const _setD=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v||'—';};
  _setD('det-categoria',   _lr?.categoria);
  _setD('det-tecnico',     getTecnicoResponsavel(rec[0]));
  _setD('det-solicitante', _lr?.solicitante);

  // Tempo de atendimento (abertura → agora, ou → encerramento)
  const _tempoRow=document.getElementById('det-tempo-row');
  if(_tempoRow){
    const _ci=getClosedMap()[rec[0]];
    const _dataAb=_lr?.dataHoraISO||(_lr?.data?_lr.data+'T00:00:00':null)||(rec[4]?rec[4]+'T00:00:00':null);
    if(_dataAb){
      const _ini=new Date(_dataAb);
      const _fim=_ci?.encerradoEm?new Date(_ci.encerradoEm):new Date();
      const _minutos=Math.floor((_fim-_ini)/60000);
      const _hrs=Math.floor(_minutos/60), _mins=_minutos%60;
      const _dias=Math.floor(_minutos/1440);
      const _tempoStr=_dias>0?`${_dias}d ${_hrs%24}h ${_mins}min`:_hrs>0?`${_hrs}h ${_mins}min`:`${_mins} min`;
      _setD('det-tempo', _tempoStr);
      _tempoRow.style.display='block';
    } else { _tempoRow.style.display='none'; }
  }

  // Fotos
  const _fotosWrap=document.getElementById('det-fotos-wrap');
  const _fotosEl=document.getElementById('det-fotos');
  if(_fotosEl&&_lr?.fotos?.length){
    // Lightbox no lugar de abrir em nova aba (Fase 2 · Etapa 2C-ii) —
    // reaproveita o mesmo padrão .modal-overlay/.modal-box dos outros 3
    // modais do sistema, não é um componente novo.
    _fotosAtuais = _lr.fotos;
    _fotosEl.innerHTML=(_lr.fotos).map((f,i)=>{
      const isPdf=f.type==='application/pdf';
      return `<div class="foto-thumb" title="${_escHtml(f.name)}" style="cursor:pointer" onclick="abrirLightbox(${i})">
        ${isPdf?'<div class="foto-thumb-pdf">📄</div>':`<img src="${f.data}" alt="${_escHtml(f.name)}">`}
      </div>`;
    }).join('');
    if(_fotosWrap) _fotosWrap.style.display='block';
  } else if(_fotosWrap) _fotosWrap.style.display='none';

  // Peças
  const _pecasWrap=document.getElementById('det-pecas-wrap');
  const _pecasEl=document.getElementById('det-pecas');
  if(_pecasEl&&_lr?.pecasUsadas?.length){
    _pecasEl.innerHTML=`<table class="data-table" style="font-size:11px">
      <thead><tr><th>Peça</th><th style="text-align:right">Qtd</th><th>Unidade</th></tr></thead>
      <tbody>${_lr.pecasUsadas.map(p=>`<tr><td>${p.nome}</td><td style="text-align:right;font-family:var(--font-mono);font-weight:600">${p.qtd}</td><td>${p.unidade||'un'}</td></tr>`).join('')}</tbody>
    </table>`;
    if(_pecasWrap) _pecasWrap.style.display='block';
  } else if(_pecasWrap) _pecasWrap.style.display='none';

  // Observações — bloco antigo (det-obs/det-obs-wrap) substituído pelo
  // Bloco 6 (Observações/comentários, ver _detComentariosHTML() abaixo,
  // que já inclui _lr.observacoes junto dos eventos tipo 'obs').
  document.getElementById('det-cult').innerHTML     = `<span class="badge ${cultPill(rec[2])}">${rec[2]||'Sem cultura'}</span>`;
  const setDetEl = (id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  // fazendaLabel(): mesmo helper compartilhado criado na Etapa 2A (antes
  // esse mapeamento estava escrito à mão aqui, de novo).
  setDetEl('det-fazenda', fazendaLabel(rec[6]));
  setDetEl('det-bucket',  rec[6] || '—');
  setDetEl('det-data',    rec[4] ? rec[4].split('-').reverse().join('/') : '—');

  // Aberto por (from local record)
  const localRec2 = _detLocalRec;
  setDetEl('det-aberto-por', localRec2?.abertoPor || '—');

  // Encerramento fields
  const encRow    = document.getElementById('det-enc-row');
  const encPorRow = document.getElementById('det-enc-por-row');
  if (isClosed && closedInfo) {
    if(encRow)    encRow.style.display    = 'block';
    if(encPorRow) encPorRow.style.display = 'block';
    setDetEl('det-data-enc', (closedInfo.dataEncerramento||'') + ' às ' + (closedInfo.horaEncerramento||''));
    setDetEl('det-enc-por',  closedInfo.encerradoPor || '—');
  } else {
    if(encRow)    encRow.style.display    = 'none';
    if(encPorRow) encPorRow.style.display = 'none';
  }

  // Descrição (vive no registro local como .desc, não no array de rec[])
  const desc = _lr?.desc || '';
  const descWrap = document.getElementById('det-desc-wrap');
  if (desc) {
    descWrap.style.display = 'block';
    document.getElementById('det-desc').textContent = desc;
  } else {
    descWrap.style.display = 'none';
  }

  // Encerramento info
  const closedWrap = document.getElementById('det-closed-wrap');
  if (isClosed && closedInfo) {
    closedWrap.style.display = 'block';
    const enc_por = closedInfo.encerradoPor ? ' · por '+closedInfo.encerradoPor : '';
    document.getElementById('det-closed-info').textContent =
      (closedInfo.dataEncerramento || '') + ' às ' + (closedInfo.horaEncerramento || '') + enc_por;
  } else if (isClosed) {
    closedWrap.style.display = 'block';
    document.getElementById('det-closed-info').textContent = 'Registrado como concluído';
  } else {
    closedWrap.style.display = 'none';
  }

  // Histórico
  const histWrap = document.getElementById('det-hist-wrap');
  const histEl   = document.getElementById('det-hist');
  if (histEl) {
    const localRec = _detLocalRec;
    histEl.innerHTML = buildTimeline(num, isClosed, closedInfo, localRec);
    if (histWrap) histWrap.style.display = 'block';
  }

  // Validation & buttons
  const bloqueioEl    = document.getElementById('det-bloqueio');
  const confirmMsg    = document.getElementById('det-confirm-msg');
  const btnInit       = document.getElementById('det-btn-enc-init');
  const btnConfirm    = document.getElementById('det-btn-enc-confirm');
  const btnCancelar   = document.getElementById('det-btn-cancelar-confirm');

  // Reset confirm state
  confirmMsg.style.display   = 'none';
  btnConfirm.style.display   = 'none';
  btnCancelar.style.display  = 'none';

  if (isClosed) {
    bloqueioEl.style.display = 'none';
    btnInit.style.display    = 'none';
  } else {
    // Validation criteria
    const motivos = [];
    if (!rec[3] || !rec[3].trim()) motivos.push('O chamado não possui responsável atribuído.');
    if (rec[5] === 'Não iniciado') motivos.push('O chamado deve estar com status "Em Andamento".');
    if (!pode('encerrar')) motivos.push('Seu perfil não tem permissão para encerrar chamados.');
    if (motivos.length) {
      bloqueioEl.style.display  = 'block';
      bloqueioEl.innerHTML = '⛔ Não é possível encerrar:<br>• ' + motivos.join('<br>• ');
      btnInit.style.display  = 'none';
    } else {
      bloqueioEl.style.display = 'none';
      btnInit.style.display    = 'inline-flex';
    }
  }

  // Reabrir button (no recursion — runs once per open) — Fase 2 · Etapa 2B:
  // agora fica dentro de #det-acoes-row (junto dos outros botões de ação),
  // em vez do rodapé do modal; mesma função, mesma condição de sempre.
  const btnReabrir = document.getElementById('det-btn-reabrir') ||
    (() => {
      const b = document.createElement('button');
      b.id = 'det-btn-reabrir';
      b.className = 'det-acao-btn';
      b.innerHTML = '<span class="det-acao-ic">↩</span>Reabrir';
      document.getElementById('det-acoes-row')?.appendChild(b);
      return b;
    })();
  btnReabrir.style.display = (isClosed && temAcesso('p_reabrir')) ? 'inline-flex' : 'none';
  btnReabrir.onclick = () => reabrirChamado(num);
  // Assumir button
  const _btnAssumirDet = document.getElementById('det-btn-assumir');
  if (_btnAssumirDet) {
    const _localA = _detLocalRec;
    const _jaAssumido = _localA?.assumidoPor && _localA.assumidoPor===(currentUser()?.nome||'');
    _btnAssumirDet.style.display = (!isClosed && pode('editar') && !_jaAssumido) ? 'inline-flex' : 'none';
  }
  // Status action bar — 'contents' (não 'block') pra participar da mesma
  // fileira flex dos botões vizinhos em #det-acoes-row (Etapa 2B); mesma
  // condição de sempre, só o modo de exibição CSS mudou.
  const _statusActBar = document.getElementById('det-status-actions');
  if (_statusActBar) {
    _statusActBar.style.display = (!isClosed && pode('editar')) ? 'contents' : 'none';
    const _evWrap = document.getElementById('det-evt-input-wrap');
    if (_evWrap) _evWrap.style.display = 'none';
  }

  // Bloco 4 · histórico resumido do equipamento embutido no painel
  // (Fase 2 · Etapa 2B) — mesma função renderHistoricoEquip() da tela Novo
  // Chamado, só com prefixo de ids próprio pra não colidir no DOM.
  if (_detEquip) renderHistoricoEquip(_detEquip.codigo, 'det-equip-hist');

  // Bloco 6 · observações como comentários cronológicos, Bloco 7 · auditoria
  // do chamado — ambos só leem dado já existente (ver funções abaixo).
  const _comentEl = document.getElementById('det-comentarios');
  if (_comentEl) _comentEl.innerHTML = _detComentariosHTML(num, _lr);
  const _auditWrap = document.getElementById('det-auditoria-wrap');
  const _auditEl   = document.getElementById('det-auditoria');
  if (_auditEl) {
    const _entradas = getAudit().filter(a => a.chamado === num).sort((a,b)=>(b.ts||'').localeCompare(a.ts||''));
    if (_entradas.length) {
      _auditEl.innerHTML = _detAuditoriaHTML(_entradas);
      if (_auditWrap) _auditWrap.style.display = 'block';
    } else if (_auditWrap) _auditWrap.style.display = 'none';
  }

  // Bloco 1 · Atraso/SLA no cabeçalho — mesmos diasAberto()/diasChip() já
  // usados nas listas (Etapa 2A), só não existia essa leitura aqui ainda.
  const _slaEl = document.getElementById('det-sla');
  if (_slaEl) {
    if (isClosed) { _slaEl.textContent = '—'; }
    else {
      const _dias = diasAberto(rec[4]);
      _slaEl.innerHTML = `<span ${diasChip(_dias)}>${_dias} dia${_dias===1?'':'s'} em aberto</span>`;
    }
  }
  document.getElementById('det-prior').textContent = prioridadeReal(num) || 'Média';

  document.getElementById('modal-detalhe').classList.add('open');
}

// Bloco 6 (Observações) — junta o campo .observacoes (texto livre da
// abertura) com os eventos tipo 'obs' já registrados
// (registrarEvento('obs')/confirmarEvento(), addEvent em core/storage.js).
// 100% dado já existente, só reorganizado como lista de comentários.
function _detComentariosHTML(num, localRec) {
  const eventos = (getEvents()[num] || []).filter(e => e.type === 'obs');
  const itens = [];
  if (localRec?.observacoes) {
    itens.push({ ts: localRec.dataHoraISO || '', actor: localRec.abertoPor || 'Sistema', texto: localRec.observacoes, origem: 'Observação da abertura' });
  }
  eventos.forEach(e => itens.push({ ts: e.ts, actor: e.actor, texto: e.detail, origem: null }));
  if (!itens.length) return `<div style="font-size:12px;color:var(--text3);padding:6px 0">Nenhuma observação registrada.</div>`;
  itens.sort((a,b) => (a.ts||'').localeCompare(b.ts||''));
  return itens.map(it => {
    const d = it.ts ? new Date(it.ts) : null;
    const fmt = d && !isNaN(d) ? d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—';
    return `<div class="det-comentario">
      <div class="det-comentario-head"><strong>${_escHtml(it.actor||'—')}</strong><span>${fmt}</span></div>
      <div class="det-comentario-txt">${_escHtml(it.texto||'')}</div>
      ${it.origem?`<div class="det-comentario-origem">${it.origem}</div>`:''}
    </div>`;
  }).join('');
}

// Bloco 7 (Auditoria) — entradas de getAudit() já filtradas por chamado
// (chamado a chamada em confirmarEvento()/assumirChamado()/etc via
// audit(tipo,detalhe,chamado) — core/storage.js). Só formata pra exibição.
function _detAuditoriaHTML(entradas) {
  return entradas.map(a => {
    const d = a.ts ? new Date(a.ts) : null;
    const fmt = d && !isNaN(d) ? d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—';
    return `<div class="det-audit-row">
      <span class="det-audit-ts">${fmt}</span>
      <span class="det-audit-quem">${_escHtml(a.usuario||'—')}</span>
      <span class="det-audit-oq">${_escHtml(a.detalhe||a.tipo||'')}</span>
    </div>`;
  }).join('');
}

function closeDetalhe(e) {
  if (e && e.target !== document.getElementById('modal-detalhe')) return;
  document.getElementById('modal-detalhe').classList.remove('open');
  detCurrentNum = null;
}

// Lightbox de anexos (Fase 2 · Etapa 2C-ii) — reaproveita o mesmo padrão
// .modal-overlay/.modal-box já usado nos outros 3 modais do sistema, em
// vez de abrir a foto numa aba nova do navegador. Mesmo dado de sempre
// (_lr.fotos, populado em openDetalhe), nenhuma lógica nova.
function abrirLightbox(idx) {
  const f = _fotosAtuais[idx];
  if (!f) return;
  const isPdf = f.type === 'application/pdf';
  const body = document.getElementById('lightbox-body');
  const title = document.getElementById('lightbox-title');
  if (title) title.textContent = f.name || '';
  if (body) {
    body.innerHTML = isPdf
      ? `<iframe src="${f.data}" style="width:100%;height:70vh;border:none;border-radius:8px"></iframe>`
      : `<img src="${f.data}" alt="${_escHtml(f.name||'')}" style="max-width:100%;max-height:76vh;display:block;margin:0 auto;border-radius:8px">`;
  }
  const linkBaixar = document.getElementById('lightbox-baixar');
  if (linkBaixar) { linkBaixar.href = f.data; linkBaixar.download = f.name || 'anexo'; }
  document.getElementById('modal-lightbox')?.classList.add('open');
}
function fecharLightbox(e) {
  if (e && e.target !== document.getElementById('modal-lightbox')) return;
  document.getElementById('modal-lightbox')?.classList.remove('open');
}

// Navegação ◀ ▶ entre chamados (Fase 2 · Etapa 2B) — lê a tabela
// atualmente visível no DOM (a lista de onde o chamado foi aberto), sem
// tocar em nenhuma função renderX(); respeita o filtro/ordenação/página já
// aplicados na tela, porque só lê o que já está renderizado.
function _detListaAtual() {
  const tbody = document.querySelector('.section.active tbody');
  if (!tbody) return [];
  return [...tbody.querySelectorAll('tr[data-num]')].map(tr => tr.dataset.num);
}
function _detNavegar(delta) {
  if (!detCurrentNum) return;
  const lista = _detListaAtual();
  const idx = lista.indexOf(detCurrentNum);
  if (idx === -1) return;
  const novoNum = lista[idx + delta];
  if (novoNum) openDetalhe(novoNum);
}
function detAnterior() { _detNavegar(-1); }
function detProximo()  { _detNavegar(1); }

// Atalhos de teclado enquanto o Centro Operacional está aberto — ←/→
// navegam entre chamados, Esc fecha. Ignorados com o foco num campo de
// texto/select (ex.: digitando uma observação), pra não atrapalhar
// digitação nem interceptar Esc de dentro de um campo.
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('modal-detalhe');
  if (!modal || !modal.classList.contains('open')) return;
  const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.key === 'Escape')        closeDetalhe();
  else if (e.key === 'ArrowLeft')  detAnterior();
  else if (e.key === 'ArrowRight') detProximo();
});

function alterarResp(num, novoResp) {
  if (!novoResp) return;
  // Update in local storage
  const local = getLocal();
  const idx = local.findIndex(r => r.num === num);
  if (idx >= 0) {
    local[idx].resp = novoResp;
    saveLocal(local);
    showToast(num + ' → ' + novoResp);
    refreshAfterAction();
    return;
  }
  // For historical records (not in local), create a local override
  const all = allRecords();
  const rec = all.find(r => r[0] === num);
  if (rec) {
    const localRecs = getLocal();
    localRecs.push({
      num: rec[0], titulo: rec[1], cultura: rec[2],
      resp: novoResp, data: rec[4], status: rec[5], bucket: rec[6]
    });
    saveLocal(localRecs);
    showToast(num + ' → ' + novoResp);
    refreshAfterAction();
  }
}

function abGotoPage(p) {
  const pages = Math.ceil(getAbertos().length / AB_PER_PAGE) || 1;
  if (p < 1 || p > pages) return;
  abPage = p;
  renderAberto();
}

// Encerrar direto da tabela Em Aberto — reutiliza confirmarEncerramento logic
function encerrarDireto(num) {
  // Open the existing modal pre-filled with this chamado number
  openEncerrar();
  document.getElementById('enc-input').value = num;
  buscarChamado();
}

function renderAberto() {
  const q     = (document.getElementById('ab-srch')?.value || '').toLowerCase();
  const resp  = document.getElementById('ab-resp')?.value || '';
  const ordem = document.getElementById('ab-ordem')?.value || 'antigos';

  const cultCard   = document.getElementById('ab-cult-card')?.value    || '';
  const fazendaCard= document.getElementById('ab-fazenda-card')?.value  || '';
  const respCard   = document.getElementById('ab-resp-card')?.value     || '';
  const vencCard   = document.getElementById('ab-venc-card')?.value     || '';

  let recs = getAbertos();

  // Filter
  if (q)          recs = recs.filter(r => r[0].toLowerCase().includes(q) || (r[1]||'').toLowerCase().includes(q));
  if (resp)       recs = recs.filter(r => (r[3]||'').includes(resp));
  if (cultCard)   recs = recs.filter(r => r[2] === cultCard);
  if (fazendaCard)recs = recs.filter(r => r[6] === fazendaCard);
  if (respCard)   recs = recs.filter(r => (r[3]||'').includes(respCard));
  if (vencCard)   recs = recs.filter(r => diasAberto(r[4]) > 7);

  // Sort
  recs.sort((a, b) => {
    const da = a[4] || '0000-00-00', db = b[4] || '0000-00-00';
    return ordem === 'antigos' ? da.localeCompare(db) : db.localeCompare(da);
  });

  // KPIs (always from full unfiltered abertos)
  const todos = getAbertos();
  const guil  = todos.filter(r => (r[3]||'').includes('Guilherme')).length;
  const wali  = todos.filter(r => (r[3]||'').includes('Walison')).length;
  const venc  = todos.filter(r => diasAberto(r[4]) > 7).length;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('ab-total', todos.length.toLocaleString('pt-BR'));
  setEl('ab-guil',  guil.toLocaleString('pt-BR'));
  setEl('ab-wali',  wali.toLocaleString('pt-BR'));
  setEl('ab-venc',  venc.toLocaleString('pt-BR'));
  setEl('badge-aberto', todos.length || '0');
  setEl('ab-graos',  todos.filter(r => r[2] === 'Grãos e Fibras').length.toLocaleString('pt-BR'));
  setEl('ab-tabaco', todos.filter(r => r[2] === 'Tabaco').length.toLocaleString('pt-BR'));
  setEl('ab-cacau',  todos.filter(r => r[2] === 'Cacau').length.toLocaleString('pt-BR'));
  setEl('ab-krt',    todos.filter(r => r[6] === 'Solinftec KRT').length.toLocaleString('pt-BR'));
  setEl('ab-rdm',    todos.filter(r => r[6] === 'Solinftec RDM').length.toLocaleString('pt-BR'));

  // Pagination
  const total = recs.length;
  const pages = Math.ceil(total / AB_PER_PAGE) || 1;
  if (abPage > pages) abPage = 1;
  const slice = recs.slice((abPage - 1) * AB_PER_PAGE, abPage * AB_PER_PAGE);

  setEl('ab-pag-info', `Exibindo ${(abPage-1)*AB_PER_PAGE+1}–${Math.min(abPage*AB_PER_PAGE,total)} de ${total.toLocaleString('pt-BR')} em aberto`);

  // Table rows — highlight by age
  const tbody = document.getElementById('tbl-aberto');
  if (!tbody) return;

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text3)">✓ Nenhum chamado em aberto</td></tr>`;
  } else {
    tbody.innerHTML = slice.map(r => {
      const dias = diasAberto(r[4]);
      // Linha de fundo por atraso — reescrita na Etapa 2A com color-mix (theme-
      // aware) no lugar dos hex fixos de antes (#fff5f5/#fffdf0), que ficavam
      // claros demais no modo escuro.
      const rowBg = dias > DIAS_ATRASO_CRITICO ? `background:color-mix(in srgb,var(--red) 6%,var(--surface))`
        : dias >= DIAS_ATRASO_ALERTA ? `background:color-mix(in srgb,var(--amber) 6%,var(--surface))` : '';
      const dataFmt = r[4] ? r[4].split('-').reverse().join('/') : '—';
      // Prioridade corrigida (achado da Etapa 2 · Etapa 2A) — antes lia
      // r[9] (nunca existe), sempre mostrando "Média". Agora lê do registro
      // local, onde o valor de verdade é gravado.
      const prior = prioridadeReal(r[0]) || 'Média';
      const _lrAb = getLocal().find(x=>x.num===r[0]);
      const _frAb = frotaLabel(r[0], _lrAb);
      return `<tr data-num="${r[0]}" style="${rowBg}cursor:pointer" onclick="openDetalhe('${r[0]}')">
        <td class="td-num">${r[0]}</td>
        <td class="td-titulo">
          ${_escHtml(r[1])}
          <div style="font-size:9px;color:var(--text3);margin-top:1px">${fazendaLabel(r[6])}${_frAb?' · '+_frAb:''}</div>
        </td>
        <td style="white-space:nowrap;font-weight:500">${r[3] || '<span style="color:var(--text3)">—</span>'}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;white-space:nowrap">${dataFmt}</td>
        <td>${prioridadeBadge(prior)}</td>
        <td><span class="badge ${statusPill(r[5])}">${r[5] || 'Não iniciado'}</span></td>
        <td><span ${diasChip(dias)}>${dias}d</span></td>
        <td style="white-space:nowrap;display:flex;gap:6px;align-items:center" onclick="event.stopPropagation()">
          <select onchange="alterarResp('${r[0]}',this.value)" title="Alterar responsável"
            style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);font-size:11px;color:var(--text);font-family:var(--font);cursor:pointer">
            <option value="">Resp.</option>
            <option value="Guilherme" ${(r[3]||'').includes('Guilherme')?'selected':''}>Guilherme</option>
            <option value="Walison"   ${(r[3]||'').includes('Walison')  ?'selected':''}>Walison</option>
            <option value="Guilherme,Walison">Ambos (G + W)</option>
          </select>
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px"
            onclick="encerrarDireto('${r[0]}')">Encerrar</button>
        </td>
      </tr>`;
    }).join('');
  }

  const pagRow = document.getElementById('ab-pag-row');
  if (pagRow) pagRow.innerHTML = _paginacaoHTML(abPage, total, AB_PER_PAGE, 'abGotoPage');
}

function abCardFilter(type, val) {
  const cultEl   = document.getElementById('ab-cult-card');
  const fazEl    = document.getElementById('ab-fazenda-card');
  const respEl   = document.getElementById('ab-resp-card');
  const vencEl   = document.getElementById('ab-venc-card');
  const clearBtn = document.getElementById('ab-clear-cards');
  if(!cultEl) return;

  // Clear all card filters first
  cultEl.value=''; fazEl.value=''; respEl.value=''; vencEl.value='';

  // Apply the selected filter (toggle: same val clears)
  if (type==='cult')     cultEl.value = val;
  else if(type==='fazenda') fazEl.value = val;
  else if(type==='resp')    respEl.value = val;
  else if(type==='vencidos') vencEl.value = '1';
  // type==='total' → all cleared above

  const hasFilter = cultEl.value||fazEl.value||respEl.value||vencEl.value;

  // Highlight active cards
  const cultMap   = {graos:'Grãos e Fibras',tabaco:'Tabaco',cacau:'Cacau'};
  const fazMap    = {krt:'Solinftec KRT',rdm:'Solinftec RDM'};
  ['graos','tabaco','cacau'].forEach(id =>
    document.getElementById('abcard-'+id)?.classList.toggle('ab-active', cultEl.value===cultMap[id]));
  ['krt','rdm'].forEach(id =>
    document.getElementById('abcard-'+id)?.classList.toggle('ab-active', fazEl.value===fazMap[id]));
  document.getElementById('abcard-guil')?.classList.toggle('ab-active', respEl.value==='Guilherme');
  document.getElementById('abcard-wali')?.classList.toggle('ab-active', respEl.value==='Walison');
  document.getElementById('abcard-venc')?.classList.toggle('ab-active', !!vencEl.value);
  document.getElementById('abcard-total')?.classList.toggle('ab-active', !hasFilter);

  clearBtn.style.display = hasFilter ? 'flex' : 'none';
  abPage=1;
  renderAberto();
}

function critGotoPage(p){
  const pages=Math.ceil(allRecords().length/CRIT_PER_PAGE)||1;
  if(p<1||p>pages)return;
  critPage=p; renderCriticidade();
}

function renderCriticidade() {
  const q        = (document.getElementById('crit-srch')?.value || '').toLowerCase();
  const fCult    = document.getElementById('crit-f-cult')?.value    || '';
  const fFaz     = document.getElementById('crit-f-fazenda')?.value || '';
  const fResp    = document.getElementById('crit-f-resp')?.value    || '';
  const fStatus  = document.getElementById('crit-f-status')?.value  || '';
  const fDe      = document.getElementById('crit-f-de')?.value      || '';
  const fAte     = document.getElementById('crit-f-ate')?.value     || '';
  const critCard = document.getElementById('crit-card-val')?.value;

  // Fase 4: allRecords() computado 1x e reaproveitado — antes era chamado
  // de novo mais abaixo pros KPIs (mesmo array, sem mutação entre as duas
  // chamadas, então a segunda era redundante).
  const all = allRecords();
  let recs = all;

  if (q)       recs = recs.filter(r => r[0].toLowerCase().includes(q) || (r[1]||'').toLowerCase().includes(q));
  if (fCult)   recs = recs.filter(r => r[2] === fCult);
  if (fFaz)    recs = recs.filter(r => r[6] === fFaz);
  if (fResp)   recs = recs.filter(r => (r[3]||'').includes(fResp));
  if (fStatus) recs = recs.filter(r => r[5] === fStatus || (fStatus==='Concluída' && (r[5]==='Encerrado'||r[5]==='Concluída')));
  if (fDe)     recs = recs.filter(r => (r[4]||'') >= fDe);
  if (fAte)    recs = recs.filter(r => (r[4]||'') <= fAte);
  // Achado da Etapa 2A: getPrior(r)/rec[9] nunca funcionou (ver
  // prioridadeReal() no topo do arquivo) — este filtro, os 4 KPIs e a
  // ordenação abaixo foram todos reescritos pra ler pelo caminho certo.
  if (critCard) {
    recs = recs.filter(r => {
      const p = prioridadeReal(r[0]);
      return critCard === 'Baixa' ? (!p || p === 'Baixa') : p === critCard;
    });
  }

  // KPIs from ALL records (unfiltered) — reaproveita "all" computado acima.
  const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('crit-urgente', all.filter(r=>prioridadeReal(r[0])==='Urgente').length.toLocaleString('pt-BR'));
  setEl('crit-alta',    all.filter(r=>prioridadeReal(r[0])==='Alta').length.toLocaleString('pt-BR'));
  setEl('crit-media',   all.filter(r=>prioridadeReal(r[0])==='Média').length.toLocaleString('pt-BR'));
  setEl('crit-baixa',   all.filter(r=>{const p=prioridadeReal(r[0]);return !p||p==='Baixa';}).length.toLocaleString('pt-BR'));

  // Sort by priority then date
  const priorityRank = {Urgente:0,Alta:1,Média:2,Baixa:3,'':4};
  recs.sort((a,b)=>{
    const pa=priorityRank[prioridadeReal(a[0])]??4, pb=priorityRank[prioridadeReal(b[0])]??4;
    if(pa!==pb) return pa-pb;
    return (b[4]||'').localeCompare(a[4]||'');
  });

  const total=recs.length, pages=Math.ceil(total/CRIT_PER_PAGE)||1;
  if(critPage>pages)critPage=1;
  const slice=recs.slice((critPage-1)*CRIT_PER_PAGE, critPage*CRIT_PER_PAGE);
  setEl('crit-pag-info', _pagInfoTexto(critPage, total, CRIT_PER_PAGE));

  const tbody=document.getElementById('tbl-criticidade');
  if(!tbody)return;

  tbody.innerHTML = !slice.length ? _estadoVazioHTML(8, 'Nenhum chamado encontrado com esses filtros.') : slice.map(r=>{
    const _lrCr = getLocal().find(x=>x.num===r[0]);
    const _frCr = frotaLabel(r[0], _lrCr);
    return `
    <tr data-num="${r[0]}" style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
      <td class="td-num">${r[0]}</td>
      <td class="td-titulo">${_escHtml(r[1])}${_frCr?`<div style="font-size:9px;color:var(--accent);font-family:var(--font-mono);margin-top:1px">${_frCr}</div>`:''}</td>
      <td>${prioridadeBadge(prioridadeReal(r[0]))}</td>
      <td><span class="badge ${cultPill(r[2])}">${r[2]||'—'}</span></td>
      <td style="white-space:nowrap">${(r[3]||'—').replace(/,/g,' e ')}</td>
      <td style="font-size:11px;color:var(--text3)">${fazendaLabel(r[6])}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${r[4]?r[4].split('-').reverse().join('/'):'—'}</td>
      <td><span class="badge ${statusPill(r[5])}">${r[5]||'—'}</span></td>
    </tr>`;}).join('');

  const pagRow=document.getElementById('crit-pag-row');
  if (pagRow) pagRow.innerHTML = _paginacaoHTML(critPage, total, CRIT_PER_PAGE, 'critGotoPage');
}

function critCardFilter(val) {
  const inp = document.getElementById('crit-card-val');
  if (!inp) return;
  // toggle: click same card clears
  inp.value = (inp.value === val && val !== null) ? '' : (val === null ? '' : val);
  const v = inp.value;
  // Highlight — "baixa" agora usa o valor real 'Baixa' (achado da Etapa 2A):
  // antes usava '' (o mesmo sentinela de "nenhum filtro"), então clicar em
  // Baixa e não filtrar nada eram indistinguíveis.
  ['urgente','alta','media','baixa'].forEach(id => {
    const map = {urgente:'Urgente',alta:'Alta',media:'Média',baixa:'Baixa'};
    document.getElementById('critcard-'+id)?.classList.toggle('crit-active', v === map[id]);
  });
  document.getElementById('crit-clear-btn').style.display = (inp.value !== '') ? 'flex' : 'none';
  critPage=1;
  renderCriticidade();
}

function limparFiltrosEnc() {
  ['enc-srch','enc-f-resp','enc-f-cult','enc-f-fazenda','enc-f-de','enc-f-ate'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  renderEncerrados();
}

function encGotoPage(p) {
  const pages = Math.ceil(getEncerrados().length/ENC_PER_PAGE)||1;
  if(p<1||p>pages) return;
  encPage=p; renderEncerrados();
}

function renderEncerrados() {
  const q        = (document.getElementById('enc-srch')?.value  || '').toLowerCase();
  const fResp    = document.getElementById('enc-f-resp')?.value  || '';
  const fCult    = document.getElementById('enc-f-cult')?.value  || '';
  const fFazenda = document.getElementById('enc-f-fazenda')?.value || '';
  const fDe      = document.getElementById('enc-f-de')?.value    || '';
  const fAte     = document.getElementById('enc-f-ate')?.value   || '';

  const closed = getClosedMap();
  let recs = getEncerrados();

  if (q)        recs = recs.filter(r => r[0].toLowerCase().includes(q) || (r[1]||'').toLowerCase().includes(q));
  if (fResp)    recs = recs.filter(r => (r[3]||'').includes(fResp));
  if (fCult)    recs = recs.filter(r => r[2] === fCult);
  if (fFazenda) recs = recs.filter(r => r[6] === fFazenda);
  if (fDe)      recs = recs.filter(r => (closed[r[0]]?.encerradoEm||r[4]||'') >= fDe);
  if (fAte)     recs = recs.filter(r => (closed[r[0]]?.encerradoEm||r[4]||'') <= fAte+'T23:59');

  // KPIs (always from unfiltered total)
  const todos = getEncerrados();
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
  const encMes = todos.filter(r => {
    const ci = closed[r[0]];
    const dt = ci?.encerradoEm ? ci.encerradoEm.slice(0,7) : '';
    return dt === mesAtual;
  }).length;

  // Average close time (days)
  let totalDias=0, count=0;
  todos.forEach(r => {
    const ci = closed[r[0]];
    if (r[4] && ci?.encerradoEm) {
      const d = Math.round((new Date(ci.encerradoEm)-new Date(r[4]+'T00:00'))/86400000);
      if (d>=0) { totalDias+=d; count++; }
    }
  });
  const tempoMedio = count ? (totalDias/count).toFixed(1) : '—';

  const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('enc-total', todos.length.toLocaleString('pt-BR'));
  setEl('enc-mes', encMes.toLocaleString('pt-BR'));
  setEl('enc-tempo', tempoMedio);
  setEl('enc-filtrados', recs.length.toLocaleString('pt-BR'));
  setEl('badge-encerrados', todos.length || '0');

  // Pagination
  const total = recs.length;
  const pages = Math.ceil(total/ENC_PER_PAGE)||1;
  if(encPage>pages) encPage=1;
  const slice = recs.slice((encPage-1)*ENC_PER_PAGE, encPage*ENC_PER_PAGE);
  setEl('enc-pag-info', `Exibindo ${(encPage-1)*ENC_PER_PAGE+1}–${Math.min(encPage*ENC_PER_PAGE,total)} de ${total.toLocaleString('pt-BR')}`);

  // Table
  const tbody = document.getElementById('tbl-encerrados');
  if (!tbody) return;
  tbody.innerHTML = !slice.length ? _estadoVazioHTML(10, 'Nenhum chamado encerrado encontrado com esses filtros.') : slice.map(r => {
    const ci = closed[r[0]] || {};
    const dataAb  = r[4] ? r[4].split('-').reverse().join('/') : '—';
    const dataEnc = ci.dataEncerramento || '—';
    const encPor  = ci.encerradoPor || '—';
    const diasNum = (r[4] && ci.encerradoEm)
      ? Math.round((new Date(ci.encerradoEm)-new Date(r[4]+'T00:00'))/86400000) : null;
    // Corrige uma célula <td> extra que existia aqui (repetia o bucket cru
    // duas vezes), deixando cada coluna desalinhada com seu cabeçalho —
    // achado da Etapa 2A, corrigido nesta reescrita. 10 células, 10 <th>.
    return `<tr data-num="${r[0]}" style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
      <td class="td-num">${r[0]}</td>
      <td class="td-titulo">${_escHtml(r[1])}</td>
      <td><span class="badge ${cultPill(r[2])}">${r[2]||'—'}</span></td>
      <td style="font-size:11px;color:var(--text3)">${fazendaLabel(r[6])}</td>
      <td style="white-space:nowrap">${(r[3]||'—').replace(/,/g,' e ')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${dataAb}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--green)">${dataEnc}</td>
      <td style="font-size:11px;color:var(--text3)">${ci.tecnicos||'—'}</td>
      <td style="font-size:11px;color:var(--text3)">${encPor}</td>
      <td>${diasNum==null?'—':`<span ${diasChip(diasNum)}>${diasNum}d</span>`}</td>
    </tr>`;
  }).join('');

  const pagRow = document.getElementById('enc-pag-row');
  if (pagRow) pagRow.innerHTML = _paginacaoHTML(encPage, total, ENC_PER_PAGE, 'encGotoPage');
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
  const _encLocalRec = getLocal().find(r => r.num === raw);
  const _encLabel = frotaLabel(raw, _encLocalRec);
  const _encEquipEl = document.getElementById('enc-res-equip');
  if (_encEquipEl) _encEquipEl.textContent = _encLabel ? '🚜 ' + _encLabel : '';
  const _encPriorEl = document.getElementById('enc-res-prior');
  // Fase 4: era priorPill(getPrior(rec)) — getPrior(r) lê r[9], que nunca
  // existe (array de 7 posições), então esse campo sempre mostrava
  // prioridade vazia/errada aqui. Mesmo par já usado em todas as outras
  // telas desde a Etapa 2A.
  if (_encPriorEl) _encPriorEl.innerHTML = prioridadeBadge(prioridadeReal(raw));

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

function toggleTecnico(btn) {
  btn.classList.toggle('sel');
  const selected = [...document.querySelectorAll('#chk-tec-opts .resp-opt.sel')].map(b => b.dataset.tec);
  document.getElementById('chk-tecnicos').value = selected.join(', ');
  const tagsEl = document.getElementById('chk-tec-tags');
  tagsEl.innerHTML = selected.map(v =>
    `<span class="resp-tag">${v}<button type="button" onclick="removeTecnico('${v}')">×</button></span>`
  ).join('');
}
function removeTecnico(val) {
  const btn = document.querySelector(`#chk-tec-opts .resp-opt[data-tec="${val}"]`);
  if (btn) btn.classList.remove('sel');
  toggleTecnico(btn || document.createElement('button'));
  // Re-render tags without the removed one
  const selected = [...document.querySelectorAll('#chk-tec-opts .resp-opt.sel')].map(b=>b.dataset.tec);
  document.getElementById('chk-tecnicos').value = selected.join(', ');
  document.getElementById('chk-tec-tags').innerHTML = selected.map(v=>
    `<span class="resp-tag">${v}<button type="button" onclick="removeTecnico('${v}')">×</button></span>`
  ).join('');
}

// Botões de seleção de técnico do checklist de encerramento — lidos de
// getCadTec() (Firestore), nunca de lista fixa.
function populateChkTecOpts() {
  const wrap = document.getElementById('chk-tec-opts');
  if (!wrap) return;
  const tecnicos = Object.values(getCadTec()||{})
    .filter(t => t && t.nome && t.status !== 'Inativo')
    .sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));
  wrap.innerHTML = tecnicos.map(t => {
    const val = t.apelido || t.nome;
    return `<button type="button" class="resp-opt" data-tec="${_escHtml(val)}" onclick="toggleTecnico(this)">${_escHtml(t.nome)}</button>`;
  }).join('');
}

function openChecklist(target) {
  _chkTarget = target;
  const num = target==='modal' ? encCurrentNum : detCurrentNum;
  if (!num) return;

  populateChkTecOpts();

  // Find record for context
  const rec = allRecords().find(r=>r[0]===num);
  document.getElementById('chk-num-label').textContent =
    `${num}${rec ? ' · ' + (rec[1]||'').slice(0,50) : ''}`;

  // Reset fields
  document.getElementById('chk-solucao').value    = '';
  document.getElementById('chk-materiais').value  = '';
  document.getElementById('chk-equipamentos').value='';
  document.getElementById('chk-obs').value        = '';
  document.getElementById('chk-tecnicos').value   = '';
  document.getElementById('chk-tec-tags').innerHTML = '';
  document.querySelectorAll('#chk-tec-opts .resp-opt').forEach(b=>b.classList.remove('sel'));
  ['chk1','chk2','chk3','chk4'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.checked=false;
  });
  document.getElementById('chk-erro').style.display='none';
  checklistChanged();

  // Pré-seleciona o técnico responsável (quem assumiu o chamado, ou quem foi
  // escolhido na abertura) — evita ter que selecionar de novo o mesmo nome
  // pra poder encerrar. Se esse nome não estiver cadastrado na tela de
  // Técnicos, cria um botão avulso pra ele (não fica de fora do checklist só
  // por não estar no cadastro de técnicos).
  const _tecResp = getTecnicoResponsavel(num);
  if (_tecResp) {
    const _wrap = document.getElementById('chk-tec-opts');
    let _tecBtn = [...document.querySelectorAll('#chk-tec-opts .resp-opt')]
      .find(b => b.dataset.tec === _tecResp || b.textContent.trim() === _tecResp);
    if (!_tecBtn && _wrap) {
      _tecBtn = document.createElement('button');
      _tecBtn.type = 'button';
      _tecBtn.className = 'resp-opt';
      _tecBtn.dataset.tec = _tecResp;
      _tecBtn.textContent = _tecResp;
      _tecBtn.onclick = () => toggleTecnico(_tecBtn);
      _wrap.prepend(_tecBtn);
    }
    if (_tecBtn) toggleTecnico(_tecBtn);
  }

  // Ensure modal-encerrar is closed to avoid stacking behind checklist
  if (target === 'modal') {
    document.getElementById('modal-encerrar')?.classList.remove('open');
  }
  const chkModal = document.getElementById('modal-checklist');
  chkModal.classList.add('open');
  chkModal.setAttribute('aria-modal','true');
  chkModal.setAttribute('role','dialog');
  setTimeout(() => document.getElementById('chk-solucao')?.focus(), 150);
}

function closeChecklist(e) {
  if (e && e.target !== document.getElementById('modal-checklist')) return;
  document.getElementById('modal-checklist').classList.remove('open');
  _chkTarget = null;
}

function submitChecklist() {
  const solucao = document.getElementById('chk-solucao').value.trim();
  const erroEl  = document.getElementById('chk-erro');
  const checks  = [...document.querySelectorAll('.chk-cb')];
  const allChecked = checks.every(cb=>cb.checked);

  const tecnicos = document.getElementById('chk-tecnicos')?.value.trim() || '';
  const erros = [];
  if (!tecnicos)   erros.push('Selecione pelo menos um técnico que realizou o atendimento.');
  if (!solucao)    erros.push('Informe a solução executada.');
  if (!allChecked) erros.push('Todos os itens do checklist devem ser marcados.');

  if (erros.length) {
    erroEl.style.display='block';
    erroEl.textContent = '⛔ '+erros.join(' ');
    return;
  }
  erroEl.style.display='none';

  // Build checklist payload
  const chkData = {
    solucao,
    tecnicos,
    materiais:     document.getElementById('chk-materiais').value.trim(),
    equipamentos:  document.getElementById('chk-equipamentos').value.trim(),
    observacoes:   document.getElementById('chk-obs').value.trim(),
    checklist:     {problemaResolvido:true,testeRealizado:true,equipamentoLiberado:true,usuarioInformado:true},
  };

  // Save checklist data into pending slot, then run the actual encerramento
  document.getElementById('modal-checklist').classList.remove('open');

  // Run the original close logic with checklist data attached
  _doEncerramento(_chkTarget, chkData);
  _chkTarget = null;
}

function checklistChanged() {
  const total=4;
  const done=[...document.querySelectorAll('.chk-cb:checked')].length;
  document.getElementById('chk-progress-fill').style.width=(done/total*100)+'%';
  document.getElementById('chk-progress-label').textContent=`${done} de ${total} itens concluídos`;
}

function _doEncerramento(target, chkData) {
  const num = target==='modal' ? encCurrentNum : detCurrentNum;
  if (!num) return;

  const now = new Date();
  const u   = currentUser();
  const closed = getClosedMap();

  closed[num] = {
    encerradoEm:       now.toISOString(),
    dataEncerramento:  now.toLocaleDateString('pt-BR'),
    horaEncerramento:  now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
    encerradoPor:      u ? u.nome : 'Sistema',
    status:            'Encerrado',
    // Checklist fields
    solucao:           chkData?.solucao || '',
    tecnicos:          chkData?.tecnicos || '',
    materiais:         chkData?.materiais || '',
    equipamentos:      chkData?.equipamentos || '',
    observacoes:       chkData?.observacoes || '',
    checklist:         chkData?.checklist || {},
  };
  saveClosed(closed);

  const local = getLocal();
  const idx = local.findIndex(r=>r.num===num);
  if(idx>=0){local[idx].status='Encerrado';saveLocal(local);}

  const nowFmt=now.toLocaleDateString('pt-BR')+' às '+now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  addEvent(num, 'encerrou', u?u.nome:'Sistema', chkData?.solucao||'');
  audit('encerrou', `Chamado ${num} encerrado`, num);
  // Fase 4: allRecords() computado 1x e reaproveitado (nada muda entre as
  // duas leituras — local/closed já foram salvos acima — a 2ª chamada era
  // redundante).
  const _encRecForKB = allRecords().find(r=>r[0]===num);
  if(_encRecForKB && chkData?.solucao) salvarSolucaoNoKB(_encRecForKB, closed[num]);
  showToast('Chamado '+num+' encerrado com sucesso.');
  refreshAfterAction();
  // Notificação de encerramento
  const _encRec = _encRecForKB || [num,'','','','','Encerrado',''];
  emailService.notificarEncerramento(_encRec, closed[num]);

  if (target==='modal') {
    // Show success toast only — no need to re-open modal
    // modal-encerrar was already closed before checklist opened
    // Nothing to do here for UI — refreshAfterAction handles everything
  } else {
    document.getElementById('modal-detalhe').classList.remove('open');
    detCurrentNum=null;
  }
}

function reabrirChamado(num) {
  if (!temAcesso('p_reabrir')) { showToast('Sem permissão para reabrir chamados.'); return; }
  const closed = getClosedMap();
  delete closed[num];
  saveClosed(closed);
  const local = getLocal();
  const idx = local.findIndex(r=>r.num===num);
  if(idx>=0){ local[idx].status='Em Andamento'; saveLocal(local); }
  addEvent(num, 'reabriu', currentUser()?.nome||'Sistema', '');
  audit('reabriu', `Chamado ${num} reaberto`, num);
  showToast('Chamado '+num+' reaberto.');
  refreshAfterAction();
  document.getElementById('modal-detalhe').classList.remove('open');
}

// Técnico responsável de um chamado, com fallback em cascata para cobrir
// chamados antigos que não tinham o campo tecnico (ou nem assumidoPor)
// gravado no registro local: 1) tecnico (campo atual); 2) assumidoPor (campo
// já existente antes da correção); 3) actor do último evento assumiu/iniciou
// no histórico (cobre registros locais sem nenhum dos dois campos acima).
function getTecnicoResponsavel(num) {
  const rec = getLocal().find(r => r.num === num);
  if (rec?.tecnico)     return rec.tecnico;
  if (rec?.assumidoPor) return rec.assumidoPor;
  const eventos = getEvents()[num] || [];
  for (let i = eventos.length - 1; i >= 0; i--) {
    if ((eventos[i].type === 'assumiu' || eventos[i].type === 'iniciou') && eventos[i].actor) {
      return eventos[i].actor;
    }
  }
  return null;
}

function assumirChamado(num) {
  if (!num) return;
  if (!pode('editar')) { showToast('Sem permissão para assumir chamados.'); return; }
  const u = currentUser();
  if (!u) return;
  const local = getLocal();
  let idx = local.findIndex(r => r.num === num);
  if (idx >= 0) {
    local[idx].assumidoPor = u.nome;
    local[idx].assumidoEm  = new Date().toISOString();
    local[idx].tecnico     = u.nome; // "Técnico Responsável" passa a ser quem assumiu
  } else {
    const rec = allRecords().find(r => r[0] === num);
    if (rec) local.push({ num: rec[0], titulo: rec[1], cultura: rec[2],
      resp: rec[3], data: rec[4], status: rec[5], bucket: rec[6],
      assumidoPor: u.nome, assumidoEm: new Date().toISOString(), tecnico: u.nome });
  }
  saveLocal(local);
  addEvent(num, 'assumiu', u.nome, `Assumido por ${u.nome}`);
  audit('assumiu', `Chamado ${num} assumido`, num);
  showToast(`⚡ ${u.nome} assumiu o chamado ${num}`);
  refreshAfterAction();
  if (document.getElementById('modal-detalhe')?.classList.contains('open')) openDetalhe(num);
}

function buildTimeline(num, isClosed, closedInfo, localRec) {
  const events  = getEvents()[num] || [];
  const timeline = [];

  // ── EVENT TYPE CONFIG
  // icon, label, color-var, border-color
  const TYPE_CFG = {
    abriu:          { icon:'🟢', label:'Chamado aberto',          color:'var(--green)',   border:'var(--green)'  },
    assumiu:        { icon:'⚡', label:'Atendimento iniciado',     color:'var(--amber)',   border:'var(--amber)'  },
    iniciou:        { icon:'▶️', label:'Atendimento iniciado',     color:'var(--accent)',  border:'var(--accent)' },
    peca_solicitada:{ icon:'📦', label:'Peça solicitada',          color:'var(--purple)',  border:'var(--purple)' },
    peca_recebida:  { icon:'✔️', label:'Peça recebida',            color:'var(--teal)',    border:'var(--teal)'   },
    aguardando:     { icon:'⏳', label:'Aguardando peça',          color:'var(--purple)',  border:'var(--purple)' },
    status_alterado:{ icon:'🔄', label:'Status alterado',          color:'var(--text3)',   border:'var(--border2)'},
    editou:         { icon:'✏️', label:'Chamado editado',          color:'var(--text3)',   border:'var(--border2)'},
    reabriu:        { icon:'↩',  label:'Chamado reaberto',         color:'var(--accent)',  border:'var(--accent)' },
    cancelou:       { icon:'🚫', label:'Chamado cancelado',        color:'var(--red)',     border:'var(--red)'    },
    obs:            { icon:'💬', label:'Observação registrada',    color:'var(--text2)',   border:'var(--border2)'},
    encerrou:       { icon:'✅', label:'Chamado concluído',        color:'var(--green)',   border:'var(--green)'  },
  };

  // ── Helper: format a Date object to display strings
  function fmtDate(d) {
    if (!d || isNaN(d)) return { date:'—', time:'—', full:'—' };
    const date = d.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric'});
    const time = d.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    return { date, time, full: `${date} às ${time}` };
  }

  // ── 1. ABERTURA
  if (localRec) {
    const tsStr = localRec.dataHoraISO || (localRec.data ? localRec.data + 'T00:00:00' : '');
    const d     = tsStr ? new Date(tsStr) : null;
    const fmt   = d ? fmtDate(d) : { date: localRec.dataHoraAbertura||localRec.data||'', time:'', full:'' };
    const solicitante = localRec.solicitante || localRec.abertoPor || 'Sistema';
    timeline.push({
      ts:     tsStr || localRec.data || '',
      cfg:    TYPE_CFG.abriu,
      actor:  solicitante,
      date:   fmt.date,
      time:   fmt.time,
      detail: [
        localRec.categoria ? `📋 Categoria: <b>${localRec.categoria}</b>` : '',
        localRec.prior     ? `⚡ Prioridade: <b>${localRec.prior}</b>`    : '',
        localRec.tecnico   ? `👷 Técnico: <b>${localRec.tecnico}</b>`     : '',
      ].filter(Boolean).join('<br>'),
    });
  }

  // ── 2. EVENTS LOG (all addEvent() calls)
  events.forEach(e => {
    const d   = new Date(e.ts);
    const fmt = fmtDate(d);
    const cfg = TYPE_CFG[e.type] || { icon:'📌', label: e.type, color:'var(--text3)', border:'var(--border2)' };

    // Build detail based on event type
    let detail = '';
    if (e.type === 'peca_solicitada') {
      detail = e.detail ? `📦 <b>${e.detail}</b>` : '';
    } else if (e.type === 'peca_recebida') {
      detail = e.detail ? `✔️ <b>${e.detail}</b>` : '';
    } else if (e.type === 'status_alterado') {
      detail = e.detail || '';
    } else if (e.detail) {
      detail = e.detail;
    }

    timeline.push({
      ts: e.ts, cfg, actor: e.actor, date: fmt.date, time: fmt.time, detail,
    });
  });

  // ── 3. ENCERRAMENTO
  if (isClosed && closedInfo?.encerradoPor) {
    const d   = closedInfo.encerradoEm ? new Date(closedInfo.encerradoEm) : null;
    const fmt = d ? fmtDate(d) : { date: closedInfo.dataEncerramento||'', time: closedInfo.horaEncerramento||'' };
    const cfgKey = closedInfo.status==='Cancelado' ? 'cancelou' : 'encerrou';
    const cfg    = TYPE_CFG[cfgKey];

    let detail = '';
    if (closedInfo.tecnicos)     detail += `👷 <b>Técnico(s):</b> ${closedInfo.tecnicos}<br>`;
    if (closedInfo.solucao)      detail += `💡 <b>Solução:</b> ${closedInfo.solucao}<br>`;
    if (closedInfo.materiais)    detail += `🔧 <b>Materiais:</b> ${closedInfo.materiais}<br>`;
    if (closedInfo.equipamentos) detail += `⚙️ <b>Equipamentos:</b> ${closedInfo.equipamentos}<br>`;
    if (closedInfo.observacoes)  detail += `📝 <b>Obs:</b> ${closedInfo.observacoes}<br>`;

    let checklistHtml = '';
    if (closedInfo.checklist) {
      const ck = closedInfo.checklist;
      const items = [
        { key:'problemaResolvido',   label:'Problema resolvido' },
        { key:'testeRealizado',      label:'Teste realizado'    },
        { key:'equipamentoLiberado', label:'Equipamento liberado'},
        { key:'usuarioInformado',    label:'Usuário informado'  },
      ];
      checklistHtml = `<div class="tl-checklist">${items.map(it=>
        `<span class="tl-check-item ${ck[it.key]?'tl-check-ok':'tl-check-no'}">
          ${ck[it.key]?'✓':'✗'} ${it.label}
        </span>`).join('')}</div>`;
    }

    timeline.push({
      ts: closedInfo.encerradoEm || '',
      cfg, actor: closedInfo.encerradoPor,
      date: fmt.date, time: fmt.time,
      detail: detail.replace(/<br>$/,''),
      checklistHtml,
    });
  }

  // ── Sort by timestamp
  timeline.sort((a,b) => (a.ts||'').localeCompare(b.ts||''));

  if (!timeline.length) {
    return '<div style="color:var(--text3);font-size:12px;padding:16px 0;text-align:center">Nenhum evento registrado neste chamado.</div>';
  }

  // ── Render vertical timeline
  const items = timeline.map((ev, idx) => {
    const isLast = idx === timeline.length - 1;
    const hasDetail = ev.detail || ev.checklistHtml;

    return `<div class="tl-item">
      <!-- Icon column -->
      <div class="tl-icon-col">
        <div class="tl-icon" style="color:${ev.cfg.color};border-color:${ev.cfg.border};background:var(--surface)">
          ${ev.cfg.icon}
        </div>
      </div>
      <!-- Content -->
      <div class="tl-body">
        <div class="tl-label" style="color:${ev.cfg.color}">${ev.cfg.label}</div>
        <div class="tl-ts">
          <span class="tl-ts-date">${ev.date}</span>
          ${ev.time ? `<span style="color:var(--border2)">·</span><span>${ev.time}</span>` : ''}
        </div>
        ${ev.actor ? `<div class="tl-actor">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          ${ev.actor}
        </div>` : ''}
        ${hasDetail ? `<div class="tl-detail-box">${ev.detail||''}${ev.checklistHtml||''}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  // Update count
  const countEl = document.getElementById('det-hist-count');
  if (countEl) countEl.textContent = `${timeline.length} evento${timeline.length!==1?'s':''}`;

  return `<div class="tl-wrap">${items}</div>`;
}

function registrarEvento(type) {
  _pendingEvtType = type;
  const wrap  = document.getElementById('det-evt-input-wrap');
  const input = document.getElementById('det-evt-input');

  if (EVT_NEEDS_INPUT[type]) {
    if (wrap)  { wrap.style.display='block'; }
    if (input) {
      input.placeholder = EVT_PLACEHOLDERS[type] || 'Descreva…';
      input.value = '';
      input.focus();
    }
  } else {
    // No input needed — register immediately
    confirmarEvento();
  }
}

function confirmarEvento() {
  const type  = _pendingEvtType;
  if (!type)  return;
  const num   = detCurrentNum;
  if (!num)   return;
  const u     = currentUser();
  const input = document.getElementById('det-evt-input');
  const detail = (input?.value || '').trim();

  if (EVT_NEEDS_INPUT[type] && !detail) {
    showToast('⚠ Descreva o evento antes de confirmar.');
    input?.focus();
    return;
  }

  // Register the event in the log
  addEvent(num, type, u?.nome||'Sistema', detail);

  // Update status on local record if applicable
  const newStatus = EVT_STATUS_CHANGE[type];
  if (newStatus) {
    const local = getLocal();
    const idx   = local.findIndex(r => r.num === num);
    if (idx >= 0) {
      local[idx].status = newStatus;
      saveLocal(local);
    } else {
      // Historical record — create local override for status
      const rec = allRecords().find(r => r[0] === num);
      if (rec) {
        local.push({
          num: rec[0], titulo: rec[1], cultura: rec[2],
          resp: rec[3], data: rec[4], status: newStatus, bucket: rec[6],
        });
        saveLocal(local);
      }
    }
  }

  // Audit
  const labelMap = EVT_LABELS;
  audit(type, `${labelMap[type]||type}: ${detail}`, num);

  // Reset UI
  cancelarEvento();
  showToast(`✓ Evento "${EVT_LABELS[type]||type}" registrado`);

  // Refresh timeline in open modal
  refreshAfterAction();
  if (document.getElementById('modal-detalhe')?.classList.contains('open')) {
    openDetalhe(num);
  }
}

function cancelarEvento() {
  _pendingEvtType = null;
  const wrap  = document.getElementById('det-evt-input-wrap');
  const input = document.getElementById('det-evt-input');
  if (wrap)  wrap.style.display = 'none';
  if (input) input.value = '';
}

function submitChamado(){
  const titulo    = document.getElementById('f-titulo').value.trim();
  const cultura   = document.getElementById('f-nova-cultura').value;
  const resp      = document.getElementById('f-resp').value;
  const bucket    = selBucket;
  const categoria = document.getElementById('f-categoria')?.value||'';
  const tecnico   = document.getElementById('f-tecnico')?.value||'';
  const solicitante=document.getElementById('f-solicitante')?.value||'';
  const obsNovo   = document.getElementById('f-obs-novo')?.value||'';

  // Validation
  const _equipValidVal = document.getElementById('equip-selected-valid')?.value;
  if (!titulo)       { showToast('⚠ Selecione um equipamento da lista'); document.getElementById('f-titulo')?.focus(); return; }
  if (!_equipValidVal){ showToast('⚠ Selecione um equipamento da lista — clique em uma opção'); document.getElementById('f-titulo')?.focus(); return; }
  if (!categoria)    { showToast('⚠ Selecione a categoria do chamado'); document.getElementById('f-categoria')?.focus(); return; }
  if (!resp)         { showToast('⚠ Selecione pelo menos um responsável'); return; }
  if (!bucket)       { showToast('⚠ Selecione a Fazenda / Sistema'); return; }
  const desc = document.getElementById('f-desc').value.trim();
  if (!desc)         { showToast('⚠ Descreva o problema no campo Descrição'); document.getElementById('f-desc')?.focus(); return; }

  const prior  = document.getElementById('f-prior').value;
  const data   = document.getElementById('f-data').value || new Date().toISOString().slice(0,10);
  const all    = allRecords();
  const seq    = all.length + 1;
  const num    = 'CHM-' + String(seq).padStart(4,'0');
  const local  = getLocal();
  const now    = new Date();
  const u      = currentUser();
  const _equipCodigo = document.getElementById('equip-selected-codigo')?.value||'';

  // Peças: baixa do estoque se qtd informada
  const pecasUsadas = _pecasNovo.map(p=>({id:p.id,nome:p.nome,qtd:p.qtd,unidade:p.unidade}));
  if (pecasUsadas.length) {
    const estoque = getPecas();
    const movs    = getMovs();
    pecasUsadas.forEach(pu=>{
      const idx=estoque.findIndex(p=>p.id===pu.id);
      if(idx>=0){
        estoque[idx].qtd=Math.max(0,Number(estoque[idx].qtd)-pu.qtd);
        movs.push({id:'m'+Date.now()+'_'+pu.id,pecaId:pu.id,pecaNome:pu.nome,
          tipo:'saida',qtd:pu.qtd,before:estoque[idx].qtd+pu.qtd,after:estoque[idx].qtd,
          chamado:num,obs:'Registrado na abertura do chamado',
          ts:now.toISOString(),usuario:u?.nome||'Sistema'});
      }
    });
    savePecas(estoque);
    saveMovs(movs);
  }

  local.push({
    num, titulo, cultura, resp, data,
    status:       document.getElementById('f-status-novo')?.value||'Aberto',
    bucket, desc, prior,
    categoria,
    tecnico,
    solicitante:  solicitante || (u?.nome||'Sistema'),
    observacoes:  obsNovo,
    fotos:        _fotosNovo.map(f=>({name:f.name,type:f.type,data:f.data})),
    pecasUsadas,
    equipCodigo:  _equipCodigo,
    equipModelo:  document.getElementById('equip-info-modelo')?.textContent||'',
    equipGrupo:   document.getElementById('equip-info-grupo')?.textContent||'',
    equipStatus:  document.getElementById('equip-info-status')?.textContent||'',
    abertoPor:    u?.nome||'Sistema',
    dataHoraAbertura: now.toLocaleDateString('pt-BR')+' às '+now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
    dataHoraISO:  now.toISOString(),
  });
  saveLocal(local);

  // Success card
  document.getElementById('form-card').style.display='none';
  resetEquipForm();
  const sc=document.getElementById('success-card');
  sc.classList.add('show');
  document.getElementById('success-num').textContent=num;
  document.getElementById('success-msg').innerHTML=
    `<strong>${titulo}</strong><br>${cultura||'Sem cultura'} · ${resp.split(',').map(r=>r.trim()).join(' & ')} · ${bucket}`;
  const meta=document.getElementById('success-meta');
  if(meta){
    const parts=[];
    if(categoria) parts.push(`📋 ${categoria}`);
    if(tecnico)   parts.push(`👷 ${tecnico}`);
    if(pecasUsadas.length) parts.push(`🔧 ${pecasUsadas.length} peça(s)`);
    if(_fotosNovo.length)  parts.push(`📷 ${_fotosNovo.length} foto(s)`);
    meta.textContent=parts.join(' · ');
  }

  // Sem addEvent('abriu',...) aqui: buildTimeline() já sintetiza a entrada
  // "Chamado aberto" a partir do próprio registro local (categoria/prioridade/
  // técnico) — chamar addEvent também duplicava essa entrada no histórico.
  audit('abriu', `Chamado ${num} aberto: ${titulo}`, num);
  showToast('Chamado '+num+' aberto com sucesso!');
  refreshAfterAction();

  // Email notification
  const _abRec=[num,titulo,cultura,resp,data,'Aberto',bucket,'',prior];
  emailService.notificarAbertura(_abRec, u?.nome||'Sistema');

  // Fase 4: reaproveita "seq" (já é all.length+1, calculado acima) em vez
  // de chamar allRecords() de novo — exatamente 1 registro foi adicionado
  // entre as duas leituras, então o resultado é matematicamente o mesmo.
  const newTotal=seq.toLocaleString('pt-BR');
  document.getElementById('badge-chamados').textContent=newTotal;
  document.getElementById('total-badge').textContent=newTotal+' chamados';

  // Reset peças+fotos
  _pecasNovo=[]; _fotosNovo=[];
  renderPecasNovo(); renderFotoPreview();
}

function updateNovoNum(){
  const seq=allRecords().length+1;
  document.getElementById('novo-num').textContent='CHM-'+String(seq).padStart(4,'0');
}

// Preenche o <select> de Técnico Responsável com os técnicos realmente
// cadastrados (getCadTec(), sincronizado com a coleção Firestore "tecnicos"),
// em vez de uma lista fixa de nomes gravada no HTML.
function populateTecnicoSelect(){
  const sel=document.getElementById('f-tecnico');
  if(!sel) return;
  const atual=sel.value;
  const cad=getCadTec();
  const tecnicos=Object.values(cad||{})
    .filter(t=>t && t.nome && t.status!=='Inativo')
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  sel.innerHTML='<option value="">A definir…</option>'+
    tecnicos.map(t=>`<option value="${_escHtml(t.apelido||t.nome)}">${_escHtml(t.nome)}</option>`).join('');
  if(atual && [...sel.options].some(o=>o.value===atual)) sel.value=atual;
}

// Indicador de progresso do formulário "Novo Chamado" (Fase 2 · Etapa 2C-i)
// — só observa os MESMOS 5 campos que submitChamado() já exige (categoria,
// equipamento válido, sistema/sede, responsável, descrição); não bloqueia
// nada, não duplica a validação — é só um retrato visual do que falta.
function atualizarProgressoNovo() {
  const feitos = {
    ident:    !!document.getElementById('f-categoria')?.value,
    equip:    !!document.getElementById('equip-selected-valid')?.value,
    alocacao: !!document.getElementById('f-bucket-val')?.value,
    resp:     !!document.getElementById('f-resp')?.value,
    detalhes: !!document.getElementById('f-desc')?.value.trim(),
  };
  Object.entries(feitos).forEach(([chave, ok]) => {
    document.getElementById('novo-step-' + chave)?.classList.toggle('novo-step-ok', ok);
  });
  const n = Object.values(feitos).filter(Boolean).length;
  const badge = document.getElementById('novo-progress');
  if (badge) {
    badge.textContent = `${n}/5 obrigatórios`;
    badge.classList.toggle('novo-progress-ok', n === 5);
  }
}

function resetForm(){
  // Text/textarea fields
  ['f-titulo','f-desc','f-obs-novo'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  // Selects
  ['f-nova-cultura','f-tecnico','f-status-novo','f-categoria'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.selectedIndex=0;
  });
  // Responsáveis
  document.getElementById('f-resp').value='';
  document.querySelectorAll('.resp-opt.sel').forEach(b=>b.classList.remove('sel'));
  const tagsEl=document.getElementById('resp-tags');
  if(tagsEl) tagsEl.innerHTML='';
  // Priority (reset to Média)
  document.getElementById('f-prior').value='Média';
  document.querySelectorAll('.prio-opt').forEach(o=>{
    o.classList.toggle('selected', o.dataset.val==='Média');
  });
  // Date + bucket
  document.getElementById('f-data').value=new Date().toISOString().slice(0,10);
  selBucket='';
  document.querySelectorAll('.bucket-opt').forEach(b=>b.classList.remove('selected'));
  // Fotos + peças
  _fotosNovo=[]; _pecasNovo=[];
  renderFotoPreview(); renderPecasNovo();
  // Cards
  document.getElementById('form-card').style.display='block';
  document.getElementById('success-card').classList.remove('show');
  // Auto-fill
  updateNovoNum();
  preencherSolicitante();
  populateTecnicoSelect();
  tickFormClock();
  // Equip
  equipClear();
  atualizarProgressoNovo();
}

function resetEquipForm() {
  equipClear();
}

function preencherSolicitante() {
  const u=currentUser();
  const el=document.getElementById('f-solicitante');
  if(el&&u) el.value=u.nome;
}

function tickFormClock() {
  const el=document.getElementById('novo-data-hora');
  if(el) el.textContent=new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function selectPrior(el) {
  document.querySelectorAll('.prio-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('f-prior').value = el.dataset.val;
}

function handleFotoInput(files) {
  [...files].slice(0, 5 - _fotosNovo.length).forEach(f => {
    if (f.size > 5 * 1024 * 1024) { showToast(`⚠ ${f.name} ultrapassa 5 MB.`); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      _fotosNovo.push({ name: f.name, type: f.type, data: ev.target.result });
      renderFotoPreview();
    };
    reader.readAsDataURL(f);
  });
  document.getElementById('foto-input').value = '';
}

function handleFotoDrop(ev) {
  ev.preventDefault();
  document.getElementById('foto-drop-zone').classList.remove('drag-over');
  handleFotoInput(ev.dataTransfer.files);
}

function renderFotoPreview() {
  const wrap = document.getElementById('foto-preview');
  if (!wrap) return;
  wrap.innerHTML = _fotosNovo.map((f,i) => {
    const isPdf = f.type==='application/pdf';
    return `<div class="foto-thumb">
      ${isPdf
        ? `<div class="foto-thumb-pdf" title="${_escHtml(f.name)}">📄</div>`
        : `<img src="${f.data}" alt="${_escHtml(f.name)}" title="${_escHtml(f.name)}">`}
      <button class="foto-thumb-del" onclick="removerFoto(${i})" title="Remover">✕</button>
    </div>`;
  }).join('');
}

function removerFoto(idx) {
  _fotosNovo.splice(idx, 1);
  renderFotoPreview();
}

// Universo de equipamentos pesquisável: o catálogo estático EQUIPAMENTOS (445
// itens) enriquecido com Patrimônio/Marca do cadastro administrável (getCadEq(),
// espelho local da coleção Firestore "equipamentos") + qualquer equipamento
// cadastrado que NÃO faz parte do catálogo estático original (frota nova,
// registrada depois pela tela de Equipamentos) — sem isso, equipamentos
// cadastrados fora dos 445 originais nunca apareciam nesta busca.
function _equipUniverso() {
  const cad = getCadEq() || {};
  const vistos = new Set();
  const lista = EQUIPAMENTOS.map(eq => {
    vistos.add(eq.c);
    const c = cad[eq.c];
    if (!c) return eq;
    const extra = [c.patrimonio, c.fabricante].filter(Boolean).join(' ');
    return extra ? { ...eq, e: eq.e + ' ' + extra } : eq;
  });
  Object.values(cad).forEach(c => {
    if (!c || !c.frota || vistos.has(c.frota)) return;
    lista.push({
      c: c.frota,
      d: c.modelo || c.fabricante || ('Equipamento ' + c.frota),
      e: [c.frota, c.modelo, c.fabricante, c.patrimonio].filter(Boolean).join(' '),
      m: c.modelo || '',
      t: c.tipo || '',
      g: c.tipo || '',
      s: c.status || 'Ativo',
    });
  });
  return lista;
}

function equipSearch(q) {
  const drop  = document.getElementById('equip-dropdown');
  const clear = document.getElementById('equip-clear');
  const infoC = document.getElementById('equip-info-card');
  const selV  = document.getElementById('equip-selected-valid');

  if (clear) clear.className = q ? 'equip-clear-btn show' : 'equip-clear-btn';

  // If user is typing after a valid selection, invalidate it
  if (_equipValid) {
    _equipValid = false;
    if (selV) selV.value = '';
    if (infoC) infoC.className = 'equip-info-card';
  }

  if (!q || q.length < 1) {
    drop.className = 'equip-dropdown';
    drop.innerHTML = '';
    _equipFocusIdx = -1;
    return;
  }

  const ql = q.toLowerCase();
  const universo = _equipUniverso();
  // Search: code starts-with first, then description/modelo/patrimônio/marca contains
  const exact   = universo.filter(e => e.c.toLowerCase().startsWith(ql));
  const partial = universo.filter(e =>
    !e.c.toLowerCase().startsWith(ql) &&
    (e.d.toLowerCase().includes(ql) || e.e.toLowerCase().includes(ql) || (e.m||'').toLowerCase().includes(ql))
  );
  const results = [...exact, ...partial].slice(0, 30);

  if (!results.length) {
    drop.innerHTML = '<div class="equip-nofound">⚠ Equipamento não cadastrado — nenhum resultado para "' + _escHtml(q) + '"</div>';
    drop.className = 'equip-dropdown open';
    return;
  }

  _equipFocusIdx = -1;
  drop.innerHTML = results.map((e, i) => `
    <div class="equip-item" data-idx="${i}" data-codigo="${e.c}"
      onmousedown="equipSelect(${JSON.stringify(e).replace(/"/g,'&quot;')})"
      onmouseover="equipHover(${i})">
      <div class="equip-item-code">${e.c}</div>
      <div class="equip-item-name">${e.d}</div>
      <div class="equip-item-meta">
        <span>${e.g || '—'}</span>
        <span>${e.m || '—'}</span>
        ${e.s !== 'Ativo' ? '<span class="equip-badge-inactive">INATIVO</span>' : ''}
      </div>
    </div>`).join('');
  drop.className = 'equip-dropdown open';
}

function equipKeyNav(e) {
  const drop  = document.getElementById('equip-dropdown');
  const items = drop.querySelectorAll('.equip-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _equipFocusIdx = Math.min(_equipFocusIdx + 1, items.length - 1);
    equipHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _equipFocusIdx = Math.max(_equipFocusIdx - 1, 0);
    equipHighlight(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_equipFocusIdx >= 0 && items[_equipFocusIdx]) {
      items[_equipFocusIdx].dispatchEvent(new MouseEvent('mousedown'));
    }
  } else if (e.key === 'Escape') {
    drop.className = 'equip-dropdown';
    _equipFocusIdx = -1;
  }
}

function equipSelect(equip) {
  const input = document.getElementById('f-titulo');
  const drop  = document.getElementById('equip-dropdown');
  const clear = document.getElementById('equip-clear');
  const infoC = document.getElementById('equip-info-card');
  const selC  = document.getElementById('equip-selected-codigo');
  const selV  = document.getElementById('equip-selected-valid');

  // Fill the main input with the equipamento string (code + description)
  if (input) input.value = equip.e || (equip.c + ' ' + equip.d);

  // Close dropdown
  drop.className = 'equip-dropdown';
  drop.innerHTML = '';
  _equipFocusIdx = -1;

  // Fill info card
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
  setEl('equip-info-codigo', equip.c);
  setEl('equip-info-modelo', equip.m);
  setEl('equip-info-grupo',  equip.g);
  setEl('equip-info-tipo',   equip.t);
  const statusEl = document.getElementById('equip-info-status');
  if (statusEl) {
    statusEl.textContent = equip.s;
    statusEl.style.color = equip.s === 'Ativo' ? 'var(--green)' : 'var(--amber)';
  }
  // Fazenda/Marca — só existem no cadastro complementar (getCadEq), nem todo equipamento tem
  const cadInfo = getCadEq()[equip.c];
  setEl('equip-info-fazenda', cadInfo?.fazenda);
  setEl('equip-info-marca', cadInfo?.fabricante);
  setEl('equip-info-patrimonio', cadInfo?.patrimonio);
  if (infoC) infoC.className = 'equip-info-card show';

  // Mark as valid selection
  _equipValid = true;
  if (selC) selC.value = equip.c;
  if (selV) selV.value = '1';
  if (clear) clear.className = 'equip-clear-btn show';

  renderHistoricoEquip(equip.c);
  atualizarProgressoNovo();
}

// Histórico de chamados (abertos + encerrados) do equipamento selecionado no
// formulário de Novo Chamado. Reaproveita o mesmo vínculo já usado em
// verHistoricoFrota() (src/equipamentos/index.js): MATCH_MAP para chamados
// históricos + local.equipCodigo para chamados criados pelo app modular.
// prefix ganhou um parâmetro (Fase 2 · Etapa 2B) pra poder renderizar o
// mesmo histórico dentro do Centro Operacional do Chamado, sem duplicar
// ids no DOM — chamada sem o 2º argumento (equipSelect(), tela Novo
// Chamado) continua escrevendo exatamente nos mesmos ids de sempre.
function renderHistoricoEquip(code, prefix = 'equip-hist') {
  const card = document.getElementById(prefix + '-card');
  if (!card) return;

  const all    = allRecords();
  const local  = getLocal();
  const closed = getClosedMap();

  const nums = new Set();
  Object.entries(MATCH_MAP).forEach(([n, c]) => { if (c === code) nums.add(n); });
  local.forEach(lr => { if (lr.equipCodigo === code) nums.add(lr.num); });

  const recs = all.filter(r => nums.has(r[0])).sort((a, b) => (b[4]||'').localeCompare(a[4]||''));
  const isFechado = r => r[5]==='Concluída' || r[5]==='Encerrado' || !!closed[r[0]];
  const nAberto    = recs.filter(r => !isFechado(r)).length;
  const nEncerrado = recs.filter(isFechado).length;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl(prefix + '-total',     recs.length);
  setEl(prefix + '-aberto',    nAberto);
  setEl(prefix + '-encerrado', nEncerrado);

  const vazio   = document.getElementById(prefix + '-vazio');
  const tblWrap = document.getElementById(prefix + '-tbl-wrap');
  const tbody   = document.getElementById('tbl-' + prefix);
  if (vazio)   vazio.style.display   = recs.length ? 'none'  : 'block';
  if (tblWrap) tblWrap.style.display = recs.length ? 'table' : 'none';
  if (tbody) {
    tbody.innerHTML = recs.map(r => {
      const ci = closed[r[0]];
      let tempoParado = '—';
      if (r[4]) {
        const abertura = new Date(r[4]+'T00:00:00');
        const fim = ci?.encerradoEm ? new Date(ci.encerradoEm) : new Date();
        const dias = Math.max(0, Math.floor((fim - abertura) / 86400000));
        tempoParado = dias + (dias === 1 ? ' dia' : ' dias');
      }
      // Prioridade corrigida aqui também (mesmo achado da Etapa 2A: getPrior/
      // rec[9] nunca funciona) — usa prioridadeReal(num) + prioridadeBadge.
      return `<tr style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
        <td class="td-num">${r[0]}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escHtml(r[1])}</td>
        <td>${prioridadeBadge(prioridadeReal(r[0]))}</td>
        <td style="font-family:var(--font-mono)">${r[4]?r[4].split('-').reverse().join('/'):'—'}</td>
        <td><span class="badge ${statusPill(r[5])}">${r[5]}</span></td>
        <td>${(r[3]||'—').replace(/,/g,' e ')}</td>
        <td>${_escHtml(ci?.tecnicos || '—')}</td>
        <td style="font-family:var(--font-mono)">${ci?.dataEncerramento || '—'}</td>
        <td style="font-family:var(--font-mono)">${tempoParado}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_escHtml(ci?.solucao||'')}">${_escHtml(ci?.solucao || '—')}</td>
      </tr>`;
    }).join('');
  }
  card.style.display = 'block';
}

function equipClear() {
  const input = document.getElementById('f-titulo');
  const drop  = document.getElementById('equip-dropdown');
  const clear = document.getElementById('equip-clear');
  const infoC = document.getElementById('equip-info-card');
  const selC  = document.getElementById('equip-selected-codigo');
  const selV  = document.getElementById('equip-selected-valid');

  if (input) { input.value = ''; input.focus(); }
  if (drop)  { drop.className = 'equip-dropdown'; drop.innerHTML = ''; }
  if (clear) clear.className = 'equip-clear-btn';
  if (infoC) infoC.className = 'equip-info-card';
  if (selC)  selC.value = '';
  if (selV)  selV.value = '';
  _equipValid = false;
  _equipFocusIdx = -1;
  const histC = document.getElementById('equip-hist-card');
  if (histC) histC.style.display = 'none';
  atualizarProgressoNovo();
}

function equipHighlight(items) {
  items.forEach((it, i) => {
    it.className = 'equip-item' + (i === _equipFocusIdx ? ' focused' : '');
  });
  if (items[_equipFocusIdx]) {
    items[_equipFocusIdx].scrollIntoView({ block: 'nearest' });
  }
}

function equipHover(idx) {
  _equipFocusIdx = idx;
  const drop  = document.getElementById('equip-dropdown');
  equipHighlight(drop.querySelectorAll('.equip-item'));
}

function buscarPecaNovo(q) {
  const res = document.getElementById('peca-results-novo');
  if (!res) return;
  if (!q || q.length < 2) { res.style.display='none'; return; }
  const ql = q.toLowerCase();
  const matches = getPecas().filter(p =>
    p.nome.toLowerCase().includes(ql) || (p.codigo||'').toLowerCase().includes(ql)
  ).slice(0, 8);
  if (!matches.length) { res.style.display='none'; return; }
  res.innerHTML = matches.map(p => `
    <div class="peca-result-item" onclick="adicionarPecaNovo('${p.id}','${p.nome.replace(/'/g,"\'")}','${p.unidade||'un'}')">
      <span><b>${p.nome}</b>${p.codigo?` · <span style="font-size:10px;color:var(--text3)">${p.codigo}</span>`:''}</span>
      <span style="color:var(--text3);font-size:11px">${p.qtd} ${p.unidade||'un'} em estoque
        ${Number(p.qtd)<=Number(p.minimo||2)?'<span style="color:var(--red);font-size:10px"> ⚠ baixo</span>':''}
      </span>
    </div>`).join('');
  res.style.display='block';
}

function adicionarPecaNovo(id, nome, unidade) {
  document.getElementById('peca-srch-novo').value='';
  document.getElementById('peca-results-novo').style.display='none';
  const existe = _pecasNovo.find(p=>p.id===id);
  if (existe) { existe.qtd++; } else { _pecasNovo.push({id, nome, unidade, qtd:1}); }
  renderPecasNovo();
}

function alterarQtdPecaNovo(id, delta) {
  const p = _pecasNovo.find(p=>p.id===id);
  if (!p) return;
  p.qtd = Math.max(0, p.qtd + delta);
  if (p.qtd === 0) _pecasNovo = _pecasNovo.filter(x=>x.id!==id);
  renderPecasNovo();
}

function renderPecasNovo() {
  const wrap = document.getElementById('pecas-selecionadas');
  const vazio = document.getElementById('pecas-vazias');
  if (!wrap) return;
  if (!_pecasNovo.length) {
    wrap.innerHTML='';
    if(vazio) vazio.style.display='block';
    return;
  }
  if(vazio) vazio.style.display='none';
  wrap.innerHTML = _pecasNovo.map(p => `
    <div class="peca-selecionada">
      <span class="peca-selecionada-nome">${p.nome}</span>
      <div class="peca-selecionada-qtd">
        <button class="peca-qtd-btn" onclick="alterarQtdPecaNovo('${p.id}',-1)">−</button>
        <span class="peca-qtd-val">${p.qtd}</span>
        <button class="peca-qtd-btn" onclick="alterarQtdPecaNovo('${p.id}',1)">+</button>
        <span style="font-size:11px;color:var(--text3);margin-left:2px">${p.unidade||'un'}</span>
      </div>
      <button class="btn btn-ghost" style="padding:2px 8px;font-size:11px;color:var(--red)" onclick="alterarQtdPecaNovo('${p.id}',-999)">✕</button>
    </div>`).join('');
}

function detMostrarConfirm() {
  document.getElementById('det-confirm-msg').style.display  = 'block';
  document.getElementById('det-btn-enc-confirm').style.display  = 'inline-flex';
  document.getElementById('det-btn-cancelar-confirm').style.display = 'inline-flex';
  document.getElementById('det-btn-enc-init').style.display  = 'none';
}

function detCancelarConfirm() {
  document.getElementById('det-confirm-msg').style.display  = 'none';
  document.getElementById('det-btn-enc-confirm').style.display  = 'none';
  document.getElementById('det-btn-cancelar-confirm').style.display = 'none';
  document.getElementById('det-btn-enc-init').style.display  = 'inline-flex';
}

function detConfirmarEnc() {
  if (!detCurrentNum) return;
  // Open checklist first — _doEncerramento is called on submit
  openChecklist('detalhe');
}

// Rótulo completo de cada responsável — achado da Etapa 2C-i: o código
// anterior só distinguia Guilherme/Walison (ternário de 2 opções só);
// qualquer outro responsável dos 6 botões existentes (Matheus/Carlos/
// Francisco/Pierry) aparecia rotulado como "Walison Almeida" nas tags.
// Mesmos nomes já escritos nos próprios botões (index.html), só
// centralizados aqui pra não repetir a lista em 2 funções.
const RESP_LABEL = {
  Guilherme: 'Guilherme Otávio', Walison: 'Walison Almeida',
  Matheus: 'Matheus Gabriel', Carlos: 'Carlos Santos',
  Francisco: 'Francisco', Pierry: 'Pierry',
};
function _respTagsHTML(selected) {
  return selected.map(v =>
    `<span class="resp-tag">${RESP_LABEL[v]||v}<button type="button" onclick="removeResp('${v}')">×</button></span>`
  ).join('');
}

function toggleResp(btn) {
  btn.classList.toggle('sel');
  const selected = [...document.querySelectorAll('.resp-opt.sel')].map(b => b.dataset.val);
  document.getElementById('f-resp').value = selected.join(',');
  const tagsEl = document.getElementById('resp-tags');
  tagsEl.innerHTML = _respTagsHTML(selected);
  atualizarProgressoNovo();
}

function removeResp(val) {
  const btn = document.querySelector(`.resp-opt[data-val="${val}"]`);
  if (btn) btn.classList.remove('sel');
  const selected = [...document.querySelectorAll('.resp-opt.sel')].map(b => b.dataset.val);
  document.getElementById('f-resp').value = selected.join(',');
  const tagsEl = document.getElementById('resp-tags');
  tagsEl.innerHTML = _respTagsHTML(selected);
  atualizarProgressoNovo();
}

function selectBucket(el,name){
  document.querySelectorAll('.bucket-opt').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  selBucket=name;
  document.getElementById('f-bucket-val').value=name;
  atualizarProgressoNovo();
}

function gsOpen(num) {
  document.getElementById('global-search-results').classList.remove('open');
  document.getElementById('global-search-box').value = '';
  openDetalhe(num);
}

function globalSearch(q) {
  clearTimeout(_gsTimeout);
  const box = document.getElementById('global-search-results');
  if (!box) return;
  if (!q || q.length < 2) { box.classList.remove('open'); box.innerHTML=''; return; }
  _gsTimeout = setTimeout(() => {
    const ql = q.toLowerCase();
    const all = allRecords();
    const local = getLocal();
    // Ampliada na Fase 2 · Etapa 2C-ii: além de número/equipamento(título)/
    // responsável, agora também fazenda (r[6]) e solicitante/descrição
    // (só existem no registro local, _lr.solicitante/_lr.desc) — mesmo
    // array, mesmo filtro, só mais 3 condições sobre dado que já existe.
    const results = all.filter(r => {
      if (r[0].toLowerCase().includes(ql))          return true;
      if ((r[1]||'').toLowerCase().includes(ql))     return true;
      if ((r[3]||'').toLowerCase().includes(ql))     return true;
      if ((r[6]||'').toLowerCase().includes(ql))     return true;
      if (fazendaLabel(r[6]).toLowerCase().includes(ql)) return true;
      const _lrGs = local.find(x => x.num === r[0]);
      if ((_lrGs?.solicitante||'').toLowerCase().includes(ql)) return true;
      if ((_lrGs?.desc||'').toLowerCase().includes(ql))        return true;
      return false;
    }).slice(0,10);

    if (!results.length) {
      box.innerHTML='<div class="gs-item" style="color:var(--text3)">Nenhum resultado encontrado.</div>';
    } else {
      box.innerHTML = results.map(r=>`
        <div class="gs-item" onclick="gsOpen('${r[0]}')">
          <div class="gs-num">${r[0]}</div>
          <div class="gs-title">${(r[1]||'—').slice(0,60)}</div>
          <div class="gs-meta">${r[2]||'—'} · ${(r[3]||'—').replace(/,/g,' e ')} · <span class="badge ${statusPill(r[5])}" style="padding:1px 6px;font-size:10px">${r[5]}</span></div>
        </div>`).join('');
    }
    box.classList.add('open');
  }, 180);
}
