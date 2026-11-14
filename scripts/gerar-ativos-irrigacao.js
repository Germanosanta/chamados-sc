#!/usr/bin/env node
'use strict';

// ══════════════════════════════════════════════════════════════
// Gera v3/src/data/irrigacao_ativos.json a partir da planilha original
// "informações pivôs e reservatorios Elavatórias Captacões e Poços.xlsx"
// (OneDrive/Dados Irrigação - Site-APP/base de dados). A planilha não fica
// no repositório: ele é público e ela tem números de contrato de energia e
// links internos do SharePoint.
//
// Abas usadas, sem descartar linhas com dado:
// - "Infor_Pivos": 1 ativo por pivô, ligado à casa de bombas (coluna C).
// - "Infor. Reservatórios e C.Bombas": 1 ativo por reservatório/casa de bombas.
// - "Infor. Cap.. Elev.. e Poços ": 1 ativo por estação (coluna C); as bombas
//   da estação ficam listadas dentro dela, sem virar ativos duplicados.
//
// Colunas fora do bundle (sensíveis, continuam só na planilha): Demanda do
// Contrato, Nº Contrato, Contrato, Energia, Demanda Atual e Endereço do laudo.
//
// Uso: node scripts/gerar-ativos-irrigacao.js "<caminho da planilha.xlsx>"
// Sem dependências: lê o .xlsx com zlib nativo.
// ══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const COLUNAS_SENSIVEIS = new Set([
  'Demanda do Contrato (kWh)',
  'Nº Contrato',
  'Contrato',
  'Energia (kwh)',
  'Demanda Atual',
  'Endereço do laudo',
]);

function lerZip(buffer) {
  const arquivos = {};
  let fim = buffer.length - 22;
  while (fim >= 0 && buffer.readUInt32LE(fim) !== 0x06054b50) fim -= 1;
  if (fim < 0) throw new Error('arquivo não é um .xlsx válido');
  const total = buffer.readUInt16LE(fim + 10);
  let p = buffer.readUInt32LE(fim + 16);
  for (let i = 0; i < total; i += 1) {
    const metodo = buffer.readUInt16LE(p + 10);
    const tamanho = buffer.readUInt32LE(p + 20);
    const nomeLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const comentLen = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nome = buffer.toString('utf8', p + 46, p + 46 + nomeLen);
    const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const bruto = buffer.subarray(inicio, inicio + tamanho);
    arquivos[nome] = metodo === 8 ? zlib.inflateRawSync(bruto) : bruto;
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return arquivos;
}

const xmlTexto = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function lerPlanilha(arquivo) {
  const zip = lerZip(fs.readFileSync(arquivo));
  const txt = (n) => (zip[n] ? zip[n].toString('utf8') : '');
  const compartilhadas = [...txt('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    xmlTexto([...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join('')),
  );
  const rels = txt('xl/_rels/workbook.xml.rels');
  const abas = {};
  for (const m of txt('xl/workbook.xml').matchAll(/<sheet [^>]*?name="([^"]*)"[^>]*?r:id="([^"]*)"/g)) {
    const alvo = new RegExp(`Id="${m[2]}"[^>]*?Target="([^"]*)"`).exec(rels) || new RegExp(`Target="([^"]*)"[^>]*?Id="${m[2]}"`).exec(rels);
    const xml = txt(`xl/${alvo[1].replace(/^\/?xl\//, '')}`);
    abas[xmlTexto(m[1])] = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
      const linha = {};
      for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = /<v>([^<]*)<\/v>/.exec(c[3] || '');
        const inline = /<t[^>]*>([^<]*)<\/t>/.exec(c[3] || '');
        const valor = /t="s"/.test(c[2]) && v ? compartilhadas[Number(v[1])] : v ? xmlTexto(v[1]) : inline ? xmlTexto(inline[1]) : '';
        if (String(valor).trim() !== '') linha[c[1]] = String(valor).trim();
      }
      return linha;
    });
  }
  return abas;
}

