import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { KpiCard } from '@/components/shared/KpiCard';
import { RankingBars } from '@/components/shared/RankingBars';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge, CulturaBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useChamados } from '@/hooks/useChamados';
import { useComputeStats, MONTHS } from '@/hooks/useDashboardStats';
import { useDetalheStore } from '@/store/detalhe';
import { chartBaseOptions } from '@/utils/chartSetup';
import { fazendaLabel } from '@/utils/chamado-helpers';

const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** chartBaseOptions vem com legenda desligada (é o certo pra gráfico de
 * série única, ex. "Por Fazenda/Sistema") — mas todo gráfico com mais de
 * 1 dataset (evolução mensal por cultura, comparativo anual) precisa da
 * legenda pra série ser identificável; sem isso as barras empilhadas/
 * agrupadas viram cor sem significado. */
const multiSeriesOptions = { ...chartBaseOptions, plugins: { ...chartBaseOptions.plugins, legend: { display: true, position: 'bottom' as const } } };

/** Dashboard executivo — portado de initDashboard()/computeStats()
 * (dashboard/index.js): mesmos KPIs e gráficos (evolução mensal, donut
 * por cultura, por fazenda/sistema, ranking de responsáveis/
 * equipamentos, últimos 10), mais 3 blocos que useComputeStats() já
 * calculava mas que ainda não tinham sido ligados a nenhuma tela
 * (byYear/issues/vencidos/cancelados — todos dados reais, sem nada
 * inventado): comparativo anual, principais problemas (keyword-matching
 * sobre número+título, igual à V2) e um filtro de cultura que reaproveita
 * o parâmetro `records` que useComputeStats já aceitava. */
