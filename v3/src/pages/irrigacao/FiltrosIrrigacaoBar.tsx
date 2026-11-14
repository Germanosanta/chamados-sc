import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterBar } from '@/components/shared/FilterBar';
import { ATIVOS_IRRIGACAO } from '@/hooks/useIrrigacao';
import { STATUS_IRRIGACAO, TIPO_ATIVO_LABEL, type FiltrosIrrigacao } from '@/utils/irrigacao';
import type { ChamadoIrrigacao, StatusIrrigacao, TipoAtivoIrrigacao } from '@/types/irrigacao';

const TODOS = '__todos__';

function Seletor({
  valor,
  onChange,
  rotulo,
  opcoes,
  largura = 'w-44',
}: {
  valor?: string;
  onChange: (v: string) => void;
  rotulo: string;
  opcoes: [string, string][];
  largura?: string;
}) {
  return (
    <Select value={valor || TODOS} onValueChange={(v) => onChange(v === TODOS ? '' : v)}>
      <SelectTrigger className={largura} aria-label={rotulo}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{rotulo}</SelectItem>
        {opcoes.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Filtros do painel e dos indicadores: fazenda, módulo, tipo, equipamento,
 * técnico, situação e período. Opções vêm do cadastro + chamados existentes. */
export function FiltrosIrrigacaoBar({
  filtros,
  onChange,
  chamados,
  mostrarStatus = true,
}: {
  filtros: FiltrosIrrigacao;
  onChange: (f: FiltrosIrrigacao) => void;
  chamados: ChamadoIrrigacao[];
  mostrarStatus?: boolean;
}) {
  const set = (campo: keyof FiltrosIrrigacao) => (v: string) => {
    const novo = { ...filtros, [campo]: v };
    // Equipamento depende de fazenda/módulo/tipo: limpa se deixar de bater.
    if (campo !== 'ativoId' && campo !== 'busca' && novo.ativoId) {
      const a = ATIVOS_IRRIGACAO.find((x) => x.id === novo.ativoId);
      if (a && ((novo.fazenda && a.fazenda !== novo.fazenda) || (novo.modulo && a.modulo !== novo.modulo) || (novo.tipoAtivo && a.tipo !== novo.tipoAtivo))) novo.ativoId = '';
    }
    onChange(novo);
  };

  const fazendas = useMemo(() => [...new Set(ATIVOS_IRRIGACAO.map((a) => a.fazenda).filter(Boolean))].sort(), []);
  const modulos = useMemo(
    () => [...new Set(ATIVOS_IRRIGACAO.filter((a) => !filtros.fazenda || a.fazenda === filtros.fazenda).map((a) => a.modulo).filter(Boolean))].sort(),
    [filtros.fazenda],
  );
  const ativos = useMemo(
    () =>
      ATIVOS_IRRIGACAO.filter(
        (a) =>
          (!filtros.fazenda || a.fazenda === filtros.fazenda) &&
          (!filtros.modulo || a.modulo === filtros.modulo) &&
          (!filtros.tipoAtivo || a.tipo === filtros.tipoAtivo),
      ),
    [filtros.fazenda, filtros.modulo, filtros.tipoAtivo],
  );
  const tecnicos = useMemo(() => [...new Set(chamados.map((c) => c.tecnico || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [chamados]);
  const algum = Object.values(filtros).some(Boolean);

  return (
    <FilterBar>
      <Input value={filtros.busca || ''} onChange={(e) => set('busca')(e.target.value)} placeholder="Buscar nº, equipamento, falha…" className="w-full sm:w-56" aria-label="Buscar chamados" />
      <Seletor valor={filtros.fazenda} onChange={set('fazenda')} rotulo="Toda fazenda" opcoes={fazendas.map((f) => [f, f])} largura="w-36" />
      <Seletor valor={filtros.modulo} onChange={set('modulo')} rotulo="Todo módulo" opcoes={modulos.map((m) => [m, m])} largura="w-36" />
      <Seletor
        valor={filtros.tipoAtivo}
        onChange={set('tipoAtivo')}
        rotulo="Todo tipo"
        opcoes={(Object.keys(TIPO_ATIVO_LABEL) as TipoAtivoIrrigacao[]).map((t) => [t, TIPO_ATIVO_LABEL[t]])}
      />
      <Seletor valor={filtros.ativoId} onChange={set('ativoId')} rotulo="Todo equipamento" opcoes={ativos.map((a) => [a.id, `${a.nome} · ${a.fazenda || '—'}`])} largura="w-48" />
      <Seletor valor={filtros.tecnico} onChange={set('tecnico')} rotulo="Todo técnico" opcoes={tecnicos.map((t) => [t, t])} />
      {mostrarStatus && (
        <Seletor
          valor={filtros.status}
          onChange={set('status')}
          rotulo="Toda situação"
          opcoes={[['abertos', 'Todos em aberto'], ...(Object.keys(STATUS_IRRIGACAO) as StatusIrrigacao[]).map((s): [string, string] => [s, STATUS_IRRIGACAO[s].label])]}
          largura="w-52"
        />
      )}
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        De
        <Input type="date" value={filtros.de || ''} onChange={(e) => set('de')(e.target.value)} className="w-36" aria-label="Período: de" />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        até
        <Input type="date" value={filtros.ate || ''} onChange={(e) => set('ate')(e.target.value)} className="w-36" aria-label="Período: até" />
      </label>
      {algum && (
        <Button variant="ghost" onClick={() => onChange({})}>
          Limpar filtros
        </Button>
      )}
    </FilterBar>
  );
}
