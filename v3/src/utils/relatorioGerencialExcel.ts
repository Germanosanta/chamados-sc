import ExcelJS from 'exceljs';
import logoInstitucional from '@/assets/img/logo-institucional.jpeg';
import type { Chamado } from '@/types/chamado';
import type { Tecnico } from '@/types/tecnico';
import type { FiltroAplicado } from '@/components/shared/RelatorioGerencialHeader';
import {
  chamadoPertenceATecnico,
  codigoEquipDoChamado,
  diasEntre,
  equipamentoDoChamado,
  fazendaLabel,
  isAbertoStatus,
  isAguardandoPeca,
  isCancelado,
  isConcluido,
  isEmAtendimento,
} from '@/utils/chamado-helpers';

/**
 * Exportação .xlsx do Relatório Gerencial — client-side (ExcelJS), ao
 * lado do PDF já existente (utils/relatorioGerencialPdf.ts, que NÃO é
 * tocado por este módulo). Recebe os MESMOS dados já filtrados/calculados
 * pela tela (RelatorioGerencialPage) — mesmo array `filtrados` usado no
 * PDF, mesmos KPIs, mesmo ranking — para nunca haver divergência entre os
 * dois formatos de exportação nem uma segunda consulta ao Firestore.
 *
 * Biblioteca: `exceljs` — única lib do projeto com suporte maduro a
 * estilo de célula (fundo/borda/fonte), largura de coluna, congelamento
 * de painel, autofiltro, `numFmt` e imagem embutida a partir do client
 * (SheetJS "community" não escreve estilo; `xlsx-populate` está sem
 * manutenção há anos). Gráfico nativo do Excel (`worksheet.addChart`) NÃO
 * é usado aqui: essa API não é exposta pela build pública do ExcelJS (só
 * existe em forks/PRs não mesclados) — implementar "na confiança" geraria
 * risco real de um .xlsx corrompido. Em vez disso, as abas Técnicos/
 * Fazendas/Frota entregam o mesmo dado agregado como TABELA formatada
 * (cabeçalho com fundo escuro, bordas discretas, `%` calculado, ordenada
 * do maior pro menor) — visualmente clara e 100% confiável de abrir.
 */

const COR_HEADER = 'FF1E293B'; // mesma paleta do cabeçalho de tabela do PDF (rgb 30,41,59)
const COR_BORDA = 'FFD9DEE5'; // cinza claro discreto
const LOGO_RATIO = 1458 / 291;
const LOGO_W = 220;
const LOGO_H = Math.round(LOGO_W / LOGO_RATIO);

type TecnicoRef = Pick<Tecnico, 'nome' | 'apelido' | 'usuarioUid'>;

export interface KpiResumo {
  label: string;
  value: string;
}

export interface RankingLinha {
  nome: string;
  total: number;
}

export interface GerarRelatorioExcelInput {
  titulo: string;
  periodo: string;
  filtros: FiltroAplicado[];
  geradoEm: string;
  /** Mesmos KPIs (label/value já formatados) usados no PDF — inclui
   * "Tempo médio de atendimento" como último item, já com `null` tratado
   * como "—" pela própria tela (ver handleGerarPdf). */
  kpis: KpiResumo[];
  /** Mesmo array `filtrados` já calculado pela tela — nenhum novo filtro/
   * consulta é feito aqui. */
  chamados: Chamado[];
  ranking: RankingLinha[];
  tecnicos: TecnicoRef[];
  /** Datas ISO (AAAA-MM-DD) dos filtros de período, quando preenchidos —
   * só para compor o nome do arquivo. */
  dataInicioISO?: string;
  dataFimISO?: string;
}

const BORDA_FINA = { style: 'thin' as const, color: { argb: COR_BORDA } };
const BORDA_CELULA = { top: BORDA_FINA, left: BORDA_FINA, bottom: BORDA_FINA, right: BORDA_FINA };

function estilizarHeaderLinha(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_HEADER } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = BORDA_CELULA;
  });
  row.height = 20;
}

function aplicarBordaLinha(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.border = BORDA_CELULA;
  });
}

/** Pré-carrega o logo institucional como data URL base64 — mesma lógica
 * de tolerância a falha do PDF (`carregarImagem` em relatorioGerencialPdf.ts):
 * se não carregar, o Excel é gerado normalmente sem a imagem, nunca trava
 * a exportação. */
