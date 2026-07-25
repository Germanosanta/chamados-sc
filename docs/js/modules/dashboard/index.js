// ══════════════════════════════════════════
// MÓDULO: DASHBOARD
// Santa Colomba — Central de Chamados SC
// ══════════════════════════════════════════

const MONTHS=["2022-06","2022-07","2022-08","2022-09","2022-10","2022-11","2022-12","2023-01","2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12","2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07","2024-08","2024-09","2024-10","2024-11","2024-12","2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07"];

// Base compartilhada das opções dos gráficos Chart.js (usada também por src/relatorios/index.js,
// que carrega depois deste arquivo e compartilha o mesmo escopo global de scripts clássicos).
const GRID='rgba(0,0,0,0.04)';
const base={
  responsive:true,maintainAspectRatio:false,
  plugins:{
    legend:{display:false},
    tooltip:{
      backgroundColor:'rgba(26,31,54,0.95)',
      borderColor:'rgba(255,255,255,0.08)',borderWidth:1,
      titleColor:'#f0f4ff',bodyColor:'#8896b0',
      padding:10,cornerRadius:8,
      titleFont:{weight:'700',size:12},
    }
  },
  scales:{
    x:{grid:{color:GRID},ticks:{color:'#8896b0'}},
    y:{grid:{color:GRID},ticks:{color:'#8896b0'},beginAtZero:true}
  }
};
function mkBase(){ return JSON.parse(JSON.stringify(base)); }

