import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { FilterBarSeparator } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { KanbanBoard } from '@/components/shared/KanbanBoard';
import { RouteLoading } from '@/components/shared/RouteLoading';
import { RespAvatar } from '@/components/shared/RespAvatar';
import { CulturaBadge, DiasChip, PrioridadeBadge, StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAbertos, useAlterarStatusChamado, useAssumirChamado, useReatribuirResponsavel } from '@/hooks/useChamados';
import { useTecnicosAtivos, useSouTecnicoAtivo } from '@/hooks/useTecnicos';
import { usePermission } from '@/hooks/usePermission';
import { useSessionStore } from '@/store/session';
import { diasAberto, diasBorderClass, fazendaLabel, formatDataBR, frotaLabel, isSlaCritico, podeAgirNoChamado } from '@/utils/chamado-helpers';
import { useDetalheStore } from '@/store/detalhe';
import type { Chamado } from '@/types/chamado';
import { cn } from '@/utils/cn';

const CULTURAS = [
  { key: 'Grãos e Fibras', icon: '🌾', label: 'Grãos e Fibras' },
  { key: 'Tabaco', icon: '🌿', label: 'Tabaco' },
  { key: 'Cacau', icon: '🍫', label: 'Cacau' },
] as const;

// Cor só do "ponto" (não do preenchimento inteiro do chip, que fica
// neutro) — dá pra distinguir fazenda visualmente sem competir com as
// cores semânticas de status/prioridade usadas no resto da tela.
const FAZENDA_DOTS = ['bg-info', 'bg-purple', 'bg-graos', 'bg-tabaco'] as const;

const PER_PAGE = 50;