function fazenda(bruto) {
  const f = (bruto || '').trim().toLowerCase();
  if (f === 'karitel') return 'Karitel';
  if (f === 'rdm') return 'Rio do Meio';
  return (bruto || '').trim();
}

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function numeroOuTexto(v) {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v) ? Math.round(n * 1e6) / 1e6 : v;
}

/** Linha → { cabeçalho: valor } só com colunas não sensíveis e preenchidas. */
function dadosDaLinha(linha, cabecalho, ignorar = []) {
  const dados = {};
  for (const [col, titulo] of Object.entries(cabecalho)) {
    const nome = titulo.replace(/\s+/g, ' ').trim();
    if (!nome || COLUNAS_SENSIVEIS.has(nome) || ignorar.includes(col)) continue;
    if (linha[col] !== undefined) dados[nome] = numeroOuTexto(linha[col]);
  }
  return dados;
}

function acharCabecalho(linhas) {
  const i = linhas.findIndex((l) => l.A === 'Fazenda' && l.B === 'Módulo');
  if (i < 0) throw new Error('cabeçalho "Fazenda | Módulo" não encontrado');
  const cabecalho = {};
  // Colunas de totalização (P/Q/R e M/N/O) usam o cabeçalho como valor: ficam fora.
  for (const [col, titulo] of Object.entries(linhas[i])) if (Number.isNaN(Number(titulo))) cabecalho[col] = titulo;
  return { i, cabecalho };
}

function coordenadas(linha, colLat, colLon) {
  const lat = Number(linha[colLat]);
  const lon = Number(linha[colLon]);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 ? { lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7 } : undefined;
}

/** Classificação das estações da aba de captações pelo nome (sem coluna de
 * tipo na planilha): "Elevatória…" → Elevatória; "PRM"/"PK" → Poço (poços
 * de RDM e Karitel); o resto → Captação. */
function tipoEstacao(nome) {
  if (/^elevat/i.test(nome)) return 'elevatoria';
  if (/^(prm|pk)\s*\d+/i.test(nome)) return 'poco';
  return 'captacao';
}

/**
 * Plataforma de telemetria onde o operador verifica a falha (só
 * organização dos chamados; nenhuma integração). Regras validadas com a
 * operação em 14/11/2026:
 * - BestStation: pivôs da Rio do Meio.
 * - 3V3: estações de bombeamento de captação/elevatória, todos os poços
 *   e os demais equipamentos do Módulo 3 da Karitel.
 * - Lindsay: pivôs da Karitel fora do Módulo 3 e, no Módulo 3, os pivôs
 *   da marca Lindsay (prevalece a marca).
 * - Sem plataforma (não confirmada): casas de bombas/reservatórios fora do
 *   Módulo 3. Definidas depois na tela de configurações.
 */
function plataformaDe(a) {
  const moduloTres = a.fazenda === 'Karitel' && a.modulo === 'Módulo 03';
  if (a.tipo === 'pivo' && a.fazenda === 'Rio do Meio') return 'BestStation';
  if (a.tipo === 'pivo' && a.fazenda === 'Karitel' && (!moduloTres || a.marca === 'Lindsay')) return 'Lindsay';
  if (a.tipo === 'captacao' || a.tipo === 'elevatoria' || a.tipo === 'poco') return '3V3';
  if (moduloTres) return '3V3';
  return undefined;
}