function computeStats(records) {
  const all      = records || allRecords();
  const closed   = getClosedMap();
  const n        = all.length;
  const n_months = MONTHS.length || 1;

  // ── Status buckets (6 categories)
  // "Concluída"/"Encerrado" in DATA or closedMap = Concluído
  // "Cancelado" = explicitly cancelled
  // "Em Atendimento" = Em Andamento (legacy) OR new status
  // "Aguardando Peça" = new status for blocked tickets
  // "Aberto" = Não iniciado (legacy) OR new Aberto status
  const isCanceled   = r => r[5]==='Cancelado';
  const isConcluido  = r => (r[5]==='Concluída'||r[5]==='Encerrado'||r[5]==='Concluído'||!!closed[r[0]]) && !isCanceled(r);
  const isAguardando = r => r[5]==='Aguardando Peça';
  const isAtendimento= r => (r[5]==='Em Andamento'||r[5]==='Em Atendimento') && !isCanceled(r) && !isConcluido(r) && !isAguardando(r);
  const isAberto     = r => (r[5]==='Não iniciado'||r[5]==='Aberto') && !isConcluido(r) && !isCanceled(r);
  const isClosed     = isConcluido; // backward compat alias

  const total       = n;
  const concluidos  = all.filter(isConcluido).length;
  const em_aberto   = all.filter(isAberto).length;
  const em_and      = all.filter(isAtendimento).length;   // legacy compat
  const atendimento = all.filter(isAtendimento).length;
  const aguardando  = all.filter(isAguardando).length;
  const cancelados  = all.filter(isCanceled).length;
  const media_mes   = Math.round(total / n_months);

  // Responsáveis — split comma-separated
  const resp_map = {};
  all.forEach(r => {
    (r[3]||'').split(',').forEach(name => {
      name = name.trim();
      if (name) resp_map[name] = (resp_map[name]||0) + 1;
    });
  });

  // Cultura
  const cult_map = {};
  all.forEach(r => {
    const c = r[2]||'Sem cultura';
    cult_map[c] = (cult_map[c]||0) + 1;
  });

  // Bucket / Sistema
  const bkt_map = {};
  all.forEach(r => {
    if (r[6]) bkt_map[r[6]] = (bkt_map[r[6]]||0) + 1;
  });

  // Fazenda labels
  const karitel  = (bkt_map['Solinftec KRT']||0);
  const rio_meio = (bkt_map['Solinftec RDM']||0);

  // By year
  const by_year = {};
  [2022,2023,2024,2025,2026].forEach(yr => {
    const ry = all.filter(r=>r[4]&&r[4].startsWith(String(yr)));
    by_year[yr] = { total:ry.length, conc:ry.filter(isClosed).length,
                    aberto:ry.filter(isAberto).length };
  });

  // Monthly by cultura — recompute from allRecords (includes local records)
  const mg={}, mt={}, mc={}, mo={};
  all.forEach(r=>{
    if(!r[4]) return;
    const ym=r[4].slice(0,7);
    const c=r[2];
    if(c==='Grãos e Fibras'){mg[ym]=(mg[ym]||0)+1;}
    else if(c==='Tabaco'){mt[ym]=(mt[ym]||0)+1;}
    else if(c==='Cacau'){mc[ym]=(mc[ym]||0)+1;}
    else{mo[ym]=(mo[ym]||0)+1;}
  });
  const months_g = MONTHS.map(m=>mg[m]||0);
  const months_t = MONTHS.map(m=>mt[m]||0);
  const months_c = MONTHS.map(m=>mc[m]||0);
  const months_o = MONTHS.map(m=>mo[m]||0);

  // Tempo médio conclusão (days): abertura → encerramento
  let soma_dias=0, cnt_dias=0;
  all.forEach(r=>{
    const ci=closed[r[0]];
    if(ci?.encerradoEm && r[4]){
      const d=Math.round((new Date(ci.encerradoEm)-new Date(r[4]+'T00:00'))/86400000);
      if(d>=0){soma_dias+=d;cnt_dias++;}
    }
  });
  const tempo_medio = cnt_dias ? (soma_dias/cnt_dias).toFixed(1) : '—';

  // Vencidos (abertos há mais de 7 dias)
  const hoje = new Date();
  const vencidos = all.filter(r=>!isClosed(r)&&r[4]&&
    Math.floor((hoje-new Date(r[4]+'T00:00'))/86400000)>7).length;

  // Issues (top problems)
  const issueKw=[
    ['Formatar Cartão',/formatar|cartão|cartao/i],
    ['Bordo Travado',/bordo travado/i],
    ['GPS Inválido',/gps inv/i],
    ['Falta de Alimentação',/aliment/i],
    ['Sem Comunicação',/sem comunicaç|sem comunic/i],
    ['Instalar Solinftec',/instalar sol/i],
    ['Bordo Desligando',/bordo deslig|desligando/i],
    ['Dando Deslocamento',/deslocamento/i],
  ];
  const issues = issueKw.map(([label,rx])=>[label,all.filter(r=>rx.test(r[0]+r[1])).length]);

  return {
    all, total, concluidos, em_aberto, em_and, atendimento, aguardando, cancelados, media_mes,
    resp_map, cult_map, bkt_map, karitel, rio_meio,
    by_year, months_g, months_t, months_c, months_o,
    tempo_medio, vencidos, issues,
  };
}

