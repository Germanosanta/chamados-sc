import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { Badge } from '@/components/ui/badge';
import { PrioridadeBadge } from '@/components/shared/StatusBadge';
import { useChamadosIrrigacao } from '@/hooks/useIrrigacao';
import {
  STATUS_IRRIGACAO,
  TIPO_ATIVO_LABEL,
  calcularKpisIrrigacao,
  filtrarChamadosIrrigacao,
  formatarDataHora,
  formatarDuracao,
  isReincidente,
  minutosEntre,
  restabelecimentoDe,
  type FiltrosIrrigacao,
} from '@/utils/irrigacao';
import type { ChamadoIrrigacao } from '@/types/irrigacao';
import { FiltrosIrrigacaoBar } from './FiltrosIrrigacaoBar';

const POR_PAGINA = 20;

/** Painel principal: indicadores (clicáveis, viram filtro de situação),
 * filtros e a lista de chamados. */
export function PainelIrrigacao({ onAbrir }: { onAbrir: (num: string) => void }) {
  const { data: todos, carregando, erro } = useChamadosIrrigacao();
  const [filtros, setFiltros] = useState<FiltrosIrrigacao>({ status: 'abertos' });
  const [apenasReincidentes, setApenasReincidentes] = useState(false);
  const [pagina, setPagina] = useState(1);

  // KPIs consideram todos os filtros menos a situação, para os cartões
  // continuarem mostrando a distribuição completa.
  const semStatus = useMemo(() => filtrarChamadosIrrigacao(todos, { ...filtros, status: '' }), [todos, filtros]);
  const kpis = useMemo(() => calcularKpisIrrigacao(semStatus, todos), [semStatus, todos]);
  const filtrados = useMemo(() => {
    const base = filtrarChamadosIrrigacao(todos, filtros);
    return apenasReincidentes ? base.filter((c) => isReincidente(c, todos)) : base;
  }, [todos, filtros, apenasReincidentes]);

  useEffect(() => setPagina(1), [filtros, apenasReincidentes]);

  const situacao = (status: string, reincidentes = false) => {
    setApenasReincidentes(reincidentes);
    setFiltros((f) => ({ ...f, status }));
  };
  const ativo = (status: string, reincidentes = false) => apenasReincidentes === reincidentes && (filtros.status || '') === status;

  const colunas: DataTableColumn<ChamadoIrrigacao>[] = [
    {
      key: 'num',
      header: 'Número',
      render: (c) => (
        <div className="flex flex-col">
          <span className="font-mono-num font-semibold text-primary">{c.num}</span>
          {isReincidente(c, todos) && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <RotateCcw className="h-3 w-3" /> Reincidente
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'ativo',
      header: 'Equipamento',
      render: (c) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{c.ativoNome}</span>
          <span className="text-xs text-muted-foreground">
            {TIPO_ATIVO_LABEL[c.ativoTipo]} · {c.fazenda || '—'} · {c.modulo || '—'}
          </span>
        </div>
      ),
    },
    { key: 'falha', header: 'Falha', render: (c) => <div className="max-w-[220px] truncate" title={c.tipoFalha}>{c.tipoFalha}</div> },
    { key: 'identificado', header: 'Identificada em', render: (c) => <span className="text-sm">{formatarDataHora(c.identificadoEm)}</span> },
    {
      key: 'indisp',
      header: 'Indisponível',
      render: (c) => {
        const fim = restabelecimentoDe(c);
        return <span className="text-sm">{fim ? formatarDuracao(minutosEntre(c.identificadoEm, fim)) : `${formatarDuracao(minutosEntre(c.identificadoEm, new Date().toISOString()))} (em curso)`}</span>;
      },
    },
    { key: 'tecnico', header: 'Técnico', render: (c) => c.tecnico || <span className="text-subtle">Sem técnico</span> },
    { key: 'prioridade', header: 'Prioridade', render: (c) => <PrioridadeBadge prioridade={c.prioridade} /> },
    { key: 'status', header: 'Situação', render: (c) => <Badge variant={STATUS_IRRIGACAO[c.status]?.variant || 'neutral'}>{STATUS_IRRIGACAO[c.status]?.label || c.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total em aberto" value={kpis.abertos} color="blue" onClick={() => situacao('abertos')} active={ativo('abertos')} compact />
        <KpiCard label="Aguardando atendimento" value={kpis.aguardando} color="red" onClick={() => situacao('aguardando')} active={ativo('aguardando')} compact />
        <KpiCard label="Em atendimento" value={kpis.emAtendimento} color="amber" onClick={() => situacao('em_atendimento')} active={ativo('em_atendimento')} compact />
        <KpiCard label="Aguardando peças" value={kpis.aguardandoPecas} color="purple" onClick={() => situacao('aguardando_pecas')} active={ativo('aguardando_pecas')} compact />
        <KpiCard label="Comunicação restabelecida" value={kpis.restabelecida} color="teal" onClick={() => situacao('restabelecida')} active={ativo('restabelecida')} compact />
        <KpiCard label="Encerrados" value={kpis.encerrados} color="green" onClick={() => situacao('encerrado')} active={ativo('encerrado')} compact />
        <KpiCard label="Reincidentes" value={kpis.reincidentes} sub="mesmo ativo em 30 dias" color="red" onClick={() => situacao('', true)} active={ativo('', true)} compact />
      </div>

      <FiltrosIrrigacaoBar
        filtros={filtros}
        onChange={(f) => {
          setApenasReincidentes(false);
          setFiltros(f);
        }}
        chamados={todos}
      />

      {erro && <p className="rounded-sm border border-destructive bg-destructive-bg p-3 text-sm text-destructive">Não foi possível carregar os chamados: {erro.message}</p>}

      <DataTable
        columns={colunas}
        rows={filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)}
        rowKey={(c) => c.num}
        onRowClick={(c) => onAbrir(c.num)}
        loading={carregando}
        emptyTitle="Nenhum chamado de irrigação encontrado"
      />
      <Pagination page={pagina} totalItems={filtrados.length} perPage={POR_PAGINA} onPageChange={setPagina} />
    </div>
  );
}
