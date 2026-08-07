import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Campo, Meta } from '@/components/shared/FormField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipAutocomplete } from '@/components/shared/EquipAutocomplete';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useChamados, useCriarChamado, useProximoNumero } from '@/hooks/useChamados';
import { useSessionStore } from '@/store/session';
import { useNovoChamadoPrefill } from '@/store/novoChamadoPrefill';
import { cn } from '@/utils/cn';
import { fmtDateHora, formatDataBR } from '@/utils/chamado-helpers';
import type { EquipamentoEstatico } from '@/types/equipamento';
import type { Chamado, Prioridade } from '@/types/chamado';

const CATEGORIAS = [
  'Manutenção Corretiva',
  'Manutenção Preventiva',
  'Instalação',
  'Configuração',
  'Conectividade',
  'GPS / Rastreamento',
  'Software',
  'Hardware',
  'Elétrica',
  'Outro',
];

const PRIORIDADES: { key: Prioridade; label: string; cls: string }[] = [
  { key: 'Baixa', label: '🟢 Baixa', cls: 'border-success text-success' },
  { key: 'Média', label: '🟡 Média', cls: 'border-warning text-warning' },
  { key: 'Alta', label: '🔴 Alta', cls: 'border-destructive text-destructive' },
  { key: 'Urgente', label: '⚡ Urgente', cls: 'border-purple text-purple' },
];

const BUCKETS = [
  { key: 'Solinftec KRT', icon: '🛰️', label: 'Solinftec KRT', sub: 'Karitel' },
  { key: 'Solinftec RDM', icon: '🛰️', label: 'Solinftec RDM', sub: 'Rio do Meio' },
  { key: 'Rádio', icon: '📻', label: 'Rádio', sub: 'Comunicação' },
  { key: 'John Deere', icon: '🚜', label: 'John Deere', sub: 'Suporte JD' },
];

/** Novo Chamado — formulário completo em 7 blocos, portado 1:1 de
 * submitChamado() (chamados/index.js): mesmos 4 campos obrigatórios
 * (categoria/equipamento/fazenda-sistema/descrição), mesma baixa de
 * estoque quando há peças selecionadas. Nasce sempre sem responsável —
 * só um técnico ativo cadastrado (via "Assumir") ou um administrador
 * (via reatribuição) atribuem alguém depois da abertura. */
