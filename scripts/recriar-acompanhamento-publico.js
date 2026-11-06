#!/usr/bin/env node
'use strict';

// ══════════════════════════════════════════════════════════════
// Correção ÚNICA: recria acompanhamento_publico/{token} dos chamados que têm
// tokenPublico mas ficaram sem espelho. Entre 21/10/2026 e 04/11/2026 as
// regras dessa coleção não estavam publicadas: o app gravava o token no
// chamado, mas a gravação do espelho era negada sem aviso na tela
// (sincronizarAcompanhamentoPublico nunca lança). O link desses chamados
// mostra "Link de acompanhamento inválido".
//
// SÓ CRIA, nunca altera nem apaga: espelho que já existe é mantido, porque o
// app já o atualiza a cada movimentação. Usa create(), que falha em vez de
// sobrescrever se o app criar o mesmo espelho durante a execução.
//
// Por padrão só SIMULA. Grava apenas com APLICAR=1.
//
// Os logs não mostram token nem assunto: o repositório é público e o token é
// o que autoriza a leitura do link.
//
// Uso (normalmente via .github/workflows/recriar-acompanhamento-publico.yml):
//   cd scripts && npm install
//   GOOGLE_APPLICATION_CREDENTIALS="/caminho/da/service-account.json" \
//   [APLICAR=1] node recriar-acompanhamento-publico.js
// ══════════════════════════════════════════════════════════════

const PROJECT_ID = 'chamdos-sc';
const TOKEN_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Espelham chamado-helpers.ts: precisam dar o mesmo status que a V3 mostra.
const isCancelado = (c) => c.status === 'Cancelado';
const isConcluido = (c) => (c.status === 'Encerrado' || c.status === 'Concluída' || !!c.encerramento) && !isCancelado(c);
const isAguardandoPeca = (c) => c.status === 'Aguardando Peça' && !isConcluido(c) && !isCancelado(c);
const isEmAtendimento = (c) =>
  (c.status === 'Em Andamento' || c.status === 'Em Atendimento') && !isCancelado(c) && !isConcluido(c) && !isAguardandoPeca(c);

function fazendaLabel(bucket) {
  if (bucket === 'Solinftec KRT') return 'Karitel';
  if (bucket === 'Solinftec RDM') return 'Rio do Meio';
  return bucket || '—';
}

function statusPublico(c) {
  if (isConcluido(c) || isCancelado(c)) return 'Fechado';
  if (isEmAtendimento(c) || isAguardandoPeca(c)) return 'Em atendimento';
  return 'Aberto';
}

function isoDeTimestamp(valor) {
  return valor && typeof valor.toDate === 'function' ? valor.toDate().toISOString() : '';
}

/**
 * Mesmo conteúdo de montarDadosPublicos() (utils/acompanhamentoPublico.ts),
 * com uma diferença de propósito: atualizadoEm usa a última data conhecida do
 * chamado, não "agora". Senão todo chamado parado apareceria no link como
 * atualizado no dia desta correção.
 */
function montarEspelho(chamado, historico) {
  const encerramento = historico && historico.encerramento ? historico.encerramento : null;
  const c = { ...chamado, encerramento: encerramento || undefined };
  const salvoEm = isoDeTimestamp(chamado._updatedAt);
  const abertoEm = c.dataHoraISO || c.data || salvoEm;
  const encerradoEm = (encerramento && encerramento.encerradoEm) || null;
  const label = fazendaLabel(c.bucket);
  return {
    num: c.num,
    assunto: c.titulo || '(sem título)',
    setor: label !== '—' ? label : c.cultura || '',
    status: statusPublico(c),
    abertoEm,
    atualizadoEm: encerradoEm || salvoEm || abertoEm,
    encerradoEm,
  };
}

/** O Admin SDK ignora firestore.rules: esta é a mesma validação de dadosPublicosValidos(). */
function espelhoValido(d) {
  return (
    typeof d.num === 'string' &&
    d.num.length > 0 &&
    typeof d.assunto === 'string' &&
    typeof d.setor === 'string' &&
    ['Aberto', 'Em atendimento', 'Fechado'].includes(d.status) &&
    typeof d.abertoEm === 'string' &&
    d.abertoEm.length > 0 &&
    typeof d.atualizadoEm === 'string' &&
    (d.encerradoEm === null || typeof d.encerradoEm === 'string')
  );
}

async function main() {
  const admin = require('firebase-admin');
  const aplicar = process.env.APLICAR === '1';

  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  const db = admin.firestore();

  console.log(`Modo: ${aplicar ? 'APLICAR (grava no Firestore)' : 'SIMULAÇÃO (não grava nada)'}`);

  const [chamadosSnap, historicoSnap] = await Promise.all([db.collection('chamados').get(), db.collection('historico').get()]);
  const historicoPorNum = new Map(historicoSnap.docs.map((d) => [d.id, d.data()]));

  const candidatos = [];
  const invalidos = [];
  let semToken = 0;

  for (const doc of chamadosSnap.docs) {
    const chamado = { num: doc.id, ...doc.data() };
    if (!chamado.tokenPublico) {
      semToken += 1;
      continue;
    }
    const espelho = montarEspelho(chamado, historicoPorNum.get(chamado.num));
    if (!TOKEN_VALIDO.test(chamado.tokenPublico) || !espelhoValido(espelho)) {
      invalidos.push(chamado.num);
      continue;
    }
    candidatos.push({ token: chamado.tokenPublico, espelho, ref: db.collection('acompanhamento_publico').doc(chamado.tokenPublico) });
  }

  const existentes = candidatos.length ? await db.getAll(...candidatos.map((c) => c.ref)) : [];
  const faltando = candidatos.filter((_, i) => !existentes[i].exists);

  console.log(`Chamados lidos: ${chamadosSnap.size}`);
  console.log(`Sem token (anteriores ao recurso, ficam sem link): ${semToken}`);
  console.log(`Com espelho, mantidos como estão: ${candidatos.length - faltando.length}`);
  console.log(`Sem espelho, a recriar: ${faltando.length}`);
  console.log(`Ignorados por dado inválido: ${invalidos.length}${invalidos.length ? ` (${invalidos.join(', ')})` : ''}`);
  for (const status of ['Aberto', 'Em atendimento', 'Fechado']) {
    const nums = faltando.filter((f) => f.espelho.status === status).map((f) => f.espelho.num);
    console.log(`  ${status}: ${nums.length}${nums.length ? ` (${nums.join(', ')})` : ''}`);
  }

  if (!aplicar) {
    console.log('Simulação concluída. Nada foi gravado.');
    return;
  }

  let criados = 0;
  let jaCriados = 0;
  const falhas = [];
  for (const item of faltando) {
    try {
      await item.ref.create({ ...item.espelho, _updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      criados += 1;
    } catch (erro) {
      // 6 = ALREADY_EXISTS: o app criou o espelho durante a execução.
      if (erro.code === 6) jaCriados += 1;
      else {
        falhas.push(item.espelho.num);
        console.error(`Falha em ${item.espelho.num}: ${erro.message}`);
      }
    }
  }

  console.log(`Criados: ${criados} | Criados pelo app durante a execução: ${jaCriados} | Falhas: ${falhas.length}`);
  if (falhas.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(`Erro: ${erro.message}`);
    process.exitCode = 1;
  });
}

module.exports = { montarEspelho, espelhoValido, statusPublico };
