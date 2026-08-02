import { cn } from '@/utils/cn';

const BAR_COLOR: Record<string, string> = {
  blue: 'before:bg-primary',
  green: 'before:bg-success',
  amber: 'before:bg-warning',
  red: 'before:bg-destructive',
  cacau: 'before:bg-cacau',
  teal: 'before:bg-info',
  purple: 'before:bg-purple',
};

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: keyof typeof BAR_COLOR;
  onClick?: () => void;
  active?: boolean;
  /** versão reduzida (menos padding/peso) — pra indicadores secundários
   * que acompanham um bloco de KPIs primários (ex. Críticos/SLA vencido
   * ao lado dos cards de Cultura/Fazenda em "Chamados em Aberto"), sem
   * competir visualmente com eles. */
  compact?: boolean;
}

/** Equivalente ao .kpi-card da V2 — card com barra colorida no topo,
 * opcionalmente clicável como atalho de filtro. */
export function KpiCard({ label, value, sub, color = 'blue', onClick, active, compact }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition',
        'before:absolute before:inset-x-0 before:top-0 before:h-[3px]',
        compact ? 'p-3' : 'p-4',
        BAR_COLOR[color],
        onClick && 'cursor-pointer hover:-translate-y-px hover:shadow',
        active && 'ring-2 ring-primary',
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</div>
      <div className={cn('mt-1.5 font-mono-num font-bold text-foreground', compact ? 'text-xl' : 'text-3xl')}>{value}</div>
      {sub && <div className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}
