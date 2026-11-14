#!/usr/bin/env node
'use strict';

// ══════════════════════════════════════════════════════════════
// Correção ÚNICA: renumera os chamados que ficaram fora da sequência.
//
// A V2 numerava pela contagem de registros e, depois da recuperação de
// frotas de agosto/2026 (que criou ~2.600 documentos de ajuste em
// `chamados`), passou a gerar números na faixa 5xxx/6xxx. A V3 seguia em
// 32xx. Os chamados abertos depois desse salto com número abaixo de 5000
// ficaram fora de ordem e recebem aqui um número novo, no fim da sequência,
// na ordem em que foram abertos.
//
// Alvo: número entre 3156 (fim do histórico estático) e 4999, aberto a
// partir do primeiro chamado 5xxx. Chamados 3156+ abertos antes do salto
// estavam na sequência da época e ficam como estão.
//
// Para cada chamado: guarda a cópia original em _backup_renumeracao/{antigo},
// cria chamados/{novo} (com numAnterior) e historico/{novo}, apaga os
// antigos, e depois atualiza as referências em auditoria, movimentacoes e
// acompanhamento_publico. Pode ser rodado de novo: chamados já movidos não
// entram no alvo, e as referências pendentes são refeitas a partir dos
// backups.
//
// Por padrão só SIMULA. Grava apenas com APLICAR=1. Os logs mostram só
// números e datas (o repositório é público).
// ══════════════════════════════════════════════════════════════

const PROJECT_ID = 'chamdos-sc';
const FIM_HISTORICO = 3155;
const INICIO_FAIXA_NOVA = 5000;

function numero(num) {
  const m = /^CHM-(\d{1,6})$/.exec(num || '');
  return m ? Number(m[1]) : null;
}

function formatar(n) {
  return `CHM-${String(n).padStart(4, '0')}`;
}

function abertura(c) {
  return c.dataHoraISO || c.data || '';
}

/**
 * Decide quem renumerar e para qual número. `inicio` é o primeiro número
 * livre; o bloco reservado no contador é [inicio, inicio + alvo - 1].
 */
function planejar(chamados, inicio) {
  const altos = chamados.filter((c) => numero(c.num) >= INICIO_FAIXA_NOVA && abertura(c));
  if (!altos.length) throw new Error(`nenhum chamado ${INICIO_FAIXA_NOVA}+ com data de abertura; nada a comparar`);
  const corte = altos.map(abertura).sort()[0];

  const naFaixa = chamados.filter((c) => {
    const n = numero(c.num);
    return n !== null && n > FIM_HISTORICO && n < INICIO_FAIXA_NOVA;
  });
  const semData = naFaixa.filter((c) => !abertura(c)).map((c) => c.num);
  const alvo = naFaixa
    .filter((c) => abertura(c) && abertura(c) >= corte)
    .sort((a, b) => abertura(a).localeCompare(abertura(b)) || numero(a.num) - numero(b.num));

  return {
    corte,
    semData,
    mantidos: naFaixa.length - alvo.length - semData.length,
    mapa: alvo.map((c, i) => ({ antigo: c.num, novo: formatar(inicio + i), abertura: abertura(c) })),
  };
}

function maiorNumero(chamados) {
  return chamados.reduce((maior, c) => Math.max(maior, numero(c.num) || 0), 0);
}

async function atualizarReferencias(db, antigo, novo, token) {
  let total = 0;
  for (const col of ['auditoria', 'movimentacoes']) {
    const snap = await db.collection(col).where('chamado', '==', antigo).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const lote = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => lote.update(d.ref, { chamado: novo }));
      await lote.commit();
    }
    total += snap.size;
  }
  if (token) {
    const ref = db.collection('acompanhamento_publico').doc(token);
    if ((await ref.get()).exists) {
      await ref.update({ num: novo });
      total += 1;
    }
  }
  return total;
}

