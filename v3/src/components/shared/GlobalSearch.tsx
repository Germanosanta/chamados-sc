import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useChamados } from '@/hooks/useChamados';
import { useDebounce } from '@/hooks/useDebounce';
import { useDetalheStore } from '@/store/detalhe';
import { frotaLabel } from '@/utils/chamado-helpers';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/utils/cn';

/** Equivalente a globalSearch() da V2 (topbar) — cruza número/título/
 * responsável/fazenda/frota. Clique num resultado abre o Centro
 * Operacional diretamente (mesmo destino de clicar numa linha de tabela). */
export function GlobalSearch() {
  const { data } = useChamados();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(q, 200);

  const results = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    if (term.length < 2) return [];
    return data
      .filter((c) => {
        const frota = frotaLabel(c).toLowerCase();
        return (
          c.num.toLowerCase().includes(term) ||
          c.titulo?.toLowerCase().includes(term) ||
          c.resp?.toLowerCase().includes(term) ||
          c.bucket?.toLowerCase().includes(term) ||
          frota.includes(term)
        );
      })
      .slice(0, 8);
  }, [data, debounced]);

  return (
    <div className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar número, frota, título…"
        className="h-8 w-48 rounded-sm border border-border bg-muted pl-8 pr-2 text-base text-foreground placeholder:text-subtle focus:w-64 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
      />
      {open && results.length > 0 && (
        <div className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-sm border border-border bg-popover shadow-lg">
          {results.map((c) => (
            <button
              key={c.num}
              onMouseDown={() => {
                abrirDetalhe(c.num);
                setQ('');
                setOpen(false);
              }}
              className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-base hover:bg-muted')}
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-mono-num font-semibold text-primary">{c.num}</span>
                <span className="truncate text-sm text-muted-foreground">{c.titulo}</span>
              </span>
              <StatusBadge status={c.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