export function AbertoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: abertos, carregando } = useAbertos();
  const { data: tecnicos } = useTecnicosAtivos();
  const reatribuir = useReatribuirResponsavel();
  const assumir = useAssumirChamado();
  const alterarStatus = useAlterarStatusChamado();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);
  const podeEditar = usePermission('p_editar');
  const podeCriar = usePermission('p_novo');
  const usuario = useSessionStore((s) => s.usuario);
  const souAdmin = usuario?.perfil === 'admin';
  const souTecnicoAtivo = useSouTecnicoAtivo();

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

  // KPIs secundários (críticos/vencidos/sem responsável): indicadores de
  // primeira classe que também funcionam como atalho de filtro (mesmo
  // padrão de clique dos chips de Cultura/Fazenda) — tudo numa única
  // faixa horizontal de chips, sem cards grandes.
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
  const advancedCount = [resp, prior, fFrota, fSolicitante, fDe, fAte, ordem !== 'antigos' ? '1' : ''].filter(Boolean).length;

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
    {
      key: 'resp',
      header: 'Responsável',
      render: (c) =>
        c.resp ? (
          <div className="flex items-center gap-1.5">
            <RespAvatar nome={c.resp} />
            <span className="min-w-0 truncate">{c.resp}</span>
          </div>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    { key: 'data', header: 'Data Abertura', render: (c) => <span className="font-mono-num text-sm">{formatDataBR(c.data)}</span> },
    { key: 'prior', header: 'Prioridade', render: (c) => <PrioridadeBadge prioridade={c.prior} /> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    { key: 'dias', header: 'Dias em Aberto', render: (c) => <DiasChip dias={diasAberto(c.data)} /> },
    {
      key: 'acao',
      header: 'Ação',
      render: (c) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {souAdmin && (
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
            {podeEditar && podeAgirNoChamado(c, usuario) ? 'Encerrar' : 'Ver'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Barra principal: busca + status em foco, ações secundárias à
         direita — pesquisa e "Novo Chamado" são o ponto de entrada
         principal da tela, o resto é apoio. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar número, frota, título…"
            className="pl-8"
          />
        </div>

        <Select value={status || 'todos'} onValueChange={(v) => setStatus(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="Aberto">Aberto</SelectItem>
            <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
            <SelectItem value="Aguardando Peça">Aguardando Peça</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={() => setAvancado((v) => !v)} className={cn(avancado && 'border-primary text-primary')}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros avançados
          {advancedCount > 0 && (
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {advancedCount}
            </span>
          )}
        </Button>
        <Button variant="ghost" onClick={limparTudo}>
          Limpar tudo
        </Button>

        <div className="ml-auto flex items-center gap-2">
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

          {podeCriar && (
            <Button onClick={() => navigate('/novo')}>
              <Plus className="h-3.5 w-3.5" /> Novo Chamado
            </Button>
          )}
        </div>
      </div>

      {/* Faixa única de indicadores: KPIs + Cultura + Fazenda como chips
         compactos e clicáveis (atalho de filtro) — substitui os antigos
         cards grandes de Cultura/Fazenda, que sozinhos ocupavam quase um
         terço da tela. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip label="Total em Aberto" value={carregando ? '—' : abertos.length} />
        <FilterChip
          dot="bg-destructive"
          label="Críticos"
          value={criticosCount}
          active={prior === 'Urgente'}
          onClick={() => setPrior((v) => (v === 'Urgente' ? '' : 'Urgente'))}
        />
        <FilterChip
          dot="bg-warning"
          label="SLA Vencido"
          value={vencidosCount}
          active={slaCritico}
          onClick={() => setSlaCritico((v) => !v)}
        />
        <FilterChip
          dot="bg-purple"
          label="Sem Responsável"
          value={semRespCount}
          active={semResp}
          onClick={() => setSemResp((v) => !v)}
        />

        <FilterBarSeparator />

        {CULTURAS.map((cu) => {
          const itens = porCultura.get(cu.key) || [];
          const criticos = itens.filter((c) => c.prior === 'Urgente').length;
          return (
            <FilterChip
              key={cu.key}
              icon={cu.icon}
              label={cu.label}
              value={carregando ? '—' : itens.length}
              extra={criticos > 0 ? <span className="font-bold text-destructive">+{criticos}</span> : undefined}
              active={cultCard === cu.key}
              onClick={() => setCultCard((v) => (v === cu.key ? '' : cu.key))}
            />
          );
        })}

        {porFazenda.length > 0 && <FilterBarSeparator />}

        {porFazenda.map(([bucket, itens], i) => {
          const criticos = itens.filter((c) => c.prior === 'Urgente').length;
          return (
            <FilterChip
              key={bucket}
              dot={FAZENDA_DOTS[i % FAZENDA_DOTS.length]}
              icon="📍"
              label={fazendaLabel(bucket)}
              value={itens.length}
              extra={criticos > 0 ? <span className="font-bold text-destructive">+{criticos}</span> : undefined}
              active={fazendaCard === bucket}
              onClick={() => setFazendaCard((v) => (v === bucket ? '' : bucket))}
            />
          );
        })}

        {temFiltroDeCard && (
          <Button variant="ghost" size="sm" onClick={() => { setCultCard(''); setFazendaCard(''); }}>
            <X className="h-3 w-3" /> Remover filtro
          </Button>
        )}
      </div>

      {avancado && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-subtle">Filtros avançados</span>
            <Button variant="ghost" size="icon" aria-label="Fechar filtros avançados" onClick={() => setAvancado(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <Select value={resp || 'todos'} onValueChange={(v) => setResp(v === 'todos' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                {tecnicos.map((t) => (
                  <SelectItem key={t.key} value={t.apelido || t.nome}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="antigos">Mais antigos primeiro</SelectItem>
                <SelectItem value="recentes">Mais recentes primeiro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={prior || 'todas'} onValueChange={(v) => setPrior(v === 'todas' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda prioridade</SelectItem>
                <SelectItem value="Urgente">⚡ Urgente</SelectItem>
                <SelectItem value="Alta">🔴 Alta</SelectItem>
                <SelectItem value="Média">🟡 Média</SelectItem>
                <SelectItem value="Baixa">🟢 Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Input value={fFrota} onChange={(e) => setFFrota(e.target.value)} placeholder="Código/Frota contém…" />
            <Input value={fSolicitante} onChange={(e) => setFSolicitante(e.target.value)} placeholder="Solicitante contém…" />
            <Input type="date" aria-label="Data de" value={fDe} onChange={(e) => setFDe(e.target.value)} />
            <Input type="date" aria-label="Data até" value={fAte} onChange={(e) => setFAte(e.target.value)} />
          </div>
        </div>
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
          onStatusChange={podeEditar ? handleStatusChange : undefined}
          onAssumir={souTecnicoAtivo ? handleAssumir : undefined}
          onCardClick={handleCardClick}
        />
      )}
    </div>
  );
}

/** Chip compacto e unificado — usado pros 4 indicadores (Total/Críticos/
 * SLA/Sem Responsável) e pros chips de Cultura/Fazenda: mesma forma e
 * tamanho pra tudo (antes eram 2 componentes visuais diferentes — KpiCard
 * pros cards grandes de Cultura/Fazenda e um chip à parte pros 4
 * indicadores). `dot` é só a cor do pontinho (não preenche o chip
 * inteiro), pra não competir com as cores semânticas de status/badge já
 * usadas no resto da tela. */
function FilterChip({
  icon,
  dot,
  label,
  value,
  extra,
  active,
  onClick,
}: {
  icon?: string;
  dot?: string;
  label: string;
  value: React.ReactNode;
  extra?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
        onClick && 'cursor-pointer hover:border-border2',
        active ? 'border-primary bg-primary-light text-primary-text' : 'border-border bg-surface text-muted-foreground',
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />}
      {icon && <span aria-hidden>{icon}</span>}
      <span className="whitespace-nowrap">{label}</span>
      <span className="font-mono-num font-bold text-foreground">{value}</span>
      {extra}
    </Comp>
  );
}