async function main() {
  const admin = require('firebase-admin');
  const aplicar = process.env.APLICAR === '1';
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  const db = admin.firestore();
  console.log(`Modo: ${aplicar ? 'APLICAR (grava no Firestore)' : 'SIMULAÇÃO (não grava nada)'}`);

  // Referências pendentes de uma execução anterior interrompida.
  const backups = await db.collection('_backup_renumeracao').get();
  if (aplicar && backups.size) {
    let refs = 0;
    for (const b of backups.docs) {
      const { novoNum, chamado } = b.data();
      refs += await atualizarReferencias(db, b.id, novoNum, chamado && chamado.tokenPublico);
    }
    console.log(`Referências pendentes refeitas: ${refs} (de ${backups.size} chamados já movidos)`);
  }

  const snap = await db.collection('chamados').get();
  const chamados = snap.docs.map((d) => ({ ...d.data(), num: d.id }));
  const contadorRef = db.collection('configuracoes').doc('contadorChamados');
  const contador = ((await contadorRef.get()).data() || {}).ultimoNumero || 0;
  const previa = planejar(chamados, Math.max(contador, maiorNumero(chamados)) + 1);

  console.log(`Chamados lidos: ${chamados.length} | maior número: ${formatar(maiorNumero(chamados))} | contador: ${contador}`);
  console.log(`Primeiro chamado 5xxx aberto em: ${previa.corte}`);
  console.log(`Faixa 3156-4999 abertos antes disso (mantidos): ${previa.mantidos}`);
  console.log(`Sem data de abertura (não mexidos): ${previa.semData.length}${previa.semData.length ? ` (${previa.semData.join(', ')})` : ''}`);
  console.log(`A renumerar: ${previa.mapa.length}`);
  previa.mapa.forEach((m) => console.log(`  ${m.antigo} -> ${m.novo}  (aberto ${m.abertura.slice(0, 16)})`));

  if (!aplicar) {
    console.log('Simulação concluída. Nada foi gravado. Os números finais podem avançar se outro chamado for aberto antes de aplicar.');
    return;
  }
  if (!previa.mapa.length) return;

  // Reserva o bloco no contador antes de mover: a V3 passa a numerar depois dele.
  const inicio = await db.runTransaction(async (tx) => {
    const atual = ((await tx.get(contadorRef)).data() || {}).ultimoNumero || 0;
    const primeiro = Math.max(atual, maiorNumero(chamados)) + 1;
    tx.set(contadorRef, { ultimoNumero: primeiro + previa.mapa.length - 1, _updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return primeiro;
  });
  const { mapa } = planejar(chamados, inicio);

  let movidos = 0;
  let refs = 0;
  for (const m of mapa) {
    const antigoRef = db.collection('chamados').doc(m.antigo);
    const histAntigoRef = db.collection('historico').doc(m.antigo);
    const [cSnap, hSnap] = await Promise.all([antigoRef.get(), histAntigoRef.get()]);
    if (!cSnap.exists) {
      console.log(`${m.antigo}: não existe mais, ignorado`);
      continue;
    }
    const agora = admin.firestore.FieldValue.serverTimestamp();
    const lote = db.batch();
    lote.create(db.collection('_backup_renumeracao').doc(m.antigo), {
      novoNum: m.novo,
      chamado: cSnap.data(),
      historico: hSnap.exists ? hSnap.data() : null,
      em: agora,
    });
    lote.create(db.collection('chamados').doc(m.novo), { ...cSnap.data(), num: m.novo, numAnterior: m.antigo, _updatedAt: agora });
    if (hSnap.exists) {
      lote.create(db.collection('historico').doc(m.novo), { ...hSnap.data(), num: m.novo, _updatedAt: agora });
      lote.delete(histAntigoRef);
    }
    lote.delete(antigoRef);
    await lote.commit();

    refs += await atualizarReferencias(db, m.antigo, m.novo, cSnap.data().tokenPublico);
    await db.collection('auditoria').doc(`log_${Date.now()}_${m.antigo}`).set({
      ts: new Date().toISOString(),
      tipo: 'renumerou',
      usuario: 'Sistema',
      login: '',
      detalhe: `Chamado ${m.antigo} renumerado para ${m.novo} (correção de sequência)`,
      chamado: m.novo,
    });
    movidos += 1;
    console.log(`${m.antigo} -> ${m.novo} ok`);
  }
  console.log(`Renumerados: ${movidos} | referências atualizadas: ${refs}`);
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(`Erro: ${erro.message}`);
    process.exitCode = 1;
  });
}

module.exports = { planejar, maiorNumero, numero };
