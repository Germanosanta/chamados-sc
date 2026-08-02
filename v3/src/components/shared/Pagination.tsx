import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalItems: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

/** Equivalente a _paginacaoHTML()/_pagInfoTexto() da V2 — janela de
 * páginas com reticências, extraído uma vez pra ser reaproveitado em
 * toda tela paginada (Aberto, e as próximas: Chamados/Encerrados/
 * Criticidade). */
export function Pagination({ page, totalItems, perPage, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  if (totalPages <= 1) {
    return (
      <div className="text-sm text-muted-foreground">
        Exibindo {totalItems.toLocaleString('pt-BR')} de {totalItems.toLocaleString('pt-BR')}
      </div>
    );
  }

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, totalItems);

  const pages = pageWindow(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-muted-foreground">
        Exibindo {from.toLocaleString('pt-BR')}–{to.toLocaleString('pt-BR')} de {totalItems.toLocaleString('pt-BR')}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1.5 text-sm text-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'h-8 min-w-8 rounded-sm border border-border px-2 text-sm font-semibold transition-colors',
                p === page ? 'border-primary bg-primary text-primary-foreground' : 'bg-surface hover:border-border2',
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button variant="ghost" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function pageWindow(current: number, total: number): (number | '…')[] {
  const delta = 1;
  const range: (number | '…')[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push('…');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push('…');
  if (total > 1) range.push(total);
  return range;
}
