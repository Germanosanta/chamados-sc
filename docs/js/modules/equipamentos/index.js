// ══════════════════════════════════════════
// MÓDULO: EQUIPAMENTOS
// Santa Colomba — Central de Chamados SC
// ══════════════════════════════════════════

// Índice de foco do teclado no autocomplete do formulário de cadastro de
// equipamento (equipFormSearch/equipFormKeyNav/equipFormHighlight). Note:
// _eqPage NÃO é declarada aqui de propósito — é usada via window._eqPage
// (ver eqGotoPage), então uma declaração let criaria um binding lexical
// separado do global e quebraria a paginação.
let _eqFormFocusIdx = -1;

function renderEquipamentos() {
  const q        = (document.getElementById('eq-srch')?.value||'').toLowerCase();
  const fTipo    = document.getElementById('eq-f-tipo')?.value||'';
  const fFazenda = document.getElementById('eq-f-fazenda')?.value||'';
  const fStat    = document.getElementById('eq-f-status')?.value||'';
  const fSemCad  = document.getElementById('eq-f-sem-cad')?.checked||false;

  // Base list: EQUIPAMENTOS xlsx merged with local cadastro overrides
  const cadMap   = getCadEq();                              // {frota: {...campos extras}}
  const baseList = typeof EQUIPAMENTOS!=='undefined' ? EQUIPAMENTOS : [];

  // Build unified list: xlsx record + local overrides merged
  let items = baseList.map(e => {
    const cad = cadMap[e.c] || {};
    return {
      frota:       e.c,
      descricao:   e.d,
      modelo:      cad.modelo      || e.m || '',
      fabricante:  cad.fabricante  || '',
      ano:         cad.ano         || '',
      tipo:        cad.tipo        || e.g || '',
      horimetro:   cad.horimetro   || '',
      fazenda:     cad.fazenda     || '',
      cultura:     cad.cultura     || '',
      responsavel: cad.responsavel || '',
      status:      cad.status      || e.s || 'Ativo',
      patrimonio:  cad.patrimonio  || '',
      serie:       cad.serie       || '',
      obs:         cad.obs         || '',
      temCad:      !!cadMap[e.c],
    };
  });

  // Chamados count map
  const chCount = {};
  if (typeof MATCH_MAP!=='undefined') Object.values(MATCH_MAP).forEach(c=>{chCount[c]=(chCount[c]||0)+1;});
  getLocal().forEach(lr=>{ if(lr.equipCodigo) chCount[lr.equipCodigo]=(chCount[lr.equipCodigo]||0)+1; });

  // Filters
  if (q)        items=items.filter(e=>e.frota.toLowerCase().includes(q)||e.descricao.toLowerCase().includes(q)||(e.modelo||'').toLowerCase().includes(q)||(e.fabricante||'').toLowerCase().includes(q)||(e.patrimonio||'').toLowerCase().includes(q));
  if (fTipo)    items=items.filter(e=>e.tipo===fTipo);
  if (fFazenda) items=items.filter(e=>e.fazenda===fFazenda);
  if (fStat)    items=items.filter(e=>e.status===fStat);
  if (fSemCad)  items=items.filter(e=>!e.temCad);

  // KPIs
  const all    = baseList;
  const comCad = Object.keys(cadMap).length;
  const setEl  = (id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('eq-total',   all.length.toLocaleString('pt-BR'));
  setEl('eq-ativos',  all.filter(e=>(cadMap[e.c]?.status||e.s)==='Ativo').length.toLocaleString('pt-BR'));
  setEl('eq-inativos',all.filter(e=>(cadMap[e.c]?.status||e.s)!=='Ativo').length.toLocaleString('pt-BR'));
  setEl('eq-com-ch',  new Set(Object.values(typeof MATCH_MAP!=='undefined'?MATCH_MAP:{})).size.toLocaleString('pt-BR'));
  setEl('eq-com-cad', comCad.toLocaleString('pt-BR'));

  const tbody=document.getElementById('tbl-equipamentos');
  const empty=document.getElementById('eq-empty');
  if(!tbody) return;

  if(!items.length){
    tbody.innerHTML='';
    if(empty) empty.style.display='block';
    document.getElementById('eq-pag').innerHTML='';
    return;
  }
  if(empty) empty.style.display='none';

  // Pagination
  const PAGE=25;
  if(typeof _eqPage==='undefined') window._eqPage=1;
  const total=items.length;
  const pageItems=items.slice((_eqPage-1)*PAGE,_eqPage*PAGE);

  const statusColor=s=>s==='Ativo'?'var(--green)':s==='Manutenção'?'var(--amber)':'var(--text3)';

  tbody.innerHTML=pageItems.map(e=>{
    const cnt=chCount[e.frota]||0;
    const hasData=e.patrimonio||e.fabricante||e.ano||e.horimetro||e.fazenda||e.responsavel;
    return `<tr>
      <td class="td-num">${e.frota}</td>
      <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.descricao}">${e.descricao}</td>
      <td style="font-size:11px;font-family:var(--font-mono)">${e.patrimonio||'<span style="color:var(--border2)">—</span>'}</td>
      <td style="font-size:11px">${e.modelo||'—'}</td>
      <td style="font-size:11px">${e.fabricante||'<span style="color:var(--border2)">—</span>'}</td>
      <td style="font-size:11px;text-align:center">${e.ano||'<span style="color:var(--border2)">—</span>'}</td>
      <td><span class="pill chip-blue" style="font-size:10px">${e.tipo||'—'}</span></td>
      <td style="font-size:11px;text-align:right">${e.horimetro?Number(e.horimetro).toLocaleString('pt-BR')+'h':'<span style="color:var(--border2)">—</span>'}</td>
      <td style="font-size:11px">${e.fazenda||'<span style="color:var(--border2)">—</span>'}</td>
      <td style="font-size:11px">${e.cultura||'<span style="color:var(--border2)">—</span>'}</td>
      <td style="font-size:11px">${e.responsavel||'<span style="color:var(--border2)">—</span>'}</td>
      <td><span style="font-size:11px;font-weight:600;color:${statusColor(e.status)}">${e.status}</span></td>
      <td style="text-align:center">${cnt?`<span style="background:var(--accent-light);color:var(--accent);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;cursor:pointer" onclick="verHistoricoFrota('${e.frota}')">${cnt}</span>`:'<span style="color:var(--border2);font-size:11px">—</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="abrirFormEq('${e.frota}')">✏️ Editar</button>
      </td>
    </tr>`;
  }).join('');

  // Pagination bar
  const pages=Math.ceil(total/PAGE);
  const pag=document.getElementById('eq-pag');
  if(pag&&pages>1){
    let btns=`<span style="font-size:11px;color:var(--text3)">${total.toLocaleString('pt-BR')} equipamentos</span> `;
    for(let p=1;p<=pages;p++){
      if(p===1||p===pages||Math.abs(p-_eqPage)<=1){
        btns+=`<button class="pag-btn${p===_eqPage?' active':''}" onclick="eqGotoPage(${p})">${p}</button>`;
      } else if(Math.abs(p-_eqPage)===2){
        btns+=`<span style="color:var(--text3);padding:0 4px">…</span>`;
      }
    }
    pag.innerHTML=btns;
  } else if(pag){
    pag.innerHTML=total>0?`<span style="font-size:11px;color:var(--text3)">${total.toLocaleString('pt-BR')} equipamentos</span>`:'';
  }
}

function eqGotoPage(p){window._eqPage=p;renderEquipamentos();}

function abrirFormEq(frota) {
  const card=document.getElementById('form-eq-card');
  if(!card) return;

  // Reset all fields
  ['eq-frota','eq-patrimonio','eq-descricao','eq-serie','eq-modelo','eq-fabricante',
   'eq-ano','eq-horimetro','eq-obs','eq-edit-id','eq-frota-code'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['eq-tipo','eq-status','eq-fazenda','eq-cultura','eq-responsavel'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.selectedIndex=0;
  });
  document.getElementById('eq-erro').style.display='none';

  if(frota){
    // Edit mode — load existing data
    document.getElementById('form-eq-title').textContent='Editar Equipamento';
    document.getElementById('eq-edit-id').value=frota;

    // Load from xlsx base
    const base=(typeof EQUIPAMENTOS!=='undefined'?EQUIPAMENTOS:[]).find(e=>e.c===frota);
    if(base){
      document.getElementById('eq-frota').value   = base.e||(base.c+' '+base.d);
      document.getElementById('eq-frota-code').value = base.c;
      document.getElementById('eq-descricao').value  = base.d;
      document.getElementById('eq-modelo').value     = base.m||'';
    }

    // Override with local cadastro data
    const cad=getCadEq()[frota]||{};
    const setVal=(id,v)=>{const el=document.getElementById(id);if(el&&v!==undefined)el.value=v;};
    setVal('eq-patrimonio', cad.patrimonio);
    setVal('eq-serie',      cad.serie);
    setVal('eq-modelo',     cad.modelo||(base?.m||''));
    setVal('eq-fabricante', cad.fabricante);
    setVal('eq-ano',        cad.ano);
    setVal('eq-horimetro',  cad.horimetro);
    setVal('eq-obs',        cad.obs);
    const setSel=(id,v)=>{const el=document.getElementById(id);if(el&&v)el.value=v;};
    setSel('eq-tipo',       cad.tipo||(base?.g||''));
    setSel('eq-status',     cad.status);
    setSel('eq-fazenda',    cad.fazenda);
    setSel('eq-cultura',    cad.cultura);
    setSel('eq-responsavel',cad.responsavel);
  } else {
    document.getElementById('form-eq-title').textContent='Novo Equipamento';
    document.getElementById('eq-status').value='Ativo';
  }

  card.style.display='block';
  card.scrollIntoView({behavior:'smooth', block:'start'});
}

function fecharFormEq() {
  const card=document.getElementById('form-eq-card');
  if(card) card.style.display='none';
}

function salvarEq() {
  const frota  = document.getElementById('eq-frota-code').value.trim()
               || document.getElementById('eq-frota').value.trim().split(' ')[0];
  const erroEl = document.getElementById('eq-erro');

  if(!frota){ erroEl.style.display='block'; erroEl.textContent='⛔ Selecione um equipamento da lista (Frota é obrigatório).'; return; }

  const get=(id)=>document.getElementById(id)?.value?.trim()||'';

  const cad=getCadEq();
  cad[frota]={
    frota,
    patrimonio:  get('eq-patrimonio'),
    serie:       get('eq-serie'),
    modelo:      get('eq-modelo'),
    fabricante:  get('eq-fabricante'),
    ano:         get('eq-ano'),
    tipo:        get('eq-tipo'),
    horimetro:   get('eq-horimetro'),
    status:      get('eq-status')||'Ativo',
    fazenda:     get('eq-fazenda'),
    cultura:     get('eq-cultura'),
    responsavel: get('eq-responsavel'),
    obs:         get('eq-obs'),
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: currentUser()?.nome||'Sistema',
  };
  saveCadEq(cad);
  fecharFormEq();
  window._eqPage=1;
  renderEquipamentos();
  showToast('✓ Equipamento salvo no cadastro!');
  audit('editou', `Equipamento ${frota} cadastrado/atualizado`, frota);
}

function equipFormSearch(q, dropId, codeId) {
  const drop = document.getElementById(dropId);
  if (!drop) return;
  if (!q || q.length < 1) { drop.className='equip-dropdown'; drop.innerHTML=''; _eqFormFocusIdx=-1; return; }
  const ql = q.toLowerCase();
  const results = (typeof EQUIPAMENTOS!=='undefined'?EQUIPAMENTOS:[])
    .filter(e=>e.c.toLowerCase().startsWith(ql)||e.d.toLowerCase().includes(ql)||e.e.toLowerCase().includes(ql))
    .slice(0,20);
  if(!results.length){ drop.innerHTML='<div class="equip-nofound">Nenhum resultado</div>'; drop.className='equip-dropdown open'; return; }
  _eqFormFocusIdx=-1;
  drop.innerHTML=results.map((e,i)=>`
    <div class="equip-item" data-idx="${i}"
      onmousedown="equipFormSelect(${JSON.stringify(e).replace(/"/g,'&quot;')},'${dropId}','${codeId}')"
      onmouseover="_eqFormFocusIdx=${i};equipFormHighlight(document.getElementById('${dropId}').querySelectorAll('.equip-item'))">
      <div class="equip-item-code">${e.c}</div>
      <div class="equip-item-name">${e.d}</div>
      <div class="equip-item-meta"><span>${e.g||'—'}</span><span>${e.m||'—'}</span></div>
    </div>`).join('');
  drop.className='equip-dropdown open';
}

function equipFormKeyNav(ev, dropId, codeId) {
  const drop=document.getElementById(dropId);
  const items=drop?.querySelectorAll('.equip-item');
  if(!items?.length) return;
  if(ev.key==='ArrowDown'){ev.preventDefault();_eqFormFocusIdx=Math.min(_eqFormFocusIdx+1,items.length-1);equipFormHighlight(items);}
  else if(ev.key==='ArrowUp'){ev.preventDefault();_eqFormFocusIdx=Math.max(_eqFormFocusIdx-1,0);equipFormHighlight(items);}
  else if(ev.key==='Enter'){ev.preventDefault();if(_eqFormFocusIdx>=0)items[_eqFormFocusIdx].dispatchEvent(new MouseEvent('mousedown'));}
  else if(ev.key==='Escape'){drop.className='equip-dropdown';_eqFormFocusIdx=-1;}
}

function equipFormSelect(equip, dropId, codeId) {
  document.getElementById('eq-frota').value    = equip.e||(equip.c+' '+equip.d);
  document.getElementById('eq-frota-code').value = equip.c;
  document.getElementById('eq-descricao').value  = equip.d;
  document.getElementById('eq-modelo').value     = equip.m||'';
  // Auto-fill tipo from grupo
  const tipoMap={'TRATOR':'TRATOR','COLHEDORA':'COLHEDORA','PULVERIZADOR':'PULVERIZADOR',
    'CAMINHÃO':'CAMINHÃO','SEMEADORA':'SEMEADORA','VEÍCULOS LEVES':'VEÍCULOS LEVES'};
  const tipoEl=document.getElementById('eq-tipo');
  if(tipoEl && tipoMap[equip.g]) tipoEl.value=tipoMap[equip.g];
  const drop=document.getElementById(dropId);
  if(drop){drop.className='equip-dropdown';drop.innerHTML='';}
  _eqFormFocusIdx=-1;
}

function equipFormHighlight(items){
  items.forEach((it,i)=>it.className='equip-item'+(i===_eqFormFocusIdx?' focused':''));
  items[_eqFormFocusIdx]?.scrollIntoView({block:'nearest'});
}

function renderFrotas() {
  const q       = (document.getElementById('fr-srch')?.value||'').toLowerCase();
  const fGrupo  = document.getElementById('fr-f-grupo')?.value||'';
  const fStatus = document.getElementById('fr-f-status')?.value||'';
  const fSort   = document.getElementById('fr-f-sort')?.value||'count';

  const all     = allRecords();
  const local   = getLocal();
  const closed  = getClosedMap();

  // Build frota → chamados map from MATCH_MAP + local records with equipCodigo
  const frotaMap = {}; // code -> [rec, ...]

  // Historical matches (MATCH_MAP)
  Object.entries(MATCH_MAP).forEach(([num, code]) => {
    const rec = all.find(r=>r[0]===num);
    if (!rec) return;
    if (!frotaMap[code]) frotaMap[code] = [];
    frotaMap[code].push(rec);
  });

  // New chamados from local records with equipCodigo
  local.forEach(lr => {
    if (!lr.equipCodigo) return;
    const code = lr.equipCodigo;
    const rec  = all.find(r=>r[0]===lr.num);
    if (!rec) return;
    if (!frotaMap[code]) frotaMap[code] = [];
    // Avoid duplicates (may already be in MATCH_MAP)
    if (!frotaMap[code].some(r=>r[0]===rec[0])) {
      frotaMap[code].push(rec);
    }
  });

  // Build display list with equip metadata
  let items = Object.entries(frotaMap).map(([code, recs]) => {
    const eq = EQUIP_IDX[code] || {d:code, m:'—', g:'—', s:'Ativo'};
    return { code, recs, d:eq.d, m:eq.m, g:eq.g, s:eq.s, count:recs.length };
  });

  // Filters
  if (q)       items=items.filter(x=>x.code.toLowerCase().includes(q)||x.d.toLowerCase().includes(q)||x.m.toLowerCase().includes(q));
  if (fGrupo)  items=items.filter(x=>x.g===fGrupo);
  if (fStatus) items=items.filter(x=>x.s===fStatus);

  // Sort
  if (fSort==='count')    items.sort((a,b)=>b.count-a.count);
  else if (fSort==='codigo')   items.sort((a,b)=>a.code.localeCompare(b.code));
  else if (fSort==='descricao')items.sort((a,b)=>a.d.localeCompare(b.d));

  // KPIs
  const allVinc  = Object.values(frotaMap).flat().length;
  const inativas = items.filter(x=>x.s!=='Ativo').length;
  const top      = items.sort((a,b)=>b.count-a.count)[0];
  const pct      = all.length ? Math.round(allVinc/all.length*100) : 0;
  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('fr-total',     items.length.toLocaleString('pt-BR'));
  setEl('fr-chamados',  allVinc.toLocaleString('pt-BR'));
  setEl('fr-pct',       pct+'%');
  setEl('fr-top',       top ? top.code+' · '+top.d.slice(0,20) : '—');
  setEl('fr-inativas',  inativas.toLocaleString('pt-BR'));

  // Re-sort for display after KPI calc
  if (fSort==='count')    items.sort((a,b)=>b.count-a.count);
  else if (fSort==='codigo')   items.sort((a,b)=>a.code.localeCompare(b.code));
  else if (fSort==='descricao')items.sort((a,b)=>a.d.localeCompare(b.d));

  const tbody = document.getElementById('tbl-frotas');
  const empty = document.getElementById('fr-empty');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML='';
    if(empty) empty.style.display='block';
    return;
  }
  if(empty) empty.style.display='none';

  tbody.innerHTML = items.map(x=>`
    <tr>
      <td class="td-num">${x.code}</td>
      <td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.d}</td>
      <td style="font-size:11px;color:var(--text3)">${x.m||'—'}</td>
      <td><span class="pill chip-blue">${x.g||'—'}</span></td>
      <td><span style="font-size:11px;font-weight:600;color:${x.s==='Ativo'?'var(--green)':'var(--amber)'}">${x.s}</span></td>
      <td style="text-align:center">
        <span style="background:var(--accent-light);color:var(--accent);padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700">${x.count}</span>
      </td>
      <td>
        <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="verHistoricoFrota('${x.code}')">
          📋 Ver histórico
        </button>
      </td>
    </tr>`).join('');
}

