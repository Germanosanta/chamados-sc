import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useEquipUniverso } from '@/hooks/useEquipamentos';
import type { EquipamentoEstatico } from '@/types/equipamento';

interface EquipAutocompleteProps {
  onSelect: (equip: EquipamentoEstatico) => void;
  placeholder?: string;
  id?: string;
}

/** Portado de equipSearch()/equipSelect()/equipKeyNav() (chamados/index.js)
 * — busca por prefixo do código primeiro, depois descrição/modelo,
 * navegação por teclado (setas + Enter), mesma fonte de dados
 * (useEquipUniverso, equivalente a _equipUniverso()). Combobox ARIA 1.2
 * (role="combobox" + listbox/option) pra ficar operável por leitor de
 * tela, além do teclado que já funcionava. */
export function EquipAutocomplete({ onSelect, placeholder, id }: EquipAutocompleteProps) {
  const universo = useEquipUniverso();
  const [q, setQ] = useState('');
  const [focusIdx, setFocusIdx] = useState(-1);
  const baseId = id || 'equip-autocomplete';
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return [];
    const exact = universo.filter((e) => e.c.toLowerCase().startsWith(ql));
    const codigos = new Set(exact.map((e) => e.c));
    const partial = universo.filter(
      (e) => !codigos.has(e.c) && (e.d.toLowerCase().includes(ql) || e.e.toLowerCase().includes(ql) || (e.m || '').toLowerCase().includes(ql)),
    );
    return [...exact, ...partial].slice(0, 30);
  }, [universo, q]);

  function selecionar(equip: EquipamentoEstatico) {
    setQ(equip.e || `${equip.c} ${equip.d}`);
    setFocusIdx(-1);
    onSelect(equip);
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
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Digite o código ou nome do equipamento…'}
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
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {results.length > 0 && (
        <div id={listboxId} role="listbox" className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-sm border border-border bg-popover shadow-lg">
          {results.map((r, i) => (
            <button
              key={r.c}
              id={optionId(i)}
              role="option"
              aria-selected={i === focusIdx}
              type="button"
              onMouseDown={() => selecionar(r)}
              className={cn('flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-base', i === focusIdx ? 'bg-muted' : 'hover:bg-muted')}
            >
              <span className="font-mono-num font-semibold text-primary">{r.c}</span>
              <span className="truncate text-sm text-muted-foreground">{r.d}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
