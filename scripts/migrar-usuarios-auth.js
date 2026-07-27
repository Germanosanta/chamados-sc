#!/usr/bin/env node
'use strict';

// ══════════════════════════════════════════════════════════════
// Migração ÚNICA: usuários existentes na coleção "usuarios" (sem Firebase
// Auth por trás, senha nunca esteve no Firestore) → contas reais no Firebase
// Authentication + Firestore usuarios/{uid}, preservando login/perfil/cargo/
// status/perms de cada um. Os vínculos com chamados/historico/auditoria/
// movimentacoes/tecnicos são por nome/login (string), não pelo id do doc
// usuarios — continuam intactos, nada nessas coleções é tocado aqui.
//
// NÃO APAGA NADA: os documentos antigos permanecem no lugar, só marcados com
// { migrado:true, migradoParaUid }.
//
// IDEMPOTENTE de verdade: se o script for interrompido no meio (queda de
// rede, processo morto, etc.) e rodado de novo, cada usuário é resolvido
// assim:
//   - já tem { migrado:true } no doc antigo           → pula (já concluído).
//   - já existe logins/{login} ligado a ESTE MESMO doc antigo (migradoDeId)
//     mas o doc antigo não chegou a ser marcado         → retoma (reaproveita
//     o uid, define uma senha temporária NOVA e conhecida, regrava tudo).
//   - já existe logins/{login} ligado a OUTRO doc       → não mexe em nada,
//     reporta como erro para resolver manualmente (evita roubar o login de
//     um usuário já migrado).
//
// Nunca adivinha perfil/status: se um doc não tiver "login", "perfil" válido
// (admin/supervisor/tecnico/visualizador) ou "status" válido (Ativo/Inativo),
// o usuário é PULADO e reportado — nunca migrado com um valor default, para
// não arriscar alterar permissões de ninguém.
//
// Cada usuário migrado recebe uma SENHA TEMPORÁRIA (aleatória) e a flag
// precisaTrocarSenha:true — o app já força a troca no primeiro login (ver
// docs/js/modules/usuarios/index.js).
//
// Uso:
//   cd scripts && npm install
//   GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/chamdos-sc-firebase-adminsdk-....json" \
//   node migrar-usuarios-auth.js
//
// Variáveis de ambiente opcionais:
//   EMAIL_FALLBACK_DOMAIN — domínio usado quando o usuário não tem e-mail
//                           válido cadastrado hoje (padrão: santacolomba.com.br).
//                           Firebase Auth EXIGE e-mail único por conta; quem
//                           cair nesse caso fica marcado no relatório final
//                           para você revisar o e-mail depois (Firebase
//                           Console → Authentication → editar e-mail, e
//                           atualizar usuarios/{uid}.email + logins/{login}
//                           no Firestore para bater).
// ══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '..', '..', 'chamdos-sc-firebase-adminsdk-fbsvc-7684e96e88.json');
const EMAIL_FALLBACK_DOMAIN = process.env.EMAIL_FALLBACK_DOMAIN || 'santacolomba.com.br';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERFIS_VALIDOS = ['admin', 'supervisor', 'tecnico', 'visualizador'];
const STATUS_VALIDOS = ['Ativo', 'Inativo'];

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Chave de serviço não encontrada em: ${SERVICE_ACCOUNT_PATH}`);
  console.error('Aponte o caminho correto via a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});
const db = admin.firestore();
const auth = admin.auth();

function gerarSenhaTemporaria() {
  // ~14 caracteres, alfanumérico (base64url) + 1 símbolo — só usada uma vez,
  // a troca é forçada no 1º acesso (precisaTrocarSenha).
  const base = crypto.randomBytes(9).toString('base64')
    .replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
  return base + '!9';
}

async function migrarUsuario(doc) {
  const data = doc.data();
  const login = (data.login || '').trim().toLowerCase();
  if (!login) {
    console.warn(`[PULADO] doc ${doc.id} sem campo "login" — não dá pra migrar.`);
    return { status: 'pulado', motivo: 'sem login', docId: doc.id };
  }
  if (!PERFIS_VALIDOS.includes(data.perfil)) {
    console.warn(`[PULADO] ${login}: perfil ausente/inválido ("${data.perfil}") — não migrado para não arriscar alterar permissões. Corrija o doc e rode de novo.`);
    return { status: 'pulado', motivo: `perfil inválido: ${data.perfil}`, login, docId: doc.id };
  }
  if (!STATUS_VALIDOS.includes(data.status)) {
    console.warn(`[PULADO] ${login}: status ausente/inválido ("${data.status}") — não migrado.`);
    return { status: 'pulado', motivo: `status inválido: ${data.status}`, login, docId: doc.id };
  }

  let email = (data.email || '').trim();
  let emailSintetico = false;
  if (!EMAIL_RE.test(email)) {
    email = `${login}@${EMAIL_FALLBACK_DOMAIN}`;
    emailSintetico = true;
  }

  // Idempotência real: se já existe logins/{login} apontando para um uid cujo
  // doc usuarios/{uid} tem migradoDeId===doc.id, é retomada de uma execução
  // anterior interrompida — reaproveita o uid em vez de tentar criar de novo
  // (o que quebraria com auth/email-already-exists). Se o login já pertence a
  // OUTRO usuário, é colisão genuína — não mexe, reporta erro.
  let uid = null;
  const loginDocExistente = await db.collection('logins').doc(login).get();
  if (loginDocExistente.exists && loginDocExistente.data().uid) {
    const uidExistente = loginDocExistente.data().uid;
    const usuarioExistente = await db.collection('usuarios').doc(uidExistente).get();
    if (usuarioExistente.exists && usuarioExistente.data().migradoDeId === doc.id) {
      uid = uidExistente; // retomando execução anterior interrompida
    } else {
      console.error(`[ERRO] ${login}: já existe logins/${login} apontando para outro usuário (uid ${uidExistente}) — colisão de login, resolver manualmente.`);
      return { status: 'erro', motivo: 'login duplicado (colisão com outro usuário)', login, docId: doc.id };
    }
  }

  const senhaTemporaria = gerarSenhaTemporaria();

  try {
    if (uid) {
      // Retomada: garante uma senha temporária NOVA e conhecida — a da
      // tentativa anterior pode ter se perdido se o script caiu antes de
      // gravar o relatório.
      await auth.updateUser(uid, { email, password: senhaTemporaria });
    } else {
      const userRecord = await auth.createUser({ email, password: senhaTemporaria, displayName: data.nome || login });
      uid = userRecord.uid;
    }
  } catch (e) {
    console.error(`[ERRO] ${login} (${email}): ${e.code || e.message}`);
    return { status: 'erro', motivo: e.code || e.message, login, email, docId: doc.id };
  }

  const novoDado = {
    nome: data.nome || login,
    login,
    email,
    cargo: data.cargo || '',
    perfil: data.perfil,   // nunca default — já validado acima
    status: data.status,   // nunca default — já validado acima
    perms: data.perms ?? null,
    criadoPor: data.criadoPor || 'Migração Firebase Auth',
    criadoEm: data.criadoEm || new Date().toISOString(),
    precisaTrocarSenha: true,
    migradoDeId: doc.id,
  };

  await db.collection('usuarios').doc(uid).set(novoDado);
  await db.collection('logins').doc(login).set({ email, uid });
  await doc.ref.update({ migrado: true, migradoParaUid: uid }); // doc antigo preservado, só marcado

  console.log(`[OK] ${login} → uid ${uid}${emailSintetico ? '  (e-mail sintético — revisar!)' : ''}`);
  return { status: 'ok', login, nome: novoDado.nome, email, emailSintetico, senhaTemporaria, uid, docId: doc.id };
}

async function main() {
  console.log(`Usando chave de serviço: ${SERVICE_ACCOUNT_PATH}`);
  console.log('Lendo coleção "usuarios"...');
  const snap = await db.collection('usuarios').get();
  console.log(`${snap.size} documento(s) encontrado(s).\n`);

  // CSV gravado incrementalmente (append a cada usuário migrado) — se o
  // script cair no meio, as senhas já geradas até ali não se perdem (o doc
  // antigo correspondente já estaria marcado migrado:true e não entraria
  // mais no relatório de uma execução seguinte).
  const outPath = path.join(__dirname, `senhas-temporarias-${Date.now()}.csv`);
  fs.writeFileSync(outPath, 'login,nome,email,senha_temporaria,email_sintetico\n', 'utf8');

  const resultados = [];
  for (const doc of snap.docs) {
    if (doc.data().migrado === true) {
      console.log(`[JÁ MIGRADO] ${doc.id} → uid ${doc.data().migradoParaUid} — pulando.`);
      continue;
    }
    const r = await migrarUsuario(doc);
    resultados.push(r);
    if (r.status === 'ok') {
      const linha = [r.login, r.nome, r.email, r.senhaTemporaria, r.emailSintetico ? 'sim' : 'nao']
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      fs.appendFileSync(outPath, linha + '\n', 'utf8');
    }
  }

  const ok = resultados.filter(r => r.status === 'ok');
  const pulados = resultados.filter(r => r.status === 'pulado');
  const erros = resultados.filter(r => r.status === 'erro');
  const sinteticos = ok.filter(r => r.emailSintetico);

  console.log('\n──────── Resumo ────────');
  console.log(`Migrados com sucesso: ${ok.length}`);
  console.log(`Pulados:              ${pulados.length}`);
  console.log(`Falharam:             ${erros.length}`);
  console.log(`E-mails sintéticos (revisar manualmente): ${sinteticos.length}`);
  if (pulados.length) {
    console.log('\nPulados (corrija o doc no Firestore e rode de novo — idempotente):');
    pulados.forEach(p => console.log(`  - ${p.login || p.docId}: ${p.motivo}`));
  }
  if (erros.length) {
    console.log('\nFalharam (resolver manualmente):');
    erros.forEach(e => console.log(`  - ${e.login || e.docId}: ${e.motivo}`));
  }
  if (ok.length) {
    console.log(`\nSenhas temporárias em: ${outPath}`);
    console.log('⚠ Esse arquivo tem senhas em texto puro. Distribua com cuidado (1 a 1, por canal');
    console.log('  seguro) e APAGUE o arquivo depois. Nunca faça commit dele (já está no .gitignore).');
  }

  const incompleto = pulados.length + erros.length;
  console.log(incompleto
    ? `\n⚠ MIGRAÇÃO INCOMPLETA: ${incompleto} usuário(s) não migrado(s) nesta execução. Corrija e rode de novo (idempotente).`
    : '\n✓ Todos os usuários da coleção foram migrados.');

  process.exit(incompleto ? 1 : 0);
}

main().catch(e => { console.error('Falha geral na migração:', e); process.exit(1); });
