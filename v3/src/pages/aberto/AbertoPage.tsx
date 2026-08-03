import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar, FilterBarSeparator } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { KanbanBoard } from '@/components/shared/KanbanBoard';
import { RouteLoading } from '@/components/shared/RouteLoading';
import { CulturaBadge, DiasChip, PrioridadeBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAbertos, useAlterarStatusChamado, useAssumirChamado, useReatribuirResponsavel } from '@/hooks/useChamados';
import { useTecnicosAtivos } from '@/hooks/useTecnicos';
import { usePermission } from '@/hooks/usePermission';
import { diasAberto, diasBorderClass, fazendaLabel, formatDataBR, frotaLabel, isSlaCritico } from '@/utils/chamado-helpers';
import { useDetalheStore } from '@/store/detalhe';
import type { Chamado } from '@/types/chamado';
import { cn } from '@/utils/cn';

const CULTURAS = [
  { key: 'Grãos e Fibras', label: '🌾 Grãos e Fibras', color: 'blue' as const },
  { key: 'Tabaco', label: '🌿 Tabaco', color: 'amber' as const },
  { key: 'Cacau', label: '🍫 Cacau', color: 'cacau' as const },
];

const FAZENDA_CORES = ['teal', 'purple', 'blue', 'amber'] as const;

const PER_PAGE = 50;

