import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/utils/cn';
import { CulturaBadge, DiasChip, PrioridadeBadge, StatusBadge } from './StatusBadge';
import { diasAberto, diasBorderClass, formatDataBR, frotaLabel, isFechado } from '@/utils/chamado-helpers';
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
  const fechado = isFechado(chamado);

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
        'cursor-grab select-none rounded-sm border border-border border-l-[3px] bg-surface p-2.5 shadow-sm transition active:cursor-grabbing',
        'hover:border-primary hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        !fechado && diasBorderClass(dias),
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 font-mono-num text-sm">
          <span className="font-bold text-primary">{chamado.num}</span>
          {frota && <span className="ml-1 truncate text-xs text-muted-foreground">🚜 {frota}</span>}
        </div>
        <PrioridadeBadge prioridade={chamado.prior} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <CulturaBadge cultura={chamado.cultura} />
        <StatusBadge status={chamado.status} />
      </div>
      <div className="mt-1.5 line-clamp-2 text-base font-semibold text-foreground">{chamado.titulo}</div>
      {!frota && <div className="mt-1 text-xs text-subtle">Sem equipamento vinculado</div>}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-subtle">
        <span className="truncate">{chamado.solicitante || 'Sem solicitante'}</span>
        <span className="shrink-0 font-mono-num">{formatDataBR(chamado.data)}</span>
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
