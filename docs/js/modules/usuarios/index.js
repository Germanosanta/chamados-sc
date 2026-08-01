// ══════════════════════════════════════════
// MÓDULO: USUARIOS
// Santa Colomba — Central de Chamados SC
// ══════════════════════════════════════════

// Docs antigos marcados migrado:true (pela migração p/ Firebase Auth) continuam
// no Firestore/cache — nada é apagado — mas ficam de fora da lista ativa do
// app: já foram substituídos por um doc novo (id = uid do Firebase Auth).
function getUsers(){ try{ const u=JSON.parse(localStorage.getItem(USERS_KEY)); const list=u&&u.length?u:DEFAULT_USERS; return list.filter(x=>!x.migrado); }catch(e){ return DEFAULT_USERS; } }

function saveUsers(u){ localStorage.setItem(USERS_KEY,JSON.stringify(u)); }

function currentUser(){ return getSession(); }

function getSession(){ try{ return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; } }

function setSession(u){ sessionStorage.setItem(SESSION_KEY,JSON.stringify(u)); }

function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }

// Usuário cujo perfil já foi conferido (Firebase Auth ok, status Ativo) mas
// que ainda precisa trocar a senha temporária antes de entrar de fato
// (flag usuarios/{uid}.precisaTrocarSenha, setada pela migração).
let _pendingLoginUser = null;

// Login é feito via Firebase Authentication (e-mail/senha). Como a tela pede
// um "usuário" (não e-mail), primeiro resolvemos login→e-mail pela coleção
// pública "logins" (só {email, uid}, leitura aberta — necessária pré-auth),
// depois autenticamos de verdade e buscamos o perfil em usuarios/{uid}.
async function doLogin() {
  const login = document.getElementById('login-user').value.trim().toLowerCase();
  const senha = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  try {
    const loginDoc = await window.fsGet('logins', login);
    // Se ainda não existe logins/{login} (ex.: 1º login depois de configurar
    // o Firebase Auth manualmente, antes de "logins" ser criada/preenchida),
    // mas o que foi digitado já é um e-mail, autentica direto com ele — evita
    // depender de "logins" já existir para o primeiríssimo acesso.
    const emailParaLogin = (loginDoc && loginDoc.email) ? loginDoc.email
      : (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login) ? login : null);
    if (!emailParaLogin) throw new Error('login desconhecido');
    const cred = await window.fbSignIn(emailParaLogin, senha);
    // Aguarda o token do Firebase Auth antes de QUALQUER leitura/gravação no
    // Firestore — evita "Missing or insufficient permissions" por
    // request.auth ainda não propagado logo depois da autenticação.
    await cred.user.getIdToken(true);
    let perfil = await window.fsGet('usuarios', cred.user.uid);
    if (!perfil) {
      // Doc de "usuarios" criado manualmente com um id diferente do uid do
      // Firebase Auth (ex.: conta configurada direto no console) — acha o
      // doc antigo pelo e-mail e copia para o id certo (uid), 1x por conta.
      perfil = await autocorrigirUsuarioPorEmail(cred.user.uid, cred.user.email);
    }
    const statusOk = perfil && String(perfil.status || '').toLowerCase() === 'ativo';
    if (!statusOk) {
      await window.fbSignOut();
      throw new Error('perfil inexistente ou inativo');
    }
    const u = { id: cred.user.uid, ...perfil };
    errEl.style.display='none';
    if (u.precisaTrocarSenha) {
      // Conta migrada com senha temporária — bloqueia a entrada até trocar.
      _pendingLoginUser = u;
      document.getElementById('login-overlay').style.display='none';
      document.getElementById('troca-senha-overlay').style.display='flex';
      return;
    }
    finalizarLogin(u);
  } catch (e) {
    audit('login_falhou', `Tentativa de login inválida: ${login}`, '');
    errEl.style.display='block';
  }
}

