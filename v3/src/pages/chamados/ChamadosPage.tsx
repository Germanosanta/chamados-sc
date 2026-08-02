import { useEffect, useMemo, useState } from 'react';
import { Download, SlidersHorizontal } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar, FilterBarSeparator } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn, type SortState } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { CulturaBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useChamados } from '@/hooks/useChamados';
import { useTecnicosAtivos } from '@/hooks/useTecnicos';
import { useDetalheStore } from '@/store/detalhe';
import { diasAberto, fazendaLabel, formatDataBR, frotaLabel } from '@/utils/chamado-helpers';
import { downloadCSV } from '@/utils/csv';
import type { Chamado } from '@/types/chamado';

const PER_PAGE = 50;

/** "Chamados / Todos" — lista completa (histórico + tempo real),
 * ordenável por coluna, com os mesmos filtros/paginação/exportação da V2
 * (applyFilters()/sortChamados()/exportarCSV, chamados/index.js). */
export function ChamadosPage() {
  const { data: todos, carregando } = useChamados();
  const { data: tecnicos } = useTecnicosAtivos();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);

  const [busca, setBusca] = useState('');
  const [cultura, setCultura] = useState('');
  const [status, setStatus] = useState('');
  const [bucket, setBucket] = useState('');
  const [resp, setResp] = useState('');
  const [avancado, setAvancado] = useState(false);
  const [prior, setPrior] = useState('');
  const [slaCritico, setSlaCritico] = useState(false);
  const [fDe, setFDe] = useState('');
  const [fAte, setFAte] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'data', dir: 'desc' });
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [busca, cultura, status, bucket, resp, prior, slaCritico, fDe, fAte]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let out = todos.filter((c) => {
      if (termo) {
        const frota = frotaLabel(c.num, c.equipCodigo).toLowerCase();
        if (!c.num.toLowerCase().includes(termo) && !c.titulo?.toLowerCase().includes(termo) && !frota.includes(termo)) return false;
      }
      if (cultura && c.cultura !== cultura) return false;
      if (status && c.status !== status) return false;
      if (bucket && c.bucket !== bucket) return false;
      if (resp && !(c.resp || '').includes(resp)) return false;
      if (prior && (c.prior || 'Média') !== prior) return false;
      if (slaCritico && diasAberto(c.data) <= 7) return false;
      if (fDe && c.data < fDe) return false;
      if (fAte && c.data > fAte) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      const va = String(a[sort.key as keyof Chamado] ?? '');
      const vb = String(b[sort.key as keyof Chamado] ?? '');
      return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return out;
  }, [todos, busca, cultura, status, bucket, resp, prior, slaCritico, fDe, fAte, sort]);

  const paginados = useMemo(() => filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtrados, page]);

  // memoizado porque `todos` pode ter milhares de registros históricos —
  // sem isso, os 2 KPIs abaixo re-varreriam a lista inteira a cada
  // digitação nos filtros, mesmo sem nenhuma relação com o texto buscado.
  const { emAberto, encerrados } = useMemo(() => {
    let emAberto = 0;
    let encerrados = 0;
    for (const c of todos) {
      if (c.status === 'Encerrado' || c.status === 'Concluída') encerrados++;
      else emAberto++;
    }
    return { emAberto, encerrados };
  }, [todos]);

  function exportar() {
    downloadCSV('chamados_santa_colomba.csv', [
      ['Número', 'Título', 'Cultura', 'Responsável', 'Data', 'Status', 'Sistema'],
      ...filtrados.map((c) => [c.num, c.titulo, c.cultura, c.resp, c.data, c.status, c.bucket]),
    ]);
  }

  const columns: DataTableColumn<Chamado>[] = [
    {
      key: 'num',
      header: 'Número',
      sortable: true,
      render: (c) => <span className="font-mono-num font-semibold text-primary">{c.num}</span>,
    },
    {
      key: 'titulo',
      header: 'Título / Equipamento',
      sortable: true,
      render: (c) => (
        <div>
          <div className="max-w-[260px] truncate font-medium text-foreground">{c.titulo}</div>
          <div className="font-mono-num text-xs text-subtle">{frotaLabel(c.num, c.equipCodigo) || '—'}</div>
        </div>
      ),
    },
    { key: 'cultura', header: 'Cultura', sortable: true, render: (c) => <CulturaBadge cultura={c.cultura} /> },
    { key: 'resp', header: 'Responsável', sortable: true, render: (c) => c.resp || <span className="text-subtle">—</span> },
    { key: 'data', header: 'Data', sortable: true, render: (c) => <span className="font-mono-num text-sm">{formatDataBR(c.data)}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (c) => <StatusBadge status={c.status} /> },
    { key: 'bucket', header: 'Fazenda/Sistema', render: (c) => <span className="text-sm text-subtle">{fazendaLabel(c.bucket)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total" value={carregando ? '—' : todos.length} color="blue" />
        <KpiCard label="Em Aberto" value={carregando ? '—' : emAberto} color="red" />
        <KpiCard label="Encerrados" value={carregando ? '—' : encerrados} color="green" />
        <KpiCard label="Filtrados" value={filtrados.length} color="amber" />
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número, frota, título…" className="w-56" />
        <Select value={cultura || 'todas'} onValueChange={(v) => setCultura(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda cultura</SelectItem>
            <SelectItem value="Grãos e Fibras">Grãos e Fibras</SelectItem>
            <SelectItem value="Tabaco">Tabaco</SelectItem>
            <SelectItem value="Cacau">Cacau</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="Aberto">Aberto</SelectItem>
            <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
            <SelectItem value="Aguardando Peça">Aguardando Peça</SelectItem>
            <SelectItem value="Encerrado">Encerrado</SelectItem>
            <SelectItem value="Cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bucket || 'todos'} onValueChange={(v) => setBucket(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Toda fazenda/sistema</SelectItem>
            <SelectItem value="Solinftec KRT">Karitel</SelectItem>
            <SelectItem value="Solinftec RDM">Rio do Meio</SelectItem>
            <SelectItem value="Rádio">Rádio</SelectItem>
            <SelectItem value="John Deere">John Deere</SelectItem>
          </SelectContent>
        </Select>

        <FilterBarSeparator />
        <Button variant="ghost" onClick={() => setAvancado((v) => !v)}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros avançados
        </Button>
        <Button variant="ghost" onClick={exportar}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </FilterBar>

      {avancado && (
        <FilterBar>
          <Select value={resp || 'todos'} onValueChange={(v) => setResp(v === 'todos' ? '' : v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {tecnicos.map((t) => (
                <SelectItem key={t.key} value={t.apelido || t.nome}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prior || 'todas'} onValueChange={(v) => setPrior(v === 'todas' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Toda prioridade</SelectItem>
              <SelectItem value="Urgente">⚡ Urgente</SelectItem>
              <SelectItem value="Alta">🔴 Alta</SelectItem>
              <SelectItem value="Média">🟡 Média</SelectItem>
              <SelectItem value="Baixa">🟢 Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Label className="flex items-center gap-1.5 normal-case">
            <Checkbox checked={slaCritico} onCheckedChange={(v) => setSlaCritico(!!v)} /> SLA crítico
          </Label>
          <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="w-36" />
          <span className="text-sm text-subtle">até</span>
          <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="w-36" />
        </FilterBar>
      )}

      <DataTable
        columns={columns}
        rows={paginados}
        rowKey={(c) => c.num}
        loading={carregando}
        onRowClick={(c) => abrirDetalhe(c.num)}
        sort={sort}
        onSortChange={setSort}
        emptyTitle="Nenhum chamado encontrado"
      />
      <Pagination page={page} totalItems={filtrados.length} perPage={PER_PAGE} onPageChange={setPage} />
    </div>
  );
}
