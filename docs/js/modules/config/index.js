// ══════════════════════════════════════════
// MÓDULO: CONFIG
// Santa Colomba — Central de Chamados SC
// ══════════════════════════════════════════

function renderConfig() {
  // Tema atual
  const tema = localStorage.getItem('chm_theme')||'light';
  const temaEl = document.getElementById('cfg-tema-val');
  if (temaEl) temaEl.textContent = tema === 'dark' ? '🌙 Escuro' : '☀️ Claro';

  // Stats
  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('cfg-total-ch', allRecords().length.toLocaleString('pt-BR')+' chamados');
  setEl('cfg-total-eq', (typeof EQUIPAMENTOS!=='undefined'?EQUIPAMENTOS.length:0).toLocaleString('pt-BR')+' equipamentos');

  _atualizarStatusNotificacoes();
}

// Notificações Push (Fase 4) — reflete o estado real da permissão do
// navegador; o botão só existe pra disparar a AÇÃO explícita do usuário
// (ver window.fbAtivarNotificacoes em js/firebase/firebase.js).
function _atualizarStatusNotificacoes() {
  const btn = document.getElementById('btn-ativar-notif');
  const st  = document.getElementById('notif-status');
  if (!btn || typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    btn.textContent = '🔔 Notificações ativadas';
    btn.disabled = true;
    if (st) st.textContent = '✓ Você vai receber avisos em tempo real nesta aba.';
  } else if (Notification.permission === 'denied') {
    btn.textContent = '🔕 Notificações bloqueadas pelo navegador';
    btn.disabled = true;
    if (st) st.textContent = 'Permissão negada — reative nas configurações do navegador/site.';
  }
}

async function ativarNotificacoesPush() {
  if (typeof window.fbAtivarNotificacoes !== 'function') { showToast('Firebase ainda carregando, tente de novo em instantes.'); return; }
  const res = await window.fbAtivarNotificacoes();
  const st = document.getElementById('notif-status');
  if (res.ok) {
    showToast('🔔 Notificações ativadas!');
  } else if (st) {
    st.textContent = '⚠ ' + (res.error || 'Não foi possível ativar.');
  }
  _atualizarStatusNotificacoes();
}

// salvarEmailConfig() removida (Fase 3 — bug real corrigido): gravava
// {provider,token,from} na MESMA chave localStorage['chm_email_cfg'] que
// saveEmailConfig() (js/modules/config/index.js abaixo, usada pelo card
// de e-mail em Usuários), mas substituindo emailService.config inteiro —
// apagava smtpEndpoint/fromEmail (os campos que emailService realmente lê,
// ver chamados/index.js:203-216) e gravava um campo "token" que nunca era
// lido por ninguém. Salvar por esse formulário quebrava silenciosamente o
// envio de e-mail via SMTP. saveEmailConfig()/loadEmailConfig() (a versão
// correta) continuam intocadas.

function limparDadosLocais() {
  if (!confirm('Isso irá remover todos os chamados, encerramentos, KB e peças criados localmente. Os dados históricos (3.214 chamados) serão preservados. Continuar?')) return;
  ['chm_local_v1','chm_closed_v1','chm_kb_v1','chm_pecas_v1','chm_movs_v1','chm_events_v1'].forEach(k=>localStorage.removeItem(k));
  refreshAfterAction();
  showToast('Dados locais removidos.');
}

// exportarCSV(): única declaração em js/modules/relatorios/index.js (script
// carregado antes deste, mesma função, reaproveitada aqui pelo botão da tela Config).

