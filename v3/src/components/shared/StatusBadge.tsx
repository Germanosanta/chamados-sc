import { Badge } from '@/components/ui/badge';
import {
  culturaVariant,
  diasVariant,
  PRIORIDADE_ICON,
  prioridadeVariant,
  statusVariant,
} from '@/utils/chamado-helpers';
import type { Prioridade } from '@/types/chamado';

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status || 'Não iniciado'}</Badge>;
}

export function CulturaBadge({ cultura }: { cultura: string }) {
  if (!cultura) return <span className="text-subtle">—</span>;
  return <Badge variant={culturaVariant(cultura)}>{cultura}</Badge>;
}

export function PrioridadeBadge({ prioridade }: { prioridade?: Prioridade }) {
  const p = prioridade || 'Média';
  return (
    <Badge variant={prioridadeVariant(p)}>
      {PRIORIDADE_ICON[p]} {p}
    </Badge>
  );
}

export function DiasChip({ dias }: { dias: number }) {
  return <Badge variant={diasVariant(dias)}>{dias}d</Badge>;
}
