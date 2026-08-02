import { cn } from '@/utils/cn';
import { buildTimeline } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';
import { EmptyState } from './EmptyState';
import { History } from 'lucide-react';

const COLOR_CLASS: Record<string, string> = {
  green: 'border-success text-success',
  amber: 'border-warning text-warning',
  red: 'border-destructive text-destructive',
  blue: 'border-primary text-primary',
  purple: 'border-purple text-purple',
  neutral: 'border-border2 text-subtle',
};

const CHECKLIST_LABELS: Record<string, string> = {
  problemaResolvido: 'Problema resolvido',
  testeRealizado: 'Teste realizado',
  equipamentoLiberado: 'Equipamento liberado',
  usuarioInformado: 'Usuário informado',
};

/** Linha do tempo do Centro Operacional — portado de buildTimeline()
 * (abertura + eventos registrados + encerramento, nessa ordem
 * cronológica), agora renderizada como componente em vez de string HTML. */
export function Timeline({ chamado }: { chamado: Chamado }) {
  const items = buildTimeline(chamado);

  if (!items.length) {
    return <EmptyState icon={History} title="Nenhum evento registrado neste chamado" />;
  }

  return (
    <div className="flex flex-col">
      {items.map((ev, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-surface text-sm', COLOR_CLASS[ev.color])}>
              {ev.icon}
            </div>
            {i < items.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="flex-1 pb-4">
            <div className={cn('text-sm font-bold', COLOR_CLASS[ev.color].split(' ')[1])}>{ev.label}</div>
            <div className="flex items-center gap-1.5 text-xs text-subtle">
              <span>{ev.date}</span>
              {ev.time && (
                <>
                  <span>·</span>
                  <span>{ev.time}</span>
                </>
              )}
            </div>
            {ev.actor && <div className="mt-0.5 text-sm text-muted-foreground">👤 {ev.actor}</div>}
            {ev.detail && (
              <div className="mt-1.5 rounded-sm bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">{ev.detail}</div>
            )}
            {ev.checklist && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(ev.checklist).map(([key, ok]) => (
                  <span
                    key={key}
                    className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ok ? 'bg-success-bg text-success' : 'bg-destructive-bg text-destructive')}
                  >
                    {ok ? '✓' : '✗'} {CHECKLIST_LABELS[key] || key}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