// Configuração de e-mail (seção com id="email-*") — distinta da seção "cfg-email-*"
// acima (salvarEmailConfig), são dois formulários diferentes na tela de Configurações.
function saveEmailConfig() {
  const provider = document.getElementById('email-provider')?.value || 'none';
  const smtpUrl  = document.getElementById('email-smtp-url')?.value || '';
  const from     = document.getElementById('email-from')?.value || '';
  emailService.config.provider = provider;
  emailService.config.smtpEndpoint = smtpUrl;
  emailService.config.fromEmail = from;
  localStorage.setItem('chm_email_cfg', JSON.stringify({provider,smtpUrl,from}));
  const statusEl = document.getElementById('email-status');
  if(statusEl) statusEl.textContent = `Provider: ${provider==='none'?'desativado':provider}`;
  const smtpRow = document.getElementById('email-smtp-row');
  if(smtpRow) smtpRow.style.display = provider==='smtp'?'flex':'none';
}

function loadEmailConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('chm_email_cfg')||'{}');
    if(cfg.provider) {
      emailService.config.provider     = cfg.provider;
      emailService.config.smtpEndpoint = cfg.smtpUrl||'';
      emailService.config.fromEmail    = cfg.from||emailService.config.fromEmail;
      const el=document.getElementById('email-provider');
      if(el) el.value=cfg.provider;
      const su=document.getElementById('email-smtp-url');
      if(su) su.value=cfg.smtpUrl||'';
      const fe=document.getElementById('email-from');
      if(fe) fe.value=cfg.from||emailService.config.fromEmail;
      saveEmailConfig(); // sync UI state
    }
  } catch(e) {}
}

async function testarEmail() {
  const u = currentUser();
  const testPayload = {
    subject: '[TESTE] Central de Chamados – Santa Colomba',
    body: '<p>Este é um e-mail de teste da Central de Chamados.</p><p>Se você recebeu esta mensagem, a integração está funcionando corretamente.</p>',
    to: u?.email ? [u.email] : [],
    chamadoNum: 'TESTE',
  };
  if (!testPayload.to.length) {
    showToast('Configure o e-mail do seu usuário para testar.');
    return;
  }
  const result = await emailService.send(testPayload);
  if(result?.simulated) showToast('Simulado — configure um provider real para enviar e-mails.');
  else if(result?.ok) showToast('E-mail de teste enviado!');
  else showToast('Erro ao enviar e-mail de teste.');
}

async function fbManualSync() {
  const log=document.getElementById('cfg-fb-log');
  const st=document.getElementById('cfg-fb-status');
  if(log) log.textContent='⏳ Sincronizando com o Firebase…';
  if(st)  st.textContent='Sincronizando…';
  if (!_fbReady()) {
    if(log) log.textContent='⚠ Firebase não disponível.';
    if(st)  { st.textContent='Offline'; st.style.color='var(--red)'; }
    return;
  }
  try {
    await window.fsSyncAll();
    const now=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    if(log) log.textContent=`✓ Sync concluído às ${now}`;
    if(st)  { st.textContent='🟢 Online'; st.style.color='var(--green)'; }
    showToast('Firebase sincronizado com sucesso!');
  } catch(e) {
    if(log) log.textContent=`⚠ Erro: ${e.message}`;
    if(st)  { st.textContent='🔴 Erro'; st.style.color='var(--red)'; }
  }
}

async function fbExportFirestore() {
  const log=document.getElementById('cfg-fb-log');
  if(log) log.textContent='⏳ Enviando dados locais para o Firebase…';
  if (!_fbReady()) { if(log) log.textContent='⚠ Firebase não disponível.'; return; }

  let count=0;
  try {
    // Push all local chamados
    const local=getLocal();
    for (const rec of local) {
      if (!rec.num) continue;
      const { fotos, ...recSafe } = rec;
      await window.fsSave('chamados', rec.num, recSafe);
      count++;
    }
    // Push closed map
    const closed=getClosedMap();
    for (const [num,ci] of Object.entries(closed)) {
      await window.fsSave('encerramentos', num, ci);
      count++;
    }
    // Push KB, peças, movs, cad_eq, cad_tec
    for (const k of getKB())    { if(k.id) { await window.fsSave('kb',k.id,k); count++; } }
    for (const p of getPecas())  { if(p.id) { await window.fsSave('pecas',p.id,p); count++; } }
    for (const m of getMovs())   { if(m.id) { await window.fsSave('movimentacoes',m.id,m); count++; } }
    const ceq=getCadEq();
    for (const [k,v] of Object.entries(ceq)) { await window.fsSave('cad_eq',k,v); count++; }
    const ctec=getCadTec();
    for (const [k,v] of Object.entries(ctec)) { await window.fsSave('cad_tec',k,v); count++; }

    const now=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    if(log) log.textContent=`✓ ${count} registros enviados às ${now}`;
    showToast(`✓ ${count} registros exportados para o Firebase!`);
  } catch(e) {
    if(log) log.textContent=`⚠ Erro no envio: ${e.message}`;
    showToast('⚠ Erro ao exportar para o Firebase.');
  }
}