export function AbertoPage() {
  const [searchParams] = useSearchParams();
  const { data: abertos, carregando } = useAbertos();
  const { data: tecnicos } = useTecnicosAtivos();
  const reatribuir = useReatribuirResponsavel();
  const assumir = useAssumirChamado();
  const alterarStatus = useAlterarStatusChamado();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);
  const podeEditar = usePermission('p_editar');

  const [view, setView] = useState<'lista' | 'kanban'>('lista');
  const [busca, setBusca] = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState('');
  const [resp, setResp] = useState('');
  const [ordem, setOrdem] = useState<'antigos' | 'recentes'>('antigos');
  const [cultCard, setCultCard] = useState('');
  const [fazendaCard, setFazendaCard] = useState('');
  const [avancado, setAvancado] = useState(false);
  const [prior, setPrior] = useState('');
  const [slaCritico, setSlaCritico] = useState(false);
  const [semResp, setSemResp] = useState(false);
  const [fFrota, setFFrota] = useState('');
  const [fSolicitante, setFSolicitante] = useState('');
  const [fDe, setFDe] = useState('');
  const [fAte, setFAte] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [busca, status, resp, ordem, cultCard, fazendaCard, prior, slaCritico, semResp, fFrota, fSolicitante, fDe, fAte]);

  const porCultura = useMemo(() => {
    const m = new Map<string, Chamado[]>();
    for (const c of abertos) {
      const arr = m.get(c.cultura) || [];
      arr.push(c);
      m.set(c.cultura, arr);
    }
    return m;
  }, [abertos]);

  // KPIs secundários (críticos/vencidos/sem responsável): antes só
  // apareciam como texto pequeno dentro dos cards de Cultura — agora são
  // indicadores de primeira classe, que também funcionam como atalho de
  // filtro (mesmo padrão de clique dos cards de Cultura/Fazenda).
  const criticosCount = useMemo(() => abertos.filter((c) => c.prior === 'Urgente').length, [abertos]);
  const vencidosCount = useMemo(() => abertos.filter(isSlaCritico).length, [abertos]);
  const semRespCount = useMemo(() => abertos.filter((c) => !c.resp).length, [abertos]);

  const porFazenda = useMemo(() => {
    const m = new Map<string, Chamado[]>();
    for (const c of abertos) {
      if (!c.bucket) continue;
      const arr = m.get(c.bucket) || [];
      arr.push(c);
      m.set(c.bucket, arr);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [abertos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let out = abertos.filter((c) => {
      if (termo) {
        const frota = frotaLabel(c.num, c.equipCodigo).toLowerCase();
        const match =
          c.num.toLowerCase().includes(termo) ||
          c.titulo?.toLowerCase().includes(termo) ||
          frota.includes(termo);
        if (!match) return false;
      }
      if (status && c.status !== status) return false;
      if (resp && !(c.resp || '').includes(resp)) return false;
      if (cultCard && c.cultura !== cultCard) return false;
      if (fazendaCard && c.bucket !== fazendaCard) return false;
      if (prior && (c.prior || 'Média') !== prior) return false;
      if (slaCritico && diasAberto(c.data) <= 7) return false;
      if (semResp && c.resp) return false;
      if (fFrota && !frotaLabel(c.num, c.equipCodigo).toLowerCase().includes(fFrota.toLowerCase())) return false;
      if (fSolicitante && !(c.solicitante || '').toLowerCase().includes(fSolicitante.toLowerCase())) return false;
      if (fDe && c.data < fDe) return false;
      if (fAte && c.data > fAte) return false;
      return true;
    });
    // String(x || '') — defesa extra além da normalização em
    // useChamados.ts: mesmo que um chamado malformado chegue até aqui
    // (fonte de dados nova, teste, etc.), o sort nunca quebra a tela.
    out = out.sort((a, b) => {
      const da = String(a.data || '');
      const db = String(b.data || '');
      return ordem === 'antigos' ? da.localeCompare(db) : db.localeCompare(da);
    });
    return out;
  }, [abertos, busca, status, resp, cultCard, fazendaCard, prior, slaCritico, semResp, fFrota, fSolicitante, fDe, fAte, ordem]);

  const paginados = useMemo(() => filtrados.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtrados, page]);

  const temFiltroDeCard = !!cultCard || !!fazendaCard;

  function limparTudo() {
    setBusca('');
    setStatus('');
    setResp('');
    setOrdem('antigos');
    setCultCard('');
    setFazendaCard('');
    setPrior('');
    setSlaCritico(false);
    setSemResp(false);
    setFFrota('');
    setFSolicitante('');
    setFDe('');
    setFAte('');
  }

  const handleReatribuir = useCallback(
    async (chamado: Chamado, novoResp: string) => {
      try {
        await reatribuir(chamado, novoResp);
        toast(`${chamado.num} → ${novoResp}`);
      } catch {
        toast.error('Não foi possível reatribuir. Tente novamente.');
      }
    },
    [reatribuir],
  );

  // useCallback nos 3 handlers abaixo (+ abrirDetalhe já é estável, vem do
  // Zustand): é o que permite ao KanbanCard/KanbanColumn memoizados de
  // fato pular re-render quando só o texto de busca muda, sem afetar o
  // card em questão.
  const handleAssumir = useCallback(
    async (chamado: Chamado) => {
      try {
        await assumir(chamado);
        toast(`⚡ Você assumiu o chamado ${chamado.num}`);
      } catch {
        toast.error('Não foi possível assumir o chamado.');
      }
    },
    [assumir],
  );

  const handleStatusChange = useCallback(
    async (chamado: Chamado, novoStatus: Chamado['status']) => {
      // Botão/drag já ficam escondidos/sem efeito pra quem não tem
      // p_editar (ver `podeEditar` abaixo) — esse guard é só a segunda
      // linha de defesa, pra dar feedback claro em vez de deixar a regra
      // do Firestore rejeitar a escrita em silêncio.
      if (!podeEditar) {
        toast.error('Você não tem permissão para alterar o status de chamados.');
        return;
      }
      try {
        await alterarStatus(chamado, novoStatus);
        toast(`${chamado.num} → ${novoStatus}`);
      } catch {
        toast.error('Não foi possível mover o chamado.');
      }
    },
    [alterarStatus, podeEditar],
  );

  const handleCardClick = useCallback((chamado: Chamado) => abrirDetalhe(chamado.num), [abrirDetalhe]);

  const columns: DataTableColumn<Chamado>[] = [
    {
      key: 'num',
      header: 'Número',
      render: (c) => {
        const frota = frotaLabel(c.num, c.equipCodigo);
        return (
          <div>
            <span className="font-mono-num font-semibold text-primary">{c.num}</span>
            <div className={cn('font-mono-num text-xs', frota ? 'text-primary' : 'text-subtle')}>
              {frota ? `🚜 ${frota}` : 'Sem equipamento vinculado'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'titulo',
      header: 'Título / Equipamento',
      render: (c) => (
        <div>
          <div className="max-w-[240px] truncate font-medium text-foreground">{c.titulo}</div>
          <div className="text-xs text-subtle">{fazendaLabel(c.bucket)}</div>
        </div>
      ),
    },
    { key: 'solicitante', header: 'Solicitante', render: (c) => c.solicitante || <span className="text-subtle">—</span> },
    { key: 'cultura', header: 'Setor', render: (c) => <CulturaBadge cultura={c.cultura} /> },
    { key: 'resp', header: 'Responsável', render: (c) => c.resp || <span className="text-subtle">—</span> },
    { key: 'data', header: 'Data Abertura', render: (c) => <span className="font-mono-num text-sm">{formatDataBR(c.data)}</span> },
    { key: 'prior', header: 'Prioridade', render: (c) => <PrioridadeBadge prioridade={c.prior} /> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    { key: 'dias', header: 'Dias em Aberto', render: (c) => <DiasChip dias={diasAberto(c.data)} /> },
    {
      key: 'acao',
      header: 'Ação',
      render: (c) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {podeEditar && (
            <Select value="" onValueChange={(v) => handleReatribuir(c, v)}>
              <SelectTrigger className="h-7 w-24 text-sm">
                <SelectValue placeholder="Resp." />
              </SelectTrigger>
              <SelectContent>
                {tecnicos.map((t) => (
                  <SelectItem key={t.key} value={t.apelido || t.nome}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="sm" onClick={() => abrirDetalhe(c.num)}>
            {podeEditar ? 'Encerrar' : 'Ver'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-subtle">🌱 Cultura</div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {CULTURAS.map((cu) => {
            const itens = porCultura.get(cu.key) || [];
            const criticos = itens.filter((c) => c.prior === 'Urgente').length;
            return (
              <KpiCard
                compact
                key={cu.key}
                label={cu.label}
                value={carregando ? '—' : itens.length}
                sub={criticos > 0 ? <span className="font-semibold text-destructive">{criticos} crítico{criticos > 1 ? 's' : ''}</span> : undefined}
                color={cu.color}
                active={cultCard === cu.key}
                onClick={() => setCultCard((v) => (v === cu.key ? '' : cu.key))}
              />
            );
          })}
        </div>
      </div>

      {porFazenda.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-subtle">🚜 Fazenda</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {porFazenda.map(([bucket, itens], i) => {
              const criticos = itens.filter((c) => c.prior === 'Urgente').length;
              return (
                <KpiCard
                  compact
                  key={bucket}
                  label={`📍 ${fazendaLabel(bucket)}`}
                  value={itens.length}
                  sub={criticos > 0 ? <span className="font-semibold text-destructive">{criticos} crítico{criticos > 1 ? 's' : ''}</span> : undefined}
                  color={FAZENDA_CORES[i % FAZENDA_CORES.length]}
                  active={fazendaCard === bucket}
                  onClick={() => setFazendaCard((v) => (v === bucket ? '' : bucket))}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <IndicadorChip label="Total em Aberto" value={carregando ? '—' : abertos.length} variant="graos" />
        <IndicadorChip
          label="Críticos"
          value={criticosCount}
          variant="red"
          active={prior === 'Urgente'}
          onClick={() => setPrior((v) => (v === 'Urgente' ? '' : 'Urgente'))}
        />
        <IndicadorChip
          label="SLA Vencido"
          value={vencidosCount}
          variant="amber"
          active={slaCritico}
          onClick={() => setSlaCritico((v) => !v)}
        />
        <IndicadorChip
          label="Sem Responsável"
          value={semRespCount}
          variant="purple"
          active={semResp}
          onClick={() => setSemResp((v) => !v)}
        />
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número, frota, título…" className="w-56" />
        <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="Aberto">Aberto</SelectItem>
            <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
            <SelectItem value="Aguardando Peça">Aguardando Peça</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resp || 'todos'} onValueChange={(v) => setResp(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {tecnicos.map((t) => (
              <SelectItem key={t.key} value={t.apelido || t.nome}>{t.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="antigos">Mais antigos primeiro</SelectItem>
            <SelectItem value="recentes">Mais recentes primeiro</SelectItem>
          </SelectContent>
        </Select>

        <FilterBarSeparator />
        <Button variant="ghost" onClick={() => setAvancado((v) => !v)}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros avançados
        </Button>
        <Button variant="ghost" onClick={limparTudo}>
          Limpar tudo
        </Button>
        {temFiltroDeCard && (
          <Button variant="ghost" size="sm" onClick={() => { setCultCard(''); setFazendaCard(''); }}>
            <X className="h-3 w-3" /> Remover filtro de card
          </Button>
        )}

        <FilterBarSeparator />
        <div className="flex overflow-hidden rounded-sm border border-border">
          <button
            onClick={() => setView('lista')}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold', view === 'lista' ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground')}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            onClick={() => setView('kanban')}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold', view === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground')}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </button>
        </div>
      </FilterBar>

      {avancado && (
        <FilterBar>
          <span className="text-xs font-bold uppercase tracking-wide text-subtle">Avançado</span>
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
          <Input value={fFrota} onChange={(e) => setFFrota(e.target.value)} placeholder="Código/Frota contém…" className="w-44" />
          <Input value={fSolicitante} onChange={(e) => setFSolicitante(e.target.value)} placeholder="Solicitante contém…" className="w-44" />
          <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="w-36" />
          <span className="text-sm text-subtle">até</span>
          <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="w-36" />
        </FilterBar>
      )}

      {view === 'lista' ? (
        <>
          <DataTable
            columns={columns}
            rows={paginados}
            rowKey={(c) => c.num}
            loading={carregando}
            emptyTitle="Nenhum chamado em aberto"
            onRowClick={handleCardClick}
            rowClassName={(c) => cn('border-l-[3px]', diasBorderClass(diasAberto(c.data)))}
          />
          <Pagination page={page} totalItems={filtrados.length} perPage={PER_PAGE} onPageChange={setPage} />
        </>
      ) : carregando ? (
        <RouteLoading />
      ) : (
        <KanbanBoard
          chamados={filtrados}
          onStatusChange={handleStatusChange}
          onAssumir={podeEditar ? handleAssumir : undefined}
          onCardClick={handleCardClick}
        />
      )}
    </div>
  );
}

/** Indicador secundário como badge/chip — bem menor que um KpiCard de
 * propósito: acompanha os cards de Cultura/Fazenda sem competir com
 * eles visualmente (um card cheio pra "Críticos"/"SLA Vencido" ficava
 * do mesmo tamanho dos indicadores primários, ocupando espaço demais
 * antes da lista/Kanban de verdade). */
function IndicadorChip({
  label,
  value,
  variant,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  variant: BadgeProps['variant'];
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
        onClick && 'cursor-pointer hover:border-border2',
        active ? 'border-primary bg-primary-light' : 'border-border bg-surface text-muted-foreground',
      )}
    >
      {label}
      <Badge variant={variant}>{value}</Badge>
    </Comp>
  );
}
