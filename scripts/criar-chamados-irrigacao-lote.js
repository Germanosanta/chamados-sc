#!/usr/bin/env node
'use strict';

// Abre chamados de irrigação em lote a partir de scripts/dados/lote-*.json,
// com o mesmo formato e a mesma numeração (IRR-xxxx, contador
// irrigacao_config/contador, em transação) da abertura pela tela. Cada
// equipamento vem do cadastro (v3/src/data/irrigacao_ativos.json) com as
// plataformas definidas na tela de configurações. Não duplica: item já
// aberto neste lote (loteId + loteItem) é pulado. Simula por padrão;
// grava só com APLICAR=1.
//
// Uso: GOOGLE_APPLICATION_CREDENTIALS=<sa.json> [APLICAR=1] node criar-chamados-irrigacao-lote.js dados/lote-x.json

const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'chamdos-sc';
const STATUS_LABEL_EM_ATENDIMENTO = 'Aguardando atendimento';
const formatar = (n) => `IRR-${String(n).padStart(4, '0')}`;

async function main() {
  const arquivo = path.resolve(__dirname, process.argv[2] || '');
  const lote = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const { ativos } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'v3', 'src', 'data', 'irrigacao_ativos.json'), 'utf8'));
  const aplicar = process.env.APLICAR === '1';

  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  const db = admin.firestore();
  console.log(`Modo: ${aplicar ? 'APLICAR (grava no Firestore)' : 'SIMULAÇÃO (não grava nada)'} | lote ${lote.lote} | ${lote.itens.length} itens`);

  const geral = (await db.collection('irrigacao_config').doc('geral').get()).data() || {};
  const plataformas = geral.plataformas || {};
  const tipos = geral.tiposFalha && geral.tiposFalha.length ? geral.tiposFalha : null;
  const jaAbertos = await db.collection('irrigacao_chamados').where('loteId', '==', lote.lote).get();
  const itensAbertos = new Map(jaAbertos.docs.map((d) => [d.data().loteItem, d.id]));

  const planos = lote.itens.map((item, i) => {
    const candidatos = ativos.filter((a) => a.nome === item.ativo && a.fazenda === item.fazenda);
    if (candidatos.length !== 1) throw new Error(`item ${i + 1} "${item.texto}": ${candidatos.length} equipamentos "${item.ativo}" em ${item.fazenda}`);
    if (tipos && !tipos.includes(item.tipoFalha)) throw new Error(`item ${i + 1}: tipo de falha "${item.tipoFalha}" não está nos tipos configurados`);
    const ativo = candidatos[0];
    const plataforma = ativo.id in plataformas ? plataformas[ativo.id] || null : ativo.plataforma || null;
    return { i: i + 1, item, ativo, plataforma, existente: itensAbertos.get(i + 1) };
  });

  for (const p of planos) {
    console.log(
      `${String(p.i).padStart(2)}. ${p.existente ? `já aberto (${p.existente}), pulado` : 'abrir'} · ${p.ativo.nome} · ${p.ativo.fazenda} · ${p.ativo.modulo || 'sem módulo'} · ${p.plataforma || 'sem plataforma'} · ${p.item.tipoFalha} · "${p.item.texto}"`,
    );
  }
  if (!aplicar) {
    console.log('Simulação concluída. Nada foi gravado.');
    return;
  }

  const contadorRef = db.collection('irrigacao_config').doc('contador');
  let abertos = 0;
  for (const p of planos.filter((x) => !x.existente)) {
    const agora = new Date().toISOString();
    const num = await db.runTransaction(async (tx) => {
      const snap = await tx.get(contadorRef);
      let n = ((snap.data() || {}).ultimoNumero || 0) + 1;
      while ((await tx.get(db.collection('irrigacao_chamados').doc(formatar(n)))).exists) n += 1;
      const numero = formatar(n);
      tx.set(contadorRef, { ultimoNumero: n, _updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      tx.create(db.collection('irrigacao_chamados').doc(numero), {
        num: numero,
        ativoId: p.ativo.id,
        ativoNome: p.ativo.nome,
        ativoTipo: p.ativo.tipo,
        fazenda: p.ativo.fazenda,
        modulo: p.ativo.modulo || '',
        casaBombas: p.ativo.tipo === 'pivo' ? p.ativo.casaBombas || '' : p.ativo.tipo === 'casa_bombas' ? p.ativo.nome : '',
        local: p.ativo.local || '',
        plataforma: p.plataforma,
        tipoFalha: p.item.tipoFalha,
        identificadoEm: agora,
        descricao: `${p.item.texto}\n\nAberto em lote a pedido da operação (${lote.lote}).`,
        prioridade: lote.prioridade || 'Alta',
        abertoPor: 'Abertura em lote',
        abertoPorUid: '',
        abertoEm: agora,
        status: 'aguardando',
        materiais: [],
        qtdFotos: 0,
        loteId: lote.lote,
        loteItem: p.i,
        eventos: [{ ts: agora, tipo: 'abertura', autor: 'Abertura em lote', detalhe: `${p.item.tipoFalha} · ${p.ativo.nome}` }],
        _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return numero;
    });
    await db.collection('auditoria').doc(`log_${Date.now()}_${num}`).set({
      ts: new Date().toISOString(),
      tipo: 'abriu',
      usuario: 'Abertura em lote',
      login: '',
      detalhe: `Chamado de irrigação ${num} aberto em lote: ${p.ativo.nome} — ${p.item.texto}`,
      chamado: num,
    });
    abertos += 1;
    console.log(`${num} aberto · ${p.ativo.nome} · "${p.item.texto}" · ${STATUS_LABEL_EM_ATENDIMENTO}`);
  }
  console.log(`Chamados abertos: ${abertos}`);
}

main().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exitCode = 1;
});
