import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motivoErro } from '@/utils/erros';
import { cn } from '@/utils/cn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterBar } from '@/components/shared/FilterBar';
import { KanbanCard } from '@/components/shared/KanbanCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAssumirChamado, useChamados } from '@/hooks/useChamados';
import { useSouTecnicoAtivo, useTecnicos } from '@/hooks/useTecnicos';
import { useDetalheStore } from '@/store/detalhe';
import { useSessionStore } from '@/store/session';
import { fazendaLabel } from '@/utils/chamado-helpers';
import { FILAS_AREA_TECNICA, filasCampo, filtrarAreaTecnicaCampo, type FilaAreaTecnica, type FiltrosAreaTecnicaCampo } from '@/utils/areaTecnica';
import type { Chamado } from '@/types/chamado';

const TODOS = '__todos__';
const PRIORIDADES = ['Urgente', 'Alta', 'Média', 'Baixa'];

/** Seletor de módulo da Área Técnica: cada módulo tem a própria fila, sem
 * misturar os registros. */
export function SeletorModuloAreaTecnica({ atual }: { atual: 'campo' | 'irrigacao' }) {
  const navigate = useNavigate();
  const opcoes = [
    { id: 'campo' as const, label: 'Campo', destino: '/area-tecnico' },
    { id: 'irrigacao' as const, label: 'Irrigação', destino: '/irrigacao?aba=tecnica' },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label="Módulo">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={atual === o.id}
          onClick={() => atual !== o.id && navigate(o.destino)}
          className={cn('rounded-sm px-3 py-1 text-sm font-semibold', atual === o.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Área do Técnico (Campo). A fila "Disponíveis" mostra todo chamado aberto
 * sem responsável assim que ele é aberto — antes não havia essa fila e um
 * chamado novo só aparecia aqui depois de atribuído. Lista em tempo real
 * (onSnapshot): assumir/mudar status atualiza a tela de todos. */
export function AreaTecnicoPage() {
  const usuario = useSessionStore((s) => s.usuario);
  const temPermissao = useSessionStore((s) => s.temPermissao);
  const { data: todos, carregando } = useChamados();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);
  const assumir = useAssumirChamado();
  const souTecnicoAtivo = useSouTecnicoAtivo();
  const [fila, setFila] = useState<FilaAreaTecnica>('disponiveis');
  const [filtros, setFiltros] = useState<FiltrosAreaTecnicaCampo>({});

  // Apelido do cadastro de técnicos vinculado a esta conta, para os chamados
  // legados gravados com o apelido (ver souResponsavelDoChamado).
  const { data: tecnicos } = useTecnicos();
  const meuApelido = useMemo(() => tecnicos.find((t) => t.usuarioUid === usuario?.id)?.apelido || null, [tecnicos, usuario]);

  const filas = useMemo(() => {
    const todas = filasCampo(todos, usuario, meuApelido);
    // "Encerrados" (de todos) segue a permissão já existente de ver encerrados.
    if (!temPermissao('p_encerrados')) todas.encerrados = [];
    return todas;
  }, [todos, usuario, meuApelido, temPermissao]);
  const filasVisiveis = FILAS_AREA_TECNICA.filter((f) => f.key !== 'encerrados' || temPermissao('p_encerrados'));
  const itens = useMemo(() => filtrarAreaTecnicaCampo(filas[fila], filtros), [filas, fila, filtros]);

  const fazendas = useMemo(() => [...new Set(todos.map((c) => fazendaLabel(c.bucket)).filter((f) => f && f !== '—'))].sort(), [todos]);
  const situacoes = useMemo(() => [...new Set(filas[fila].map((c) => c.status).filter(Boolean))].sort(), [filas, fila]);
  const set = (campo: keyof FiltrosAreaTecnicaCampo) => (v: string) => setFiltros((f) => ({ ...f, [campo]: v === TODOS ? '' : v }));

  const handleCardClick = useCallback((c: Chamado) => abrirDetalhe(c.num), [abrirDetalhe]);
  const handleAssumir = useCallback(
    async (c: Chamado) => {
      try {
        await assumir(c);
        toast(`⚡ Você assumiu o chamado ${c.num}`);
      } catch (erro) {
        toast.error(`Não foi possível assumir: ${motivoErro(erro)}.`);
      }
    },
    [assumir],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Área do Técnico</h1>
          <p className="text-sm text-muted-foreground">Fila de atendimento · atualizada em tempo real</p>
        </div>
        <SeletorModuloAreaTecnica atual="campo" />
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
        <Input value={filtros.equipamento || ''} onChange={(e) => set('equipamento')(e.target.value)} placeholder="Equipamento, frota ou nº" className="w-full sm:w-56" aria-label="Filtrar por equipamento" />
        <Select value={filtros.fazenda || TODOS} onValueChange={set('fazenda')}>
          <SelectTrigger className="w-40" aria-label="Fazenda"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda fazenda/sistema</SelectItem>
            {fazendas.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.prioridade || TODOS} onValueChange={set('prioridade')}>
          <SelectTrigger className="w-36" aria-label="Prioridade"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda prioridade</SelectItem>
            {PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.situacao || TODOS} onValueChange={set('situacao')}>
          <SelectTrigger className="w-40" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda situação</SelectItem>
            {situacoes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {Object.values(filtros).some(Boolean) && <Button variant="ghost" onClick={() => setFiltros({})}>Limpar filtros</Button>}
      </FilterBar>

      {!carregando && itens.length === 0 && (
        <EmptyState
          title={fila === 'disponiveis' ? 'Nenhum chamado aguardando técnico' : 'Nenhum chamado encontrado para este filtro'}
          description={fila === 'disponiveis' ? 'Chamados novos sem responsável aparecem aqui assim que são abertos.' : undefined}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {itens.map((c) => (
          <KanbanCard
            key={c.num}
            chamado={c}
            onClick={handleCardClick}
            onAssumir={fila !== 'historico' && fila !== 'encerrados' && souTecnicoAtivo ? handleAssumir : undefined}
            dragDisabled
          />
        ))}
      </div>
    </div>
  );
}
