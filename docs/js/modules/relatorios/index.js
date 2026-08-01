// ══════════════════════════════════════════
// MÓDULO: RELATORIOS
// Santa Colomba — Central de Chamados SC
// ══════════════════════════════════════════

function renderRespSection(){
  const all      = allRecords();        // all records with closed-map merged
  const closed   = getClosedMap();      // {num: {encerradoPor, dataEncerramento, encerradoEm, ...}}
  const local    = getLocal();          // local records with abertoPor

  // ── Helper: check if a resp string contains a name (handles "Walison,Guilherme" etc.)
  function hasResp(respStr, name){ return (respStr||'').split(',').map(s=>s.trim()).some(s=>s===name); }

  // ── Helper: days between two date strings
  function daysBetween(d1,d2){
    if(!d1||!d2) return null;
    const diff=(new Date(d2)-new Date(d1+'T00:00'))/86400000;
    return diff>=0?Math.round(diff):null;
  }

  const RESPS=[
    {name:'Guilherme',label:'Guilherme Otávio',color:'#2563eb'},
    {name:'Walison',  label:'Walison Almeida',  color:'#0d9488'},
    {name:'Matheus',  label:'Matheus Gabriel',   color:'#7c3aed'},
    {name:'Carlos',   label:'Carlos Santos',     color:'#16a34a'},
    {name:'Francisco',label:'Francisco Neto',    color:'#d97706'},
  ];

  const data = RESPS.map(({name,label,color})=>{
    // Atribuídos: any record where resp field contains this name
    const atribuidos = all.filter(r => hasResp(r[3], name));

    // Abertos pelo responsável: local records with abertoPor matching name
    const abertos_por = local.filter(r => r.abertoPor && r.abertoPor.includes(name)).length;

    // Encerrados pelo responsável: closedMap entries where encerradoPor contains name
    const encerrados_por = Object.values(closed).filter(ci =>
      ci.encerradoPor && ci.encerradoPor.includes(name)
    ).length;

    // Status breakdown of atribuídos
    const emAberto    = atribuidos.filter(r => r[5]==='Não iniciado').length;
    const emAndamento = atribuidos.filter(r => r[5]==='Em Andamento').length;
    const encerrados  = atribuidos.filter(r => r[5]==='Encerrado'||r[5]==='Concluída'||closed[r[0]]).length;

    // Tempo médio de atendimento (abertura até hoje para em andamento)
    const hoje = new Date().toISOString().slice(0,10);
    let somaAtend=0, cntAtend=0;
    atribuidos.filter(r=>r[5]==='Em Andamento'&&r[4]).forEach(r=>{
      const d=daysBetween(r[4],hoje);
      if(d!==null){somaAtend+=d;cntAtend++;}
    });

    // Tempo médio de conclusão (data abertura → data encerramento)
    let somaConc=0, cntConc=0;
    atribuidos.forEach(r=>{
      const ci=closed[r[0]];
      if(ci?.encerradoEm && r[4]){
        const d=daysBetween(r[4], ci.encerradoEm.slice(0,10));
        if(d!==null){somaConc+=d;cntConc++;}
      }
    });

    return {
      name,label,color,
      atribuidos: atribuidos.length,
      abertos_por,
      encerrados_por,
      emAberto,
      emAndamento,
      encerrados,
      tempoAtend: cntAtend ? (somaAtend/cntAtend).toFixed(1)+'d' : '—',
      tempoConc:  cntConc  ? (somaConc/cntConc).toFixed(1)+'d'  : '—',
    };
  });

  // Total atribuições (sum across all — a dual-resp record counts for both)
  const totalAtrib = data.reduce((s,d)=>s+d.atribuidos,0);
  document.getElementById('resp-donut-n').textContent=totalAtrib.toLocaleString('pt-BR');

  // Charts (reuse existing chart vars cRespBar, cRespDonut)
  if(cRespBar) cRespBar.destroy();
  cRespBar=new Chart(document.getElementById('ch-resp-bar'),{
    type:'bar',
    data:{
      labels:data.map(d=>d.label),
      datasets:[
        {label:'Atribuídos',    data:data.map(d=>d.atribuidos),    backgroundColor:'rgba(37,99,235,.8)',  borderRadius:3,borderSkipped:false},
        {label:'Enc. por este', data:data.map(d=>d.encerrados_por),backgroundColor:'rgba(22,163,74,.75)',borderRadius:3,borderSkipped:false},
        {label:'Em Aberto',     data:data.map(d=>d.emAberto),      backgroundColor:'rgba(220,38,38,.7)', borderRadius:3,borderSkipped:false},
      ]
    },
    options:{...mkBase(),plugins:{...mkBase().plugins,
      tooltip:{...base.plugins.tooltip,callbacks:{title:ctx=>`${ctx[0].label}`}}
    }}
  });

  if(cRespDonut) cRespDonut.destroy();
  cRespDonut=new Chart(document.getElementById('ch-resp-donut'),{
    type:'doughnut',
    data:{labels:data.map(d=>d.label),
      datasets:[{data:data.map(d=>d.atribuidos),backgroundColor:data.map(d=>d.color),borderWidth:2,borderColor:'#fff',hoverOffset:5}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'70%',
      plugins:{legend:{display:false},tooltip:{...base.plugins.tooltip,
        callbacks:{label:ctx=>`${ctx.label}: ${ctx.parsed.toLocaleString('pt-BR')} atribuídos`}}}}
  });

  // Table
  document.getElementById('tbl-resp').innerHTML=`
    <thead><tr>
      <th>Responsável</th>
      <th title="Chamados onde este responsável está atribuído">Atribuídos</th>
      <th title="Chamados abertos por este usuário (histórico local)">Abriu</th>
      <th title="Chamados encerrados por este usuário">Encerrou</th>
      <th>Em Aberto</th>
      <th>Em Andamento</th>
      <th>Encerrados</th>
      <th>T.Médio Atend.</th>
      <th>T.Médio Conclusão</th>
      <th>% do Total</th>
    </tr></thead>
    <tbody>
    ${data.map(d=>`<tr>
      <td style="font-weight:600;color:var(--text);white-space:nowrap">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${d.color};margin-right:6px"></span>
        ${d.label}
      </td>
      <td style="text-align:center;font-weight:700;font-family:'JetBrains Mono',monospace">${d.atribuidos.toLocaleString('pt-BR')}</td>
      <td style="text-align:center">${d.abertos_por||'—'}</td>
      <td style="text-align:center">${d.encerrados_por||'—'}</td>
      <td style="text-align:center"><span class="badge badge-red">${d.emAberto}</span></td>
      <td style="text-align:center"><span class="badge badge-amber">${d.emAndamento}</span></td>
      <td style="text-align:center"><span class="badge badge-green">${d.encerrados}</span></td>
      <td style="text-align:center;font-family:'JetBrains Mono',monospace;color:var(--amber)">${d.tempoAtend}</td>
      <td style="text-align:center;font-family:'JetBrains Mono',monospace;color:var(--green)">${d.tempoConc}</td>
      <td style="text-align:center">${totalAtrib?Math.round(d.atribuidos/all.length*100):0}%</td>
    </tr>`).join('')}
    </tbody>`;
}

function renderAuditoria() {
  const q     = (document.getElementById('aud-srch')?.value||'').toLowerCase();
  const fTipo = document.getElementById('aud-f-tipo')?.value||'';
  const fUser = document.getElementById('aud-f-user')?.value||'';
  let logs = [...getAudit()].reverse(); // newest first

  if (q)     logs = logs.filter(l => l.detalhe.toLowerCase().includes(q) || (l.chamado||'').toLowerCase().includes(q));
  if (fTipo) logs = logs.filter(l => l.tipo === fTipo);
  if (fUser) logs = logs.filter(l => l.login === fUser);

  // Fill user filter
  const allUsers = [...new Set(getAudit().map(l=>l.login).filter(Boolean))];
  const userSel = document.getElementById('aud-f-user');
  if (userSel && userSel.options.length < 2) {
    allUsers.forEach(u => { const o=document.createElement('option');o.value=u;o.textContent=u;userSel.appendChild(o); });
  }

  const listEl = document.getElementById('aud-list');
  const emptyEl= document.getElementById('aud-empty');
  if (!listEl) return;

  if (!logs.length) {
    listEl.innerHTML='';
    if(emptyEl) emptyEl.style.display='block';
    const cnt=document.getElementById('aud-count');if(cnt)cnt.textContent='';
    return;
  }
  if(emptyEl) emptyEl.style.display='none';

  const typeColors = {
    abriu:'var(--green)',encerrou:'var(--accent)',reabriu:'var(--amber)',
    assumiu:'var(--amber)',login:'var(--teal)',logout:'var(--text3)',editou:'var(--text2)'
  };
  const typeLabels = {
    abriu:'Abertura',encerrou:'Encerramento',reabriu:'Reabertura',
    assumiu:'Assunção',login:'Login',logout:'Logout',editou:'Edição'
  };

  listEl.innerHTML = logs.slice(0,200).map(l=>{
    const d = new Date(l.ts);
    const fmt = d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const color = typeColors[l.tipo]||'var(--text3)';
    const label = typeLabels[l.tipo]||l.tipo;
    return `<tr>
      <td class="audit-ts">${fmt}</td>
      <td class="audit-actor">${l.usuario||'—'}</td>
      <td><span class="op-badge" style="background:${color}22;color:${color};min-width:90px">${label}</span></td>
      <td class="audit-action">${l.chamado?`<b>${l.chamado}</b> · `:''} ${l.detalhe}</td>
    </tr>`;
  }).join('');

  const cnt=document.getElementById('aud-count');
  if(cnt) cnt.textContent = `${logs.length} registros (exibindo ${Math.min(logs.length,200)})`;
}

function exportAuditCSV() {
  const logs = getAudit();
  const header = 'Data/Hora,Usuário,Login,Tipo,Chamado,Detalhe';
  const body = logs.map(l=>[l.ts,l.usuario||'',l.login||'',l.tipo||'',l.chamado||'','"'+(l.detalhe||'').replace(/"/g,'""')+'"'].join(',')).join(String.fromCharCode(10));
  const csv = header + String.fromCharCode(10) + body;
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
  a.download='auditoria_santa_colomba.csv';a.click();
}

function exportarCSV() {
  const all = allRecords();
  const header = 'Número,Título,Cultura,Responsável,Data,Status,Sistema';
  const body = all.map(r=>[r[0],`"${(r[1]||'').replace(/"/g,'""')}"`,r[2]||'',r[3]||'',r[4]||'',r[5]||'',r[6]||''].join(',')).join(String.fromCharCode(10));
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(header+String.fromCharCode(10)+body);
  a.download='chamados_santa_colomba.csv';a.click();
}

function exportEncerradosCSV() {
  const closed=getClosedMap();
  const rows=[['Número','Título','Cultura','Fazenda','Sistema','Responsável','Abertura','Encerramento','Técnico(s)','Encerrado por','Dias'],
    ...getEncerrados().map(r=>{
      const ci=closed[r[0]]||{};
      const dias=(r[4]&&ci.encerradoEm)?Math.round((new Date(ci.encerradoEm)-new Date(r[4]+'T00:00'))/86400000):'';
      return [r[0],`"${(r[1]||'').replace(/"/g,'""')}"`,r[2],r[6]==='Solinftec KRT'?'Karitel':r[6]==='Solinftec RDM'?'Rio do Meio':r[6],r[6],r[3],r[4],ci.dataEncerramento||'',ci.tecnicos||'',ci.encerradoPor||'',dias];
    })];
  const csv=rows.map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download='encerrados_santa_colomba.csv';
  a.click();
  showToast('CSV exportado!');
}
