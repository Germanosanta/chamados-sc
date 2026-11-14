#!/usr/bin/env node
'use strict';

// Publica firestore.rules pela API do Firebase Rules (sem a CLI, que exige
// serviceusage.services.get e falha com a conta de serviço do deploy).
// 1) valida a compilação; 2) cria o ruleset; 3) aponta o release
// cloud.firestore para ele. Sem dependências. Nunca imprime credenciais.
//
// Uso: GOOGLE_APPLICATION_CREDENTIALS=<sa.json> node scripts/publicar-regras-firestore.js firestore.rules

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const PROJETO = 'chamdos-sc';

function requisitar(metodo, url, corpo, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const dados = corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (dados !== undefined) {
      headers['Content-Type'] = typeof corpo === 'string' ? 'application/x-www-form-urlencoded' : 'application/json';
      headers['Content-Length'] = Buffer.byteLength(dados);
    }
    const req = https.request({ host: u.host, path: u.pathname + u.search, method: metodo, headers }, (res) => {
      let r = '';
      res.on('data', (c) => (r += c));
      res.on('end', () => {
        let j = {};
        try { j = r ? JSON.parse(r) : {}; } catch { j = { bruto: r }; }
        if (res.statusCode >= 300) reject(new Error(`${metodo} ${u.pathname} → HTTP ${res.statusCode}: ${(j.error && j.error.message) || r.slice(0, 300)}`));
        else resolve(j);
      });
    });
    req.on('error', reject);
    if (dados !== undefined) req.write(dados);
    req.end();
  });
}

async function token(sa) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  })}`;
  const jwt = `${corpo}.${crypto.createSign('RSA-SHA256').update(corpo).sign(sa.private_key, 'base64url')}`;
  const r = await requisitar('POST', 'https://oauth2.googleapis.com/token', `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`);
  return r.access_token;
}

async function main() {
  const arquivo = process.argv[2] || 'firestore.rules';
  const sa = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  console.log(`Conta: ${sa.client_email}`);
  const source = { files: [{ name: 'firestore.rules', content: fs.readFileSync(arquivo, 'utf8') }] };
  const t = await token(sa);
  const base = `https://firebaserules.googleapis.com/v1/projects/${PROJETO}`;

  const atual = await requisitar('GET', `${base}/releases/cloud.firestore`, undefined, t);
  console.log(`Release atual: ${atual.rulesetName} (${atual.updateTime})`);

  const teste = await requisitar('POST', `${base}:test`, { source }, t);
  const erros = (teste.issues || []).filter((i) => i.severity === 'ERROR');
  (teste.issues || []).forEach((i) => console.log(`${i.severity}: linha ${i.sourcePosition && i.sourcePosition.line}: ${i.description}`));
  if (erros.length) throw new Error(`${erros.length} erro(s) de compilação; nada foi publicado`);
  console.log('Compilação: ok');

  const ruleset = await requisitar('POST', `${base}/rulesets`, { source }, t);
  console.log(`Ruleset criado: ${ruleset.name}`);
  const release = await requisitar('PATCH', `${base}/releases/cloud.firestore`, { release: { name: `projects/${PROJETO}/releases/cloud.firestore`, rulesetName: ruleset.name } }, t);
  console.log(`Publicado: release ${release.name} → ${release.rulesetName} (${release.updateTime})`);
  console.log(`Para desfazer, aponte o release de volta para: ${atual.rulesetName}`);
}

main().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exitCode = 1;
});
