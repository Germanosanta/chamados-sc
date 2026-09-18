import { useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { Chart as ChartJSInstance, ChartData } from 'chart.js';
import { FileDown, FileSpreadsheet, Sheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterBar } from '@/components/shared/FilterBar';
import { KpiCard } from '@/components/shared/KpiCard';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { RankingBars } from '@/components/shared/RankingBars';
import { RelatorioGerencialHeader, type FiltroAplicado } from '@/components/shared/RelatorioGerencialHeader';
import { Badge } from '@/components/ui/badge';
import { useChamados } from '@/hooks/useChamados';
import { useTecnicosAtivos } from '@/hooks/useTecnicos';
import {
  chamadoPertenceATecnico,
  contarPorTecnico,
  encerramentoISO,
  fazendaLabel,
  formatDataBR,
  isAbertoStatus,
  isAguardandoPeca,
  isCancelado,
  isConcluido,
  isEmAtendimento,
  statusVariant,
  tempoMedioDias,
  codigoEquipDoChamado,
} from '@/utils/chamado-helpers';
import { chartBaseOptions } from '@/utils/chartSetup';
import { gerarRelatorioGerencialPdf } from '@/utils/relatorioGerencialPdf';
import { gerarRelatorioGerencialExcel } from '@/utils/relatorioGerencialExcel';
import { downloadCSV } from '@/utils/csv';
import type { Chamado, ChamadoStatus } from '@/types/chamado';

const PER_PAGE = 25;

const STATUS_OPTIONS: ChamadoStatus[] = [
  'Não iniciado',
  'Aberto',
  'Em Andamento',
  'Em Atendimento',
  'Aguardando Peça',
  'Concluída',
  'Encerrado',
  'Cancelado',
];

const STATUS_ORDER: { key: string; label: string; check: (c: Chamado) => boolean }[] = [
  { key: 'aberto', label: 'Em Aberto', check: isAbertoStatus },
  { key: 'atendimento', label: 'Em Atendimento', check: isEmAtendimento },
  { key: 'peca', label: 'Aguardando Peça', check: isAguardandoPeca },
  { key: 'concluido', label: 'Encerrados', check: isConcluido },
  { key: 'cancelado', label: 'Cancelados', check: isCancelado },
];

const TODOS = '__todos__';

/**
 * Relatório Gerencial de Chamados — filtros combináveis (período, status,
 * técnico, fazenda, frota) sobre a mesma fonte única de chamados
 * (useChamados) e as mesmas funções puras de KPI/ranking já usadas no
 * resto da V3 (utils/chamado-helpers.ts) — nenhuma lógica de contagem é
 * reimplementada aqui. Exportação em PDF client-side (ver
 * utils/relatorioGerencialPdf.ts), com o mesmo cabeçalho institucional
 * (RelatorioGerencialHeader) usado no preview desta tela.
 */
export function RelatorioGerencialPage() {
  const { data: todos, carregando } = useChamados();
  const { data: tecnicos } = useTecnicosAtivos();

  // Achado no pedido "quero extrair os chamados com data de encerramento":
  // o filtro de período só olhava `c.data` (abertura) — não tinha como
  // extrair "todos os chamados encerrados entre X e Y" (o caso comum de
  // fechamento de mês/produtividade), só "abertos entre X e Y" mesmo que
  // tenham encerrado bem depois ou continuem em aberto. Depois do pedido
  // de poder usar os dois AO MESMO TEMPO, virou 2 pares de data
  // independentes (abertura e encerramento) combinados por E — cada par
  // só filtra se pelo menos um dos dois campos dele estiver preenchido, e
  // os dois juntos permitem, por exemplo, "aberto em julho E encerrado em
  // agosto". O resto da tela (KPIs, ranking, tabela, PDF, CSV) não muda —
  // continua tudo reagindo só a `filtrados`.
  const [aberturaDe, setAberturaDe] = useState('');
  const [aberturaAte, setAberturaAte] = useState('');
  const [encerramentoDe, setEncerramentoDe] = useState('');
  const [encerramentoAte, setEncerramentoAte] = useState('');
  const [status, setStatus] = useState<string>(TODOS);
  const [tecnicoSel, setTecnicoSel] = useState<string>(TODOS);
  const [bucketSel, setBucketSel] = useState<string>(TODOS);
  const [frotaSel, setFrotaSel] = useState<string>(TODOS);
  const [page, setPage] = useState(1);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  // Flag própria (não reusa `gerandoPdf`) para não desabilitar os dois
  // botões de exportação juntos por engano quando só um deles está
  // gerando.
  const [gerandoExcel, setGerandoExcel] = useState(false);

  const chartRef = useRef<ChartJSInstance<'bar'>>(null);

  const buckets = useMemo(() => {
    const set = new Set<string>();
    todos.forEach((c) => c.bucket && set.add(c.bucket));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [todos]);

  const frotas = useMemo(() => {
    const set = new Set<string>();
    todos.forEach((c) => {
      const cod = codigoEquipDoChamado(c);
      if (cod) set.add(cod);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [todos]);

  const tecnicoObj = tecnicos.find((t) => (t.apelido || t.nome) === tecnicoSel);

  const filtrados = useMemo(() => {
    return todos.filter((c) => {
      // Abertura e encerramento são filtros independentes, combinados por
      // E — um chamado só precisa satisfazer o par que estiver preenchido;
      // se os dois pares estiverem preenchidos, precisa satisfazer os dois
      // (ex.: aberto em julho E encerrado em agosto).
      if (aberturaDe && (!c.data || c.data < aberturaDe)) return false;
      if (aberturaAte && (!c.data || c.data > aberturaAte)) return false;
      if (encerramentoDe || encerramentoAte) {
        // Sem data de encerramento, não há como bater um filtro de
        // encerramento — exclui, em vez de deixar passar por engano.
        const enc = encerramentoISO(c);
        if (!enc) return false;
        if (encerramentoDe && enc < encerramentoDe) return false;
        if (encerramentoAte && enc > encerramentoAte) return false;
      }
      if (status !== TODOS && c.status !== status) return false;
      if (tecnicoSel !== TODOS && (!tecnicoObj || !chamadoPertenceATecnico(c, tecnicoObj))) return false;
      if (bucketSel !== TODOS && c.bucket !== bucketSel) return false;
      if (frotaSel !== TODOS && codigoEquipDoChamado(c) !== frotaSel) return false;
      return true;
    });
  }, [todos, aberturaDe, aberturaAte, encerramentoDe, encerramentoAte, status, tecnicoSel, tecnicoObj, bucketSel, frotaSel]);

  const paginados = useMemo(() => filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtrados, page]);

  const kpis = useMemo(
    () => [
      { label: 'Total no filtro', value: filtrados.length, color: 'blue' as const },
      { label: 'Em Aberto', value: filtrados.filter(isAbertoStatus).length, color: 'red' as const },
      { label: 'Em Atendimento', value: filtrados.filter(isEmAtendimento).length, color: 'amber' as const },
      { label: 'Aguardando Peça', value: filtrados.filter(isAguardandoPeca).length, color: 'purple' as const },
      { label: 'Encerrados', value: filtrados.filter(isConcluido).length, color: 'green' as const },
      { label: 'Cancelados', value: filtrados.filter(isCancelado).length, color: 'teal' as const },
    ],
    [filtrados],
  );

  const tempoMedio = useMemo(() => tempoMedioDias(filtrados), [filtrados]);

  const ranking = useMemo(() => {
    const linhas = contarPorTecnico(filtrados, tecnicos);
    return [...linhas].sort((a, b) => b[1] - a[1]);
  }, [filtrados, tecnicos]);

  const chartData: ChartData<'bar'> = useMemo(
    () => ({
      labels: STATUS_ORDER.map((s) => s.label),
      datasets: [
        {
          label: 'Chamados',
          data: STATUS_ORDER.map((s) => filtrados.filter(s.check).length),
          backgroundColor: ['#dc2626', '#d97706', '#7c3aed', '#16a34a', '#94a3b8'],
          borderRadius: 3,
          borderSkipped: false,
        },
      ],
    }),
    [filtrados],
  );

  function faixaLabel(de: string, ate: string): string | null {
    if (de && ate) return `${formatDataBR(de)} a ${formatDataBR(ate)}`;
    if (de) return `A partir de ${formatDataBR(de)}`;
    if (ate) return `Até ${formatDataBR(ate)}`;
    return null;
  }

  const periodoLabel = useMemo(() => {
    const abertura = faixaLabel(aberturaDe, aberturaAte);
    const encerramento = faixaLabel(encerramentoDe, encerramentoAte);
    const partes = [abertura && `Abertura: ${abertura}`, encerramento && `Encerramento: ${encerramento}`].filter(Boolean);
    return partes.length ? partes.join(' · ') : 'Todo o histórico';
  }, [aberturaDe, aberturaAte, encerramentoDe, encerramentoAte]);

  const filtrosAplicados: FiltroAplicado[] = useMemo(() => {
    const f: FiltroAplicado[] = [];
    if (status !== TODOS) f.push({ label: 'Status', valor: status });
    if (tecnicoSel !== TODOS) f.push({ label: 'Técnico', valor: tecnicoSel });
    if (bucketSel !== TODOS) f.push({ label: 'Fazenda', valor: fazendaLabel(bucketSel) });
    if (frotaSel !== TODOS) f.push({ label: 'Frota', valor: frotaSel });
    return f;
  }, [status, tecnicoSel, bucketSel, frotaSel]);

  const columns: DataTableColumn<Chamado>[] = [
    { key: 'num', header: 'Número', render: (c) => <span className="font-mono-num font-semibold text-foreground">{c.num || '—'}</span> },
    { key: 'titulo', header: 'Título', render: (c) => <span className="text-foreground">{c.titulo || '—'}</span> },
    { key: 'status', header: 'Status', render: (c) => <Badge variant={statusVariant(c.status)}>{c.status || '—'}</Badge> },
    { key: 'resp', header: 'Técnico', render: (c) => c.resp || c.assumidoPor || '—' },
    { key: 'bucket', header: 'Fazenda', render: (c) => fazendaLabel(c.bucket) },
    { key: 'frota', header: 'Frota', render: (c) => codigoEquipDoChamado(c) || '—' },
    { key: 'data', header: 'Abertura', render: (c) => formatDataBR(c.data) },
    // `Encerramento.dataEncerramento` já vem formatada DD/MM/AAAA (ver
    // fmtDateHora em chamado-helpers.ts) — nunca passar por formatDataBR
    // (que espera ISO AAAA-MM-DD), senão o texto seria exibido invertido.
    { key: 'encerramento', header: 'Encerramento', render: (c) => c.encerramento?.dataEncerramento || '—' },
  ];

  // "Extrair" os chamados do filtro atual pra uma planilha de verdade
  // (CSV abre direto no Excel) — o PDF já existente é um relatório pra
  // leitura/impressão, não pra reaproveitar os dados em outra ferramenta.
  // Mesmo utilitário/formato já usado em Encerrados/Chamados/Auditoria
  // (utils/csv.ts) — sem lib nova, sem reimplementar o CSV.
  function exportarCsv() {
    downloadCSV('relatorio_gerencial_chamados.csv', [
      ['Número', 'Título', 'Status', 'Técnico', 'Fazenda', 'Frota', 'Abertura', 'Encerramento'],
      ...filtrados.map((c) => [
        c.num,
        c.titulo,
        c.status,
        c.resp || c.assumidoPor || '',
        fazendaLabel(c.bucket),
        codigoEquipDoChamado(c) || '',
        formatDataBR(c.data),
        c.encerramento?.dataEncerramento || '',
      ]),
    ]);
  }

  async function handleGerarPdf() {
    setGerandoPdf(true);
    try {
      const graficoDataUrl = chartRef.current ? chartRef.current.toBase64Image('image/png', 1) : null;
      const agora = new Date();
      await gerarRelatorioGerencialPdf({
        titulo: 'RELATÓRIO GERENCIAL DE CHAMADOS',
        periodo: periodoLabel,
        filtros: filtrosAplicados,
        geradoEm: `${formatDataBR(agora.toISOString().slice(0, 10))} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        kpis: [
          ...kpis.map((k) => ({ label: k.label, value: String(k.value) })),
          { label: 'Tempo médio de atendimento', value: tempoMedio !== null ? `${tempoMedio.toFixed(1)} dias` : '—' },
        ],
        chamados: filtrados,
        ranking: ranking.map(([nome, total]) => ({ nome, total })),
        graficoDataUrl,
      });
    } finally {
      setGerandoPdf(false);
    }
  }

  // Excel (.xlsx) com abas Resumo/Chamados/Técnicos/Fazendas/Frota —
  // mesmos dados já filtrados/calculados pela tela (utils/
  // relatorioGerencialExcel.ts), ao lado do PDF (leitura) e do CSV
  // (extração rápida de 1 aba só). `dataInicioISO`/`dataFimISO` só
  // nomeiam o arquivo — usa o período de abertura quando preenchido,
  // senão o de encerramento, senão cai no nome "completo_<hoje>".
  async function handleGerarExcel() {
    setGerandoExcel(true);
    try {
      const agora = new Date();
      await gerarRelatorioGerencialExcel({
        titulo: 'RELATÓRIO GERENCIAL DE CHAMADOS',
        periodo: periodoLabel,
        filtros: filtrosAplicados,
        geradoEm: `${formatDataBR(agora.toISOString().slice(0, 10))} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        kpis: [
          ...kpis.map((k) => ({ label: k.label, value: String(k.value) })),
          { label: 'Tempo médio de atendimento', value: tempoMedio !== null ? `${tempoMedio.toFixed(1)} dias` : '—' },
        ],
        chamados: filtrados,
        ranking: ranking.map(([nome, total]) => ({ nome, total })),
        tecnicos,
        dataInicioISO: aberturaDe || encerramentoDe || undefined,
        dataFimISO: aberturaAte || encerramentoAte || undefined,
      });
    } catch (err) {
      console.error('Falha ao gerar Excel do relatório gerencial', err);
      toast.error('Não foi possível gerar o Excel do relatório. Tente novamente.');
    } finally {
      setGerandoExcel(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-4">
          <RelatorioGerencialHeader titulo="RELATÓRIO GERENCIAL DE CHAMADOS" periodo={periodoLabel} filtrosAplicados={filtrosAplicados} />
        </CardContent>
      </Card>

      <FilterBar className="flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-[130px] flex-1 flex-col gap-1">
          <Label>Abertura de</Label>
          <Input type="date" value={aberturaDe} onChange={(e) => { setAberturaDe(e.target.value); setPage(1); }} />
        </div>
        <div className="flex min-w-[130px] flex-1 flex-col gap-1">
          <Label>Abertura até</Label>
          <Input type="date" value={aberturaAte} onChange={(e) => { setAberturaAte(e.target.value); setPage(1); }} />
        </div>
        <div className="flex min-w-[130px] flex-1 flex-col gap-1">
          <Label>Encerramento de</Label>
          <Input type="date" value={encerramentoDe} onChange={(e) => { setEncerramentoDe(e.target.value); setPage(1); }} />
        </div>
        <div className="flex min-w-[130px] flex-1 flex-col gap-1">
          <Label>Encerramento até</Label>
          <Input type="date" value={encerramentoAte} onChange={(e) => { setEncerramentoAte(e.target.value); setPage(1); }} />
        </div>
        <div className="flex min-w-[150px] flex-1 flex-col gap-1">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-[150px] flex-1 flex-col gap-1">
          <Label>Técnico</Label>
          <Select value={tecnicoSel} onValueChange={(v) => { setTecnicoSel(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {tecnicos.map((t) => (
                <SelectItem key={t.id} value={t.apelido || t.nome}>{t.apelido || t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-[150px] flex-1 flex-col gap-1">
          <Label>Fazenda/Setor</Label>
          <Select value={bucketSel} onValueChange={(v) => { setBucketSel(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {buckets.map((b) => (
                <SelectItem key={b} value={b}>{fazendaLabel(b)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-[150px] flex-1 flex-col gap-1">
          <Label>Frota/Equipamento</Label>
          <Select value={frotaSel} onValueChange={(v) => { setFrotaSel(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {frotas.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" onClick={exportarCsv} disabled={carregando || filtrados.length === 0} className="sm:self-end">
          <Sheet className="h-4 w-4" />
          Exportar CSV
        </Button>
        <Button variant="ghost" onClick={handleGerarExcel} disabled={gerandoExcel || carregando} className="sm:self-end">
          <FileSpreadsheet className="h-4 w-4" />
          {gerandoExcel ? 'Gerando…' : 'Exportar Excel'}
        </Button>
        <Button onClick={handleGerarPdf} disabled={gerandoPdf || carregando} className="sm:self-end">
          <FileDown className="h-4 w-4" />
          {gerandoPdf ? 'Gerando…' : 'Gerar PDF'}
        </Button>
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={carregando ? '—' : k.value} color={k.color} />
        ))}
        <KpiCard label="Tempo Médio de Atendimento" value={carregando ? '—' : tempoMedio !== null ? `${tempoMedio.toFixed(1)}d` : '—'} color="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Chamados por status</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            {carregando ? (
              <Skeleton className="h-full w-full" />
            ) : filtrados.length === 0 ? (
              <p className="text-sm text-subtle">Nenhum chamado no filtro selecionado.</p>
            ) : (
              <Bar ref={chartRef} data={chartData} options={{ ...chartBaseOptions, animation: false }} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ranking por técnico</CardTitle></CardHeader>
          <CardContent>
            {carregando ? <Skeleton className="h-40 w-full" /> : <RankingBars items={ranking} emptyLabel="Nenhum chamado do filtro atribuído a um técnico." />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Chamados no período/filtro ({filtrados.length.toLocaleString('pt-BR')})</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            columns={columns}
            rows={paginados}
            rowKey={(c) => c.num}
            loading={carregando}
            emptyTitle="Nenhum chamado encontrado"
            emptyDescription="Ajuste os filtros para ver resultados."
          />
          <Pagination page={page} totalItems={filtrados.length} perPage={PER_PAGE} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
