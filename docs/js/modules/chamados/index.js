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

function diasAberto(dataStr) {
  if (!dataStr) return 0;
  const d = new Date(dataStr + 'T00:00:00');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.floor((hoje - d) / 86400000);
}

function diasChip(dias) {
  if (dias > 7)  return 'style="background:#fef2f2;color:#dc2626;font-weight:700"';
  if (dias >= 3) return 'style="background:#fffbeb;color:#d97706;font-weight:700"';
  return 'style="background:#f0fdf4;color:#16a34a;font-weight:700"';
}

function priorPill(p) {
  if (!p || p === 'Média') return '<span class="pill p-outros">Média</span>';
  if (p === 'Urgente')    return '<span class="pill" style="background:#fef2f2;color:#dc2626;font-weight:700">Urgente</span>';
  if (p === 'Alta')       return '<span class="pill p-tabaco">Alta</span>';
  return '<span class="pill p-outros">Baixa</span>';
}

function getPrior(r) {
  // local records store prior at r[9]; base records have no priority
  return r[9] || r[10] || '';  // index may vary
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

function renderChamados(){
  if(!filteredRecords.length) filteredRecords=[...allRecords()];

// ── AUTH INIT
(function(){
  const u = getSession();
  if (u) {
    document.getElementById('login-overlay').style.display='none';
    document.getElementById('topbar-user').textContent = u.nome.split(' ')[0]+' · '+(PERFIL_LABEL[u.perfil]||u.perfil);
    aplicarNavPerms();
  } else {
    document.getElementById('login-overlay').style.display='flex';
    // focus login field
    setTimeout(()=>document.getElementById('login-user')?.focus(), 100);
  }
})();
  const total=filteredRecords.length;
  const pages=Math.ceil(total/PER_PAGE);
  const slice=filteredRecords.slice((page-1)*PER_PAGE, page*PER_PAGE);

  document.getElementById('pag-info').textContent=`Exibindo ${(page-1)*PER_PAGE+1}–${Math.min(page*PER_PAGE,total)} de ${total.toLocaleString('pt-BR')} registros`;

  document.getElementById('tbl-chamados').innerHTML=slice.map(r=>{
    const _lrC=getLocal().find(x=>x.num===r[0]);
    const _frC=frotaLabel(r[0],_lrC);
    return `<tr style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
      <td class="td-num">
        ${r[0]}
        ${_frC?`<div style="font-size:9px;color:var(--accent);font-family:var(--font-mono);margin-top:1px">${_frC}</div>`:''}
      </td>
      <td class="td-titulo">${_escHtml(r[1])}</td>
      <td><span class="pill ${cultPill(r[2])}">${r[2]||'—'}</span></td>
      <td style="white-space:nowrap">${r[3]||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;white-space:nowrap">${r[4]?r[4].split('-').reverse().join('/'):' —'}</td>
      <td><span class="pill ${statusPill(r[5])}">${r[5]}</span></td>
      <td style="color:var(--text3);font-size:11px">${r[6]||'—'}</td>
    </tr>`;}).join('');

  // Pagination
  const pagRow=document.getElementById('pag-row');
  let btns='';
  btns+=`<button class="pag-btn" onclick="gotoPage(${page-1})" ${page===1?'disabled':''}>←</button>`;
  const start=Math.max(1,page-2), end=Math.min(pages,page+2);
  if(start>1) btns+=`<button class="pag-btn" onclick="gotoPage(1)">1</button>${start>2?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}`;
  for(let p=start;p<=end;p++) btns+=`<button class="pag-btn ${p===page?'active':''}" onclick="gotoPage(${p})">${p}</button>`;
  if(end<pages) btns+=`${end<pages-1?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}<button class="pag-btn" onclick="gotoPage(${pages})">${pages}</button>`;
  btns+=`<button class="pag-btn" onclick="gotoPage(${page+1})" ${page===pages?'disabled':''}>→</button>`;
  pagRow.innerHTML=btns;
}

function clearFilters(){
  document.getElementById('srch').value='';
  document.getElementById('f-cultura').value='';
  document.getElementById('f-status').value='';
  document.getElementById('f-bucket').value='';
  applyFilters();
}

function applyFilters(){
  const q=(document.getElementById('srch').value||'').toLowerCase();
  const fc=document.getElementById('f-cultura').value;
  const fs=document.getElementById('f-status').value;
  const fb=document.getElementById('f-bucket').value;
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
    if(q && !(r[0].toLowerCase().includes(q)||r[1].toLowerCase().includes(q))) return false;
    return true;
  });
  page=1;
  renderChamados();
}

