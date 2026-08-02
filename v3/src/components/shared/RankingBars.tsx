const CORES = ['#2563eb', '#0d9488', '#7c3aed', '#16a34a', '#d97706', '#dc2626'];

/** Equivalente a .prog-item/.prog-track/.prog-fill da V2 — usado nos
 * rankings de Responsáveis/Equipamentos/Principais Problemas do
 * Dashboard e Painel Operacional. */
export function RankingBars({ items, emptyLabel }: { items: [string, number][]; emptyLabel?: string }) {
  if (!items.length) {
    return <p className="text-sm text-subtle">{emptyLabel || 'Sem dados suficientes ainda.'}</p>;
  }
  const max = items[0]?.[1] || 1;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map(([nome, valor], i) => (
        <div key={nome} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium text-foreground">{nome}</span>
            <span className="font-mono-num font-bold text-muted-foreground">{valor.toLocaleString('pt-BR')}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
            <div className="h-full rounded-full transition-all" style={{ width: `${(valor / max) * 100}%`, background: CORES[i % CORES.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
