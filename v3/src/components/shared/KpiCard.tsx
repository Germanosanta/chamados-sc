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
}

/** Equivalente ao .kpi-card da V2 — card com barra colorida no topo,
 * opcionalmente clicável como atalho de filtro. */
export function KpiCard({ label, value, sub, color = 'blue', onClick, active }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-sm transition',
        'before:absolute before:inset-x-0 before:top-0 before:h-[3px]',
        BAR_COLOR[color],
        onClick && 'cursor-pointer hover:-translate-y-px hover:shadow',
        active && 'ring-2 ring-primary',
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</div>
      <div className="mt-1.5 font-mono-num text-3xl font-bold text-foreground">{value}</div>
      {sub && <div className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}
