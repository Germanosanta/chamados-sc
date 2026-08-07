import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { CulturaBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEncerradosLista } from '@/hooks/useChamados';
import { useTecnicosAtivos } from '@/hooks/useTecnicos';
import { useDetalheStore } from '@/store/detalhe';
import { fazendaLabel, formatDataBR, frotaLabel } from '@/utils/chamado-helpers';
import { downloadCSV } from '@/utils/csv';
import { cn } from '@/utils/cn';
import type { Chamado } from '@/types/chamado';

const PER_PAGE = 50;

/** Chamados Encerrados — histórico de conclusões, mesmos filtros/KPIs/
 * exportação da V2 (renderEncerrados()/exportEncerradosCSV). */
export function EncerradosPage() {
  const { data: encerrados, carregando } = useEncerradosLista();
  const { data: tecnicos } = useTecnicosAtivos();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);

  const [busca, setBusca] = useState('');
  const [resp, setResp] = useState('');
  const [cultura, setCultura] = useState('');
  const [fDe, setFDe] = useState('');
  const [fAte, setFAte] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [busca, resp, cultura, fDe, fAte]);

  function limparFiltros() {
    setBusca('');
    setResp('');
    setCultura('');
    setFDe('');
    setFAte('');
  }

  const esteMes = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return encerrados.filter((c) => c.encerramento?.encerradoEm?.startsWith(ym)).length;
  }, [encerrados]);

  const tempoMedio = useMemo(() => {
    const validos = encerrados.filter((c) => c.data && c.encerramento?.encerradoEm);
    if (!validos.length) return '—';
    const total = validos.reduce((acc, c) => {
      const dias = Math.round((new Date(c.encerramento!.encerradoEm).getTime() - new Date(c.data + 'T00:00').getTime()) / 86400000);
      return acc + dias;
    }, 0);
    return `${Math.round(total / validos.length)}d`;
  }, [encerrados]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return encerrados.filter((c) => {
      if (termo && !c.num.toLowerCase().includes(termo) && !c.titulo?.toLowerCase().includes(termo)) return false;
      if (resp && !(c.resp || '').includes(resp)) return false;
      if (cultura && c.cultura !== cultura) return false;
      if (fDe && c.data < fDe) return false;
      if (fAte && c.data > fAte) return false;
      return true;
    });
  }, [encerrados, busca, resp, cultura, fDe, fAte]);

  const paginados = useMemo(() => filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtrados, page]);

  function exportar() {
    downloadCSV('encerrados_santa_colomba.csv', [
      ['Número', 'Título', 'Cultura', 'Fazenda', 'Sistema', 'Responsável', 'Abertura', 'Encerramento', 'Técnico(s)', 'Encerrado por'],
      ...filtrados.map((c) => [
        c.num,
        c.titulo,
        c.cultura,
        fazendaLabel(c.bucket),
        c.bucket,
        c.resp,
        c.data,
        c.encerramento?.dataEncerramento || '',
        c.encerramento?.tecnicos || '',
        c.encerramento?.encerradoPor || '',
      ]),
    ]);
  }

  const columns: DataTableColumn<Chamado>[] = [
    { key: 'num', header: 'Número', render: (c) => <span className="font-mono-num font-semibold text-primary">{c.num}</span> },
    {
      key: 'titulo',
      header: 'Título',
      render: (c) => (
        <div>
          <div className="max-w-[220px] truncate font-medium text-foreground">{c.titulo}</div>
          <div className="font-mono-num text-xs text-subtle">{frotaLabel(c) || '—'}</div>
        </div>
      ),
    },
    { key: 'cultura', header: 'Cultura', render: (c) => <CulturaBadge cultura={c.cultura} /> },
    { key: 'fazenda', header: 'Fazenda', render: (c) => fazendaLabel(c.bucket) },
    { key: 'resp', header: 'Responsável(is)', render: (c) => c.resp || '—' },
    { key: 'abertura', header: 'Abertura', render: (c) => <span className="font-mono-num text-sm">{formatDataBR(c.data)}</span> },
    {
      key: 'encerramento',
      header: 'Data de Encerramento',
      render: (c) => (
        <span className={cn('font-mono-num text-sm', !c.encerramento?.dataEncerramento && 'text-subtle')}>
          {c.encerramento?.dataEncerramento
            ? `${c.encerramento.dataEncerramento}${c.encerramento.horaEncerramento ? ` ${c.encerramento.horaEncerramento}` : ''}`
            : 'Data não registrada'}
        </span>
      ),
    },
    { key: 'tecnicos', header: 'Técnico(s)', render: (c) => c.encerramento?.tecnicos || '—' },
    { key: 'encerradoPor', header: 'Encerrado por', render: (c) => c.encerramento?.encerradoPor || '—' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total" value={carregando ? '—' : encerrados.length} color="green" />
        <KpiCard label="Este Mês" value={carregando ? '—' : esteMes} color="blue" />
        <KpiCard label="Tempo Médio" value={carregando ? '—' : tempoMedio} color="amber" />
        <KpiCard label="Filtrados" value={carregando ? '—' : filtrados.length} color="purple" />
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número, título…" className="w-56" />
        <Select value={resp || 'todos'} onValueChange={(v) => setResp(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {tecnicos.map((t) => (
              <SelectItem key={t.key} value={t.apelido || t.nome}>{t.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cultura || 'todas'} onValueChange={(v) => setCultura(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda cultura</SelectItem>
            <SelectItem value="Grãos e Fibras">Grãos e Fibras</SelectItem>
            <SelectItem value="Tabaco">Tabaco</SelectItem>
            <SelectItem value="Cacau">Cacau</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="w-36" />
        <span className="text-sm text-subtle">até</span>
        <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="w-36" />
        <Button variant="ghost" onClick={limparFiltros}>
          Limpar filtros
        </Button>
        <Button variant="ghost" onClick={exportar}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paginados}
        rowKey={(c) => c.num}
        loading={carregando}
        onRowClick={(c) => abrirDetalhe(c.num)}
        emptyTitle="Nenhum chamado encerrado"
      />
      <Pagination page={page} totalItems={filtrados.length} perPage={PER_PAGE} onPageChange={setPage} />
    </div>
  );
}
