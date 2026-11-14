import { useMemo, useState } from 'react';
import { KpiCard } from '@/components/shared/KpiCard';
import { RankingBars } from '@/components/shared/RankingBars';
import { useChamadosIrrigacao } from '@/hooks/useIrrigacao';
import { calcularIndicadoresIrrigacao, filtrarChamadosIrrigacao, formatarDataHora, formatarDuracao, type FiltrosIrrigacao } from '@/utils/irrigacao';
import { FiltrosIrrigacaoBar } from './FiltrosIrrigacaoBar';

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-subtle">{titulo}</h2>
      {children}
    </section>
  );
}

const nomeMes = (aaaamm: string) => {
  const [a, m] = aaaamm.split('-').map(Number);
  return a && m ? new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : aaaamm;
};

/** Histórico e indicadores: equipamentos com mais falhas, reincidências,
 * tempos médios, chamados por fazenda/técnico e evolução mensal. */
export function IndicadoresIrrigacao({ onAbrir }: { onAbrir: (num: string) => void }) {
  const { data: todos } = useChamadosIrrigacao();
  const [filtros, setFiltros] = useState<FiltrosIrrigacao>({});
  const lista = useMemo(() => filtrarChamadosIrrigacao(todos, filtros), [todos, filtros]);
  const ind = useMemo(() => calcularIndicadoresIrrigacao(lista, todos), [lista, todos]);

  return (
    <div className="flex flex-col gap-4">
      <FiltrosIrrigacaoBar filtros={filtros} onChange={setFiltros} chamados={todos} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Chamados no período" value={lista.length} color="blue" compact />
        <KpiCard label="Reincidentes" value={ind.reincidentes.length} sub="mesmo ativo em 30 dias" color="red" compact />
        <KpiCard label="Tempo médio de atendimento" value={formatarDuracao(ind.tempoMedioAtendimentoMin)} sub="abertura → encerramento" color="amber" compact />
        <KpiCard label="Indisponibilidade média" value={formatarDuracao(ind.indisponibilidadeMediaMin)} sub="falha → restabelecimento" color="purple" compact />
        <KpiCard label="Indisponibilidade total" value={formatarDuracao(ind.indisponibilidadeTotalMin)} color="teal" compact />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Equipamentos com mais falhas">
          <RankingBars items={ind.porAtivo.slice(0, 10)} emptyLabel="Sem chamados no período" />
        </Painel>
        <Painel titulo="Evolução mensal">
          <RankingBars items={ind.porMes.map(([m, n]): [string, number] => [nomeMes(m), n])} emptyLabel="Sem chamados no período" />
        </Painel>
        <Painel titulo="Chamados por fazenda">
          <RankingBars items={ind.porFazenda} emptyLabel="Sem chamados no período" />
        </Painel>
        <Painel titulo="Chamados por técnico">
          <RankingBars items={ind.porTecnico} emptyLabel="Sem chamados no período" />
        </Painel>
      </div>
      <Painel titulo={`Ocorrências repetidas (${ind.reincidentes.length})`}>
        {ind.reincidentes.length ? (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {ind.reincidentes.map((c) => (
              <li key={c.num}>
                <button type="button" onClick={() => onAbrir(c.num)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 py-2 text-left hover:text-primary">
                  <span className="font-mono-num font-semibold text-primary">{c.num}</span>
                  <span className="font-medium">{c.ativoNome}</span>
                  <span className="text-muted-foreground">{c.fazenda} · {c.tipoFalha}</span>
                  <span className="ml-auto text-xs text-subtle">{formatarDataHora(c.identificadoEm)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-subtle">Nenhuma falha repetida no mesmo equipamento em até 30 dias.</p>
        )}
      </Painel>
    </div>
  );
}
