import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterBar } from '@/components/shared/FilterBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { PrioridadeBadge } from '@/components/shared/StatusBadge';
import { SeletorModuloAreaTecnica } from '@/pages/area-tecnico/AreaTecnicoPage';
import { useSessionStore } from '@/store/session';
import { useSouTecnicoAtivo, useTecnicosAtivos } from '@/hooks/useTecnicos';
import { useAcoesIrrigacao, useChamadosIrrigacao } from '@/hooks/useIrrigacao';
import { FILAS_AREA_TECNICA, filasIrrigacao, type FilaAreaTecnica } from '@/utils/areaTecnica';
import {
  PRIORIDADES_IRRIGACAO,
  STATUS_IRRIGACAO,
  TIPO_ATIVO_LABEL,
  filtrarChamadosIrrigacao,
  formatarDataHora,
  formatarDuracao,
  minutosEntre,
  type FiltrosIrrigacao,
} from '@/utils/irrigacao';
import type { ChamadoIrrigacao, StatusIrrigacao } from '@/types/irrigacao';

const TODOS = '__todos__';

/** Área Técnica do módulo de irrigação: mesmas filas da área de campo.
 * Chamado recém-aberto, sem técnico, aparece em "Disponíveis" para todos
 * os técnicos e sai de lá quando alguém assume (em tempo real). */
export function AreaTecnicaIrrigacao({ onAbrir }: { onAbrir: (num: string) => void }) {
  const usuario = useSessionStore((s) => s.usuario);
  const temPermissao = useSessionStore((s) => s.temPermissao);
  const souTecnicoAtivo = useSouTecnicoAtivo();
  const { data: tecnicos } = useTecnicosAtivos();
  const { data: todos, carregando } = useChamadosIrrigacao();
  const acoes = useAcoesIrrigacao();
  const [fila, setFila] = useState<FilaAreaTecnica>('disponiveis');
  const [filtros, setFiltros] = useState<FiltrosIrrigacao>({});
  const [assumindo, setAssumindo] = useState<string | null>(null);

  const filas = useMemo(() => {
    const todas = filasIrrigacao(todos, usuario);
    if (!temPermissao('p_encerrados')) todas.encerrados = [];
    return todas;
  }, [todos, usuario, temPermissao]);
  const filasVisiveis = FILAS_AREA_TECNICA.filter((f) => f.key !== 'encerrados' || temPermissao('p_encerrados'));
  const itens = useMemo(() => filtrarChamadosIrrigacao(filas[fila], filtros), [filas, fila, filtros]);
  const fazendas = useMemo(() => [...new Set(todos.map((c) => c.fazenda).filter(Boolean))].sort(), [todos]);
  const set = (campo: keyof FiltrosIrrigacao) => (v: string) => setFiltros((f) => ({ ...f, [campo]: v === TODOS ? '' : v }));
  const meuTecnico = tecnicos.find((t) => t.usuarioUid === usuario?.id);

  async function assumir(c: ChamadoIrrigacao) {
    if (!usuario) return;
    setAssumindo(c.num);
    try {
      await acoes.assumir(c, { key: meuTecnico?.key || usuario.id, nome: meuTecnico?.nome || usuario.nome });
      toast(`⚡ Você assumiu o chamado ${c.num}`);
    } catch (erro) {
      toast.error(`Não foi possível assumir: ${erro instanceof Error ? erro.message : 'erro desconhecido'}.`);
    } finally {
      setAssumindo(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Área Técnica</h2>
          <p className="text-sm text-muted-foreground">Fila de atendimento · atualizada em tempo real</p>
        </div>
        <SeletorModuloAreaTecnica atual="irrigacao" />
      </div>

      <div className="flex flex-wrap gap-2">
        {filasVisiveis.map((f) => (
          <button
            key={f.key}
            onClick={() => setFila(f.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
              fila === f.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:border-border2',
            )}
          >
            {f.label}
            <span className={cn('rounded-full px-1.5 text-xs', fila === f.key ? 'bg-white/20' : 'bg-surface3')}>{filas[f.key].length}</span>
          </button>
        ))}
      </div>

      <FilterBar>
        <Input value={filtros.busca || ''} onChange={(e) => set('busca')(e.target.value)} placeholder="Equipamento, falha ou nº" className="w-full sm:w-56" aria-label="Filtrar por equipamento" />
        <Select value={filtros.fazenda || TODOS} onValueChange={set('fazenda')}>
          <SelectTrigger className="w-36" aria-label="Fazenda"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda fazenda</SelectItem>
            {fazendas.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.prioridade || TODOS} onValueChange={set('prioridade')}>
          <SelectTrigger className="w-36" aria-label="Prioridade"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda prioridade</SelectItem>
            {PRIORIDADES_IRRIGACAO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.status || TODOS} onValueChange={set('status')}>
          <SelectTrigger className="w-52" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda situação</SelectItem>
            {(Object.keys(STATUS_IRRIGACAO) as StatusIrrigacao[]).map((s) => <SelectItem key={s} value={s}>{STATUS_IRRIGACAO[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        {Object.values(filtros).some(Boolean) && <Button variant="ghost" onClick={() => setFiltros({})}>Limpar filtros</Button>}
      </FilterBar>

      {!carregando && itens.length === 0 && (
        <EmptyState
          title={fila === 'disponiveis' ? 'Nenhum chamado aguardando técnico' : 'Nenhum chamado encontrado para este filtro'}
          description={fila === 'disponiveis' ? 'Chamados novos sem técnico aparecem aqui assim que são abertos.' : undefined}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((c) => (
          <div
            key={c.num}
            role="button"
            tabIndex={0}
            onClick={() => onAbrir(c.num)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onAbrir(c.num))}
            className="flex cursor-pointer flex-col gap-2 rounded-md border border-border bg-surface p-3 shadow-sm transition hover:border-primary hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono-num text-xs font-bold text-primary">{c.num}</span>
              <PrioridadeBadge prioridade={c.prioridade} />
            </div>
            <div className="text-sm font-semibold text-foreground">{c.ativoNome}</div>
            <div className="text-xs text-muted-foreground">
              {TIPO_ATIVO_LABEL[c.ativoTipo]} · {c.fazenda || '—'} · {c.modulo || '—'}
              {c.plataforma ? ` · ${c.plataforma}` : ''}
            </div>
            <div className="text-xs">{c.tipoFalha}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_IRRIGACAO[c.status]?.variant || 'neutral'}>{STATUS_IRRIGACAO[c.status]?.label || c.status}</Badge>
              <span className="text-xs text-subtle">
                {formatarDataHora(c.identificadoEm)}
                {c.status !== 'encerrado' && ` · ${formatarDuracao(minutosEntre(c.identificadoEm, c.restabelecidoEm || new Date().toISOString()))}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{c.tecnico || 'Sem técnico'}</span>
              {!c.tecnico && c.status !== 'encerrado' && souTecnicoAtivo && (
                <Button
                  size="sm"
                  disabled={assumindo === c.num}
                  onClick={(e) => {
                    e.stopPropagation();
                    void assumir(c);
                  }}
                >
                  ⚡ Assumir
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