function gerar(arquivo) {
  const abas = lerPlanilha(arquivo);
  const pegar = (prefixo) => {
    const nome = Object.keys(abas).find((n) => n.trim().startsWith(prefixo));
    if (!nome) throw new Error(`aba "${prefixo}…" não encontrada (abas: ${Object.keys(abas).join(', ')})`);
    return abas[nome];
  };
  const ativos = [];
  const avisos = [];

  // Reservatórios / casas de bombas
  {
    const linhas = pegar('Infor. Reservat');
    const { i, cabecalho } = acharCabecalho(linhas);
    for (const l of linhas.slice(i + 1)) {
      const nome = l.C || l.D;
      if (!nome) continue;
      if (!l.C) avisos.push(`Reservatórios: linha "${l.D}" sem fazenda/módulo/reservatório, importada como está`);
      ativos.push({
        id: `cb-${slug(`${l.A || 'sem-fazenda'}-${nome}`)}`,
        tipo: 'casa_bombas',
        nome,
        fazenda: fazenda(l.A),
        modulo: l.B || '',
        pivosAbastecidos: l.C ? l.D || '' : '',
        dados: dadosDaLinha(l, cabecalho),
      });
    }
  }

  // Pivôs
  {
    const linhas = pegar('Infor_Pivos');
    const { i, cabecalho } = acharCabecalho(linhas);
    for (const l of linhas.slice(i + 1)) {
      if (!l.E || !l.A) continue;
      ativos.push({
        id: `piv-${slug(`${l.A}-${l.E}`)}`,
        tipo: 'pivo',
        nome: l.E,
        fazenda: fazenda(l.A),
        modulo: l.B || '',
        casaBombas: l.C || '',
        marca: l.D || '',
        coordenadas: coordenadas(l, 'L', 'M'),
        dados: dadosDaLinha(l, cabecalho, ['L', 'M']),
      });
    }
  }

  // Captações, elevatórias e poços (1 ativo por estação)
  {
    const linhas = pegar('Infor. Cap');
    const { i, cabecalho } = acharCabecalho(linhas);
    const estacoes = new Map();
    for (const l of linhas.slice(i + 1)) {
      if (!l.C || !l.A) continue;
      const id = `est-${slug(`${l.A}-${l.C}`)}`;
      if (!estacoes.has(id)) {
        estacoes.set(id, {
          id,
          tipo: tipoEstacao(l.C),
          nome: l.C,
          fazenda: fazenda(l.A),
          modulo: l.B || '',
          coordenadas: coordenadas(l, 'J', 'K'),
          bombas: [],
        });
      }
      estacoes.get(id).bombas.push(dadosDaLinha(l, cabecalho, ['A', 'B', 'C', 'J', 'K']));
    }
    ativos.push(...estacoes.values());
  }

  const ids = new Set();
  for (const a of ativos) {
    if (ids.has(a.id)) throw new Error(`ativo duplicado: ${a.id}`);
    ids.add(a.id);
    if (!a.coordenadas) delete a.coordenadas;
    const plataforma = plataformaDe(a);
    if (plataforma) a.plataforma = plataforma;
    else avisos.push(`Sem plataforma de telemetria (definir em Configurações): ${a.nome} · ${a.fazenda || 'sem fazenda'} · ${a.modulo || 'sem módulo'}`);
  }
  const nomesCasas = new Set(ativos.filter((a) => a.tipo === 'casa_bombas').map((a) => `${a.fazenda}|${a.nome}`));
  for (const p of ativos.filter((a) => a.tipo === 'pivo' && a.casaBombas)) {
    const partes = p.casaBombas.split('/').map((s) => s.trim());
    if (!partes.some((c) => nomesCasas.has(`${p.fazenda}|${c}`))) avisos.push(`${p.nome} (${p.fazenda}): casa de bombas "${p.casaBombas}" não está na aba de reservatórios`);
  }
  return { ativos, avisos };
}

if (require.main === module) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Uso: node scripts/gerar-ativos-irrigacao.js "<planilha.xlsx>"');
    process.exit(1);
  }
  const { ativos, avisos } = gerar(arquivo);
  const destino = path.join(__dirname, '..', 'v3', 'src', 'data', 'irrigacao_ativos.json');
  fs.writeFileSync(destino, `${JSON.stringify({ origem: path.basename(arquivo), geradoEm: new Date().toISOString().slice(0, 10), ativos }, null, 1)}\n`);
  const porTipo = ativos.reduce((m, a) => ({ ...m, [a.tipo]: (m[a.tipo] || 0) + 1 }), {});
  console.log(`Ativos gerados: ${ativos.length}`, porTipo);
  avisos.forEach((a) => console.log(`Aviso: ${a}`));
}

module.exports = { gerar, tipoEstacao, plataformaDe };