// Autocorreção: quando usuarios/{uid do Firebase Auth} não existe (conta
// criada manualmente com outro id), acha o doc antigo pelo e-mail e cria uma
// cópia sob o id certo (perfil/status/perms idênticos — a regra do Firestore
// não deixa mudar nada nesse passo), marcando o doc antigo como migrado.
// Sem isso, nem o login nem as permissões (souAdmin/estouAtivo, que buscam
// usuarios/{uid}) funcionariam pra contas configuradas fora do app.
async function autocorrigirUsuarioPorEmail(uid, email) {
  if (!window.FirestoreStorage || !email) return null;
  try {
    const res = await window.FirestoreStorage.buscarPorCampo('usuarios', 'email', email);
    if (!res.ok) return null;
    const antigo = res.data.find(d => !d.migrado && d.id !== uid);
    if (!antigo) return null;
    const { id: idAntigo, migrado, migradoParaUid, ...dadosAntigos } = antigo;
    // perms precisa ser null (nunca undefined) — doc criado manualmente pode
    // não ter esse campo, e o Firestore recusa gravar valor undefined.
    const novoDado = { ...dadosAntigos, perms: dadosAntigos.perms ?? null, migradoDeId: idAntigo };
    const criado = await window.fsSave('usuarios', uid, novoDado);
    if (!criado.ok) return null;
    const marcado = await window.fsSave('usuarios', idAntigo, { migrado: true, migradoParaUid: uid });
    if (!marcado.ok) {
      // O perfil novo (uid certo) já existe e o login prossegue normalmente —
      // mas o doc antigo não foi marcado como migrado, então ele pode voltar
      // a aparecer em listas que deveriam ignorá-lo (getUsers() filtra por
      // "migrado"). Fica registrado na Auditoria pra um admin encontrar sem
      // precisar vasculhar o console do navegador (achado C3 do relatório
      // técnico de 29/07/2026: falha parcial silenciosa nesse encadeamento).
      audit('erro_sync', `Autocorreção de login: doc antigo ${idAntigo} não pôde ser marcado como migrado após criar ${uid} (${email}) — ${marcado.error||'erro desconhecido'}`, '');
    }
    return novoDado;
  } catch (e) {
    console.warn('[Usuarios] autocorrigirUsuarioPorEmail falhou:', e.message);
    return null;
  }
}

function finalizarLogin(u) {
  setSession(u);
  audit('login', `Login: ${u.login}`, '');
  document.getElementById('login-overlay').style.display='none';
  document.getElementById('troca-senha-overlay').style.display='none';
  document.getElementById('topbar-user').textContent = u.nome.split(' ')[0] + ' · ' + PERFIL_LABEL[u.perfil];
  aplicarNavPerms();
  fbSyncAfterLogin(); // pull latest data from Firestore
  // Mostrar menu principal em vez do dashboard
  mostrarMenu();
}

async function concluirTrocaSenhaObrigatoria() {
  const nova = document.getElementById('troca-senha-nova').value;
  const conf = document.getElementById('troca-senha-confirma').value;
  const errEl = document.getElementById('troca-senha-err');
  if (!_pendingLoginUser || nova.length < 6 || nova !== conf) {
    errEl.textContent = 'As senhas não coincidem ou são muito curtas (mínimo 6 caracteres).';
    errEl.style.display='block';
    return;
  }
  errEl.style.display='none';
  try {
    await window.fbUpdatePassword(nova);
    await window.fsSave('usuarios', _pendingLoginUser.id, { precisaTrocarSenha: false });
    const u = { ..._pendingLoginUser, precisaTrocarSenha: false };
    _pendingLoginUser = null;
    document.getElementById('troca-senha-nova').value='';
    document.getElementById('troca-senha-confirma').value='';
    finalizarLogin(u);
  } catch (e) {
    errEl.textContent = 'Falha ao trocar a senha: ' + (e.message || e.code || 'tente novamente.');
    errEl.style.display='block';
  }
}