async function carregarLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch(logoInstitucional);
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler logo institucional'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function montarAbaResumo(
  workbook: ExcelJS.Workbook,
  logoBase64: string | null,
  input: GerarRelatorioExcelInput,
  totalGeral: number,
  encerradosGeral: number,
) {
  const ws = workbook.addWorksheet('Resumo Gerencial', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 32 }, { width: 42 }];

  if (logoBase64) {
    try {
      const ext: 'png' | 'jpeg' = logoBase64.includes('image/png') ? 'png' : 'jpeg';
      const imageId = workbook.addImage({ base64: logoBase64, extension: ext });
      ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: LOGO_W, height: LOGO_H } });
    } catch {
      // asset em formato inesperado — segue sem travar a exportação.
    }
  }

  // 3 linhas reservadas à altura da imagem (LOGO_H ~44px ≈ 3 linhas de 15px).
  ws.getRow(1).height = 15;
  ws.getRow(2).height = 15;
  ws.getRow(3).height = 15;

  let linha = 5;
  ws.getCell(`A${linha}`).value = input.titulo;
  ws.getCell(`A${linha}`).font = { bold: true, size: 14 };
  linha += 1;

  ws.getCell(`A${linha}`).value = `Período: ${input.periodo}`;
  ws.getCell(`A${linha}`).font = { size: 10, color: { argb: 'FF5A5A5A' } };
  linha += 1;

  ws.getCell(`A${linha}`).value = `Gerado em: ${input.geradoEm}`;
  ws.getCell(`A${linha}`).font = { size: 9, color: { argb: 'FF969696' } };
  linha += 1;

  if (input.filtros.length > 0) {
    ws.getCell(`A${linha}`).value = `Filtros aplicados: ${input.filtros.map((f) => `${f.label}: ${f.valor}`).join('  |  ')}`;
    ws.getCell(`A${linha}`).font = { size: 9, italic: true, color: { argb: 'FF464646' } };
    ws.getRow(linha).height = 18;
    linha += 1;
  }

  linha += 1;
  ws.getCell(`A${linha}`).value = 'INDICADORES';
  ws.getCell(`A${linha}`).font = { bold: true, size: 11 };
  linha += 1;

  const headerIndicadores = ws.getRow(linha);
  headerIndicadores.getCell(1).value = 'Indicador';
  headerIndicadores.getCell(2).value = 'Valor';
  estilizarHeaderLinha(headerIndicadores);
  linha += 1;

  for (const kpi of input.kpis) {
    const row = ws.getRow(linha);
    row.getCell(1).value = kpi.label;
    row.getCell(2).value = kpi.value;
    row.getCell(2).font = { bold: true };
    aplicarBordaLinha(row);
    linha += 1;
  }

  // % de encerramento — calculado direto do mesmo array `filtrados`
  // (isConcluido), mesma fonte que os demais KPIs da tela.
  const rowPct = ws.getRow(linha);
  rowPct.getCell(1).value = '% de Encerramento';
  rowPct.getCell(2).value = totalGeral > 0 ? encerradosGeral / totalGeral : 0;
  rowPct.getCell(2).numFmt = '0%';
  rowPct.getCell(2).font = { bold: true };
  aplicarBordaLinha(rowPct);
}

/** Hora de abertura, "HH:MM" — prioriza `dataHoraISO` (timestamp real,
 * gravado por NovoChamadoPage); cai pro `dataHoraAbertura` textual
 * ("DD/MM/AAAA às HH:MM", mesmo fluxo) só quando o ISO não existir.
 * String vazia (nunca "undefined") quando nenhum dos dois estiver
 * disponível — a maioria dos chamados históricos não tem hora de
 * abertura registrada, só a data. */
