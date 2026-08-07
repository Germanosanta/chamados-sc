import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/utils/cn';
import { CulturaBadge, DiasChip, PrioridadeBadge, StatusBadge } from './StatusBadge';
import { RespAvatar } from './RespAvatar';
import { diasAberto, diasBorderClass, formatDataBR, frotaLabel, isFechado, temResponsavel } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';

interface KanbanCardProps {
  chamado: Chamado;
  onClick?: (chamado: Chamado) => void;
  onAssumir?: (chamado: Chamado) => void;
  /** Desliga o drag-and-drop (ex.: usuário sem `p_editar`) — sem isso o
   * card dava cursor de "arrastável" e feedback visual completo pra quem
   * não tinha permissão, que só descobria isso depois de soltar o card. */
  dragDisabled?: boolean;
}

/** memo: numa coluna com dezenas de cards, sem isso todo card re-renderiza
 * a cada tecla digitada nos filtros da tela de Aberto (o pai inteiro
 * re-renderiza) mesmo quando o card em si não mudou nada — só compensa
 * porque `chamado`/`onClick`/`onAssumir` agora chegam com referência
 * estável (ver useChamados.ts e KanbanColumn.tsx).
 *
 * Hierarquia reorganizada (era número → badges → título → rodapé): o
 * título agora vem logo abaixo do cabeçalho, como leitura principal do
 * card — número/frota e prioridade viram metadado no topo, cultura/status
 * viram tags abaixo do título, e o rodapé ganha avatar de responsável +
 * divisor, no mesmo padrão de card usado por Jira/Linear/Trello. */
export const KanbanCard = memo(function KanbanCard({ chamado, onClick, onAssumir, dragDisabled }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chamado.num,
    data: { chamado },
    disabled: dragDisabled,
  });

  const dias = diasAberto(chamado.data);
  const frota = frotaLabel(chamado);
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
        'select-none rounded-md border border-border border-l-[3px] bg-surface p-2.5 shadow-sm transition',
        dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        'hover:border-primary hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        !fechado && diasBorderClass(dias),
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono-num text-xs font-bold text-primary">{chamado.num}</span>
          {frota && <span className="min-w-0 truncate text-[10px] text-subtle">🚜 {frota}</span>}
        </div>
        <PrioridadeBadge prioridade={chamado.prior} />
      </div>

      <div className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{chamado.titulo}</div>
      {!frota && <div className="mt-1 text-[10px] text-subtle">Sem equipamento vinculado</div>}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <CulturaBadge cultura={chamado.cultura} />
        <StatusBadge status={chamado.status} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-[10px] text-subtle">
        <span className="min-w-0 truncate">{chamado.solicitante || 'Sem solicitante'}</span>
        <span className="shrink-0 font-mono-num">
          {fechado ? chamado.encerramento?.dataEncerramento || 'Data não registrada' : formatDataBR(chamado.data)}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <RespAvatar nome={chamado.resp} />
          <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">{chamado.resp || 'Sem responsável'}</span>
        </div>
        <DiasChip dias={dias} />
      </div>

      {!temResponsavel(chamado) && onAssumir && (
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