// Backfill: garante que todo doc de "usuarios" tenha o correspondente em
// "logins" (login->email/uid) — necessário para contas criadas fora do app
// (ex.: direto no console do Firebase). Só cria o que estiver AUSENTE, nunca
// sobrescreve nem duplica quem já existe. Escrita em "logins" exige admin
// (regra do Firestore), por isso só roda para quem já está logado como admin.
async function criarLoginsFaltantes() {
  if (currentUser()?.perfil !== 'admin') return;
  if (!window.FirestoreStorage) return;
  try {
    const usuariosRes = await window.FirestoreStorage.listarColecao('usuarios');
    const loginsRes = await window.FirestoreStorage.listarColecao('logins');
    if (!usuariosRes.ok || !loginsRes.ok) return;
    const loginsExistentes = new Set(loginsRes.data.items.map(d => d.id));
    for (const u of usuariosRes.data.items) {
      if (u.migrado) continue; // doc antigo já substituído, não precisa de login
      const login = (u.login || '').trim().toLowerCase();
      if (!login || !u.email || loginsExistentes.has(login)) continue;
      await window.fsSave('logins', login, { email: u.email, uid: u.id });
    }
  } catch (e) {
    console.warn('[Usuarios] criarLoginsFaltantes falhou:', e.message);
  }
}

