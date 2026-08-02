import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  headClassName?: string;
  /** habilita clique no cabeçalho pra ordenar (ver sort/onSortChange) */
  sortable?: boolean;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
}

/** Equivalente ao .data-table da V2 (thead sticky, hover de linha,
 * mono-num) — genérica, reaproveitada em qualquer listagem paginada.
 * Ordenação por coluna é opcional (passe `sort`/`onSortChange` +
 * `sortable:true` na coluna) — portado de sortChamados() (chamados/index.js). */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription,
  sort,
  onSortChange,
}: DataTableProps<T>) {
  function handleSort(col: DataTableColumn<T>) {
    if (!col.sortable || !onSortChange) return;
    const dir: SortState['dir'] = sort?.key === col.key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ key: col.key, dir });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse text-base">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  className={cn(
                    'whitespace-nowrap px-3.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground',
                    col.headClassName,
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable &&
                      (sort?.key === col.key ? (
                        sort.dir === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3.5 py-2.5">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('border-b border-border last:border-none hover:bg-muted', onRowClick && 'cursor-pointer')}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-3.5 py-2.5 align-middle text-muted-foreground', col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
