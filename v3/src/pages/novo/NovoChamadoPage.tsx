import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Minus, Plus, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Campo, Meta } from '@/components/shared/FormField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipAutocomplete } from '@/components/shared/EquipAutocomplete';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useTecnicosAtivos } from '@/hooks/useTecnicos';
import { useChamados, useCriarChamado, useProximoNumero } from '@/hooks/useChamados';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
import { useSessionStore } from '@/store/session';
import { useNovoChamadoPrefill } from '@/store/novoChamadoPrefill';
import { cn } from '@/utils/cn';
import { fmtDateHora, formatDataBR } from '@/utils/chamado-helpers';
import type { EquipamentoEstatico } from '@/types/equipamento';
import type { Chamado, FotoAnexo, PecaUsada, Prioridade } from '@/types/chamado';
import type { Peca } from '@/types/peca';

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
 * submitChamado() (chamados/index.js): mesmos 5 campos obrigatórios
 * (categoria/equipamento/fazenda-sistema/responsável/descrição), mesma
 * baixa de estoque quando há peças selecionadas. */
export function NovoChamadoPage() {
  const navigate = useNavigate();
  const usuario = useSessionStore((s) => s.usuario);
  const { data: tecnicos } = useTecnicosAtivos();
  const { data: todos } = useChamados();
  const { data: pecasEstoque } = useFirestoreCollection<Peca>('pecas');
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

  const [respSelecionados, setRespSelecionados] = useState<string[]>([]);
  const [tecnico, setTecnico] = useState('');
  const [statusInicial, setStatusInicial] = useState('Aberto');

  const [desc, setDesc] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [fotos, setFotos] = useState<FotoAnexo[]>([]);

  const [buscaPeca, setBuscaPeca] = useState('');
  const [pecasSelecionadas, setPecasSelecionadas] = useState<PecaUsada[]>([]);

  const [enviado, setEnviado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const historicoEquip = useMemo(() => {
    if (!equip) return [];
    return todos.filter((c) => c.equipCodigo === equip.c).slice(0, 10);
  }, [todos, equip]);

  const resultadosPeca = useMemo(() => {
    const q = buscaPeca.trim().toLowerCase();
    if (q.length < 2) return [];
    return pecasEstoque.filter((p) => p.nome.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q)).slice(0, 8);
  }, [pecasEstoque, buscaPeca]);

  function toggleResp(nome: string) {
    setRespSelecionados((prev) => (prev.includes(nome) ? prev.filter((r) => r !== nome) : [...prev, nome]));
  }

  function adicionarPeca(p: Peca) {
    setBuscaPeca('');
    if (Number(p.qtd) <= 0) {
      toast.error(`${p.nome} está sem estoque.`);
      return;
    }
    setPecasSelecionadas((prev) => {
      const existe = prev.find((x) => x.id === p.id);
      if (existe) {
        if (existe.qtd >= Number(p.qtd)) {
          toast.error(`Estoque de ${p.nome}: só ${p.qtd} disponível(is).`);
          return prev;
        }
        return prev.map((x) => (x.id === p.id ? { ...x, qtd: x.qtd + 1 } : x));
      }
      return [...prev, { id: p.id, nome: p.nome, qtd: 1, unidade: p.unidade }];
    });
  }

  // Trava a quantidade no estoque disponível (`pecasEstoque` — mesma
  // coleção lida na abertura do chamado): sem isso, o usuário podia pedir
  // mais do que existe e a baixa era silenciosamente zerada no servidor
  // (Math.max(0, ...) em useCriarChamado), sem nenhum aviso na tela.
  function alterarQtdPeca(id: string, delta: number) {
    setPecasSelecionadas((prev) =>
      prev
        .map((p) => {
          if (p.id !== id) return p;
          const disponivel = Number(pecasEstoque.find((e) => e.id === id)?.qtd) || 0;
          const novaQtd = Math.max(0, p.qtd + delta);
          if (delta > 0 && novaQtd > disponivel) {
            toast.error(`Estoque de ${p.nome}: só ${disponivel} disponível(is).`);
            return p;
          }
          return { ...p, qtd: novaQtd };
        })
        .filter((p) => p.qtd > 0),
    );
  }

  async function handleSubmit() {
    // Junta todos os campos faltando numa mensagem só — antes cada
    // validação retornava (e mostrava um toast) na primeira falha, então
    // um formulário com 3 campos vazios exigia 3 cliques em "Criar
    // Chamado" pra descobrir os 3 problemas, um de cada vez.
    const erros: string[] = [];
    if (!equip) erros.push('selecione um equipamento');
    if (!categoria) erros.push('selecione a categoria');
    if (!respSelecionados.length) erros.push('selecione pelo menos um responsável');
    if (!bucket) erros.push('selecione a Fazenda/Sistema');
    if (!desc.trim()) erros.push('descreva o problema');
    if (erros.length) {
      const frase = erros.length === 1 ? erros[0] : `${erros.slice(0, -1).join(', ')} e ${erros.at(-1)}`;
      toast.error(`⚠ Antes de continuar: ${frase}.`);
      return;
    }

    setEnviando(true);
    const now = new Date();
    const { date: dataAbertura, time: horaAbertura } = fmtDateHora(now);
    const chamado: Chamado = {
      num: proximoNumero,
      titulo: equip.e || `${equip.c} ${equip.d}`,
      cultura: cultura as Chamado['cultura'],
      resp: respSelecionados.join(', '),
      data,
      status: statusInicial as Chamado['status'],
      bucket,
      desc: desc.trim(),
      prior: prioridade,
      categoria,
      tecnico,
      solicitante: solicitante || usuario?.nome || 'Sistema',
      observacoes: observacoes.trim(),
      fotos,
      pecasUsadas: pecasSelecionadas,
      equipCodigo: equip.c,
      equipModelo: equip.m,
      equipGrupo: equip.g,
      equipStatus: equip.s,
      abertoPor: usuario?.nome || 'Sistema',
      dataHoraAbertura: `${dataAbertura} às ${horaAbertura}`,
      dataHoraISO: now.toISOString(),
    };

    try {
      await criar.mutateAsync({ chamado, pecasUsadas: pecasSelecionadas });
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
    setRespSelecionados([]);
    setTecnico('');
    setStatusInicial('Aberto');
    setDesc('');
    setObservacoes('');
    setFotos([]);
    setPecasSelecionadas([]);
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

      <Bloco titulo="👷 Responsáveis">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Responsável pelo Chamado *">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Responsável pelo chamado">
              {tecnicos.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={respSelecionados.includes(t.apelido || t.nome)}
                  onClick={() => toggleResp(t.apelido || t.nome)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-sm font-semibold',
                    respSelecionados.includes(t.apelido || t.nome) ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
                  )}
                >
                  {t.nome}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-subtle">Quem responde pelo chamado — pode ser mais de um</p>
          </Campo>
          <Campo label="Técnico Responsável" htmlFor="novo-tecnico">
            <Select value={tecnico || undefined} onValueChange={setTecnico}>
              <SelectTrigger id="novo-tecnico"><SelectValue placeholder="A definir…" /></SelectTrigger>
              <SelectContent>
                {tecnicos.map((t) => (
                  <SelectItem key={t.key} value={t.apelido || t.nome}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-subtle">Quem executa o atendimento em campo</p>
          </Campo>
          <Campo label="Status inicial" htmlFor="novo-status">
            <Select value={statusInicial} onValueChange={setStatusInicial}>
              <SelectTrigger id="novo-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
                <SelectItem value="Aguardando Peça">Aguardando Peça</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        </div>
      </Bloco>

      <Bloco titulo="📝 Detalhes">
        <div className="flex flex-col gap-4">
          <Campo label="Descrição do Problema *" htmlFor="novo-desc">
            <textarea
              id="novo-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              className="rounded-sm border border-border bg-muted p-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Campo>
          <Campo label="Observações" htmlFor="novo-obs">
            <textarea
              id="novo-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="rounded-sm border border-border bg-muted p-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Campo>
        </div>
      </Bloco>

      <Bloco titulo="📷 Fotos">
        <PhotoUploader value={fotos} onChange={setFotos} />
      </Bloco>

      <Bloco titulo="🔧 Peças Utilizadas">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={buscaPeca}
            onChange={(e) => setBuscaPeca(e.target.value)}
            placeholder="Buscar peça no estoque…"
            className="h-9 w-full rounded-sm border border-border bg-muted pl-8 pr-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {resultadosPeca.length > 0 && (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-sm border border-border bg-popover shadow-lg">
              {resultadosPeca.map((p) => (
                <button
                  key={p.id}
                  onClick={() => adicionarPeca(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{p.nome}</span>
                  <span className={cn('text-xs', p.qtd <= (p.minimo || 2) ? 'text-destructive' : 'text-subtle')}>
                    {p.qtd} {p.unidade} em estoque
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {pecasSelecionadas.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">Nenhuma peça selecionada.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5">
            {pecasSelecionadas.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-sm border border-border bg-muted px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{p.nome}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => alterarQtdPeca(p.id, -1)} className="flex h-6 w-6 items-center justify-center rounded-xs border border-border bg-surface">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center font-mono-num">{p.qtd}</span>
                  <button onClick={() => alterarQtdPeca(p.id, 1)} className="flex h-6 w-6 items-center justify-center rounded-xs border border-border bg-surface">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

