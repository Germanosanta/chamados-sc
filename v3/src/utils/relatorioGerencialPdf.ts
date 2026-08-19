import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCoa from '@/assets/img/coa.jpeg';
import { codigoEquipDoChamado, fazendaLabel, formatDataBR } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';
import type { FiltroAplicado } from '@/components/shared/RelatorioGerencialHeader';

/**
 * Geração de PDF 100% client-side (sem backend novo, funciona dentro do
 * PWA instalado/offline) — escolhida `jspdf` + `jspdf-autotable` em vez
 * de `@react-pdf/renderer` por serem as libs mais leves/maduras pra este
 * caso (documento com cabeçalho repetido + tabela), sem exigir descrever
 * o layout inteiro num sistema de componentes paralelo ao React. O
 * gráfico usa o MESMO Chart.js já presente no projeto (utils/chartSetup.ts,
 * via react-chartjs-2) — o `<Bar>` já renderizado na tela é convertido
 * para imagem com `chart.toBase64Image()` (ver `handleGerarPdf` em
 * RelatorioGerencialPage.tsx) antes de ser inserido no PDF, em vez de
 * adicionar uma segunda biblioteca de gráficos.
 *
 * Cabeçalho institucional: replica o mesmo conteúdo/ordem de
 * `RelatorioGerencialHeader.tsx` (duas logos lado a lado, nome do
 * relatório, período, filtros aplicados) — jsPDF/autoTable não sabem
 * renderizar um componente React, então o layout é redesenhado aqui com
 * as primitivas do jsPDF (texto/retângulos/imagem). Qualquer mudança
 * visual no header da tela deve ser replicada aqui também.
 */

const MARGIN = 40;
const PAGE_W = 595.28; // A4 pt, retrato
const PAGE_H = 841.89;

/**
 * `logoCoa` (import de asset do Vite) é uma URL — dev server path ou, se
 * menor que o limite de inlining do Vite, já uma `data:` URI —, nunca
 * dado de imagem pronto. `jsPDF.addImage` não sabe buscar uma URL
 * sozinho (precisa de base64/ArrayBuffer/elemento já carregado), então
 * pré-carregamos a URL num `HTMLImageElement` uma única vez (funciona
 * para os dois casos) e reaproveitamos o mesmo elemento carregado em
 * todo cabeçalho desenhado (1 por página) — sem isso, a imagem simplesmente
 * não apareceria no PDF (addImage silenciosamente ignora string inválida).
 */
function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });
}

function drawHeader(doc: jsPDF, logoImg: HTMLImageElement | null, titulo: string, periodo: string, filtros: FiltroAplicado[]): number {
  let y = MARGIN;

  // Logo COA (real) — só desenha se o pré-carregamento deu certo; nunca
  // trava a geração do PDF por causa disso (resto do cabeçalho segue
  // íntegro mesmo sem essa imagem).
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'JPEG', MARGIN, y, 34, 34);
    } catch {
      // formato inesperado do asset — segue sem travar a exportação.
    }
  }

  // Placeholder do logo Santa Colomba — ausente no projeto (ver
  // RelatorioGerencialHeader.tsx). Nunca inventar uma imagem no lugar:
  // desenha uma caixa tracejada neutra com o mesmo aviso da tela.
  const phX = MARGIN + 34 + 8;
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(phX, y, 34, 34, 'S');
  doc.setLineDashPattern([], 0);
  doc.setFontSize(5);
  doc.setTextColor(140, 140, 140);
  doc.text('Logo Santa', phX + 17, y + 14, { align: 'center' });
  doc.text('Colomba', phX + 17, y + 20, { align: 'center' });
  doc.text('pendente', phX + 17, y + 26, { align: 'center' });

  // Título + período, alinhados à direita.
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(titulo, PAGE_W - MARGIN, y + 12, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(`Período: ${periodo}`, PAGE_W - MARGIN, y + 26, { align: 'right' });

  y += 34 + 8;

  // Linha de filtros aplicados (só os que o usuário realmente escolheu).
  if (filtros.length > 0) {
    const linha = filtros.map((f) => `${f.label}: ${f.valor}`).join('   |   ');
    doc.setFillColor(245, 246, 248);
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 16, 'F');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(linha, MARGIN + 6, y + 11);
    y += 16 + 6;
  }

  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 14;

  return y;
}

function drawFooter(doc: jsPDF, pageNum: number, pageCount: number) {
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text(`Central de Chamados · Santa Colomba Agropecuária — página ${pageNum} de ${pageCount}`, PAGE_W / 2, PAGE_H - 20, { align: 'center' });
}

export interface KpiResumo {
  label: string;
  value: string;
}

export interface RankingLinha {
  nome: string;
  total: number;
}

