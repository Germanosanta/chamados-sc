import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipCrudDialog } from '@/components/shared/EquipCrudDialog';
import { FichaEquipamentoModal } from '@/components/shared/FichaEquipamentoModal';
import { useCadastroEquipamentos, useEquipUniverso } from '@/hooks/useEquipamentos';
import { useChamados } from '@/hooks/useChamados';
import type { Equipamento } from '@/types/equipamento';

const PER_PAGE = 25;

interface Linha {
  frota: string;
  descricao: string;
  modelo: string;
  fabricante: string;
  tipo: string;
  fazenda: string;
  status: string;
  temCad: boolean;
  chamados: number;
}

/** Cadastro de Equipamentos — portado de renderEquipamentos()
 * (equipamentos/index.js): base estática + overrides do cadastro em
 * tempo real, mesmos KPIs/filtros. */
export function EquipamentosPage() {
  const universo = useEquipUniverso();
  const { data: cadastro, carregando } = useCadastroEquipamentos();
  const { data: todos } = useChamados();

  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [fazenda, setFazenda] = useState('');
  const [status, setStatus] = useState('');
  const [semCad, setSemCad] = useState(false);
  const [page, setPage] = useState(1);

  const [fichaFrota, setFichaFrota] = useState<string | null>(null);
  const [crudFrota, setCrudFrota] = useState<string | null>(null);
  const [crudOpen, setCrudOpen] = useState(false);

  useEffect(() => setPage(1), [busca, tipo, fazenda, status, semCad]);

  const cadMap = useMemo(() => new Map(cadastro.map((c) => [c.frota, c])), [cadastro]);
  const chCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of todos) {
      if (c.equipCodigo) m.set(c.equipCodigo, (m.get(c.equipCodigo) || 0) + 1);
    }
    return m;
  }, [todos]);

  const linhas: Linha[] = useMemo(
    () =>
      universo.map((e) => {
        const cad = cadMap.get(e.c);
        return {
          frota: e.c,
          descricao: e.d,
          modelo: cad?.modelo || e.m || '',
          fabricante: cad?.fabricante || '',
          tipo: cad?.tipo || e.g || '',
          fazenda: cad?.fazenda || '',
          status: cad?.status || e.s || 'Ativo',
          temCad: !!cad,
          chamados: chCount.get(e.c) || 0,
        };
      }),
    [universo, cadMap, chCount],
  );

  const tipos = useMemo(() => [...new Set(linhas.map((l) => l.tipo).filter(Boolean))].sort(), [linhas]);
  const fazendas = useMemo(() => [...new Set(linhas.map((l) => l.fazenda).filter(Boolean))].sort(), [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (q && !l.frota.toLowerCase().includes(q) && !l.descricao.toLowerCase().includes(q) && !l.modelo.toLowerCase().includes(q) && !l.fabricante.toLowerCase().includes(q)) return false;
      if (tipo && l.tipo !== tipo) return false;
      if (fazenda && l.fazenda !== fazenda) return false;
      if (status && l.status !== status) return false;
      if (semCad && l.temCad) return false;
      return true;
    });
  }, [linhas, busca, tipo, fazenda, status, semCad]);

  const paginadas = useMemo(() => filtradas.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtradas, page]);

  const columns: DataTableColumn<Linha>[] = [
    { key: 'frota', header: 'Frota', render: (l) => <span className="font-mono-num font-semibold text-primary">{l.frota}</span> },
    { key: 'descricao', header: 'Descrição', render: (l) => <span className="max-w-[200px] truncate">{l.descricao}</span> },
    { key: 'modelo', header: 'Modelo', render: (l) => l.modelo || '—' },
    { key: 'fabricante', header: 'Fabricante', render: (l) => l.fabricante || '—' },
    { key: 'tipo', header: 'Tipo', render: (l) => <Badge variant="graos">{l.tipo || '—'}</Badge> },
    { key: 'fazenda', header: 'Fazenda', render: (l) => l.fazenda || '—' },
    { key: 'status', header: 'Status', render: (l) => <Badge variant={l.status === 'Ativo' ? 'green' : l.status === 'Manutenção' ? 'amber' : 'neutral'}>{l.status}</Badge> },
    {
      key: 'chamados',
      header: 'Chamados',
      render: (l) => (l.chamados ? <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary-text">{l.chamados}</span> : '—'),
    },
    {
      key: 'acoes',
      header: 'Ações',
      render: (l) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setCrudFrota(l.frota);
            setCrudOpen(true);
          }}
        >
          ✏️ Editar
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total" value={carregando ? '—' : linhas.length} color="blue" />
        <KpiCard label="Ativos" value={linhas.filter((l) => l.status === 'Ativo').length} color="green" />
        <KpiCard label="Inativos" value={linhas.filter((l) => l.status !== 'Ativo').length} color="red" />
        <KpiCard label="Com Chamados" value={chCount.size} color="amber" />
        <KpiCard label="Com Cadastro" value={cadastro.length} color="purple" />
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar frota, descrição, modelo…" className="w-56" />
        <Select value={tipo || 'todos'} onValueChange={(v) => setTipo(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo tipo</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fazenda || 'todas'} onValueChange={(v) => setFazenda(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda fazenda</SelectItem>
            {fazendas.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo status</SelectItem>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
            <SelectItem value="Manutenção">Manutenção</SelectItem>
          </SelectContent>
        </Select>
        <Label className="flex items-center gap-1.5 normal-case">
          <Checkbox checked={semCad} onCheckedChange={(v) => setSemCad(!!v)} /> Sem cadastro
        </Label>
        <Button className="ml-auto" size="sm" onClick={() => { setCrudFrota(null); setCrudOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Novo Equipamento
        </Button>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paginadas}
        rowKey={(l) => l.frota}
        loading={carregando}
        onRowClick={(l) => setFichaFrota(l.frota)}
        emptyTitle="Nenhum equipamento encontrado"
      />
      <Pagination page={page} totalItems={filtradas.length} perPage={PER_PAGE} onPageChange={setPage} />

      <FichaEquipamentoModal
        frota={fichaFrota}
        open={!!fichaFrota}
        onOpenChange={(v) => !v && setFichaFrota(null)}
        onEditar={() => {
          setCrudFrota(fichaFrota);
          setCrudOpen(true);
          setFichaFrota(null);
        }}
      />
      <EquipCrudDialog
        frota={crudFrota}
        cadastroAtual={(cadMap.get(crudFrota || '') as Equipamento) || null}
        open={crudOpen}
        onOpenChange={setCrudOpen}
      />
    </div>
  );
}