function verHistoricoFrota(code) {
  const eq     = EQUIP_IDX[code] || {d:code, m:'—', g:'—', s:'—'};
  const all    = allRecords();
  const local  = getLocal();
  const closed = getClosedMap();

  // Gather all chamados for this frota
  const nums = new Set();
  Object.entries(MATCH_MAP).forEach(([n,c])=>{ if(c===code) nums.add(n); });
  local.forEach(lr=>{ if(lr.equipCodigo===code) nums.add(lr.num); });

  const recs = all.filter(r=>nums.has(r[0]));
  const isCl = r=>r[5]==='Concluída'||r[5]==='Encerrado'||!!closed[r[0]];
  const conc  = recs.filter(isCl).length;
  const aberto= recs.filter(r=>!isCl(r)).length;

  // Avg resolution time
  let somaD=0, cntD=0;
  recs.forEach(r=>{
    const ci=closed[r[0]];
    if(ci?.encerradoEm&&r[4]){
      const d=Math.floor((new Date(ci.encerradoEm)-new Date(r[4]+'T00:00'))/86400000);
      if(d>=0){somaD+=d;cntD++;}
    }
  });
  const avgD = cntD ? (somaD/cntD).toFixed(1)+'d' : '—';

  const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  setEl('fr-detail-title', code+' · '+eq.d);
  setEl('fr-detail-sub',   eq.g+' · '+eq.m+(eq.s?' · '+eq.s:''));
  setEl('fr-d-total',  recs.length);
  setEl('fr-d-conc',   conc);
  setEl('fr-d-aberto', aberto);
  setEl('fr-d-tempo',  avgD);

  document.getElementById('tbl-fr-detail').innerHTML = recs
    .sort((a,b)=>b[4]?.localeCompare(a[4]||'')||0)
    .map(r=>`<tr style="cursor:pointer" onclick="openDetalhe('${r[0]}')">
      <td class="td-num">${r[0]}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[1]||'—'}</td>
      <td style="font-family:var(--font-mono);font-size:11px">${r[4]?r[4].split('-').reverse().join('/'):' —'}</td>
      <td><span class="pill ${statusPill(r[5])}">${r[5]}</span></td>
      <td style="font-size:11px">${(r[3]||'—').replace(/,/g,' e ')}</td>
    </tr>`).join('');

  document.getElementById('fr-detail-card').style.display='block';
  document.getElementById('fr-detail-card').scrollIntoView({behavior:'smooth'});
}