function extrairHoraAbertura(c: Chamado): string {
  if (c.dataHoraISO) {
    const d = new Date(c.dataHoraISO);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  const match = c.dataHoraAbertura?.match(/(\d{2}:\d{2})\s*$/);
  return match ? match[1] : '';
}

function montarAbaChamados(workbook: ExcelJS.Workbook, chamados: Chamado[]) {
  const ws = workbook.addWorksheet('Chamados');
  ws.columns = [
    { header: 'Número', key: 'num', width: 12 },
    { header: 'Data abertura', key: 'dataAbertura', width: 14 },
    { header: 'Hora abertura', key: 'horaAbertura', width: 12 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Técnico', key: 'tecnico', width: 18 },
    { header: 'Fazenda/Setor', key: 'fazenda', width: 16 },
    { header: 'Frota', key: 'frota', width: 12 },
    { header: 'Equipamento', key: 'equipamento', width: 24 },
    { header: 'Título', key: 'titulo', width: 26 },
    { header: 'Descrição', key: 'descricao', width: 34 },
    { header: 'Solução', key: 'solucao', width: 34 },
    { header: 'Data encerramento', key: 'dataEncerramento', width: 16 },
    { header: 'Hora encerramento', key: 'horaEncerramento', width: 16 },
    { header: 'Tempo de atendimento (dias)', key: 'tempoAtendimento', width: 22 },
  ];
  estilizarHeaderLinha(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  if (chamados.length === 0) {
    ws.autoFilter = { from: 'A1', to: 'N1' };
    const notaRow = ws.getRow(2);
    notaRow.getCell(1).value = 'Nenhum chamado no período/filtro selecionado.';
    ws.mergeCells('A2:N2');
    notaRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
    notaRow.getCell(1).alignment = { horizontal: 'left' };
    return;
  }

  for (const c of chamados) {
    const equip = equipamentoDoChamado(c);
    const dias = diasEntre(c.data, c.encerramento?.encerradoEm);

    const row = ws.addRow({
      num: c.num || '',
      dataAbertura: c.data ? new Date(c.data + 'T00:00:00') : null,
      horaAbertura: extrairHoraAbertura(c),
      status: c.status || '',
      tecnico: c.resp || c.assumidoPor || '',
      fazenda: fazendaLabel(c.bucket) === '—' ? '' : fazendaLabel(c.bucket),
      frota: codigoEquipDoChamado(c) || '',
      equipamento: equip?.descricao || equip?.modelo || '',
      titulo: c.titulo || '',
      descricao: c.desc || '',
      solucao: c.encerramento?.solucao || '',
      dataEncerramento: c.encerramento?.dataEncerramento || '',
      horaEncerramento: c.encerramento?.horaEncerramento || '',
      tempoAtendimento: dias !== null ? dias : null,
    });

    const dataCell = row.getCell('dataAbertura');
    if (dataCell.value) dataCell.numFmt = 'dd/mm/yyyy';
    row.getCell('titulo').alignment = { wrapText: true };
    row.getCell('descricao').alignment = { wrapText: true };
    row.getCell('solucao').alignment = { wrapText: true };
    aplicarBordaLinha(row);
  }

  ws.autoFilter = { from: 'A1', to: `N${chamados.length + 1}` };
}

function montarAbaTecnicos(workbook: ExcelJS.Workbook, chamados: Chamado[], ranking: RankingLinha[], tecnicos: TecnicoRef[]) {
  const ws = workbook.addWorksheet('Técnicos');
  ws.columns = [
    { header: 'Técnico', key: 'tecnico', width: 22 },
    { header: 'Total', key: 'total', width: 10 },
    { header: 'Em Aberto', key: 'aberto', width: 12 },
    { header: 'Em Atendimento', key: 'atendimento', width: 15 },
    { header: 'Aguardando Peça', key: 'peca', width: 16 },
    { header: 'Encerrados', key: 'encerrado', width: 12 },
    { header: 'Cancelados', key: 'cancelado', width: 12 },
    { header: '% Encerramento', key: 'pct', width: 15 },
  ];
  estilizarHeaderLinha(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // `ranking` já é [nome, total] ordenado desc (mesmo cálculo do PDF/tela,
  // via contarPorTecnico) — reaproveitado aqui só pra ordem/lista de
  // nomes; a quebra por status usa chamadoPertenceATecnico sobre o mesmo
  // array `chamados` já filtrado, uma única passada por técnico (lista de
  // técnicos é pequena, mesma ordem de grandeza já usada por
  // contarPorTecnico em produção).
  if (ranking.length === 0) {
    ws.autoFilter = { from: 'A1', to: 'H1' };
    return;
  }

  for (const { nome } of ranking) {
    const t = tecnicos.find((tc) => (tc.apelido || tc.nome) === nome);
    const doTecnico = t ? chamados.filter((c) => chamadoPertenceATecnico(c, t)) : [];
    const total = doTecnico.length;
    const encerrado = doTecnico.filter(isConcluido).length;

    const row = ws.addRow({
      tecnico: nome,
      total,
      aberto: doTecnico.filter(isAbertoStatus).length,
      atendimento: doTecnico.filter(isEmAtendimento).length,
      peca: doTecnico.filter(isAguardandoPeca).length,
      encerrado,
      cancelado: doTecnico.filter(isCancelado).length,
      pct: total > 0 ? encerrado / total : 0,
    });
    row.getCell('pct').numFmt = '0%';
    aplicarBordaLinha(row);
  }

  ws.autoFilter = { from: 'A1', to: `H${ranking.length + 1}` };
}

interface AgregadoLinha {
  chave: string;
  total: number;
  abertos: number;
  encerrados: number;
}

/** Único passe sobre `chamados` (já filtrado pela tela) — nada de
 * `chamados.filter()` repetido por linha, mesmo para volumes grandes. */
function agregarPorChave(chamados: Chamado[], chaveDe: (c: Chamado) => string | undefined): AgregadoLinha[] {
  const mapa = new Map<string, AgregadoLinha>();
  for (const c of chamados) {
    const chave = chaveDe(c);
    if (!chave) continue;
    let linha = mapa.get(chave);
    if (!linha) {
      linha = { chave, total: 0, abertos: 0, encerrados: 0 };
      mapa.set(chave, linha);
    }
    linha.total += 1;
    if (isAbertoStatus(c)) linha.abertos += 1;
    if (isConcluido(c)) linha.encerrados += 1;
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

function montarAbaAgregada(workbook: ExcelJS.Workbook, nomeAba: string, colunaChave: string, linhas: AgregadoLinha[]) {
  const ws = workbook.addWorksheet(nomeAba);
  ws.columns = [
    { header: colunaChave, key: 'chave', width: 26 },
    { header: 'Total', key: 'total', width: 10 },
    { header: 'Em Aberto', key: 'abertos', width: 12 },
    { header: 'Encerrados', key: 'encerrados', width: 12 },
    { header: '% Encerramento', key: 'pct', width: 15 },
  ];
  estilizarHeaderLinha(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  if (linhas.length === 0) {
    ws.autoFilter = { from: 'A1', to: 'E1' };
    return;
  }

  for (const l of linhas) {
    const row = ws.addRow({
      chave: l.chave,
      total: l.total,
      abertos: l.abertos,
      encerrados: l.encerrados,
      pct: l.total > 0 ? l.encerrados / l.total : 0,
    });
    row.getCell('pct').numFmt = '0%';
    aplicarBordaLinha(row);
  }

  ws.autoFilter = { from: 'A1', to: `E${linhas.length + 1}` };
}

function nomeArquivo(input: GerarRelatorioExcelInput): string {
  if (input.dataInicioISO && input.dataFimISO) {
    return `Relatorio_Gerencial_Chamados_${input.dataInicioISO}_a_${input.dataFimISO}.xlsx`;
  }
  const hoje = new Date().toISOString().slice(0, 10);
  return `Relatorio_Gerencial_Chamados_completo_${hoje}.xlsx`;
}

/**
 * Gera e baixa o .xlsx do Relatório Gerencial — mesmos dados já
 * filtrados/calculados pela tela (`chamados` = mesmo array `filtrados`
 * usado no PDF). Nunca grava nada no Firestore; nunca refaz consulta.
 */
export async function gerarRelatorioGerencialExcel(input: GerarRelatorioExcelInput): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Central de Chamados — Santa Colomba Agropecuária';
  workbook.created = new Date();

  const logoBase64 = await carregarLogoBase64();

  const totalGeral = input.chamados.length;
  const encerradosGeral = input.chamados.filter(isConcluido).length;

  montarAbaResumo(workbook, logoBase64, input, totalGeral, encerradosGeral);
  montarAbaChamados(workbook, input.chamados);
  montarAbaTecnicos(workbook, input.chamados, input.ranking, input.tecnicos);
  montarAbaAgregada(
    workbook,
    'Fazendas',
    'Fazenda/Setor',
    agregarPorChave(input.chamados, (c) => (c.bucket ? fazendaLabel(c.bucket) : undefined)),
  );
  montarAbaAgregada(workbook, 'Frota', 'Frota', agregarPorChave(input.chamados, (c) => codigoEquipDoChamado(c)));

  // "Resumo Gerencial" é a primeira aba adicionada ao workbook — o Excel
  // abre o arquivo com a primeira aba ativa por padrão, sem precisar de
  // nenhuma API adicional (evitado de propósito: `workbook.views`/
  // `activeTab` não é uma API central/bem documentada do ExcelJS —
  // preferível não arriscar um método incerto por um comportamento que já
  // sai correto pela ordem de inserção das abas).

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo(input);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}