async function doLogout() {
  audit('logout', `Logout: ${currentUser()?.login||''}`, '');
  try { await window.fbSignOut(); } catch(e) {}
  if (typeof window.fsStopRealtime === 'function') window.fsStopRealtime();
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
      <td style="font-weight:600;color:var(--text)">${_escHtml(usr.nome)}</td>
      <td class="td-num">${_escHtml(usr.login)}</td>
      <td style="color:var(--text2)">${_escHtml(usr.cargo)||'—'}</td>
      <td><span class="badge badge-neutral">${PERFIL_LABEL[usr.perfil]||usr.perfil}</span></td>
      <td style="color:var(--text3);font-size:11px">${_escHtml(usr.email)||'—'}</td>
      <td><span class="badge ${usr.status==='Ativo'?'badge-green':'badge-red'}">${usr.status}</span></td>
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
  document.getElementById('u-senha').style.display='block';
  document.getElementById('u-senha-req').style.display='inline';
  document.getElementById('u-senha-reset-btn').style.display='none';
  document.getElementById('u-email').value='';
  document.getElementById('u-email').disabled=false;
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

async function salvarUsuario() {
  // Só administrador pode salvar (mesma regra que já restringe o acesso à
  // tela inteira em renderUsuarios() — checagem redundante aqui por segurança).
  if (currentUser()?.perfil !== 'admin') { showToast('Apenas administradores podem salvar usuários.'); return; }

  const nome  = document.getElementById('u-nome').value.trim();
  const login = document.getElementById('u-login').value.trim().toLowerCase();
  const email = document.getElementById('u-email').value.trim();
  const senha = document.getElementById('u-senha').value; // só existe/é usado na criação
  const perfil= document.getElementById('u-perfil').value;
  const id = document.getElementById('u-id').value;
  if(!nome||!login||!email||(!id&&!senha)) { showToast('Nome, login, e-mail e senha são obrigatórios'); return; }
  if(!id && senha.length<6) { showToast('A senha deve ter no mínimo 6 caracteres'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('E-mail inválido'); return; }
  if(!['admin','supervisor','tecnico','visualizador'].includes(perfil)) { showToast('Perfil inválido'); return; }

  const users = getUsers();
  if (users.some(u => u.login.toLowerCase()===login && u.id!==id)) {
    showToast('Já existe um usuário com esse login'); return;
  }
  const perms = [...document.querySelectorAll('#perms-grid input[type=checkbox]:checked')].map(cb=>cb.value);
  const userData = {nome,login,email,
    cargo:document.getElementById('u-cargo').value,
    perfil,status:document.getElementById('u-status').value,
    perms: perms.length ? perms : null};

  if (id) {
    const antigo = users.find(u=>u.id===id);
    const idx = users.findIndex(u=>u.id===id);
    if(idx>=0) users[idx] = {...users[idx],...userData};
    saveUsers(users);
    // Aguarda e confere esse fsSave (antes era "solta e esquece"): se falhar,
    // o usuário fica sem conseguir entrar digitando o login (só por e-mail),
    // sem ninguém perceber — achado C3 do relatório técnico de 29/07/2026.
    const loginSync = await window.fsSave('logins', login, { email, uid:id }); // garante logins/{login} criado/atualizado sempre
    if (antigo && antigo.login !== login) {
      window.FirestoreStorage?.excluirDocumento('logins', antigo.login);
    }
    audit('editou', `Usuário ${login} atualizado`, '');
    fecharFormUsuario();
    renderUsuarios();
    if (loginSync?.ok) {
      showToast('Usuário atualizado!');
    } else {
      showToast('⚠ Usuário atualizado, mas o login pode não sincronizar — tente salvar de novo em instantes.');
      audit('erro_sync', `Falha ao sincronizar logins/${login} (uid ${id}) ao editar usuário — ${loginSync?.error||'erro desconhecido'}`, '');
    }
    return;
  }

  // Criação: o Firebase Auth precisa da conta antes de gravar o doc no Firestore
  // (o id do usuário passa a ser o UID gerado pelo Auth).
  let uid;
  try {
    uid = await window.fbCreateAuthUser(email, senha);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') showToast('Este e-mail já está cadastrado.');
    else showToast('Falha ao criar a conta: ' + (e.message || e.code || 'erro desconhecido'));
    return;
  }
  const criador = currentUser();
  const extras = { criadoPor: criador?.nome || criador?.login || 'Sistema', criadoEm: new Date().toISOString() };
  users.push({id:uid, ...userData, ...extras});
  saveUsers(users);
  // Aguarda e confere os dois fsSave que fecham a conta nova (perfil + mapa
  // de login) — antes eram "solta e esquece": se a rede caísse bem aqui, a
  // conta do Firebase Auth ficava criada mas sem contraparte no Firestore, e
  // o toast de sucesso aparecia do mesmo jeito, sem avisar ninguém (achado
  // C3 do relatório técnico de 29/07/2026).
  const [criouPerfil, criouLogin] = await Promise.all([
    window.fsSave('usuarios', uid, { ...userData, ...extras }),
    window.fsSave('logins', login, { email, uid }),
  ]);
  audit('editou', `Usuário ${login} cadastrado`, '');
  fecharFormUsuario();
  renderUsuarios();
  if (criouPerfil?.ok && criouLogin?.ok) {
    showToast('Usuário cadastrado com sucesso!');
  } else {
    showToast('⚠ Conta criada, mas não sincronizou por completo com o Firestore — abra "Editar" neste usuário para tentar de novo.');
    audit('erro_sync', `Sincronização incompleta ao cadastrar ${login} (uid ${uid}): usuarios.ok=${!!criouPerfil?.ok} logins.ok=${!!criouLogin?.ok}`, '');
  }
}

async function enviarResetSenhaUsuario() {
  const id = document.getElementById('u-id').value;
  const u = getUsers().find(x=>x.id===id);
  if (!u || !u.email) { showToast('Usuário sem e-mail cadastrado.'); return; }
  try {
    await window.fbSendPasswordReset(u.email);
    showToast('Link de redefinição enviado para ' + u.email);
  } catch (e) {
    showToast('Falha ao enviar e-mail de redefinição.');
  }
}

function editarUsuario(id) {
  const u = getUsers().find(u=>u.id===id);
  if(!u) return;
  document.getElementById('u-id').value=u.id;
  document.getElementById('u-nome').value=u.nome;
  document.getElementById('u-login').value=u.login;
  // Senha não é gerenciada aqui: Firebase Auth guarda a senha, o admin não
  // consegue trocá-la diretamente (sem Admin SDK) — só enviar um link de reset.
  document.getElementById('u-senha').style.display='none';
  document.getElementById('u-senha-req').style.display='none';
  document.getElementById('u-senha-reset-btn').style.display='inline-flex';
  document.getElementById('u-email').value=u.email||'';
  document.getElementById('u-email').disabled=true; // trocar e-mail exige Admin SDK, fica fixo após criado
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

function renderPermsGrid(selectedPerms) {
  const grid = document.getElementById('perms-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(ALL_PERMS).map(([key,label])=>`
    <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;color:var(--text2)">
      <input type="checkbox" value="${key}" ${(selectedPerms||[]).includes(key)?'checked':''} style="accent-color:var(--accent);width:14px;height:14px">
      ${label}
    </label>`).join('');
}

function aplicarPerfilPerms() {
  const perfil = document.getElementById('u-perfil')?.value || 'tecnico';
  renderPermsGrid(PERFIL_PERMS[perfil] || []);
}
