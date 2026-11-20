import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TIPO_ATIVO_LABEL, buscarAtivosIrrigacao } from '@/utils/irrigacao';
import type { AtivoIrrigacao } from '@/types/irrigacao';

/** Busca do equipamento na abertura — mesmo comportamento do campo
 * Equipamento dos chamados de campo (EquipAutocomplete): digita o pivô ou o
 * nome, escolhe na lista, navegação por teclado. */
export function AtivoIrrigacaoAutocomplete({
  ativos,
  onSelect,
  id,
}: {
  ativos: AtivoIrrigacao[];
  onSelect: (a: AtivoIrrigacao | null) => void;
  id?: string;
}) {
  const [q, setQ] = useState('');
  const [focusIdx, setFocusIdx] = useState(-1);
  const [aberto, setAberto] = useState(false);
  const baseId = id || 'ativo-irrigacao';
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const results = useMemo(() => (aberto ? buscarAtivosIrrigacao(ativos, q) : []), [ativos, q, aberto]);

  function selecionar(a: AtivoIrrigacao) {
    setQ(`${a.nome} · ${a.fazenda || '—'} · ${a.modulo || '—'}`);
    setFocusIdx(-1);
    setAberto(false);
    onSelect(a);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault();
      selecionar(results[focusIdx]);
    } else if (e.key === 'Escape') {
      setFocusIdx(-1);
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
      <input
        id={id}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setFocusIdx(-1);
          setAberto(true);
          onSelect(null);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={handleKeyDown}
        placeholder="Digite o pivô ou o equipamento (ex.: 27, Pivô 101, R7, PRM 03)…"
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={focusIdx >= 0 ? optionId(focusIdx) : undefined}
        className="h-9 w-full rounded-sm border border-border bg-muted pl-8 pr-8 text-base text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {q && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setQ('');
            setFocusIdx(-1);
            setAberto(true);
            onSelect(null);
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {results.length > 0 && (
        <div id={listboxId} role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-sm border border-border bg-popover shadow-lg">
          {results.map((a, i) => (
            <button
              key={a.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === focusIdx}
              type="button"
              onMouseDown={() => selecionar(a)}
              className={cn('flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-base', i === focusIdx ? 'bg-muted' : 'hover:bg-muted')}
            >
              <span className="font-semibold text-primary">{a.nome}</span>
              <span className="truncate text-sm text-muted-foreground">
                {TIPO_ATIVO_LABEL[a.tipo]} · {a.fazenda || '—'} · {a.modulo || '—'}
                {a.casaBombas ? ` · ${a.casaBombas}` : ''}
                {a.local ? ` · ${a.local}` : ''}
                {a.dispositivo ? ` · ${a.dispositivo}` : ''} · {a.plataforma || 'sem plataforma'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
