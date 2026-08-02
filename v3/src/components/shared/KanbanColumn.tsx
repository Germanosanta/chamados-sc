import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/utils/cn';
import { KanbanCard } from './KanbanCard';
import type { Chamado } from '@/types/chamado';

interface KanbanColumnProps {
  laneKey: string;
  label: string;
  chamados: Chamado[];
  onCardClick?: (chamado: Chamado) => void;
  onAssumir?: (chamado: Chamado) => void;
}

export const KanbanColumn = memo(function KanbanColumn({ laneKey, label, chamados, onCardClick, onAssumir }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: laneKey });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[200px] flex-col gap-2 rounded-lg border border-border bg-muted p-2.5 transition-colors',
        isOver && 'border-primary bg-primary-light',
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="rounded-full bg-surface3 px-2 py-0.5 text-xs font-bold text-subtle">{chamados.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {chamados.map((c) => (
          <KanbanCard key={c.num} chamado={c} onClick={onCardClick} onAssumir={onAssumir} />
        ))}
      </div>
    </div>
  );
});