function renderKB() {
  const q      = (document.getElementById('kb-srch')?.value || '').toLowerCase();
  const fCat   = document.getElementById('kb-f-cat')?.value || '';
  const fSist  = document.getElementById('kb-f-sistema')?.value || '';
  let items    = getKB();

  if (q)     items = items.filter(k => k.problema.toLowerCase().includes(q) || k.solucao.toLowerCase().includes(q));
  if (fCat)  items = items.filter(k => k.categoria === fCat);
  if (fSist) items = items.filter(k => k.sistema === fSist);

  const all = getKB();
  const cats = [...new Set(all.map(k=>k.categoria).filter(Boolean))];
  const topCat = cats.sort((a,b)=>all.filter(k=>k.categoria===b).length-all.filter(k=>k.categoria===a).length)[0]||'—';
  const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('kb-total', all.length.toLocaleString('pt-BR'));
  setEl('kb-cats', cats.length.toLocaleString('pt-BR'));
  setEl('kb-top', topCat);

  const tbody = document.getElementById('tbl-kb');
  const empty = document.getElementById('kb-empty');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = items.map(k=>`
    <tr>
      <td style="font-weight:600;max-width:180px">${k.problema}</td>
      <td><span class="pill chip-blue">${k.categoria||'—'}</span></td>
      <td style="font-size:11px;color:var(--text3)">${k.sistema||'Todos'}</td>
      <td style="max-width:220px;font-size:12px">${k.solucao}</td>
      <td style="font-size:11px;color:var(--text3)">${k.materiais||'—'}</td>
      <td style="font-size:11px;text-align:center">${k.tempo ? k.tempo+'min' : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="editarKB('${k.id}')">✏️</button>
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;color:var(--red)" onclick="excluirKB('${k.id}')">🗑</button>
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="usarSolucaoKB('${k.id}')">📋 Usar</button>
      </td>
    </tr>`).join('');
}

