import { useMemo } from 'react';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { toast } from 'sonner';
import { KanbanColumn } from './KanbanColumn';
import { KANBAN_LANES, KANBAN_TRANSICOES, laneKey, type LaneKey } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';

interface KanbanBoardProps {
  chamados: Chamado[];
  /** Ausente = drag-and-drop desligado (ex.: usuário sem `p_editar`) —
   * os cards nascem sem o `useDraggable` ativo em vez de só rejeitar o
   * drop depois de arrastar. */
  onStatusChange?: (chamado: Chamado, novoStatus: Chamado['status']) => void;
  onCardClick?: (chamado: Chamado) => void;
  onAssumir?: (chamado: Chamado) => void;
}

/**
 * Drag-and-drop real (@dnd-kit) entre as 4 raias — mesmas transições da
 * V2 (KANBAN_TRANSICOES). Encerrar e reabrir sempre exigem o checklist/
 * confirmação do Centro Operacional (mesma regra da V2 — nunca uma
 * mudança de status silenciosa), então soltar um card em "Concluído" (ou
 * arrastar um card de lá) abre o Centro Operacional daquele chamado em
 * vez de mudar o status direto.
 */
export function KanbanBoard({ chamados, onStatusChange, onCardClick, onAssumir }: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const porLane = useMemo(() => {
    const grupos: Record<LaneKey, Chamado[]> = { aberto: [], atendimento: [], peca: [], concluido: [] };
    for (const c of chamados) grupos[laneKey(c)].push(c);
    return grupos;
  }, [chamados]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const chamado = active.data.current?.chamado as Chamado | undefined;
    if (!chamado) return;

    const origem = laneKey(chamado);
    const destino = over.id as LaneKey;
    if (origem === destino) return;

    if (destino === 'concluido') {
      toast('Encerrar exige o checklist — abrindo o Centro Operacional…');
      onCardClick?.(chamado);
      return;
    }
    if (origem === 'concluido') {
      toast('Reabrir um chamado encerrado exige confirmação — abrindo o Centro Operacional…');
      onCardClick?.(chamado);
      return;
    }

    const novoStatus = KANBAN_TRANSICOES[`${origem}>${destino}`];
    if (!novoStatus) {
      toast('Ação não disponível — avance uma etapa por vez.');
      return;
    }
    onStatusChange?.(chamado, novoStatus);
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
            dragDisabled={!onStatusChange}
          />
        ))}
      </div>
    </DndContext>
  );
}
