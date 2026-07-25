// ══════════════════════════════════════════
// MÓDULO: USUARIOS
// Santa Colomba — Central de Chamados SC
// ══════════════════════════════════════════

function getUsers(){ try{ const u=JSON.parse(localStorage.getItem(USERS_KEY)); return u&&u.length?u:DEFAULT_USERS; }catch(e){ return DEFAULT_USERS; } }

function saveUsers(u){ localStorage.setItem(USERS_KEY,JSON.stringify(u)); }

function currentUser(){ return getSession(); }

function getSession(){ try{ return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; } }

function setSession(u){ sessionStorage.setItem(SESSION_KEY,JSON.stringify(u)); }

function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }

function doLogin() {
  const login = document.getElementById('login-user').value.trim().toLowerCase();
  const senha = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  const users = getUsers();
  const u = users.find(u => u.login.toLowerCase()===login && u.senha===senha && u.status==='Ativo');
  if (!u) { audit('login_falhou', `Tentativa de login inválida: ${login}`, ''); errEl.style.display='block'; return; }
  errEl.style.display='none';
  setSession(u);
  audit('login', `Login: ${u.login}`, '');
  document.getElementById('login-overlay').style.display='none';
  document.getElementById('topbar-user').textContent = u.nome.split(' ')[0] + ' · ' + PERFIL_LABEL[u.perfil];
  aplicarNavPerms();
  fbSyncAfterLogin(); // pull latest data from Firestore
  // Mostrar menu principal em vez do dashboard
  mostrarMenu();
}

function doLogout() {
  audit('logout', `Logout: ${currentUser()?.login||''}`, '');
  clearSession();
  // Hide menu overlay + reset app visibility for next login
  const mo=document.getElementById('menu-overlay'); if(mo) mo.classList.remove('show');
  const backBtn=document.getElementById('menu-back-btn'); if(backBtn) backBtn.classList.remove('show');
  const badge=document.getElementById('topbar-module-badge'); if(badge) badge.remove();
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
  document.getElementById('login-overlay').style.display='flex';
  document.getElementById('topbar-user').textContent='';
}

function aplicarNavPerms() {
  const u = currentUser();
  if (!u) return;
  const perms = u.perms || PERFIL_PERMS[u.perfil] || [];
  const navMap = {
    'nav-aberto':'p_aberto','nav-encerrados':'p_encerrados',
    'nav-novo':'p_novo','nav-usuarios':'p_usuarios',
  };
  Object.entries(navMap).forEach(([navId, perm])=>{
    const el = document.getElementById(navId);
    if(el) el.style.display = perms.includes(perm) ? 'flex' : 'none';
  });
}

function temAcesso(perm){
  const u=currentUser(); if(!u) return false;
  const perms = u.perms || PERFIL_PERMS[u.perfil] || [];
  return perms.includes(perm);
}

function pode(acao){
  const u=currentUser(); if(!u) return false;
  // Map old acao strings to new perm keys
  const map={abrir:'p_abrir',editar:'p_editar',encerrar:'p_encerrar',reabrir:'p_reabrir',
             excluir:'p_excluir',ver:'p_dashboard',atualizar:'p_editar',exportar:'p_exportar'};
  const key = map[acao] || 'p_'+acao;
  const perms = u.perms || PERFIL_PERMS[u.perfil] || [];
  return perms.includes(key);
}

function renderUsuarios() {
  const users = getUsers();
  const u = currentUser();
  // Only admin can access
  if (!u || u.perfil !== 'admin') {
    showToast('Acesso restrito a administradores.');
    showSection('dashboard', document.querySelector('[onclick*=dashboard]'));
    return;
  }
  document.getElementById('tbl-usuarios').innerHTML = users.map(usr => `
    <tr>
      <td style="font-weight:600;color:var(--text)">${usr.nome}</td>
      <td class="td-num">${usr.login}</td>
      <td style="color:var(--text2)">${usr.cargo||'—'}</td>
      <td><span class="pill chip-blue">${PERFIL_LABEL[usr.perfil]||usr.perfil}</span></td>
      <td style="color:var(--text3);font-size:11px">${usr.email||'—'}</td>
      <td><span class="pill ${usr.status==='Ativo'?'p-concluida':'p-aberto'}">${usr.status}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="editarUsuario('${usr.id}')">Editar</button>
        ${usr.id!==u.id?`<button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;color:var(--red)" onclick="toggleStatusUsuario('${usr.id}')">
          ${usr.status==='Ativo'?'Inativar':'Ativar'}</button>`:''}
      </td>
    </tr>`).join('');
}

