import { useEffect, useMemo, useState } from 'react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { CulturaBadge, PrioridadeBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useChamados } from '@/hooks/useChamados';
import { useDetalheStore } from '@/store/detalhe';
import { fazendaLabel, formatDataBR, frotaLabel } from '@/utils/chamado-helpers';
import type { Chamado, Prioridade } from '@/types/chamado';

const NIVEIS: { key: Prioridade; label: string; color: 'red' | 'amber' | 'blue' | 'green' }[] = [
  { key: 'Urgente', label: '⚡ Urgente', color: 'red' },
  { key: 'Alta', label: '🔴 Alta', color: 'amber' },
  { key: 'Média', label: '🟡 Média', color: 'blue' },
  { key: 'Baixa', label: '🟢 Baixa', color: 'green' },
];

const PER_PAGE = 50;

const PRIOR_ORDEM: Record<string, number> = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };

/** Criticidade — distribuição por nível de prioridade, mesmos 4 cards
 * clicáveis + filtros da V2 (renderCriticidade()/critCardFilter()). */
export function CriticidadePage() {
  const { data: todos, carregando } = useChamados();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);

  const [nivelCard, setNivelCard] = useState('');
  const [busca, setBusca] = useState('');
  const [cultura, setCultura] = useState('');
  const [fazenda, setFazenda] = useState('');
  const [statusF, setStatusF] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [nivelCard, busca, cultura, fazenda, statusF]);

  function limparFiltros() {
    setNivelCard('');
    setBusca('');
    setCultura('');
    setFazenda('');
    setStatusF('');
  }

  const porNivel = useMemo(() => {
    const m = new Map<string, Chamado[]>();
    for (const c of todos) {
      const p = c.prior || 'Média';
      const arr = m.get(p) || [];
      arr.push(c);
      m.set(p, arr);
    }
    return m;
  }, [todos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const out = todos.filter((c) => {
      if (nivelCard && (c.prior || 'Média') !== nivelCard) return false;
      if (termo && !c.num.toLowerCase().includes(termo) && !c.titulo?.toLowerCase().includes(termo)) return false;
      if (cultura && c.cultura !== cultura) return false;
      if (fazenda && c.bucket !== fazenda) return false;
      if (statusF && c.status !== statusF) return false;
      return true;
    });
    return out.sort((a, b) => {
      const pa = PRIOR_ORDEM[a.prior || 'Média'] ?? 9;
      const pb = PRIOR_ORDEM[b.prior || 'Média'] ?? 9;
      return pa !== pb ? pa - pb : (b.data || '').localeCompare(a.data || '');
    });
  }, [todos, nivelCard, busca, cultura, fazenda, statusF]);

  const paginados = useMemo(() => filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtrados, page]);

  const columns: DataTableColumn<Chamado>[] = [
    { key: 'num', header: 'Número', render: (c) => <span className="font-mono-num font-semibold text-primary">{c.num}</span> },
    {
      key: 'titulo',
      header: 'Título',
      render: (c) => (
        <div>
          <div className="max-w-[240px] truncate font-medium text-foreground">{c.titulo}</div>
          <div className="font-mono-num text-xs text-subtle">{frotaLabel(c.num, c.equipCodigo) || '—'}</div>
        </div>
      ),
    },
    { key: 'prior', header: 'Criticidade', render: (c) => <PrioridadeBadge prioridade={c.prior} /> },
    { key: 'cultura', header: 'Cultura', render: (c) => <CulturaBadge cultura={c.cultura} /> },
    { key: 'resp', header: 'Responsável', render: (c) => c.resp || '—' },
    { key: 'bucket', header: 'Fazenda', render: (c) => fazendaLabel(c.bucket) },
    { key: 'data', header: 'Data', render: (c) => <span className="font-mono-num text-sm">{formatDataBR(c.data)}</span> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {NIVEIS.map((n) => (
          <KpiCard
            key={n.key}
            label={n.label}
            value={carregando ? '—' : (porNivel.get(n.key) || []).length}
            color={n.color}
            active={nivelCard === n.key}
            onClick={() => setNivelCard((v) => (v === n.key ? '' : n.key))}
          />
        ))}
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número, título…" className="w-56" />
        <Select value={cultura || 'todas'} onValueChange={(v) => setCultura(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda cultura</SelectItem>
            <SelectItem value="Grãos e Fibras">Grãos e Fibras</SelectItem>
            <SelectItem value="Tabaco">Tabaco</SelectItem>
            <SelectItem value="Cacau">Cacau</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fazenda || 'todas'} onValueChange={(v) => setFazenda(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda fazenda</SelectItem>
            <SelectItem value="Solinftec KRT">Karitel</SelectItem>
            <SelectItem value="Solinftec RDM">Rio do Meio</SelectItem>
            <SelectItem value="Rádio">Rádio</SelectItem>
            <SelectItem value="John Deere">John Deere</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusF || 'todos'} onValueChange={(v) => setStatusF(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="Aberto">Aberto</SelectItem>
            <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
            <SelectItem value="Aguardando Peça">Aguardando Peça</SelectItem>
            <SelectItem value="Encerrado">Encerrado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={limparFiltros}>
          Limpar filtros
        </Button>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paginados}
        rowKey={(c) => c.num}
        loading={carregando}
        onRowClick={(c) => abrirDetalhe(c.num)}
        emptyTitle="Nenhum chamado encontrado"
      />
      <Pagination page={page} totalItems={filtrados.length} perPage={PER_PAGE} onPageChange={setPage} />
    </div>
  );
}