function fbSyncAfterLogin() {
  if (!_fbReady()) return;
  setTimeout(() => {
    if (typeof window.fsSyncAll === 'function') {
      window.fsSyncAll()
        .then(() => { if (typeof window.fsStartRealtime === 'function') window.fsStartRealtime(); })
        .then(() => { if (typeof criarLoginsFaltantes === 'function') return criarLoginsFaltantes(); })
        .then(() => console.log('[Firebase] Sync pós-login concluído'))
        .catch(e => console.warn('[Firebase] Sync pós-login falhou:', e.message));
    }
  }, 500); // small delay so UI is fully ready
}

function renderTecnicos() {
  const q       = (document.getElementById('tec-srch')?.value||'').toLowerCase();
  const fArea   = document.getElementById('tec-f-area')?.value||'';
  const periodo = document.getElementById('tec-f-periodo')?.value||'tudo';
  const view    = document.getElementById('tec-f-view')?.value||'cards';

  // Toggle views
  document.getElementById('tec-view-cards').style.display  = view==='cards'  ? 'block':'none';
  document.getElementById('tec-view-tabela').style.display = view==='tabela' ? 'block':'none';

  const all    = allRecords();
  const closed = getClosedMap();
  const cadTec = getCadTec();

  // Period cutoff
  const cutoff = periodo!=='tudo'
    ? new Date(Date.now()-Number(periodo)*86400000).toISOString().slice(0,10)
    : '0000-00-00';

  // Build stats map from chamados data (using resp field + tecnico field from local)
  const statsMap = {};  // apelido -> {total, conc, aberto, tempos[]}
  all.forEach(rec => {
    if ((rec[4]||'') < cutoff) return;
    // Responsáveis (resp field — multi-value comma separated)
    (rec[3]||'').split(',').map(n=>n.trim()).filter(Boolean).forEach(nome => {
      if (!statsMap[nome]) statsMap[nome]={total:0,conc:0,aberto:0,tempos:[]};
      statsMap[nome].total++;
      const ci=closed[rec[0]];
      if (ci) {
        statsMap[nome].conc++;
        if (rec[4]&&ci.encerradoEm) {
          const d=Math.floor((new Date(ci.encerradoEm)-new Date(rec[4]+'T00:00'))/86400000);
          if (d>=0&&d<365) statsMap[nome].tempos.push(d);
        }
      } else { statsMap[nome].aberto++; }
    });
    // Also credit local tecnico field if set
    const lr=getLocal().find(r=>r.num===rec[0]);
    if (lr?.tecnico && !statsMap[lr.tecnico]) {
      statsMap[lr.tecnico]={total:0,conc:0,aberto:0,tempos:[]};
    }
  });

  // Merge cadastro + stats into unified tech list
  // Start with cadastro entries
  const cadKeys=Object.keys(cadTec);
  const allNames=new Set([...cadKeys,...Object.keys(statsMap)]);

  let tecs=[...allNames].map(key=>{
    const cad=cadTec[key]||{};
    const st=statsMap[cad.apelido||key]||statsMap[key]||{total:0,conc:0,aberto:0,tempos:[]};
    return {
      id:      key,
      nome:    cad.nome    || key,
      apelido: cad.apelido || key,
      telefone:cad.telefone|| '',
      email:   cad.email   || '',
      area:    cad.area    || '',
      cargo:   cad.cargo   || '',
      status:  cad.status  || 'Ativo',
      admissao:cad.admissao|| '',
      obs:     cad.obs     || '',
      temCad:  !!cadTec[key],
      total:   st.total,
      conc:    st.conc,
      aberto:  st.aberto,
      tempos:  st.tempos,
    };
  });

  // Filters
  if (q)     tecs=tecs.filter(t=>t.nome.toLowerCase().includes(q)||t.apelido.toLowerCase().includes(q)||(t.email||'').toLowerCase().includes(q)||(t.area||'').toLowerCase().includes(q));
  if (fArea) tecs=tecs.filter(t=>t.area===fArea);

  tecs.sort((a,b)=>b.total-a.total);

  // ── KPIs
  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('tec-total',    tecs.length);
  setEl('tec-top',      tecs[0]?.apelido.split(' ')[0]||'—');
  const allTempos=tecs.flatMap(t=>t.tempos);
  setEl('tec-avg-tempo', allTempos.length?(allTempos.reduce((a,b)=>a+b,0)/allTempos.length).toFixed(1)+'d':'—');
  const slaOk=tecs.reduce((s,t)=>s+t.tempos.filter(d=>d<=7).length,0);
  const slaTot=tecs.reduce((s,t)=>s+t.tempos.length,0);
  setEl('tec-sla',      slaTot?Math.round(slaOk/slaTot*100)+'%':'—');
  setEl('tec-pendentes',tecs.reduce((s,t)=>s+t.aberto,0));

  const colors=['var(--accent)','var(--teal)','var(--green)','var(--purple)','var(--amber)','var(--red)'];
  const statusColor=s=>s==='Ativo'?'var(--green)':s==='Férias'?'var(--amber)':s==='Afastado'?'var(--amber)':'var(--text3)';
  const statusLabel=s=>({'Ativo':'🟢 Ativo','Inativo':'⚫ Inativo','Férias':'🏖 Férias','Afastado':'⚠ Afastado'}[s]||s);

  // ── VIEW: CARDS
  if (view==='cards') {
    const grid=document.getElementById('tec-cards-grid');
    if (!grid) return;
    if (!tecs.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px">Nenhum técnico encontrado.</div>';return;}
    grid.innerHTML=tecs.map((t,i)=>{
      const avgT=t.tempos.length?(t.tempos.reduce((a,b)=>a+b,0)/t.tempos.length).toFixed(1):'—';
      const slaP=t.tempos.length?Math.round(t.tempos.filter(d=>d<=7).length/t.tempos.length*100):0;
      const color=colors[i%colors.length];
      const initials=t.apelido.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';
      const pct=t.total>0?Math.min(100,Math.round(t.conc/t.total*100)):0;
      return `<div class="card" style="padding:0;overflow:hidden">
        <!-- Header do card -->
        <div style="padding:16px 16px 14px;display:flex;align-items:flex-start;gap:12px">
          <div style="width:46px;height:46px;border-radius:50%;background:${color}18;border:2px solid ${color};
            display:flex;align-items:center;justify-content:center;
            font-size:15px;font-weight:800;color:${color};flex-shrink:0;letter-spacing:-.02em">${initials}</div>
          <div style="min-width:0;flex:1">
            <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.nome}</div>
            ${t.cargo?`<div style="font-size:11px;color:var(--text3);margin-top:1px">${t.cargo}</div>`:''}
            <div style="display:flex;gap:8px;margin-top:5px;flex-wrap:wrap">
              ${t.area?`<span style="font-size:10px;font-weight:600;background:${color}18;color:${color};padding:1px 7px;border-radius:20px">${t.area}</span>`:''}
              <span style="font-size:10px;font-weight:600;color:${statusColor(t.status)}">${statusLabel(t.status)}</span>
            </div>
          </div>
          <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;flex-shrink:0"
            onclick="abrirFormTec('${t.id}')">✏️</button>
          <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;flex-shrink:0;color:var(--red)"
            onclick="excluirTec('${t.id}')">🗑️</button>
        </div>

        <!-- Contatos -->
        ${(t.telefone||t.email)?`<div style="padding:0 16px 10px;display:flex;gap:12px;flex-wrap:wrap">
          ${t.telefone?`<a href="tel:${t.telefone}" style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:4px;text-decoration:none">📞 ${t.telefone}</a>`:''}
          ${t.email?`<a href="mailto:${t.email}" style="font-size:11px;color:var(--accent);display:flex;align-items:center;gap:4px;text-decoration:none">✉️ ${t.email}</a>`:''}
        </div>`:''}

        <!-- Divisor -->
        <div style="height:1px;background:var(--border)"></div>

        <!-- Stats -->
        <div style="padding:12px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center">
          <div>
            <div style="font-size:20px;font-weight:800;color:var(--text);font-family:var(--font-mono);line-height:1">${t.total}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-top:2px">Total</div>
          </div>
          <div>
            <div style="font-size:20px;font-weight:800;color:var(--green);font-family:var(--font-mono);line-height:1">${t.conc}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-top:2px">Encerrados</div>
          </div>
          <div>
            <div style="font-size:20px;font-weight:800;color:var(--amber);font-family:var(--font-mono);line-height:1">${t.aberto}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-top:2px">Pendentes</div>
          </div>
        </div>

        <!-- Barra de progresso -->
        <div style="padding:0 16px 8px">
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="height:100%;border-radius:2px;background:${color};width:${pct}%;transition:width .8s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px">
            <span style="font-size:10px;color:var(--text3)">${pct}% conclusão</span>
            <span style="font-size:10px;color:var(--text3)">⏱ ${avgT}${avgT!=='—'?'d':''} médio</span>
          </div>
        </div>

        <!-- SLA -->
        <div style="margin:0 16px 14px;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3)">SLA ≤7 dias</span>
          <span style="font-size:13px;font-weight:800;color:${slaP>=90?'var(--green)':slaP>=70?'var(--amber)':'var(--red)'}">${slaP?slaP+'%':'—'}</span>
        </div>
      </div>`;
    }).join('');
  }

  // ── VIEW: TABELA
  if (view==='tabela') {
    const tbody=document.getElementById('tbl-tecnicos');
    const empty=document.getElementById('tec-empty');
    if (!tbody) return;
    if (!tecs.length){tbody.innerHTML='';if(empty)empty.style.display='block';return;}
    if(empty) empty.style.display='none';
    tbody.innerHTML=tecs.map(t=>{
      const avgT=t.tempos.length?(t.tempos.reduce((a,b)=>a+b,0)/t.tempos.length).toFixed(1)+'d':'—';
      return `<tr>
        <td style="font-weight:600">${t.nome}</td>
        <td style="font-family:var(--font-mono);font-size:11px">${t.apelido||'—'}</td>
        <td>${t.area?`<span class="pill chip-blue" style="font-size:10px">${t.area}</span>`:'—'}</td>
        <td style="font-size:11px;color:var(--text3)">${t.cargo||'—'}</td>
        <td style="font-size:11px">${t.telefone?`<a href="tel:${t.telefone}" style="color:var(--accent)">${t.telefone}</a>`:'—'}</td>
        <td style="font-size:11px">${t.email?`<a href="mailto:${t.email}" style="color:var(--accent)">${t.email}</a>`:'—'}</td>
        <td><span style="font-size:11px;font-weight:600;color:${statusColor(t.status)}">${t.status}</span></td>
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700">${t.total}</td>
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--green)">${t.conc}</td>
        <td style="text-align:center;font-family:var(--font-mono);font-weight:700;color:var(--amber)">${t.aberto}</td>
        <td style="font-family:var(--font-mono);font-size:11px">${avgT}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="abrirFormTec('${t.id}')">✏️ Editar</button>
          <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;color:var(--red)" onclick="excluirTec('${t.id}')">🗑️ Excluir</button>
        </td>
      </tr>`;
    }).join('');
  }
}

function abrirFormTec(id) {
  const card=document.getElementById('form-tec-card');
  if(!card) return;
  // Reset
  ['tec-nome','tec-apelido','tec-telefone','tec-email','tec-cargo','tec-admissao','tec-obs','tec-edit-id']
    .forEach(x=>{const e=document.getElementById(x);if(e)e.value='';});
  ['tec-area','tec-status'].forEach(x=>{const e=document.getElementById(x);if(e)e.selectedIndex=0;});
  document.getElementById('tec-erro').style.display='none';
  document.getElementById('tec-status').value='Ativo';

  if (id) {
    const cad=getCadTec()[id]||{};
    document.getElementById('form-tec-title').textContent='Editar Técnico';
    document.getElementById('tec-edit-id').value=id;
    const sv=(eid,v)=>{const e=document.getElementById(eid);if(e&&v)e.value=v;};
    sv('tec-nome',    cad.nome);
    sv('tec-apelido', cad.apelido);
    sv('tec-telefone',cad.telefone);
    sv('tec-email',   cad.email);
    sv('tec-cargo',   cad.cargo);
    sv('tec-admissao',cad.admissao);
    sv('tec-obs',     cad.obs);
    sv('tec-area',    cad.area);
    sv('tec-status',  cad.status);
  } else {
    document.getElementById('form-tec-title').textContent='Novo Técnico';
  }

  card.style.display='block';
  card.scrollIntoView({behavior:'smooth',block:'start'});
}

function fecharFormTec() {
  const card=document.getElementById('form-tec-card');
  if(card) card.style.display='none';
}

function excluirTec(id) {
  const cad = getCadTec();
  const nome = cad[id]?.nome || id;
  if (!confirm(`Excluir "${nome}" do cadastro de técnicos? Esta ação não pode ser desfeita.`)) return;
  delete cad[id];
  saveCadTec(cad);
  if (_fbReady()) {
    window.FirestoreStorage.excluirDocumento(FS_COL.TECNICOS, id)
      .then(res => { if (!res.ok) console.warn('[Técnicos] excluir falhou:', res.error); })
      .catch(e => console.warn('[Técnicos] excluir falhou:', e.message));
  }
  renderTecnicos();
  populateTecnicoSelect();
  showToast('Técnico removido do cadastro.');
  audit('excluiu', `Técnico ${nome} removido do cadastro`, '');
}

function salvarTec() {
  const nome=document.getElementById('tec-nome').value.trim();
  const erroEl=document.getElementById('tec-erro');
  if(!nome){ erroEl.style.display='block'; erroEl.textContent='⛔ O Nome completo é obrigatório.'; return; }
  erroEl.style.display='none';

  const get=id=>document.getElementById(id)?.value?.trim()||'';
  const editId=get('tec-edit-id');
  // Use apelido or first name as key (must match chamados resp field)
  const apelido=get('tec-apelido')||nome.split(' ')[0];
  const key=editId||apelido;

  const cad=getCadTec();
  cad[key]={
    nome, apelido,
    telefone: get('tec-telefone'),
    email:    get('tec-email'),
    area:     get('tec-area'),
    cargo:    get('tec-cargo'),
    status:   get('tec-status')||'Ativo',
    admissao: get('tec-admissao'),
    obs:      get('tec-obs'),
    atualizadoEm:  new Date().toISOString(),
    atualizadoPor: currentUser()?.nome||'Sistema',
  };
  saveCadTec(cad);
  fecharFormTec();
  renderTecnicos();
  showToast('✓ Técnico salvo no cadastro!');
  audit('editou', `Técnico ${nome} cadastrado/atualizado`, '');
}

// _fbReady(): única declaração em js/core/storage.js (script carregado antes
// deste), reaproveitada aqui pelos botões de sync/export do Firebase.
