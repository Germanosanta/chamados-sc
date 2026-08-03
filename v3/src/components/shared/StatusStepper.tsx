import { cn } from '@/utils/cn';
import { KANBAN_LANES, laneKey } from '@/utils/chamado-helpers';

/** Portado de statusStepperHTML() (chamados/index.js) — 4 etapas reais
 * (Aberto/Em Atendimento/Aguardando Peça/Encerrado) + estado especial
 * "Cancelado". */
export function StatusStepper({ status, selos }: { status: string; selos?: React.ReactNode }) {
  if (status === 'Cancelado') {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-surface3 px-3 py-1 text-sm font-semibold text-subtle">🚫 Cancelado</span>
        {selos}
      </div>
    );
  }

  const atual = KANBAN_LANES.findIndex((l) => l.key === laneKey(status));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center overflow-x-auto">
        {KANBAN_LANES.map((l, i) => (
          <div key={l.key} className="flex items-center">
            <span
              className={cn(
                'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
                i < atual && 'bg-success-bg text-success',
                i === atual && 'bg-primary text-primary-foreground',
                i > atual && 'bg-surface3 text-subtle',
              )}
            >
              {l.label}
            </span>
            {i < KANBAN_LANES.length - 1 && <span className="h-px w-4 bg-border2" />}
          </div>
        ))}
      </div>
      {selos}
    </div>
  );
}