export function NovoChamadoPage() {
  const navigate = useNavigate();
  const usuario = useSessionStore((s) => s.usuario);
  const { data: todos } = useChamados();
  const proximoNumero = useProximoNumero();
  const criar = useCriarChamado();

  const [solicitante, setSolicitante] = useState(usuario?.nome || '');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('Média');

  const [equip, setEquip] = useState<EquipamentoEstatico | null>(null);
  const consumirPrefill = useNovoChamadoPrefill((s) => s.consumir);
  useEffect(() => {
    const pre = consumirPrefill();
    if (pre) setEquip(pre);
  }, [consumirPrefill]);

  const [cultura, setCultura] = useState('');
  const [bucket, setBucket] = useState('');

  const [statusInicial, setStatusInicial] = useState('Aberto');

  const [desc, setDesc] = useState('');

  const [enviado, setEnviado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const historicoEquip = useMemo(() => {
    if (!equip) return [];
    return todos.filter((c) => c.equipCodigo === equip.c).slice(0, 10);
  }, [todos, equip]);

  async function handleSubmit() {
    // Junta todos os campos faltando numa mensagem só — antes cada
    // validação retornava (e mostrava um toast) na primeira falha, então
    // um formulário com 3 campos vazios exigia 3 cliques em "Criar
    // Chamado" pra descobrir os 3 problemas, um de cada vez.
    const erros: string[] = [];
    if (!equip) erros.push('selecione um equipamento');
    if (!categoria) erros.push('selecione a categoria');
    if (!bucket) erros.push('selecione a Fazenda/Sistema');
    if (!desc.trim()) erros.push('descreva o problema');
    if (erros.length) {
      const frase = erros.length === 1 ? erros[0] : `${erros.slice(0, -1).join(', ')} e ${erros.at(-1)}`;
      toast.error(`⚠ Antes de continuar: ${frase}.`);
      return;
    }
    if (!equip) return; // já coberto por `erros` acima — só pro TS estreitar o tipo

    setEnviando(true);
    const now = new Date();
    const { date: dataAbertura, time: horaAbertura } = fmtDateHora(now);
    const chamado: Chamado = {
      num: proximoNumero,
      titulo: equip.e || `${equip.c} ${equip.d}`,
      cultura: cultura as Chamado['cultura'],
      // Chamado sempre nasce sem responsável — só passa a ter um quando
      // um técnico ativo cadastrado clica em "Assumir" (ou um
      // administrador reatribui), nunca na abertura (ver useChamados.ts).
      resp: '',
      data,
      status: statusInicial as Chamado['status'],
      bucket,
      desc: desc.trim(),
      prior: prioridade,
      categoria,
      solicitante: solicitante || usuario?.nome || 'Sistema',
      // Observações/fotos/peças utilizadas passam a ser preenchidas pelo
      // técnico responsável durante o atendimento/encerramento (Centro
      // Operacional), não na abertura — quem abre o chamado normalmente
      // não sabe ainda quais peças serão usadas.
      observacoes: '',
      fotos: [],
      pecasUsadas: [],
      equipCodigo: equip.c,
      equipModelo: equip.m,
      equipGrupo: equip.g,
      equipStatus: equip.s,
      abertoPor: usuario?.nome || 'Sistema',
      dataHoraAbertura: `${dataAbertura} às ${horaAbertura}`,
      dataHoraISO: now.toISOString(),
    };

    try {
      await criar.mutateAsync({ chamado, pecasUsadas: [] });
      setEnviado(proximoNumero);
    } catch {
      toast.error('Não foi possível abrir o chamado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  function novoFormulario() {
    setEnviado(null);
    setEquip(null);
    setCultura('');
    setBucket('');
    setStatusInicial('Aberto');
    setDesc('');
    setCategoria('');
    setPrioridade('Média');
    setData(new Date().toISOString().slice(0, 10));
  }

  if (enviado) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <div className="text-lg font-bold text-foreground">Chamado {enviado} criado com sucesso!</div>
            <p className="text-sm text-muted-foreground">
              {equip?.d} · {cultura || 'Sem cultura'} · {bucket}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={novoFormulario}>
                Novo Chamado
              </Button>
              <Button onClick={() => navigate('/aberto')}>Ver Chamados em Aberto</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const equipColumns: DataTableColumn<Chamado>[] = [
    { key: 'num', header: 'Número', render: (c) => <span className="font-mono-num font-semibold text-primary">{c.num}</span> },
    { key: 'titulo', header: 'Descrição', render: (c) => <div className="max-w-[200px] truncate">{c.titulo}</div> },
    { key: 'data', header: 'Abertura', render: (c) => formatDataBR(c.data) },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-foreground">Novo Chamado</h1>
        <p className="text-sm text-muted-foreground">Número: {proximoNumero}</p>
      </div>

      <Bloco titulo="📋 Identificação">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Solicitante" htmlFor="novo-solicitante">
            <input
              id="novo-solicitante"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              className="h-9 rounded-sm border border-border bg-muted px-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Campo>
          <Campo label="Data de Abertura" htmlFor="novo-data">
            <input
              id="novo-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 rounded-sm border border-border bg-muted px-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Campo>
          <Campo label="Categoria *" htmlFor="novo-categoria">
            <Select value={categoria || undefined} onValueChange={setCategoria}>
              <SelectTrigger id="novo-categoria"><SelectValue placeholder="Selecione a categoria…" /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Prioridade">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label="Prioridade">
              {PRIORIDADES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={prioridade === p.key}
                  onClick={() => setPrioridade(p.key)}
                  className={cn('rounded-sm border px-2 py-1.5 text-xs font-semibold', prioridade === p.key ? p.cls : 'border-border text-muted-foreground')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Campo>
        </div>
      </Bloco>

      <Bloco titulo="🚜 Equipamento">
        <Campo label="Equipamento *" htmlFor="novo-equip">
          <EquipAutocomplete id="novo-equip" onSelect={setEquip} />
        </Campo>
        {equip && (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-sm border border-border bg-muted p-3 text-sm sm:grid-cols-4">
            <Meta label="Código/Frota" value={equip.c} />
            <Meta label="Modelo" value={equip.m || '—'} />
            <Meta label="Grupo" value={equip.g || '—'} />
            <Meta label="Status" value={equip.s || '—'} />
          </div>
        )}
        {historicoEquip.length > 0 && (
          <div className="mt-3">
            <Label>Histórico do equipamento</Label>
            <div className="mt-1.5">
              <DataTable columns={equipColumns} rows={historicoEquip} rowKey={(c) => c.num} emptyTitle="" />
            </div>
          </div>
        )}
      </Bloco>

      <Bloco titulo="🚦 Status">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Status inicial" htmlFor="novo-status">
            <Select value={statusInicial} onValueChange={setStatusInicial}>
              <SelectTrigger id="novo-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
                <SelectItem value="Aguardando Peça">Aguardando Peça</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-subtle">
              O chamado nasce sem responsável — um técnico ativo cadastrado assume no Kanban de Chamados em Aberto.
            </p>
          </Campo>
        </div>
      </Bloco>

      <Bloco titulo="📝 Detalhes">
        <Campo label="Descrição do Problema *" htmlFor="novo-desc">
          <textarea
            id="novo-desc"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            className="rounded-sm border border-border bg-muted p-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </Campo>
      </Bloco>

      <Bloco titulo="📍 Alocação">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Cultura" htmlFor="novo-cultura">
            <Select value={cultura || undefined} onValueChange={setCultura}>
              <SelectTrigger id="novo-cultura"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Grãos e Fibras">Grãos e Fibras</SelectItem>
                <SelectItem value="Tabaco">Tabaco</SelectItem>
                <SelectItem value="Cacau">Cacau</SelectItem>
                <SelectItem value="Geral">Geral</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Fazenda / Sistema *">
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Fazenda / Sistema">
              {BUCKETS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={bucket === b.key}
                  onClick={() => setBucket(b.key)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-sm border px-2 py-2 text-center text-xs',
                    bucket === b.key ? 'border-primary bg-primary-light text-primary-text' : 'border-border text-muted-foreground',
                  )}
                >
                  <span className="text-base">{b.icon}</span>
                  <span className="font-semibold">{b.label}</span>
                  <span className="text-subtle">{b.sub}</span>
                </button>
              ))}
            </div>
          </Campo>
        </div>
      </Bloco>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={novoFormulario}>
          Limpar formulário
        </Button>
        <Button onClick={handleSubmit} disabled={enviando}>
          Criar Chamado
        </Button>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 border-b border-border pb-2 text-xs font-bold uppercase tracking-wide text-subtle">{titulo}</div>
      {children}
    </div>
  );
}

