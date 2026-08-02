import { cn } from '@/utils/cn';

/** Equivalente ao .filter-bar da V2 — container padrão pra qualquer
 * combinação de busca/selects/checkboxes de filtro. As páginas compõem
 * seus próprios campos dentro (os filtros mudam muito de tela pra tela
 * pra valer a pena um componente por campo). */
export function FilterBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function FilterBarSeparator() {
  return <span className="mx-0.5 hidden h-5 w-px self-stretch bg-border sm:block" />;
}

export function FilterLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-subtle">{children}</span>;
}
