import { useMemo } from 'react';
import { KpiCard } from '@/components/shared/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAbertos, useChamados } from '@/hooks/useChamados';
import { useDetalheStore } from '@/store/detalhe';
import { diasAberto, fazendaLabel, isSlaCritico } from '@/utils/chamado-helpers';
import { cn } from '@/utils/cn';

/**
 * Painel Operacional — portado de renderPainel() (dashboard/index.js):
 * mesmos 5 KPIs em tempo real, críticos, ranking de técnicos (semana),
 * por sistema, tempo médio por técnico. A "Sugestão de IA" (busca por
 * keyword-matching no histórico + Banco de Soluções) fica pendente —
 * depende do Banco de Soluções já estar mais maduro pra valer a pena.
 */
export function PainelPage() {
  const { data: abertos, carregando } = useAbertos();
  const { data: todos } = useChamados();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);

  const stats = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - 7);

    const criticos = abertos.filter((c) => c.prior === 'Urgente').length;
    const vencidos = abertos.filter(isSlaCritico).length;
    const abertosHoje = todos.filter((c) => c.data === hoje).length;
    const encerradosHoje = todos.filter((c) => c.encerramento?.encerradoEm?.slice(0, 10) === hoje).length;

    let slaOk = 0;
    let slaTotal = 0;
    for (const c of todos) {
      if (!c.data || !c.encerramento?.encerradoEm) continue;
      slaTotal++;
      const dias = Math.floor((new Date(c.encerramento.encerradoEm).getTime() - new Date(c.data + 'T00:00').getTime()) / 86400000);
      if (dias <= 7) slaOk++;
    }
    const slaPct = slaTotal ? Math.round((slaOk / slaTotal) * 100) : 0;

    const criticosList = abertos
      .filter((c) => c.prior === 'Urgente')
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
      .slice(0, 6);

    const rankMap = new Map<string, number>();
    for (const c of todos) {
      if (c.encerramento?.encerradoEm && new Date(c.encerramento.encerradoEm) >= inicioSemana) {
        const n = c.encerramento.encerradoPor || 'Sistema';
        rankMap.set(n, (rankMap.get(n) || 0) + 1);
      }
    }
    const ranking = [...rankMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const sistMap = new Map<string, number>();
    for (const c of abertos) {
      if (c.bucket) sistMap.set(c.bucket, (sistMap.get(c.bucket) || 0) + 1);
    }
    const sistemas = [...sistMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const tempoPorTecnico = new Map<string, { soma: number; cnt: number }>();
    for (const c of todos) {
      if (!c.data || !c.encerramento?.encerradoEm || !c.encerramento.encerradoPor) continue;
      const dias = Math.floor((new Date(c.encerramento.encerradoEm).getTime() - new Date(c.data + 'T00:00').getTime()) / 86400000);
      if (dias < 0) continue;
      const atual = tempoPorTecnico.get(c.encerramento.encerradoPor) || { soma: 0, cnt: 0 };
      atual.soma += dias;
      atual.cnt++;
      tempoPorTecnico.set(c.encerramento.encerradoPor, atual);
    }
    const tempoTecnico = [...tempoPorTecnico.entries()].map(([n, v]) => [n, v.soma / v.cnt] as [string, number]).sort((a, b) => a[1] - b[1]).slice(0, 5);

    return { criticos, vencidos, abertosHoje, encerradosHoje, slaPct, criticosList, ranking, sistemas, tempoTecnico };
  }, [abertos, todos]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Críticos Abertos" value={carregando ? '—' : stats.criticos} color="red" />
        <KpiCard label="Vencidos (+7d)" value={carregando ? '—' : stats.vencidos} color="amber" />
        <KpiCard label="Abertos Hoje" value={carregando ? '—' : stats.abertosHoje} color="blue" />
        <KpiCard label="Encerrados Hoje" value={carregando ? '—' : stats.encerradosHoje} color="green" />
        <KpiCard
          label="SLA Geral"
          value={carregando ? '—' : `${stats.slaPct}%`}
          color={stats.slaPct >= 90 ? 'green' : stats.slaPct >= 70 ? 'amber' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>🚨 Chamados Críticos</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {!carregando && stats.criticosList.length === 0 && <p className="text-sm text-subtle">Nenhum chamado crítico.</p>}
            {stats.criticosList.map((c) => (
              <OpRow key={c.num} onClick={() => abrirDetalhe(c.num)}>
                <span className="font-mono-num text-xs text-primary">{c.num}</span>
                <span className="min-w-0 flex-1 truncate text-xs">{c.titulo}</span>
                <span className={cn('text-xs font-semibold', diasAberto(c.data) > 7 ? 'text-destructive' : 'text-warning')}>{diasAberto(c.data)}d</span>
              </OpRow>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>🏆 Ranking de Técnicos (semana)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {!carregando && stats.ranking.length === 0 && <p className="text-sm text-subtle">Sem dados nesta semana.</p>}
            {stats.ranking.map(([nome, v], i) => (
              <OpRow key={nome}>
                <span className="min-w-5 font-bold text-subtle">{i + 1}º</span>
                <span className="min-w-0 flex-1 truncate">{nome.split(' ')[0]}</span>
                <span className="font-bold text-primary">{v}</span>
              </OpRow>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>📡 Por Sistema</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {!carregando && stats.sistemas.length === 0 && <p className="text-sm text-subtle">Sem chamados abertos.</p>}
            {stats.sistemas.map(([bucket, v]) => (
              <OpRow key={bucket}>
                <span className="min-w-0 flex-1 truncate text-xs">{fazendaLabel(bucket)}</span>
                <span className="font-bold text-foreground">{v}</span>
              </OpRow>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>⏱ Tempo Médio por Técnico</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {!carregando && stats.tempoTecnico.length === 0 && <p className="text-sm text-subtle">Sem chamados encerrados suficientes ainda.</p>}
          {stats.tempoTecnico.map(([nome, dias]) => (
            <div key={nome} className="rounded-sm border border-border bg-muted p-2.5 text-center">
              <div className="font-mono-num text-lg font-bold text-foreground">{dias.toFixed(1)}d</div>
              <div className="truncate text-xs text-subtle">{nome.split(' ')[0]}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function OpRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('flex items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm', onClick && 'hover:bg-muted')}>
      {children}
    </Comp>
  );
}