function initDashboard(){
  const S = computeStats();

  // ── KPIs
  const _setKPI = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  _setKPI('k-total',      S.total.toLocaleString('pt-BR'));
  _setKPI('k-aberto',     S.em_aberto.toLocaleString('pt-BR'));
  _setKPI('k-atendimento',S.atendimento.toLocaleString('pt-BR'));
  _setKPI('k-aguardando', S.aguardando.toLocaleString('pt-BR'));
  _setKPI('k-conc',       S.concluidos.toLocaleString('pt-BR'));
  _setKPI('k-cancelado',  S.cancelados.toLocaleString('pt-BR'));
  _setKPI('k-conc-pct',   (S.total>0?(S.concluidos/S.total*100).toFixed(1):'0')+'%');
  _setKPI('k-aberto-sub', S.em_aberto===1?'não iniciado':'não iniciados');
  _setKPI('k-media',      S.media_mes);
  _setKPI('total-badge',  S.total.toLocaleString('pt-BR')+' chamados');
  document.getElementById('badge-chamados-2')&&(document.getElementById('badge-chamados-2').textContent=allRecords().length.toLocaleString('pt-BR'));
  document.getElementById('badge-chamados').textContent = S.total.toLocaleString('pt-BR');
  document.getElementById('donut-n').textContent    = S.total.toLocaleString('pt-BR');

  // ── Evolução mensal (from allRecords — includes local records)
  const lbls = MONTHS.map(m=>{
    const [y,mo]=m.split('-');
    return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(mo)-1]+'-'+y.slice(2);
  });
  if(cEvolucao) cEvolucao.destroy();
  cEvolucao=new Chart(document.getElementById('ch-evolucao'),{
    type:'bar',
    data:{labels:lbls,datasets:[
      {label:'Grãos e Fibras',data:S.months_g,backgroundColor:'rgba(37,99,235,.8)',borderRadius:2,borderSkipped:false},
      {label:'Tabaco',        data:S.months_t,backgroundColor:'rgba(217,119,6,.8)',borderRadius:2,borderSkipped:false},
      {label:'Cacau',         data:S.months_c,backgroundColor:'rgba(146,64,14,.8)',borderRadius:2,borderSkipped:false},
      {label:'Sem cultura',   data:S.months_o,backgroundColor:'rgba(148,163,184,.6)',borderRadius:2,borderSkipped:false},
    ]},
    options:{...mkBase(),scales:{...base.scales,x:{...base.scales.x,stacked:true,ticks:{maxRotation:45,color:'#8896b0'}},y:{...base.scales.y,stacked:true}}}
  });

  // ── Donut por cultura
  const totG=S.months_g.reduce((a,b)=>a+b,0);
  const totT=S.months_t.reduce((a,b)=>a+b,0);
  const totC=S.months_c.reduce((a,b)=>a+b,0);
  const totO=S.months_o.reduce((a,b)=>a+b,0);
  if(cDonutCultura) cDonutCultura.destroy();
  cDonutCultura=new Chart(document.getElementById('ch-donut'),{
    type:'doughnut',
    data:{labels:['Grãos e Fibras','Tabaco','Cacau','Sem cultura'],
      datasets:[{data:[totG,totT,totC,totO],backgroundColor:['#2563eb','#d97706','#92400e','#94a3b8'],borderWidth:2,borderColor:'#fff',hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{display:false},tooltip:{...base.plugins.tooltip}}}
  });

  // ── Bucket / Sistema (barras horizontais)
  const bktEntries = Object.entries(S.bkt_map).sort((a,b)=>b[1]-a[1]);
  if(cBucket) cBucket.destroy();
  cBucket=new Chart(document.getElementById('ch-bucket'),{
    type:'bar',
    data:{labels:bktEntries.map(e=>e[0]),
      datasets:[{data:bktEntries.map(e=>e[1]),
        backgroundColor:['rgba(37,99,235,.85)','rgba(13,148,136,.85)','rgba(217,119,6,.85)','rgba(220,38,38,.8)','rgba(100,116,139,.7)'],
        borderRadius:4,borderSkipped:false}]},
    options:{...mkBase(),indexAxis:'y'}
  });

  // ── Responsáveis bars (split comma-sep correctly)
  const respEntries = Object.entries(S.resp_map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxResp = respEntries[0]?.[1]||1;
  const respColors=['#2563eb','#0d9488','#7c3aed','#16a34a','#d97706'];
  document.getElementById('resp-bars').innerHTML=respEntries.map(([name,val],i)=>`
    <div class="prog-item">
      <div class="prog-header"><span class="prog-name">${name}</span><span class="prog-val">${val.toLocaleString('pt-BR')}</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${val/maxResp*100}%;background:${respColors[i%5]}"></div></div>
    </div>`).join('');

  // ── Issues
  const maxIssue = S.issues[0]?.[1]||1;
  document.getElementById('issue-bars').innerHTML=S.issues.map(([label,val])=>`
    <div class="prog-item">
      <div class="prog-header"><span class="prog-name">${label}</span><span class="prog-val">${val}</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${val/maxIssue*100}%;background:rgba(37,99,235,${.4+val/maxIssue*.5})"></div></div>
    </div>`).join('');

  // ── Por ano
  const anoData=[2022,2023,2024,2025,2026].map(y=>S.by_year[y]?.total||0);
  if(cAnos) cAnos.destroy();
  cAnos=new Chart(document.getElementById('ch-anos'),{
    type:'bar',
    data:{labels:['2022','2023','2024','2025','2026'],
      datasets:[{data:anoData,backgroundColor:['rgba(100,116,139,.7)','rgba(37,99,235,.8)','rgba(13,148,136,.8)','rgba(217,119,6,.85)','rgba(220,38,38,.7)'],borderRadius:6,borderSkipped:false}]},
    options:mkBase()
  });

  // ── Recentes
  const recent=[...S.all].sort((a,b)=>((b[4]||'')>a[4]?1:-1)).slice(0,10);
  document.getElementById('recent-sub').textContent='CHM-'+recent[recent.length-1]?.[0]?.replace('CHM-','')+' a '+recent[0]?.[0];
  document.getElementById('tbl-recent').innerHTML=`
    <thead><tr><th>Número</th><th>Título</th><th>Cultura</th><th>Status</th></tr></thead>
    <tbody>${recent.map(r=>`<tr>
      <td class="td-num">${r[0]}</td>
      <td class="td-titulo" style="max-width:160px">${r[1]}</td>
      <td><span class="pill ${cultPill(r[2])}">${r[2]||'—'}</span></td>
      <td><span class="pill ${statusPill(r[5])}">${r[5]}</span></td>
    </tr>`).join('')}</tbody>`;
}

function initAbertoBadge() {
  // Recompute from allRecords — single source of truth
  const all     = allRecords();
  const closed  = getClosedMap();
  const isClose = r => r[5]==='Concluída'||r[5]==='Encerrado'||!!closed[r[0]];
  const nAberto = all.filter(r=>!isClose(r)).length;
  const nEnc    = all.filter(isClose).length;
  const setEl   = (id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('badge-aberto', nAberto||'0');
  setEl('badge-encerrados', nEnc||'0');
  setEl('badge-chamados', all.length.toLocaleString('pt-BR'));
  setEl('total-badge', all.length.toLocaleString('pt-BR')+' chamados');
}

function applyStatusFilter(status) {
  // Navigate to chamados section
  showSection('chamados', document.getElementById('nav-dashboard'));
  // Apply the filter after a brief render tick
  setTimeout(()=>{
    const sel = document.getElementById('f-status');
    if (sel) {
      sel.value = status;
      applyFilters();
    }
    // Highlight the correct nav item
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.querySelector('[onclick*="chamados"]')?.classList.add('active');
  }, 50);
}

function statusPill(s){
  if(s==='Concluída'||s==='Encerrado'||s==='Concluído') return 'p-concluida';
  if(s==='Em Andamento'||s==='Em Atendimento')            return 'p-andamento';
  if(s==='Aguardando Peça')                               return 'p-aguardando';
  if(s==='Cancelado')                                     return 'p-cancelado';
  return 'p-aberto';
}

function cultPill(c){
  if(c==='Grãos e Fibras') return 'p-graos';
  if(c==='Tabaco') return 'p-tabaco';
  if(c==='Cacau') return 'p-cacau';
  return 'p-outros';
}

function initTheme() {
  const saved = localStorage.getItem('chm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
}

function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('chm_theme', newTheme);
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function toggleMobileMenu() {
  document.querySelector('.sidebar').classList.toggle('mob-open');
}

function changeYear(d){
  const inp=document.getElementById('yr-filter');
  inp.value=Math.max(2022,Math.min(2026,parseInt(inp.value)+d));
  renderMesCharts();
}

// Instâncias Chart.js da seção "Por Mês" — destruídas/recriadas a cada render (ver uso abaixo)
let cMesBar=null, cMesDonut=null;
// Instâncias dos gráficos do Dashboard principal — guardadas para poder
// destruir antes de recriar (Chart.js não substitui sozinho um gráfico já
// desenhado no mesmo <canvas>: sem destroy(), instâncias antigas continuam
// desenhando por baixo/por cima da nova, causando sobreposição visual).
let cEvolucao=null, cDonutCultura=null, cBucket=null, cAnos=null;

function renderMesCharts(){
  const yr=parseInt(document.getElementById('yr-filter').value)||2025;
  document.getElementById('mes-chart-title').textContent=`Chamados por Mês — ${yr}`;
  document.getElementById('mes-donut-sub').textContent=`Total em ${yr}`;
  document.getElementById('hm-title').textContent=`Heatmap — ${yr}`;

  const MONTHS_PT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const all=allRecords();
  const inYear=all.filter(r=>r[4]&&r[4].startsWith(yr+''));

  const mg=Array(12).fill(0),mt=Array(12).fill(0),mc=Array(12).fill(0),mo=Array(12).fill(0);
  inYear.forEach(r=>{
    const m=parseInt((r[4]||'').slice(5,7))-1;
    if(m>=0&&m<12){
      if(r[2]==='Grãos e Fibras') mg[m]++;
      else if(r[2]==='Tabaco') mt[m]++;
      else if(r[2]==='Cacau') mc[m]++;
      else mo[m]++;
    }
  });

  if(cMesBar) cMesBar.destroy();
  cMesBar=new Chart(document.getElementById('ch-mes-bar'),{
    type:'bar',
    data:{labels:MONTHS_PT,datasets:[
      {label:'Grãos e Fibras',data:mg,backgroundColor:'rgba(37,99,235,.85)',borderRadius:3,borderSkipped:false},
      {label:'Tabaco',data:mt,backgroundColor:'rgba(217,119,6,.85)',borderRadius:3,borderSkipped:false},
      {label:'Cacau',data:mc,backgroundColor:'rgba(146,64,14,.85)',borderRadius:3,borderSkipped:false},
      {label:'Sem cultura',data:mo,backgroundColor:'rgba(148,163,184,.6)',borderRadius:3,borderSkipped:false},
    ]},
    options:{...mkBase(),scales:{...base.scales,x:{...base.scales.x,stacked:true},y:{...base.scales.y,stacked:true}}}
  });

  const totG=mg.reduce((a,b)=>a+b,0),totT=mt.reduce((a,b)=>a+b,0),totC=mc.reduce((a,b)=>a+b,0),totO=mo.reduce((a,b)=>a+b,0);
  const totYr=totG+totT+totC+totO;
  document.getElementById('mes-donut-n').textContent=totYr.toLocaleString('pt-BR');
  if(cMesDonut) cMesDonut.destroy();
  cMesDonut=new Chart(document.getElementById('ch-mes-donut'),{
    type:'doughnut',
    data:{labels:['Grãos e Fibras','Tabaco','Cacau','Outros'],
      datasets:[{data:[totG,totT,totC,totO],backgroundColor:['#2563eb','#d97706','#92400e','#94a3b8'],borderWidth:2,borderColor:'#fff',hoverOffset:5}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{legend:{display:false},tooltip:{...base.plugins.tooltip}}}
  });

  // Heatmap
  const maxCell=Math.max(...mg,...mt,...mc,...mo,1);
  function heatColor(v){
    if(!v) return '#f1f5f9';
    const pct=v/maxCell;
    if(pct<.25) return '#dbeafe';
    if(pct<.5)  return '#93c5fd';
    if(pct<.75) return '#3b82f6';
    return '#1d4ed8';
  }
  function textColor(v){return v/maxCell>.5?'white':'#1a1f36'}
  const cultRows=[
    ['Grãos e Fibras',mg,'#2563eb'],
    ['Tabaco',mt,'#d97706'],
    ['Cacau',mc,'#92400e'],
    ['Sem cultura',mo,'#94a3b8'],
  ];
  let hmHtml=`<div class="heatmap-grid">
    <div class="hm-corner"></div>
    ${MONTHS_PT.map(m=>`<div class="hm-month">${m}</div>`).join('')}
    ${cultRows.map(([label,data])=>`
      <div class="hm-label">${label}</div>
      ${data.map(v=>`<div class="hm-cell" style="background:${heatColor(v)};color:${textColor(v)}" title="${label}: ${v} chamados">${v||''}</div>`).join('')}
    `).join('')}
    <div class="hm-label" style="font-weight:700">TOTAL</div>
    ${Array(12).fill(0).map((_,i)=>mg[i]+mt[i]+mc[i]+mo[i]).map(v=>`<div class="hm-cell" style="background:${heatColor(v)};color:${textColor(v)};font-weight:700">${v||''}</div>`).join('')}
  </div>`;
  document.getElementById('hm-table').innerHTML=hmHtml;
}

function renderPainel() {
  const all    = allRecords();
  const closed = getClosedMap();
  const isCl   = r => r[5]==='Concluída'||r[5]==='Encerrado'||!!closed[r[0]];
  const abertos= all.filter(r=>!isCl(r));
  const hoje   = new Date().toISOString().slice(0,10);
  const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate()-7);

  // KPIs
  const criticos  = abertos.filter(r=>(r[9]||r[10]||'')==='Urgente').length;
  const vencidos  = abertos.filter(r=>r[4]&&Math.floor((new Date()-new Date(r[4]+'T00:00'))/86400000)>7).length;
  const hoje_ab   = all.filter(r=>r[4]===hoje).length;
  const local     = getLocal();
  const hoje_enc  = Object.values(closed).filter(ci=>ci.encerradoEm?.slice(0,10)===hoje).length;

  // SLA: % encerrados dentro de 7 dias
  let slaOk=0, slaTotal=0;
  Object.entries(closed).forEach(([num,ci])=>{
    const rec=all.find(r=>r[0]===num);
    if(!rec||!rec[4]||!ci.encerradoEm) return;
    slaTotal++;
    const dias=Math.floor((new Date(ci.encerradoEm)-new Date(rec[4]+'T00:00'))/86400000);
    if(dias<=7) slaOk++;
  });
  const slaPct = slaTotal ? Math.round(slaOk/slaTotal*100) : 0;

  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('op-criticos', criticos);
  setEl('op-vencidos',  vencidos);
  setEl('op-hoje',      hoje_ab);
  setEl('op-enc-hoje',  hoje_enc);
  setEl('op-sla',       slaPct+'%');
  const slaBar=document.getElementById('op-sla-bar');
  if(slaBar){slaBar.style.width=slaPct+'%';slaBar.style.background=slaPct>=90?'var(--green)':slaPct>=70?'var(--amber)':'var(--red)';}

  // Lista chamados críticos abertos (top 6)
  const listCrit = document.getElementById('op-list-criticos');
  if(listCrit){
    const urgentes = abertos.filter(r=>(r[9]||r[10]||'')==='Urgente').slice(0,6);
    const venc6    = abertos.filter(r=>r[4]&&Math.floor((new Date()-new Date(r[4]+'T00:00'))/86400000)>7).slice(0,6);
    const show     = urgentes.length ? urgentes : venc6;
    if(!show.length){ listCrit.innerHTML='<div style="color:var(--text3);padding:8px 0">Nenhum chamado crítico.</div>'; }
    else listCrit.innerHTML = show.map(r=>{
      const dias=r[4]?Math.floor((new Date()-new Date(r[4]+'T00:00'))/86400000):0;
      return `<div class="op-row" style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
        <span class="td-num" style="font-size:11px">${r[0]}</span>
        <span style="flex:1;padding:0 8px;font-size:11px">${(r[1]||'').slice(0,30)}</span>
        <span style="color:${dias>7?'var(--red)':'var(--amber)'};font-size:11px">${dias}d</span>
      </div>`;
    }).join('');
  }

  // Ranking técnicos (esta semana)
  const rankEl = document.getElementById('op-ranking');
  if(rankEl){
    const isSemana = ts => ts && new Date(ts) >= inicioSemana;
    const rankMap  = {};
    Object.values(closed).filter(ci=>isSemana(ci.encerradoEm)).forEach(ci=>{
      const n=ci.encerradoPor||'Sistema'; rankMap[n]=(rankMap[n]||0)+1;
    });
    const rank=Object.entries(rankMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const maxR=rank[0]?.[1]||1;
    rankEl.innerHTML = rank.length ? rank.map(([n,v],i)=>`
      <div class="op-row">
        <span style="font-weight:700;color:var(--text3);min-width:20px">${i+1}º</span>
        <span style="flex:1;padding:0 8px">${n.split(' ')[0]}</span>
        <span style="font-weight:700;color:var(--accent)">${v}</span>
        <div style="width:60px;height:4px;background:var(--border);border-radius:2px;margin-left:8px"><div style="width:${v/maxR*100}%;height:100%;background:var(--accent);border-radius:2px"></div></div>
      </div>`).join('') : '<div style="color:var(--text3);padding:8px 0">Sem dados nesta semana.</div>';
  }

  // Por sistema
  const sistEl = document.getElementById('op-sistemas');
  if(sistEl){
    const sistMap={};
    abertos.forEach(r=>{if(r[6])sistMap[r[6]]=(sistMap[r[6]]||0)+1;});
    const sist=Object.entries(sistMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const maxS=sist[0]?.[1]||1;
    sistEl.innerHTML=sist.length?sist.map(([n,v])=>`
      <div class="op-row">
        <span style="flex:1;font-size:11px">${n}</span>
        <span style="font-weight:700;color:var(--text)">${v}</span>
        <div style="width:60px;height:4px;background:var(--border);border-radius:2px;margin-left:8px"><div style="width:${v/maxS*100}%;height:100%;background:var(--teal);border-radius:2px"></div></div>
      </div>`).join(''):'<div style="color:var(--text3);padding:8px">Sem chamados abertos.</div>';
  }

  // Tempo médio por técnico
  const tempoEl = document.getElementById('op-tempo-tecnico');
  if(tempoEl){
    const tempoMap={};
    Object.entries(closed).forEach(([num,ci])=>{
      const rec=all.find(r=>r[0]===num);
      if(!rec||!rec[4]||!ci.encerradoEm||!ci.encerradoPor)return;
      const dias=Math.floor((new Date(ci.encerradoEm)-new Date(rec[4]+'T00:00'))/86400000);
      if(dias<0)return;
      if(!tempoMap[ci.encerradoPor])tempoMap[ci.encerradoPor]={soma:0,cnt:0};
      tempoMap[ci.encerradoPor].soma+=dias;
      tempoMap[ci.encerradoPor].cnt++;
    });
    const tempo=Object.entries(tempoMap).map(([n,d])=>([n,Math.round(d.soma/d.cnt*10)/10])).sort((a,b)=>a[1]-b[1]).slice(0,5);
    tempoEl.innerHTML=tempo.length?tempo.map(([n,v])=>`
      <div class="op-row">
        <span style="flex:1">${n.split(' ')[0]}</span>
        <span style="font-weight:700;color:${v<=3?'var(--green)':v<=7?'var(--amber)':'var(--red)'}">${v}d</span>
        <span style="font-size:10px;color:var(--text3);margin-left:6px">tempo médio</span>
      </div>`).join(''):'<div style="color:var(--text3);padding:8px">Sem dados suficientes.</div>';
  }

  const upd=document.getElementById('op-updated');
  if(upd)upd.textContent=new Date().toLocaleTimeString('pt-BR');
}

function iaAnalisar() {
  const sintoma = (document.getElementById('ia-sintoma')?.value||'').toLowerCase().trim();
  const resEl   = document.getElementById('ia-resultado');
  if (!resEl) return;
  if (!sintoma) { resEl.innerHTML='<div style="color:var(--text3);font-size:12px">Digite um sintoma para analisar.</div>'; return; }

  resEl.innerHTML='<div class="ai-suggestion" style="opacity:.6">🤖 Analisando histórico…</div>';

  setTimeout(()=>{
    const all    = allRecords();
    const closed = getClosedMap();
    const kb     = getKB();

    // Find matching records by keyword overlap
    const words = sintoma.split(/\s+/).filter(w=>w.length>2);
    const scored = all.map(r=>{
      const text=(r[0]+' '+(r[1]||'')+' '+(r[2]||'')).toLowerCase();
      const score=words.reduce((s,w)=>s+(text.includes(w)?1:0),0);
      return {r, score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,10);

    // Solutions from closedMap for matching records
    const solutions=[];
    scored.forEach(({r})=>{
      const ci=closed[r[0]];
      if(ci?.solucao) solutions.push({solucao:ci.solucao, materiais:ci.materiais||'', sistema:r[6]||''});
    });

    // KB matches
    const kbMatches=kb.filter(k=>{
      const kText=(k.problema+' '+k.solucao).toLowerCase();
      return words.some(w=>kText.includes(w));
    }).slice(0,3);

    // Most common systems in matches
    const sistCount={};
    scored.forEach(({r})=>{if(r[6])sistCount[r[6]]=(sistCount[r[6]]||0)+1;});
    const topSist=Object.entries(sistCount).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([s])=>s).join(', ');

    // Most common technicians for these types
    const techCount={};
    scored.forEach(({r})=>{
      const ci=closed[r[0]];
      if(ci?.encerradoPor)(ci.encerradoPor.split(',').forEach(t=>{t=t.trim();if(t)techCount[t]=(techCount[t]||0)+1;}));
    });
    const topTech=Object.entries(techCount).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([t])=>t.split(' ')[0]).join(', ');

    // Build suggestion
    let html='';
    if(!scored.length && !kbMatches.length){
      html='<div class="ai-suggestion">Nenhum histórico similar encontrado para este sintoma. Tente palavras diferentes.</div>';
    } else {
      html+='<div class="ai-suggestion">';
      html+=`<b>📊 Análise:</b> Encontrei <b>${scored.length}</b> chamados similares no histórico.<br>`;
      if(topSist) html+=`<b>📡 Sistema mais afetado:</b> ${topSist}<br>`;
      if(topTech) html+=`<b>👷 Técnicos experientes:</b> ${topTech}<br>`;

      if(solutions.length){
        html+='<br><b>💡 Soluções aplicadas anteriormente:</b><ul style="margin:4px 0 0 14px;padding:0">';
        [...new Set(solutions.map(s=>s.solucao))].slice(0,3).forEach(s=>{
          html+=`<li style="margin-bottom:3px">${s.slice(0,120)}${s.length>120?'…':''}</li>`;
        });
        html+='</ul>';
        const mats=[...new Set(solutions.map(s=>s.materiais).filter(Boolean))].slice(0,3);
        if(mats.length) html+=`<br><b>🔧 Materiais comuns:</b> ${mats.join(' · ')}`;
      }

      if(kbMatches.length){
        html+='<br><br><b>📚 Banco de Soluções:</b><ul style="margin:4px 0 0 14px;padding:0">';
        kbMatches.forEach(k=>{ html+=`<li style="margin-bottom:3px"><b>${k.problema}</b>: ${k.solucao.slice(0,100)}${k.solucao.length>100?'…':''}</li>`; });
        html+='</ul>';
      }
      html+='</div>';

      if(solutions.length){
        html+=`<button class="ai-chip" style="margin-top:8px" onclick="usarSugestaoIA('${(solutions[0]?.solucao||'').replace(/'/g,"\'").slice(0,200)}','${(solutions[0]?.materiais||'').replace(/'/g,"\'")}')">
          📋 Usar primeira sugestão no checklist
        </button>`;
      }
    }
    if(resEl) resEl.innerHTML=html;
  }, 400);
}

function usarSugestaoIA(solucao, materiais) {
  const s=document.getElementById('chk-solucao');
  const m=document.getElementById('chk-materiais');
  if(s) s.value=solucao;
  if(m && materiais) m.value=materiais;
  showToast('Sugestão da IA aplicada ao checklist!');
}
