import { useMemo } from 'react';
import { KpiCard } from '@/components/shared/KpiCard';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { useChamados } from '@/hooks/useChamados';
import { useTecnicosAtivos } from '@/hooks/useTecnicos';
import { isFechado } from '@/utils/chamado-helpers';

interface LinhaResp {
  name: string;
  label: string;
  atribuidos: number;
  abertosPor: number;
  encerradosPor: number;
  emAberto: number;
  emAndamento: number;
  encerrados: number;
  tempoAtend: string;
  tempoConc: string;
}

function hasResp(respStr: string | undefined, name: string): boolean {
  return (respStr || '').split(',').map((s) => s.trim()).some((s) => s === name);
}

function daysBetween(d1?: string, d2?: string): number | null {
  if (!d1 || !d2) return null;
  const diff = (new Date(d2).getTime() - new Date(d1 + 'T00:00').getTime()) / 86400000;
  return diff >= 0 ? Math.round(diff) : null;
}

/**
 * Relatórios → Responsáveis — portado de renderRespSection()
 * (relatorios/index.js), mesmos cálculos, mesma fonte única de
 * responsáveis (_tecnicosAtivos()). Apresentado como tabela — os
 * gráficos (barra/donut) da V2 ficam para uma próxima passada de
 * polish, não bloqueiam os números em si.
 */
export function ResponsaveisPage() {
  const { data: todos, carregando } = useChamados();
  const { data: tecnicos } = useTecnicosAtivos();

  const linhas: LinhaResp[] = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return tecnicos.map((t) => {
      const name = t.apelido || t.nome;
      const atribuidos = todos.filter((r) => hasResp(r.resp, name));
      const abertosPor = todos.filter((r) => r.abertoPor?.includes(name)).length;
      const encerradosPor = todos.filter((r) => r.encerramento?.encerradoPor?.includes(name)).length;
      const emAberto = atribuidos.filter((r) => r.status === 'Não iniciado').length;
      const emAndamento = atribuidos.filter((r) => r.status === 'Em Andamento' || r.status === 'Em Atendimento').length;
      const encerrados = atribuidos.filter(isFechado).length;

      let somaAtend = 0;
      let cntAtend = 0;
      for (const r of atribuidos) {
        if ((r.status === 'Em Andamento' || r.status === 'Em Atendimento') && r.data) {
          const d = daysBetween(r.data, hoje);
          if (d !== null) {
            somaAtend += d;
            cntAtend++;
          }
        }
      }

      let somaConc = 0;
      let cntConc = 0;
      for (const r of atribuidos) {
        if (r.encerramento?.encerradoEm && r.data) {
          const d = daysBetween(r.data, r.encerramento.encerradoEm.slice(0, 10));
          if (d !== null) {
            somaConc += d;
            cntConc++;
          }
        }
      }

      return {
        name,
        label: t.nome,
        atribuidos: atribuidos.length,
        abertosPor,
        encerradosPor,
        emAberto,
        emAndamento,
        encerrados,
        tempoAtend: cntAtend ? `${(somaAtend / cntAtend).toFixed(1)}d` : '—',
        tempoConc: cntConc ? `${(somaConc / cntConc).toFixed(1)}d` : '—',
      };
    });
  }, [todos, tecnicos]);

  const totalAtribuicoes = linhas.reduce((a, l) => a + l.atribuidos, 0);

  const columns: DataTableColumn<LinhaResp>[] = [
    { key: 'label', header: 'Responsável', render: (l) => <span className="font-semibold text-foreground">{l.label}</span> },
    { key: 'atribuidos', header: 'Atribuídos', render: (l) => <span className="font-mono-num font-bold">{l.atribuidos}</span> },
    { key: 'abertosPor', header: 'Abriu', render: (l) => l.abertosPor || '—' },
    { key: 'encerradosPor', header: 'Encerrou', render: (l) => l.encerradosPor || '—' },
    { key: 'emAberto', header: 'Em Aberto', render: (l) => <Badge variant="red">{l.emAberto}</Badge> },
    { key: 'emAndamento', header: 'Em Andamento', render: (l) => <Badge variant="amber">{l.emAndamento}</Badge> },
    { key: 'encerrados', header: 'Encerrados', render: (l) => <Badge variant="green">{l.encerrados}</Badge> },
    { key: 'tempoAtend', header: 'T. Médio Atend.', render: (l) => <span className="font-mono-num text-warning">{l.tempoAtend}</span> },
    { key: 'tempoConc', header: 'T. Médio Conclusão', render: (l) => <span className="font-mono-num text-success">{l.tempoConc}</span> },
    { key: 'pct', header: '% do Total', render: (l) => (totalAtribuicoes ? `${Math.round((l.atribuidos / totalAtribuicoes) * 100)}%` : '0%') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Técnicos Ativos" value={carregando ? '—' : tecnicos.length} color="blue" />
        <KpiCard label="Total de Atribuições" value={totalAtribuicoes} color="amber" />
        <KpiCard label="Chamados Considerados" value={todos.length} color="green" />
      </div>
      <DataTable columns={columns} rows={linhas} rowKey={(l) => l.name} loading={carregando} emptyTitle="Nenhum técnico ativo cadastrado" />
    </div>
  );
}