export interface GerarRelatorioPdfInput {
  titulo: string;
  periodo: string;
  filtros: FiltroAplicado[];
  geradoEm: string;
  kpis: KpiResumo[];
  chamados: Chamado[];
  ranking: RankingLinha[];
  /** dataURL PNG do gráfico (chamados por status), já renderizado pelo
   * Chart.js na tela (ver `handleGerarPdf`, RelatorioGerencialPage.tsx).
   * `null` quando o gráfico não pôde ser capturado (ex. sem dados) — o
   * PDF é gerado normalmente sem essa seção nesse caso, nunca quebra a
   * exportação. */
  graficoDataUrl: string | null;
}

/** Linha de detalhe da frota/técnico — nunca "undefined"/"null": todo
 * campo ausente vira "—" na origem antes de chegar aqui (ver
 * RelatorioGerencialPage.tsx). Assíncrona só por causa do pré-carregamento
 * do logo (ver `carregarImagem` acima) — o resto da geração é síncrono. */
export async function gerarRelatorioGerencialPdf(input: GerarRelatorioPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const logoImg = await carregarImagem(logoCoa).catch(() => null);

  let y = drawHeader(doc, logoImg, input.titulo, input.periodo, input.filtros);
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${input.geradoEm}`, PAGE_W - MARGIN, y - 20, { align: 'right' });

  // KPIs em grade simples de texto (3 colunas).
  doc.setFontSize(10);
  const kpiColW = (PAGE_W - MARGIN * 2) / 3;
  input.kpis.forEach((kpi, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MARGIN + col * kpiColW;
    const yy = y + row * 32;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(7.5);
    doc.text(kpi.label.toUpperCase(), x, yy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(13);
    doc.text(kpi.value, x, yy + 14);
  });
  const kpiRows = Math.ceil(input.kpis.length / 3);
  y += kpiRows * 32 + 14;

  // Gráfico (chamados por status), se disponível.
  if (input.graficoDataUrl) {
    const imgW = 220;
    const imgH = 140;
    if (y + imgH > PAGE_H - 60) {
      doc.addPage();
      y = drawHeader(doc, logoImg, input.titulo, input.periodo, input.filtros);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text('Chamados por status', MARGIN, y);
    doc.addImage(input.graficoDataUrl, 'PNG', MARGIN, y + 6, imgW, imgH);
    y += imgH + 20;
  }

  // Ranking por técnico (tabela compacta).
  if (input.ranking.length > 0) {
    if (y > PAGE_H - 120) {
      doc.addPage();
      y = drawHeader(doc, logoImg, input.titulo, input.periodo, input.filtros);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text('Ranking por técnico', MARGIN, y);
    autoTable(doc, {
      startY: y + 8,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Técnico', 'Chamados']],
      body: input.ranking.map((r) => [r.nome, String(r.total)]),
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      theme: 'striped',
    });
    // jspdf-autotable anexa `lastAutoTable` ao doc em runtime; cast local
    // em vez de depender da declaração de tipos da lib bater exatamente
    // (evita depender de um `@ts-expect-error` que quebraria o build se a
    // versão instalada já tipar isso oficialmente).
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // Tabela detalhada — uma linha por chamado. autoTable já pagina
  // sozinho e redesenha um cabeçalho de TABELA a cada página nova
  // (didDrawPage cuida do cabeçalho INSTITUCIONAL/rodapé em cada uma).
  if (y > PAGE_H - 100) {
    doc.addPage();
    y = drawHeader(doc, logoImg, input.titulo, input.periodo, input.filtros);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('Chamados no período/filtro', MARGIN, y);

  // Página em que a tabela começa a ser desenhada — o cabeçalho dessa
  // página já foi pintado manualmente (drawHeader acima); só as páginas
  // NOVAS que o autoTable criar sozinho ao paginar a tabela grande
  // precisam do cabeçalho institucional redesenhado pelo callback abaixo.
  const paginaInicialTabela = doc.getNumberOfPages();

  autoTable(doc, {
    startY: y + 8,
    margin: { left: MARGIN, right: MARGIN, top: 100 },
    head: [['Número', 'Título', 'Status', 'Técnico', 'Fazenda', 'Frota', 'Abertura', 'Encerramento']],
    body: input.chamados.map((c) => [
      c.num || '—',
      c.titulo || '—',
      c.status || '—',
      c.resp || c.assumidoPor || '—',
      fazendaLabel(c.bucket),
      codigoEquipDoChamado(c) || '—',
      formatDataBR(c.data),
      c.encerramento?.dataEncerramento || '—',
    ]),
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    theme: 'striped',
    columnStyles: { 1: { cellWidth: 110 } },
    didDrawPage: (data) => {
      // cabeçalho institucional em TODA página nova que o autoTable cria
      // sozinho ao paginar a tabela grande — a página onde a tabela
      // começa já teve seu cabeçalho pintado manualmente acima, então
      // pintar de novo aqui duplicaria/sobreporia o conteúdo (KPIs,
      // gráfico, ranking) que já está nela.
      if (data.pageNumber > paginaInicialTabela) {
        drawHeader(doc, logoImg, input.titulo, input.periodo, input.filtros);
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawFooter(doc, p, pageCount);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio-gerencial-chamados-${hoje}.pdf`);
}
