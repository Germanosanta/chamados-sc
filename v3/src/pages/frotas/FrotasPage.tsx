import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipCrudDialog } from '@/components/shared/EquipCrudDialog';
import { useChamados } from '@/hooks/useChamados';
import { useCadastroEquipamentos } from '@/hooks/useEquipamentos';
import { formatDataBR } from '@/utils/chamado-helpers';
import matchMap from '@/data/match_map.json';
import equipIdx from '@/data/equip_idx.json';
import type { EquipIdxEntry } from '@/types/equipamento';
import type { Chamado } from '@/types/chamado';
import type { Equipamento } from '@/types/equipamento';

const MATCH_MAP = matchMap as unknown as Record<string, string>;
const EQUIP_IDX = equipIdx as unknown as Record<string, EquipIdxEntry>;
const PER_PAGE = 25;

interface FrotaLinha {
  code: string;
  d: string;
  g: string;
  s: string;
  count: number;
}

/** Por Frota — histórico de chamados agrupado por equipamento, portado
 * de renderFrotas()/verHistoricoFrota() (equipamentos/index.js). Tela
 * complementar ao Cadastro (CRUD): aqui é analytics somente-leitura. */
export function FrotasPage() {
  const { data: todos, carregando } = useChamados();
  const { data: cadastro } = useCadastroEquipamentos();

  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [statusF, setStatusF] = useState('');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [crudOpen, setCrudOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [busca, grupo, statusF]);

  const frotaMap = useMemo(() => {
    const m = new Map<string, Chamado[]>();
    for (const c of todos) {
      const code = c.equipCodigo || MATCH_MAP[c.num];
      if (!code) continue;
      const arr = m.get(code) || [];
      if (!arr.some((x) => x.num === c.num)) arr.push(c);
      m.set(code, arr);
    }
    return m;
  }, [todos]);

  const linhas: FrotaLinha[] = useMemo(
    () =>
      [...frotaMap.entries()].map(([code, recs]) => {
        const eq = EQUIP_IDX[code] || { d: code, g: '—', s: 'Ativo' };
        return { code, d: eq.d || code, g: eq.g || '—', s: eq.s || 'Ativo', count: recs.length };
      }),
    [frotaMap],
  );

  const grupos = useMemo(() => [...new Set(linhas.map((l) => l.g).filter(Boolean))].sort(), [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas
      .filter((l) => {
        if (q && !l.code.toLowerCase().includes(q) && !l.d.toLowerCase().includes(q)) return false;
        if (grupo && l.g !== grupo) return false;
        if (statusF && l.s !== statusF) return false;
        return true;
      })
      .sort((a, b) => b.count - a.count);
  }, [linhas, busca, grupo, statusF]);

  const paginadas = useMemo(() => filtradas.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtradas, page]);

  const historicoSelecionado = useMemo(
    () => (selecionada ? (frotaMap.get(selecionada) || []).sort((a, b) => (b.data || '').localeCompare(a.data || '')) : []),
    [frotaMap, selecionada],
  );

  const columns: DataTableColumn<FrotaLinha>[] = [
    { key: 'code', header: 'Código', render: (l) => <span className="font-mono-num font-semibold text-primary">{l.code}</span> },
    { key: 'd', header: 'Descrição', render: (l) => <div className="max-w-[220px] truncate">{l.d}</div> },
    { key: 'g', header: 'Grupo', render: (l) => l.g },
    { key: 's', header: 'Status', render: (l) => <StatusBadge status={l.s} /> },
    { key: 'count', header: 'Chamados', render: (l) => <span className="font-mono-num font-bold">{l.count}</span> },
  ];

  const detColumns: DataTableColumn<Chamado>[] = [
    { key: 'num', header: 'Chamado', render: (c) => <span className="font-mono-num font-semibold text-primary">{c.num}</span> },
    { key: 'titulo', header: 'Título', render: (c) => <div className="max-w-[200px] truncate">{c.titulo}</div> },
    { key: 'data', header: 'Data', render: (c) => formatDataBR(c.data) },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Frotas com Chamados" value={carregando ? '—' : linhas.length} color="blue" />
        <KpiCard label="Chamados Vinculados" value={carregando ? '—' : [...frotaMap.values()].reduce((a, v) => a + v.length, 0)} color="amber" />
        <KpiCard label="Mais Chamados" value={carregando ? '—' : linhas[0]?.code || '—'} color="green" />
        <KpiCard label="Frotas Inativas" value={carregando ? '—' : linhas.filter((l) => l.s !== 'Ativo').length} color="red" />
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código, descrição…" className="w-56" />
        <Select value={grupo || 'todos'} onValueChange={(v) => setGrupo(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo grupo</SelectItem>
            {grupos.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusF || 'todos'} onValueChange={(v) => setStatusF(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo status</SelectItem>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paginadas}
        rowKey={(l) => l.code}
        loading={carregando}
        onRowClick={(l) => setSelecionada(l.code)}
        emptyTitle="Nenhuma frota com chamados encontrada"
      />
      <Pagination page={page} totalItems={filtradas.length} perPage={PER_PAGE} onPageChange={setPage} />

      {selecionada && (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-base font-bold text-foreground">Histórico — {selecionada}</div>
            <div className="flex items-center gap-3">
              <button onClick={() => setCrudOpen(true)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                <Pencil className="h-3.5 w-3.5" /> Editar cadastro
              </button>
              <button onClick={() => setSelecionada(null)} className="text-sm text-subtle hover:text-foreground">Fechar ✕</button>
            </div>
          </div>
          <DataTable columns={detColumns} rows={historicoSelecionado} rowKey={(c) => c.num} emptyTitle="Nenhum chamado" />
        </div>
      )}

      <EquipCrudDialog
        frota={selecionada}
        cadastroAtual={cadastro.find((c) => c.frota === selecionada) as Equipamento | null}
        open={crudOpen}
        onOpenChange={setCrudOpen}
      />
    </div>
  );
}
