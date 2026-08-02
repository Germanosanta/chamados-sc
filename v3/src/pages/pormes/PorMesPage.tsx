import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useChamados } from '@/hooks/useChamados';
import { chartBaseOptions } from '@/utils/chartSetup';

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CULTURAS = [
  { key: 'g', label: 'Grãos e Fibras' },
  { key: 't', label: 'Tabaco' },
  { key: 'c', label: 'Cacau' },
  { key: 'o', label: 'Sem cultura' },
];

function heatColor(v: number, max: number): string {
  if (!v) return 'var(--surface3)';
  const pct = v / max;
  if (pct < 0.25) return '#dbeafe';
  if (pct < 0.5) return '#93c5fd';
  if (pct < 0.75) return '#3b82f6';
  return '#1d4ed8';
}

/** Relatório Por Mês — portado de renderMesCharts() (dashboard/index.js):
 * seletor de ano, barras empilhadas do ano, donut, heatmap cultura×mês. */
export function PorMesPage() {
  const { data: todos, carregando } = useChamados();
  const [ano, setAno] = useState(2025);

  const { mg, mt, mc, mo } = useMemo(() => {
    const mg = Array(12).fill(0);
    const mt = Array(12).fill(0);
    const mc = Array(12).fill(0);
    const mo = Array(12).fill(0);
    for (const r of todos) {
      if (!r.data || !r.data.startsWith(String(ano))) continue;
      const m = parseInt(r.data.slice(5, 7), 10) - 1;
      if (m < 0 || m >= 12) continue;
      if (r.cultura === 'Grãos e Fibras') mg[m]++;
      else if (r.cultura === 'Tabaco') mt[m]++;
      else if (r.cultura === 'Cacau') mc[m]++;
      else mo[m]++;
    }
    return { mg, mt, mc, mo };
  }, [todos, ano]);

  const totais = { g: mg.reduce((a, b) => a + b, 0), t: mt.reduce((a, b) => a + b, 0), c: mc.reduce((a, b) => a + b, 0), o: mo.reduce((a, b) => a + b, 0) };
  const totalAno = totais.g + totais.t + totais.c + totais.o;
  const maxCell = Math.max(...mg, ...mt, ...mc, ...mo, 1);
  const linhas: Record<string, number[]> = { g: mg, t: mt, c: mc, o: mo };

  const barData = {
    labels: MESES_PT,
    datasets: [
      { label: 'Grãos e Fibras', data: mg, backgroundColor: 'rgba(37,99,235,.85)', borderRadius: 3, borderSkipped: false as const },
      { label: 'Tabaco', data: mt, backgroundColor: 'rgba(217,119,6,.85)', borderRadius: 3, borderSkipped: false as const },
      { label: 'Cacau', data: mc, backgroundColor: 'rgba(146,64,14,.85)', borderRadius: 3, borderSkipped: false as const },
      { label: 'Sem cultura', data: mo, backgroundColor: 'rgba(148,163,184,.6)', borderRadius: 3, borderSkipped: false as const },
    ],
  };
  const donutData = {
    labels: ['Grãos e Fibras', 'Tabaco', 'Cacau', 'Outros'],
    datasets: [{ data: [totais.g, totais.t, totais.c, totais.o], backgroundColor: ['#2563eb', '#d97706', '#92400e', '#94a3b8'], borderWidth: 2, borderColor: '#fff', hoverOffset: 5 }],
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Ano anterior" disabled={ano <= 2022} onClick={() => setAno((a) => a - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-mono-num text-lg font-bold text-foreground">{ano}</span>
        <Button variant="ghost" size="icon" aria-label="Próximo ano" disabled={ano >= 2026} onClick={() => setAno((a) => a + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Chamados por Mês — {ano}</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {carregando ? null : (
              <Bar
                data={barData}
                options={{ ...chartBaseOptions, scales: { x: { ...chartBaseOptions.scales.x, stacked: true }, y: { ...chartBaseOptions.scales.y, stacked: true } } }}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Total em {ano}: {totalAno.toLocaleString('pt-BR')}</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: true, position: 'bottom' } } }} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Heatmap — {ano}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-1 text-left text-xs text-subtle">Cultura</th>
                {MESES_PT.map((m) => (
                  <th key={m} className="p-1 text-center text-xs text-subtle">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CULTURAS.map((cu) => (
                <tr key={cu.key}>
                  <td className="whitespace-nowrap p-1 text-xs font-medium text-foreground">{cu.label}</td>
                  {linhas[cu.key].map((v, i) => (
                    <td key={i} className="p-1 text-center">
                      <div
                        className="mx-auto flex h-7 w-7 items-center justify-center rounded-xs text-xs font-semibold"
                        style={{ background: heatColor(v, maxCell), color: v / maxCell > 0.5 ? '#fff' : 'var(--text)' }}
                        title={`${v} chamado(s)`}
                      >
                        {v || ''}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
