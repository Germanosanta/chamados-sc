import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';
import { KanbanCard } from '@/components/shared/KanbanCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAbertos, useAssumirChamado, useEncerradosLista } from '@/hooks/useChamados';
import { useSouTecnicoAtivo } from '@/hooks/useTecnicos';
import { useDetalheStore } from '@/store/detalhe';
import { useSessionStore } from '@/store/session';
import { souResponsavelDoChamado } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';

type Filtro = 'meus' | 'urgentes' | 'atendimento' | 'peca' | 'concluidos';

const CHIPS: { key: Filtro; label: string }[] = [
  { key: 'meus', label: 'Meus Chamados' },
  { key: 'urgentes', label: 'Urgentes' },
  { key: 'atendimento', label: 'Em Atendimento' },
  { key: 'peca', label: 'Aguardando Peça' },
  { key: 'concluidos', label: 'Encerrados' },
];

/** Área do Técnico — espaço de trabalho pessoal, separado do cadastro
 * administrativo (Técnicos/RH). Portado de renderAreaTecnico()
 * (chamados/index.js): mesmos 5 filtros em chip, mesmo card reaproveitado
 * do Kanban (_ticketCardHTML). */
export function AreaTecnicoPage() {
  const usuario = useSessionStore((s) => s.usuario);
  const { data: abertos, carregando } = useAbertos();
  const { data: encerrados } = useEncerradosLista();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);
  const assumir = useAssumirChamado();
  const souTecnicoAtivo = useSouTecnicoAtivo();
  const [filtro, setFiltro] = useState<Filtro>('meus');

  const conjuntos = useMemo(() => {
    const meus = abertos.filter((c) => souResponsavelDoChamado(c, usuario));
    return {
      meus,
      urgentes: abertos.filter((c) => c.prior === 'Urgente'),
      atendimento: abertos.filter((c) => c.status === 'Em Atendimento' || c.status === 'Em Andamento'),
      peca: abertos.filter((c) => c.status === 'Aguardando Peça'),
      concluidos: encerrados.filter((c) => souResponsavelDoChamado(c, usuario)),
    };
  }, [abertos, encerrados, usuario]);

  const itens = conjuntos[filtro];

  // useCallback (referência estável): KanbanCard é memoizado — sem isso,
  // toda troca de filtro/re-render da página recria a função e invalida
  // o memo de cada card (mesmo raciocínio de AbertoPage.tsx).
  const handleCardClick = useCallback((c: Chamado) => abrirDetalhe(c.num), [abrirDetalhe]);

  const handleAssumir = useCallback(
    async (c: Chamado) => {
      try {
        await assumir(c);
        toast(`⚡ Você assumiu o chamado ${c.num}`);
      } catch {
        toast.error('Não foi possível assumir o chamado.');
      }
    },
    [assumir],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Área do Técnico</h1>
        <p className="text-sm text-muted-foreground">Meu painel de trabalho · ações rápidas</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setFiltro(chip.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
              filtro === chip.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:border-border2',
            )}
          >
            {chip.label}
            <span className={cn('rounded-full px-1.5 text-xs', filtro === chip.key ? 'bg-white/20' : 'bg-surface3')}>
              {conjuntos[chip.key].length}
            </span>
          </button>
        ))}
      </div>

      {!carregando && itens.length === 0 && <EmptyState title="Nenhum chamado encontrado para este filtro" />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {itens.map((c) => (
          <KanbanCard
            key={c.num}
            chamado={c}
            onClick={handleCardClick}
            onAssumir={filtro !== 'concluidos' && souTecnicoAtivo ? handleAssumir : undefined}
          />
        ))}
      </div>
    </div>
  );
}
