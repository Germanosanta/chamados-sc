import { useMemo } from 'react';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { toast } from 'sonner';
import { KanbanColumn } from './KanbanColumn';
import { KANBAN_LANES, KANBAN_TRANSICOES, laneKey, type LaneKey } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';

interface KanbanBoardProps {
  chamados: Chamado[];
  onStatusChange: (chamado: Chamado, novoStatus: Chamado['status']) => void;
  onCardClick?: (chamado: Chamado) => void;
  onAssumir?: (chamado: Chamado) => void;
}

/**
 * Drag-and-drop real (@dnd-kit) entre as 4 raias — mesmas transições da
 * V2 (KANBAN_TRANSICOES). As 2 transições que terminam em "Encerrado"
 * exigem o checklist do Centro Operacional (fase seguinte da V3, ainda
 * não portada) — soltar um card lá mostra um aviso em vez de fingir
 * encerrar sem o checklist obrigatório.
 */
export function KanbanBoard({ chamados, onStatusChange, onCardClick, onAssumir }: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const porLane = useMemo(() => {
    const grupos: Record<LaneKey, Chamado[]> = { aberto: [], atendimento: [], peca: [], concluido: [] };
    for (const c of chamados) grupos[laneKey(c.status)].push(c);
    return grupos;
  }, [chamados]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const chamado = active.data.current?.chamado as Chamado | undefined;
    if (!chamado) return;

    const origem = laneKey(chamado.status);
    const destino = over.id as LaneKey;
    if (origem === destino) return;

    if (destino === 'concluido') {
      toast('Encerramento com checklist chega na próxima fase (Centro Operacional).');
      return;
    }
    if (origem === 'concluido') {
      toast('Reabertura chega na próxima fase (Centro Operacional).');
      return;
    }

    const novoStatus = KANBAN_TRANSICOES[`${origem}>${destino}`];
    if (!novoStatus) {
      toast('Ação não disponível — avance uma etapa por vez.');
      return;
    }
    onStatusChange(chamado, novoStatus);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KANBAN_LANES.map((lane) => (
          <KanbanColumn
            key={lane.key}
            laneKey={lane.key}
            label={lane.label}
            chamados={porLane[lane.key]}
            onCardClick={onCardClick}
            onAssumir={onAssumir}
          />
        ))}
      </div>
    </DndContext>
  );
}
