#!/usr/bin/env node
'use strict';

// Remove documentos de `chamados` sem conteúdo (sem número, título,
// equipamento e solicitante) — aparecem na tela como um card em branco
// ("Sem equipamento vinculado", "Não iniciado", "Sem responsável").
// Guarda cópia em _backup_exclusao/{id} antes de apagar. Simula por padrão;
// apaga só com APLICAR=1.

const PROJECT_ID = 'chamdos-sc';
const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

async function main() {
  const admin = require('firebase-admin');
  const aplicar = process.env.APLICAR === '1';
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  const db = admin.firestore();
  console.log(`Modo: ${aplicar ? 'APLICAR (apaga)' : 'SIMULAÇÃO (não apaga nada)'}`);

  const snap = await db.collection('chamados').get();
  const alvos = snap.docs.filter((d) => {
    const c = d.data();
    return vazio(c.num) && vazio(c.titulo) && vazio(c.equipCodigo) && vazio(c.solicitante);
  });
  console.log(`Chamados lidos: ${snap.size} | vazios: ${alvos.length}`);
  for (const d of alvos) console.log(`  doc "${d.id}" · campos: ${Object.keys(d.data()).sort().join(', ') || '(nenhum)'}`);
  if (!aplicar) {
    console.log('Simulação concluída. Nada foi apagado.');
    return;
  }
  for (const d of alvos) {
    const lote = db.batch();
    lote.set(db.collection('_backup_exclusao').doc(`chamados__${d.id}`), { colecao: 'chamados', docId: d.id, dados: d.data(), em: admin.firestore.FieldValue.serverTimestamp() });
    lote.delete(d.ref);
    await lote.commit();
    console.log(`apagado: "${d.id}" (cópia em _backup_exclusao/chamados__${d.id})`);
  }
  console.log(`Apagados: ${alvos.length}`);
}

main().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exitCode = 1;
});