export function DashboardPage() {
  const navigate = useNavigate();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);
  const { data: todos } = useChamados();

  const [cultura, setCultura] = useState('');
  const registros = useMemo(() => (cultura ? todos.filter((c) => c.cultura === cultura) : todos), [todos, cultura]);
  const { stats, carregando } = useComputeStats(registros);

  const labels = useMemo(() => MONTHS.map((m) => `${MESES_ABR[parseInt(m.slice(5, 7), 10) - 1]}-${m.slice(2, 4)}`), []);

  const evolucaoData = {
    labels,
    datasets: [
      { label: 'Grãos e Fibras', data: stats.monthsG, backgroundColor: 'rgba(37,99,235,.8)', borderRadius: 2, borderSkipped: false as const },
      { label: 'Tabaco', data: stats.monthsT, backgroundColor: 'rgba(217,119,6,.8)', borderRadius: 2, borderSkipped: false as const },
      { label: 'Cacau', data: stats.monthsC, backgroundColor: 'rgba(146,64,14,.8)', borderRadius: 2, borderSkipped: false as const },
      { label: 'Sem cultura', data: stats.monthsO, backgroundColor: 'rgba(148,163,184,.6)', borderRadius: 2, borderSkipped: false as const },
    ],
  };

  const cultTotals = {
    graos: stats.monthsG.reduce((a, b) => a + b, 0),
    tabaco: stats.monthsT.reduce((a, b) => a + b, 0),
    cacau: stats.monthsC.reduce((a, b) => a + b, 0),
    outros: stats.monthsO.reduce((a, b) => a + b, 0),
  };
  const donutData = {
    labels: ['Grãos e Fibras', 'Tabaco', 'Cacau', 'Sem cultura'],
    datasets: [{ data: [cultTotals.graos, cultTotals.tabaco, cultTotals.cacau, cultTotals.outros], backgroundColor: ['#2563eb', '#d97706', '#92400e', '#94a3b8'], borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }],
  };

  const bktEntries = Object.entries(stats.bktMap).sort((a, b) => b[1] - a[1]);
  const bucketData = {
    labels: bktEntries.map(([b]) => fazendaLabel(b)),
    datasets: [{ data: bktEntries.map(([, v]) => v), backgroundColor: ['rgba(37,99,235,.85)', 'rgba(13,148,136,.85)', 'rgba(217,119,6,.85)', 'rgba(220,38,38,.8)', 'rgba(100,116,139,.7)'], borderRadius: 4, borderSkipped: false as const }],
  };

  const respTop5 = Object.entries(stats.respMap).sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][];
  const equipTop6 = Object.entries(stats.equipMap).sort((a, b) => b[1] - a[1]).slice(0, 6) as [string, number][];
  const recentes = useMemo(() => [...stats.all].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 10), [stats.all]);

  const anos = useMemo(() => Object.keys(stats.byYear).map(Number).sort((a, b) => a - b), [stats.byYear]);
  const anoData = {
    labels: anos.map(String),
    datasets: [
      { label: 'Total', data: anos.map((a) => stats.byYear[a].total), backgroundColor: 'rgba(100,116,139,.55)', borderRadius: 2, borderSkipped: false as const },
      { label: 'Concluídos', data: anos.map((a) => stats.byYear[a].conc), backgroundColor: 'rgba(22,163,74,.85)', borderRadius: 2, borderSkipped: false as const },
      { label: 'Em Aberto', data: anos.map((a) => stats.byYear[a].aberto), backgroundColor: 'rgba(220,38,38,.8)', borderRadius: 2, borderSkipped: false as const },
    ],
  };

  const problemasTop = useMemo(
    () => ([...stats.issues].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) as [string, number][]),
    [stats.issues],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Total" value={carregando ? '—' : stats.total} color="blue" onClick={() => navigate('/chamados')} />
        <KpiCard label="Em Aberto" value={carregando ? '—' : stats.emAberto} color="red" onClick={() => navigate('/aberto')} />
        <KpiCard label="Em Atendimento" value={carregando ? '—' : stats.atendimento} color="amber" />
        <KpiCard label="Aguardando Peça" value={carregando ? '—' : stats.aguardando} color="purple" />
        <KpiCard label="Concluídos" value={carregando ? '—' : stats.concluidos} color="green" onClick={() => navigate('/encerrados')} />
        <KpiCard label="Cancelados" value={carregando ? '—' : stats.cancelados} color="cacau" />
        <KpiCard label="Vencidos (+7d)" value={carregando ? '—' : stats.vencidos} color="red" />
        <KpiCard label="Tempo Médio" value={carregando || stats.tempoMedio === '—' ? '—' : `${stats.tempoMedio}d`} color="teal" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-subtle">Cultura</span>
        <Select value={cultura || 'todas'} onValueChange={(v) => setCultura(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as culturas</SelectItem>
            <SelectItem value="Grãos e Fibras">Grãos e Fibras</SelectItem>
            <SelectItem value="Tabaco">Tabaco</SelectItem>
            <SelectItem value="Cacau">Cacau</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Evolução Mensal por Cultura</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {carregando ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <Bar
                data={evolucaoData}
                options={{ ...multiSeriesOptions, scales: { x: { ...chartBaseOptions.scales.x, stacked: true, ticks: { maxRotation: 45 } }, y: { ...chartBaseOptions.scales.y, stacked: true } } }}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Distribuição por Cultura</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {carregando ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: true, position: 'bottom' } } }} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Comparativo Anual</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            {carregando ? <Skeleton className="h-full w-full" /> : <Bar data={anoData} options={multiSeriesOptions} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Principais Problemas</CardTitle></CardHeader>
          <CardContent>
            {carregando ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <RankingBars items={problemasTop} emptyLabel="Sem padrão identificável ainda." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Por Fazenda / Sistema</CardTitle></CardHeader>
          <CardContent style={{ height: 220 }}>
            {carregando ? <Skeleton className="h-full w-full" /> : <Bar data={bucketData} options={{ ...chartBaseOptions, indexAxis: 'y' as const }} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top 5 Responsáveis</CardTitle></CardHeader>
          <CardContent>{carregando ? <Skeleton className="h-32 w-full" /> : <RankingBars items={respTop5} />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ranking de Equipamentos</CardTitle></CardHeader>
          <CardContent>
            {carregando ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <RankingBars items={equipTop6} emptyLabel="Sem chamados vinculados a equipamento ainda." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimos 10 Chamados</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1">
          {carregando && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          {!carregando && recentes.length === 0 && <EmptyState title="Nenhum chamado registrado ainda" />}
          {!carregando && recentes.map((c) => (
            <button
              key={c.num}
              onClick={() => abrirDetalhe(c.num)}
              className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono-num font-semibold text-primary">{c.num}</span> {c.titulo}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <CulturaBadge cultura={c.cultura} />
                <StatusBadge status={c.status} />
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