function gotoPage(p){
  const pages=Math.ceil(filteredRecords.length/PER_PAGE);
  if(p<1||p>pages) return;
  page=p;renderChamados();
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
  statusEl.innerHTML = `<span class="pill ${statusPill(rec[5])}">${isClosed ? (rec[5]==='Encerrado'?'Encerrado':'Concluída') : (rec[5] || 'Não iniciado')}</span>`;
  document.getElementById('det-prior').textContent  = rec[9] || rec[9] || 'Média';
  document.getElementById('det-resp').textContent   = (rec[3]||'').replace(/,/g,' e ') || '—';

  // New fields from local record
  const _lr = getLocal().find(r=>r.num===rec[0]);
  const _setD=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v||'—';};
  _setD('det-categoria',   _lr?.categoria);
  _setD('det-tecnico',     _lr?.tecnico);
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
    _fotosEl.innerHTML=(_lr.fotos).map(f=>{
      const isPdf=f.type==='application/pdf';
      return `<div class="foto-thumb" title="${_escHtml(f.name)}" style="cursor:pointer" onclick="window.open('${f.data}','_blank')">
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

  // Observações
  const _obsWrap=document.getElementById('det-obs-wrap');
  const _obsEl=document.getElementById('det-obs');
  if(_obsEl&&_lr?.observacoes){
    _obsEl.textContent=_lr.observacoes;
    if(_obsWrap) _obsWrap.style.display='block';
  } else if(_obsWrap) _obsWrap.style.display='none';
  document.getElementById('det-cult').innerHTML     = `<span class="pill ${cultPill(rec[2])}">${rec[2]||'Sem cultura'}</span>`;
  // Fazenda label
  const fazendaLabel = rec[6]==='Solinftec KRT'?'Karitel':rec[6]==='Solinftec RDM'?'Rio do Meio':(rec[6]||'—');
  const setDetEl = (id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setDetEl('det-fazenda', fazendaLabel);
  setDetEl('det-bucket',  rec[6] || '—');
  setDetEl('det-data',    rec[4] ? rec[4].split('-').reverse().join('/') : '—');

  // Aberto por (from local record)
  const localRec2 = getLocal().find(r=>r.num===num);
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

  // Descrição (local records may have it at index 7+)
  const desc = rec[7] || '';
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
    const localRec = getLocal().find(r => r.num === num);
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

  // Reabrir button (no recursion — runs once per open)
  const btnReabrir = document.getElementById('det-btn-reabrir') ||
    (() => {
      const b = document.createElement('button');
      b.id = 'det-btn-reabrir';
      b.className = 'btn btn-ghost';
      b.textContent = '↩ Reabrir Chamado';
      document.querySelector('.modal-footer')?.prepend(b);
      return b;
    })();
  btnReabrir.style.display = (isClosed && temAcesso('p_reabrir')) ? 'inline-flex' : 'none';
  btnReabrir.onclick = () => reabrirChamado(num);
  // Assumir button
  const _btnAssumirDet = document.getElementById('det-btn-assumir');
  if (_btnAssumirDet) {
    const _localA = getLocal().find(r=>r.num===num);
    const _jaAssumido = _localA?.assumidoPor && _localA.assumidoPor===(currentUser()?.nome||'');
    _btnAssumirDet.style.display = (!isClosed && pode('editar') && !_jaAssumido) ? 'inline-flex' : 'none';
  }
  // Status action bar
  const _statusActBar = document.getElementById('det-status-actions');
  if (_statusActBar) {
    _statusActBar.style.display = (!isClosed && pode('editar')) ? 'block' : 'none';
    const _evWrap = document.getElementById('det-evt-input-wrap');
    if (_evWrap) _evWrap.style.display = 'none';
  }

  document.getElementById('modal-detalhe').classList.add('open');
}

function closeDetalhe(e) {
  if (e && e.target !== document.getElementById('modal-detalhe')) return;
  document.getElementById('modal-detalhe').classList.remove('open');
  detCurrentNum = null;
}

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
      const rowBg = dias > 7 ? 'background:#fff5f5' : dias >= 3 ? 'background:#fffdf0' : '';
      const dataFmt = r[4] ? r[4].split('-').reverse().join('/') : '—';
      // r[9] = prioridade (index 9 for local records; base records don't have it → fallback)
      const prior = r[9] || r[9] || 'Média';
      return `<tr style="${rowBg}cursor:pointer" onclick="openDetalhe('${r[0]}')">
        <td class="td-num">${r[0]}</td>
        <td class="td-titulo">${_escHtml(r[1])}</td>
        <td style="white-space:nowrap;font-weight:500">${r[3] || '<span style="color:var(--text3)">—</span>'}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;white-space:nowrap">${dataFmt}</td>
        <td>${priorPill(prior)}</td>
        <td><span class="pill ${statusPill(r[5])}">${r[5] || 'Não iniciado'}</span></td>
        <td><span class="pill" ${diasChip(dias)}>${dias}d</span></td>
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

  // Pagination buttons — reuse same pattern as renderChamados
  const pagRow = document.getElementById('ab-pag-row');
  if (!pagRow) return;
  let btns = '';
  btns += `<button class="pag-btn" onclick="abGotoPage(${abPage-1})" ${abPage===1?'disabled':''}>←</button>`;
  const start = Math.max(1, abPage-2), end = Math.min(pages, abPage+2);
  if (start > 1) btns += `<button class="pag-btn" onclick="abGotoPage(1)">1</button>${start>2?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}`;
  for (let p = start; p <= end; p++) btns += `<button class="pag-btn ${p===abPage?'active':''}" onclick="abGotoPage(${p})">${p}</button>`;
  if (end < pages) btns += `${end<pages-1?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}<button class="pag-btn" onclick="abGotoPage(${pages})">${pages}</button>`;
  btns += `<button class="pag-btn" onclick="abGotoPage(${abPage+1})" ${abPage===pages?'disabled':''}>→</button>`;
  pagRow.innerHTML = btns;
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

  let recs = allRecords();

  if (q)       recs = recs.filter(r => r[0].toLowerCase().includes(q) || (r[1]||'').toLowerCase().includes(q));
  if (fCult)   recs = recs.filter(r => r[2] === fCult);
  if (fFaz)    recs = recs.filter(r => r[6] === fFaz);
  if (fResp)   recs = recs.filter(r => (r[3]||'').includes(fResp));
  if (fStatus) recs = recs.filter(r => r[5] === fStatus || (fStatus==='Concluída' && (r[5]==='Encerrado'||r[5]==='Concluída')));
  if (fDe)     recs = recs.filter(r => (r[4]||'') >= fDe);
  if (fAte)    recs = recs.filter(r => (r[4]||'') <= fAte);
  if (critCard !== undefined && critCard !== null) {
    recs = recs.filter(r => getPrior(r) === critCard);
  }

  // KPIs from ALL records (unfiltered)
  const all = allRecords();
  const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('crit-urgente', all.filter(r=>getPrior(r)==='Urgente').length.toLocaleString('pt-BR'));
  setEl('crit-alta',    all.filter(r=>getPrior(r)==='Alta').length.toLocaleString('pt-BR'));
  setEl('crit-media',   all.filter(r=>getPrior(r)==='Média').length.toLocaleString('pt-BR'));
  setEl('crit-baixa',   all.filter(r=>!getPrior(r)||getPrior(r)==='Baixa').length.toLocaleString('pt-BR'));

  // Sort by priority then date
  const priorityRank = {Urgente:0,Alta:1,Média:2,Baixa:3,'':4};
  recs.sort((a,b)=>{
    const pa=priorityRank[getPrior(a)]??4, pb=priorityRank[getPrior(b)]??4;
    if(pa!==pb) return pa-pb;
    return (b[4]||'').localeCompare(a[4]||'');
  });

  const total=recs.length, pages=Math.ceil(total/CRIT_PER_PAGE)||1;
  if(critPage>pages)critPage=1;
  const slice=recs.slice((critPage-1)*CRIT_PER_PAGE, critPage*CRIT_PER_PAGE);
  setEl('crit-pag-info',`Exibindo ${(critPage-1)*CRIT_PER_PAGE+1}–${Math.min(critPage*CRIT_PER_PAGE,total)} de ${total.toLocaleString('pt-BR')}`);

  const tbody=document.getElementById('tbl-criticidade');
  if(!tbody)return;

  const critPillHtml = p => {
    if(!p||p==='Baixa') return `<span class="pill p-outros">${p||'Sem prior.'}</span>`;
    if(p==='Urgente') return `<span class="pill" style="background:var(--red-bg);color:var(--red);font-weight:700">🔴 Urgente</span>`;
    if(p==='Alta')    return `<span class="pill p-tabaco">🟠 Alta</span>`;
    return `<span class="pill chip-blue">🟡 Média</span>`;
  };

  tbody.innerHTML = slice.map(r=>`
    <tr style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
      <td class="td-num">${r[0]}</td>
      <td class="td-titulo">${_escHtml(r[1])}</td>
      <td>${critPillHtml(getPrior(r))}</td>
      <td><span class="pill ${cultPill(r[2])}">${r[2]||'—'}</span></td>
      <td style="white-space:nowrap">${(r[3]||'—').replace(/,/g,' e ')}</td>
      <td style="font-size:11px;color:var(--text3)">${r[6]||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${r[4]?r[4].split('-').reverse().join('/'):'—'}</td>
      <td><span class="pill ${statusPill(r[5])}">${r[5]||'—'}</span></td>
    </tr>`).join('');

  // Pagination (same pattern as other sections)
  const pagRow=document.getElementById('crit-pag-row');
  if(!pagRow)return;
  let btns='';
  btns+=`<button class="pag-btn" onclick="critGotoPage(${critPage-1})" ${critPage===1?'disabled':''}>←</button>`;
  const s=Math.max(1,critPage-2),e=Math.min(pages,critPage+2);
  if(s>1)btns+=`<button class="pag-btn" onclick="critGotoPage(1)">1</button>${s>2?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}`;
  for(let p=s;p<=e;p++)btns+=`<button class="pag-btn ${p===critPage?'active':''}" onclick="critGotoPage(${p})">${p}</button>`;
  if(e<pages)btns+=`${e<pages-1?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}<button class="pag-btn" onclick="critGotoPage(${pages})">${pages}</button>`;
  btns+=`<button class="pag-btn" onclick="critGotoPage(${critPage+1})" ${critPage===pages?'disabled':''}>→</button>`;
  pagRow.innerHTML=btns;
}

function critCardFilter(val) {
  const inp = document.getElementById('crit-card-val');
  if (!inp) return;
  // toggle: click same card clears
  inp.value = (inp.value === val && val !== null) ? '' : (val === null ? '' : val);
  const v = inp.value;
  // Highlight
  ['urgente','alta','media','baixa'].forEach(id => {
    const map = {urgente:'Urgente',alta:'Alta',media:'Média',baixa:''};
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
  tbody.innerHTML = slice.map(r => {
    const ci = closed[r[0]] || {};
    const dataAb  = r[4] ? r[4].split('-').reverse().join('/') : '—';
    const dataEnc = ci.dataEncerramento || '—';
    const encPor  = ci.encerradoPor || '—';
    const dias    = (r[4] && ci.encerradoEm)
      ? Math.round((new Date(ci.encerradoEm)-new Date(r[4]+'T00:00'))/86400000)+'d' : '—';
    return `<tr style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
      <td class="td-num">${r[0]}</td>
      <td class="td-titulo">${_escHtml(r[1])}</td>
      <td><span class="pill ${cultPill(r[2])}">${r[2]||'—'}</span></td>
      <td style="font-size:11px;color:var(--text3)">${r[6]==='Solinftec KRT'?'Karitel':r[6]==='Solinftec RDM'?'Rio do Meio':(r[6]||'—')}</td>
      <td style="font-size:11px;color:var(--text3)">${r[6]||'—'}</td>
      <td style="white-space:nowrap">${(r[3]||'—').replace(/,/g,' e ')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${dataAb}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--green)">${dataEnc}</td>
      <td style="font-size:11px;color:var(--text3)">${ci.tecnicos||'—'}</td>
      <td style="font-size:11px;color:var(--text3)">${encPor}</td>
      <td><span class="pill chip-green" style="background:var(--green-bg);color:var(--green)">${dias}</span></td>
    </tr>`;
  }).join('');

  // Pagination buttons — reuse same pattern
  const pagRow = document.getElementById('enc-pag-row');
  if (!pagRow) return;
  let btns='';
  btns+=`<button class="pag-btn" onclick="encGotoPage(${encPage-1})" ${encPage===1?'disabled':''}>←</button>`;
  const s=Math.max(1,encPage-2), e2=Math.min(pages,encPage+2);
  if(s>1) btns+=`<button class="pag-btn" onclick="encGotoPage(1)">1</button>${s>2?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}`;
  for(let p=s;p<=e2;p++) btns+=`<button class="pag-btn ${p===encPage?'active':''}" onclick="encGotoPage(${p})">${p}</button>`;
  if(e2<pages) btns+=`${e2<pages-1?'<span style="padding:0 4px;color:var(--text3)">…</span>':''}<button class="pag-btn" onclick="encGotoPage(${pages})">${pages}</button>`;
  btns+=`<button class="pag-btn" onclick="encGotoPage(${encPage+1})" ${encPage===pages?'disabled':''}>→</button>`;
  pagRow.innerHTML=btns;
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
  if (_encPriorEl) _encPriorEl.innerHTML = priorPill(getPrior(rec));

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
  const _encRecForKB = allRecords().find(r=>r[0]===num);
  if(_encRecForKB && chkData?.solucao) salvarSolucaoNoKB(_encRecForKB, closed[num]);
  showToast('Chamado '+num+' encerrado com sucesso.');
  refreshAfterAction();
  // Notificação de encerramento
  const _encRec = allRecords().find(r=>r[0]===num) || [num,'','','','','Encerrado',''];
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
  } else {
    const rec = allRecords().find(r => r[0] === num);
    if (rec) local.push({ num: rec[0], titulo: rec[1], cultura: rec[2],
      resp: rec[3], data: rec[4], status: rec[5], bucket: rec[6],
      assumidoPor: u.nome, assumidoEm: new Date().toISOString() });
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
  if (!bucket)       { showToast('⚠ Selecione o Sistema / Sede'); return; }
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

  addEvent(num, 'abriu', u?.nome||'Sistema', `${categoria} · ${prior}`);
  audit('abriu', `Chamado ${num} aberto: ${titulo}`, num);
  showToast('Chamado '+num+' aberto com sucesso!');
  refreshAfterAction();

  // Email notification
  const _abRec=[num,titulo,cultura,resp,data,'Aberto',bucket,'',prior];
  emailService.notificarAbertura(_abRec, u?.nome||'Sistema');

  const newTotal=allRecords().length.toLocaleString('pt-BR');
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
}

// Histórico de chamados (abertos + encerrados) do equipamento selecionado no
// formulário de Novo Chamado. Reaproveita o mesmo vínculo já usado em
// verHistoricoFrota() (src/equipamentos/index.js): MATCH_MAP para chamados
// históricos + local.equipCodigo para chamados criados pelo app modular.
function renderHistoricoEquip(code) {
  const card = document.getElementById('equip-hist-card');
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
  setEl('equip-hist-total',     recs.length);
  setEl('equip-hist-aberto',    nAberto);
  setEl('equip-hist-encerrado', nEncerrado);

  const vazio   = document.getElementById('equip-hist-vazio');
  const tblWrap = document.getElementById('equip-hist-tbl-wrap');
  const tbody   = document.getElementById('tbl-equip-hist');
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
      return `<tr style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
        <td class="td-num">${r[0]}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escHtml(r[1])}</td>
        <td>${priorPill(getPrior(r))}</td>
        <td style="font-family:var(--font-mono)">${r[4]?r[4].split('-').reverse().join('/'):'—'}</td>
        <td><span class="pill ${statusPill(r[5])}">${r[5]}</span></td>
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

function toggleResp(btn) {
  btn.classList.toggle('sel');
  const selected = [...document.querySelectorAll('.resp-opt.sel')].map(b => b.dataset.val);
  document.getElementById('f-resp').value = selected.join(',');
  // Render tags
  const tagsEl = document.getElementById('resp-tags');
  tagsEl.innerHTML = selected.map(v => {
    const label = v === 'Guilherme' ? 'Guilherme Otávio' : 'Walison Almeida';
    return `<span class="resp-tag">${label}<button type="button" onclick="removeResp('${v}')">×</button></span>`;
  }).join('');
}

function removeResp(val) {
  const btn = document.querySelector(`.resp-opt[data-val="${val}"]`);
  if (btn) btn.classList.remove('sel');
  const selected = [...document.querySelectorAll('.resp-opt.sel')].map(b => b.dataset.val);
  document.getElementById('f-resp').value = selected.join(',');
  const tagsEl = document.getElementById('resp-tags');
  tagsEl.innerHTML = selected.map(v => {
    const label = v === 'Guilherme' ? 'Guilherme Otávio' : 'Walison Almeida';
    return `<span class="resp-tag">${label}<button type="button" onclick="removeResp('${v}')">×</button></span>`;
  }).join('');
}

function selectBucket(el,name){
  document.querySelectorAll('.bucket-opt').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  selBucket=name;
  document.getElementById('f-bucket-val').value=name;
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
    const results = all.filter(r =>
      r[0].toLowerCase().includes(ql) ||
      (r[1]||'').toLowerCase().includes(ql) ||
      (r[3]||'').toLowerCase().includes(ql)
    ).slice(0,10);

    if (!results.length) {
      box.innerHTML='<div class="gs-item" style="color:var(--text3)">Nenhum resultado encontrado.</div>';
    } else {
      box.innerHTML = results.map(r=>`
        <div class="gs-item" onclick="gsOpen('${r[0]}')">
          <div class="gs-num">${r[0]}</div>
          <div class="gs-title">${(r[1]||'—').slice(0,60)}</div>
          <div class="gs-meta">${r[2]||'—'} · ${(r[3]||'—').replace(/,/g,' e ')} · <span class="pill ${statusPill(r[5])}" style="padding:1px 6px;font-size:10px">${r[5]}</span></div>
        </div>`).join('');
    }
    box.classList.add('open');
  }, 180);
}
