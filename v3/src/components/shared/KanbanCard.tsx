import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/utils/cn';
import { DiasChip, PrioridadeBadge } from './StatusBadge';
import { diasAberto, frotaLabel } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';

interface KanbanCardProps {
  chamado: Chamado;
  onClick?: (chamado: Chamado) => void;
  onAssumir?: (chamado: Chamado) => void;
}

/** memo: numa coluna com dezenas de cards, sem isso todo card re-renderiza
 * a cada tecla digitada nos filtros da tela de Aberto (o pai inteiro
 * re-renderiza) mesmo quando o card em si não mudou nada — só compensa
 * porque `chamado`/`onClick`/`onAssumir` agora chegam com referência
 * estável (ver useChamados.ts e KanbanColumn.tsx). */
export const KanbanCard = memo(function KanbanCard({ chamado, onClick, onAssumir }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chamado.num,
    data: { chamado },
  });

  const dias = diasAberto(chamado.data);
  const frota = frotaLabel(chamado.num, chamado.equipCodigo);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      onClick={onClick ? () => onClick(chamado) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(chamado);
              }
            }
          : undefined
      }
      aria-label={onClick ? `Chamado ${chamado.num} — ${chamado.titulo}` : undefined}
      className={cn(
        'cursor-grab select-none rounded-sm border border-border bg-surface p-2.5 shadow-sm transition active:cursor-grabbing',
        'hover:border-primary hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono-num text-sm font-bold text-primary">{chamado.num}</span>
        <PrioridadeBadge prioridade={chamado.prior} />
      </div>
      <div className="mt-1.5 line-clamp-2 text-base font-semibold text-foreground">{chamado.titulo}</div>
      <div className="mt-1 truncate text-xs text-subtle">
        {frota ? `🚜 ${frota}` : 'Sem equipamento vinculado'}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="truncate">{chamado.resp || 'Sem responsável'}</span>
        <DiasChip dias={dias} />
      </div>
      {!chamado.assumidoPor && onAssumir && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAssumir(chamado);
          }}
          className="mt-2 w-full rounded-full border border-border2 bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-primary hover:border-primary hover:text-primary-foreground"
        >
          Assumir
        </button>
      )}
    </div>
  );
});