function abrirFormUsuario() {
  document.getElementById('u-id').value='';
  document.getElementById('u-nome').value='';
  document.getElementById('u-login').value='';
  document.getElementById('u-senha').value='';
  document.getElementById('u-email').value='';
  document.getElementById('u-cargo').value='';
  document.getElementById('u-perfil').value='tecnico';
  document.getElementById('u-status').value='Ativo';
  document.getElementById('form-usuario-title').textContent='Novo Usuário';
  document.getElementById('form-usuario-card').style.display='block';
  renderPermsGrid(PERFIL_PERMS['tecnico']);
  document.getElementById('form-usuario-card').scrollIntoView({behavior:'smooth'});
}

function fecharFormUsuario() {
  document.getElementById('form-usuario-card').style.display='none';
}

function salvarUsuario() {
  const nome  = document.getElementById('u-nome').value.trim();
  const login = document.getElementById('u-login').value.trim();
  const senha = document.getElementById('u-senha').value;
  const perfil= document.getElementById('u-perfil').value;
  if(!nome||!login||!senha) { showToast('Nome, login e senha são obrigatórios'); return; }

  const users = getUsers();
  const id = document.getElementById('u-id').value;
  if (users.some(u => u.login.toLowerCase()===login.toLowerCase() && u.id!==id)) {
    showToast('Já existe um usuário com esse login'); return;
  }
  const perms = [...document.querySelectorAll('#perms-grid input[type=checkbox]:checked')].map(cb=>cb.value);
  const userData = {nome,login,senha,
    email:document.getElementById('u-email').value,
    cargo:document.getElementById('u-cargo').value,
    perfil,status:document.getElementById('u-status').value,
    perms: perms.length ? perms : null};
  if (id) {
    const idx = users.findIndex(u=>u.id===id);
    if(idx>=0) users[idx] = {...users[idx],...userData};
  } else {
    users.push({id:'u'+Date.now(),...userData});
  }
  saveUsers(users);
  audit('editou', `Usuário ${login} cadastrado/atualizado`, '');
  fecharFormUsuario();
  renderUsuarios();
  showToast(id ? 'Usuário atualizado!' : 'Usuário cadastrado com sucesso!');
}

function editarUsuario(id) {
  const u = getUsers().find(u=>u.id===id);
  if(!u) return;
  document.getElementById('u-id').value=u.id;
  document.getElementById('u-nome').value=u.nome;
  document.getElementById('u-login').value=u.login;
  document.getElementById('u-senha').value=u.senha;
  document.getElementById('u-email').value=u.email||'';
  document.getElementById('u-cargo').value=u.cargo||'';
  document.getElementById('u-perfil').value=u.perfil;
  document.getElementById('u-status').value=u.status;
  document.getElementById('form-usuario-title').textContent='Editar Usuário';
  document.getElementById('form-usuario-card').style.display='block';
  // Fill perms
  renderPermsGrid(u.perms || PERFIL_PERMS[u.perfil] || []);
  document.getElementById('form-usuario-card').scrollIntoView({behavior:'smooth'});
}

function toggleStatusUsuario(id) {
  const users = getUsers();
  const idx = users.findIndex(u=>u.id===id);
  if(idx<0) return;
  users[idx].status = users[idx].status==='Ativo' ? 'Inativo' : 'Ativo';
  saveUsers(users);
  renderUsuarios();
  showToast('Status do usuário atualizado.');
}

function aplicarPerfilPerms() {
  const perfil = document.getElementById('u-perfil')?.value || 'tecnico';
  renderPermsGrid(PERFIL_PERMS[perfil] || []);
}