function abrirFormKB(prefill) {
  kbEditId = null;
  document.getElementById('form-kb-title').textContent = 'Nova Solução';
  document.getElementById('kb-edit-id').value = '';
  ['kb-problema','kb-cat','kb-sistema','kb-solucao','kb-materiais','kb-tempo','kb-obs'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  if (prefill) {
    if (prefill.problema) document.getElementById('kb-problema').value = prefill.problema;
    if (prefill.solucao)  document.getElementById('kb-solucao').value  = prefill.solucao;
    if (prefill.materiais)document.getElementById('kb-materiais').value= prefill.materiais;
    if (prefill.sistema)  document.getElementById('kb-sistema').value  = prefill.sistema;
  }
  document.getElementById('kb-erro').style.display='none';
  document.getElementById('form-kb-card').style.display='block';
  document.getElementById('form-kb-card').scrollIntoView({behavior:'smooth'});
}

function fecharFormKB() { document.getElementById('form-kb-card').style.display='none'; kbEditId=null; }

function editarKB(id) {
  const k = getKB().find(x=>x.id===id);
  if (!k) return;
  kbEditId = id;
  document.getElementById('form-kb-title').textContent = 'Editar Solução';
  document.getElementById('kb-edit-id').value = id;
  document.getElementById('kb-problema').value  = k.problema  || '';
  document.getElementById('kb-cat').value       = k.categoria || '';
  document.getElementById('kb-sistema').value   = k.sistema   || '';
  document.getElementById('kb-solucao').value   = k.solucao   || '';
  document.getElementById('kb-materiais').value = k.materiais || '';
  document.getElementById('kb-tempo').value     = k.tempo     || '';
  document.getElementById('kb-obs').value       = k.obs       || '';
  document.getElementById('kb-erro').style.display='none';
  document.getElementById('form-kb-card').style.display='block';
  document.getElementById('form-kb-card').scrollIntoView({behavior:'smooth'});
}

function salvarKB() {
  const problema  = document.getElementById('kb-problema').value.trim();
  const categoria = document.getElementById('kb-cat').value;
  const solucao   = document.getElementById('kb-solucao').value.trim();
  const erroEl    = document.getElementById('kb-erro');
  if (!problema || !categoria || !solucao) {
    erroEl.style.display='block';
    erroEl.textContent='⛔ Preencha Problema, Categoria e Solução.';
    return;
  }
  erroEl.style.display='none';
  const items = getKB();
  const editId = document.getElementById('kb-edit-id').value;
  const entry = {
    id:        editId || 'kb'+Date.now(),
    problema, categoria,
    sistema:   document.getElementById('kb-sistema').value,
    solucao,
    materiais: document.getElementById('kb-materiais').value.trim(),
    tempo:     document.getElementById('kb-tempo').value,
    obs:       document.getElementById('kb-obs').value.trim(),
    criadoEm:  editId ? (items.find(x=>x.id===editId)?.criadoEm||new Date().toISOString()) : new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
  if (editId) {
    const idx = items.findIndex(x=>x.id===editId);
    if (idx>=0) items[idx]=entry; else items.push(entry);
  } else {
    items.push(entry);
  }
  saveKB(items);
  fecharFormKB();
  renderKB();
  showToast('Solução salva no Banco de Conhecimento!');
}

function excluirKB(id) {
  if (!confirm('Excluir esta solução?')) return;
  saveKB(getKB().filter(k=>k.id!==id));
  renderKB();
  showToast('Solução excluída.');
}

function usarSolucaoKB(id) {
  const k = getKB().find(x=>x.id===id);
  if (!k) return;
  const solEl = document.getElementById('chk-solucao');
  const matEl = document.getElementById('chk-materiais');
  if (solEl) solEl.value = k.solucao;
  if (matEl && k.materiais) matEl.value = k.materiais;
  if (document.getElementById('modal-checklist')?.classList.contains('open')) {
    showToast('Solução aplicada ao checklist!');
  } else {
    showToast('Solução copiada — abra o encerramento para usar.');
  }
}

function salvarSolucaoNoKB(rec, closedInfo) {
  if (!closedInfo?.solucao) return;
  const items = getKB();
  // Avoid duplicates (check if same problem+solution exists)
  const exists = items.some(k => k.solucao === closedInfo.solucao);
  if (exists) return;
  items.push({
    id: 'kb'+Date.now(),
    problema:  rec[1] || '',
    categoria: 'Outro',
    sistema:   rec[6] || '',
    solucao:   closedInfo.solucao,
    materiais: closedInfo.materiais || '',
    tempo:     '',
    obs:       closedInfo.observacoes || '',
    criadoEm:  new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });
  saveKB(items);
}

function renderPecas() {
  const q      = (document.getElementById('pec-srch')?.value || '').toLowerCase();
  const fCat   = document.getElementById('pec-f-cat')?.value || '';
  const fBaixo = document.getElementById('pec-f-baixo')?.checked;
  let items    = getPecas();

  if (q)      items = items.filter(p => p.nome.toLowerCase().includes(q) || (p.codigo||'').toLowerCase().includes(q));
  if (fCat)   items = items.filter(p => p.categoria === fCat);
  if (fBaixo) items = items.filter(p => Number(p.qtd) <= Number(p.minimo||2));

  const all  = getPecas();
  const movs = getMovs();
  const baixo = all.filter(p => Number(p.qtd) <= Number(p.minimo||2)).length;

  // Most consumed
  const consumed = {};
  movs.filter(m=>m.tipo==='saida').forEach(m=>{consumed[m.pecaId]=(consumed[m.pecaId]||0)+Number(m.qtd||1);});
  const topId = Object.entries(consumed).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topPec = all.find(p=>p.id===topId);

  const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('pec-total', all.length.toLocaleString('pt-BR'));
  setEl('pec-baixo', baixo.toLocaleString('pt-BR'));
  setEl('pec-top',   topPec?.nome || '—');
  setEl('pec-mov-cnt', movs.length.toLocaleString('pt-BR'));

  const tbody = document.getElementById('tbl-pecas');
  const empty = document.getElementById('pec-empty');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = items.map(p=>{
    const isLow = Number(p.qtd) <= Number(p.minimo||2);
    const qtdClass = isLow ? 'color:var(--red);font-weight:700' : 'color:var(--green);font-weight:600';
    return `<tr>
      <td style="font-weight:600">${p.nome}${isLow?` <span style="font-size:10px;background:var(--red-bg);color:var(--red);padding:1px 5px;border-radius:4px">⚠ baixo</span>`:''}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${p.codigo||'—'}</td>
      <td><span class="pill chip-blue">${p.categoria||'—'}</span></td>
      <td style="font-size:11px;color:var(--text3)">${p.unidade||'un'}</td>
      <td style="${qtdClass}">${p.qtd} ${p.unidade||'un'}</td>
      <td style="font-size:11px;color:var(--text3)">${p.minimo||2}</td>
      <td style="font-size:11px;color:var(--text3)">${p.local||'—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="editarPeca('${p.id}')">✏️</button>
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;color:var(--green)" onclick="abrirMovimentacao('${p.id}','${p.nome.replace(/'/g,"\'")}')" title="Movimentar estoque">📦</button>
        <button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;color:var(--red)" onclick="excluirPeca('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function abrirFormPeca() {
  pecaEditId = null;
  document.getElementById('form-pec-title').textContent = 'Nova Peça';
  document.getElementById('pec-edit-id').value = '';
  ['pec-nome','pec-codigo','pec-cat','pec-unidade','pec-qtd','pec-minimo','pec-local','pec-fornecedor','pec-obs-item'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value = (id==='pec-qtd'?'0':id==='pec-minimo'?'2':'');
  });
  document.getElementById('pec-erro').style.display='none';
  document.getElementById('form-pec-card').style.display='block';
  document.getElementById('form-pec-card').scrollIntoView({behavior:'smooth'});
}

function fecharFormPeca() { document.getElementById('form-pec-card').style.display='none'; pecaEditId=null; }

function editarPeca(id) {
  const p = getPecas().find(x=>x.id===id);
  if (!p) return;
  pecaEditId = id;
  document.getElementById('form-pec-title').textContent='Editar Peça';
  document.getElementById('pec-edit-id').value   = id;
  document.getElementById('pec-nome').value       = p.nome||'';
  document.getElementById('pec-codigo').value     = p.codigo||'';
  document.getElementById('pec-cat').value        = p.categoria||'';
  document.getElementById('pec-unidade').value    = p.unidade||'un';
  document.getElementById('pec-qtd').value        = p.qtd||0;
  document.getElementById('pec-minimo').value     = p.minimo||2;
  document.getElementById('pec-local').value      = p.local||'';
  document.getElementById('pec-fornecedor').value = p.fornecedor||'';
  document.getElementById('pec-obs-item').value   = p.obs||'';
  document.getElementById('pec-erro').style.display='none';
  document.getElementById('form-pec-card').style.display='block';
  document.getElementById('form-pec-card').scrollIntoView({behavior:'smooth'});
}

function salvarPeca() {
  const nome = document.getElementById('pec-nome').value.trim();
  const qtd  = document.getElementById('pec-qtd').value;
  const erroEl = document.getElementById('pec-erro');
  if (!nome) { erroEl.style.display='block'; erroEl.textContent='⛔ Informe o nome da peça.'; return; }
  erroEl.style.display='none';
  const items = getPecas();
  const editId = document.getElementById('pec-edit-id').value;
  const entry = {
    id:         editId || 'p'+Date.now(),
    nome, qtd: Number(qtd)||0,
    codigo:     document.getElementById('pec-codigo').value.trim(),
    categoria:  document.getElementById('pec-cat').value,
    unidade:    document.getElementById('pec-unidade').value,
    minimo:     Number(document.getElementById('pec-minimo').value)||2,
    local:      document.getElementById('pec-local').value.trim(),
    fornecedor: document.getElementById('pec-fornecedor').value.trim(),
    obs:        document.getElementById('pec-obs-item').value.trim(),
    criadoEm:   editId ? (items.find(x=>x.id===editId)?.criadoEm||new Date().toISOString()) : new Date().toISOString(),
  };
  if (editId) { const idx=items.findIndex(x=>x.id===editId); if(idx>=0) items[idx]=entry; else items.push(entry); }
  else items.push(entry);
  savePecas(items);
  fecharFormPeca();
  renderPecas();
  showToast('Peça salva no estoque!');
}

function excluirPeca(id) {
  if (!confirm('Excluir esta peça do estoque?')) return;
  savePecas(getPecas().filter(p=>p.id!==id));
  renderPecas();
  showToast('Peça excluída.');
}

function abrirMovimentacao(id, nome) {
  document.getElementById('mov-peca-id').value   = id;
  document.getElementById('mov-peca-nome').value = nome;
  document.getElementById('mov-qtd').value       = '1';
  document.getElementById('mov-tipo').value      = 'saida';
  document.getElementById('mov-chamado').value   = '';
  document.getElementById('mov-obs').value       = '';
  document.getElementById('pec-mov-card').style.display = 'block';
  document.getElementById('pec-mov-card').scrollIntoView({behavior:'smooth'});
}

function registrarMovimentacao() {
  const id   = document.getElementById('mov-peca-id').value;
  const tipo = document.getElementById('mov-tipo').value;
  const qtd  = Number(document.getElementById('mov-qtd').value)||1;
  const obs  = document.getElementById('mov-obs').value.trim();
  const chamado = document.getElementById('mov-chamado').value.trim();
  if (!id||!qtd) { showToast('Informe a quantidade.'); return; }

  const items = getPecas();
  const idx = items.findIndex(p=>p.id===id);
  if (idx<0) return;
  const before = Number(items[idx].qtd)||0;
  items[idx].qtd = tipo==='entrada' ? before+qtd : Math.max(0,before-qtd);
  savePecas(items);

  const movs = getMovs();
  movs.push({ id:'m'+Date.now(), pecaId:id, pecaNome:items[idx].nome,
    tipo, qtd, before, after:items[idx].qtd,
    chamado, obs, ts: new Date().toISOString(),
    usuario: currentUser()?.nome||'Sistema' });
  saveMovs(movs);

  document.getElementById('pec-mov-card').style.display='none';
  renderPecas();
  showToast(`✓ ${tipo==='entrada'?'Entrada':'Saída'} de ${qtd} ${items[idx].nome} registrada.`);
}

function getChamadoEquip(num, localRec) {
  const code = (localRec && localRec.equipCodigo) || MATCH_MAP[num];
  if (!code) return null;
  const eq = EQUIP_IDX[code];
  if (!eq) return null;
  return { codigo:code, descricao:eq.d, modelo:eq.m, grupo:eq.g, status:eq.s };
}

function frotaLabel(num, localRec) {
  const eq = getChamadoEquip(num, localRec);
  if (!eq) return '';
  return eq.codigo + ' · ' + eq.descricao;
}
