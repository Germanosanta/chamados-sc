import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Campo, Meta } from '@/components/shared/FormField';
import { useSessionStore } from '@/store/session';
import { ATIVOS_IRRIGACAO, useConfigIrrigacao, useCriarChamadoIrrigacao } from '@/hooks/useIrrigacao';
import { PRIORIDADES_IRRIGACAO, TIPO_ATIVO_LABEL, inputLocalParaIso, isoParaInputLocal } from '@/utils/irrigacao';
import type { AtivoIrrigacao, PrioridadeIrrigacao, TipoAtivoIrrigacao } from '@/types/irrigacao';

const NENHUMA = '__nenhuma__';
const MAX_FOTOS = 4;

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Abertura: o equipamento sempre vem do cadastro (só os monitorados),
 * escolhido por fazenda → módulo → tipo, ou pela busca. */
export function NovoChamadoIrrigacao({ onCriado }: { onCriado: (num: string) => void }) {
  const usuario = useSessionStore((s) => s.usuario);
  const { monitorados, tiposFalha } = useConfigIrrigacao();
  const criar = useCriarChamadoIrrigacao();

  const [fazenda, setFazenda] = useState('');
  const [modulo, setModulo] = useState('');
  const [tipo, setTipo] = useState('');
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState<AtivoIrrigacao | null>(null);
  const [casaBombas, setCasaBombas] = useState('');
  const [tipoFalha, setTipoFalha] = useState('');
  const [identificadoEm, setIdentificadoEm] = useState(() => isoParaInputLocal(new Date().toISOString()));
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeIrrigacao>('Alta');
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  const fazendas = useMemo(() => [...new Set(monitorados.map((a) => a.fazenda).filter(Boolean))].sort(), [monitorados]);
  const modulos = useMemo(() => [...new Set(monitorados.filter((a) => !fazenda || a.fazenda === fazenda).map((a) => a.modulo).filter(Boolean))].sort(), [monitorados, fazenda]);
  const tipos = useMemo(() => [...new Set(monitorados.map((a) => a.tipo))] as TipoAtivoIrrigacao[], [monitorados]);
  const candidatos = useMemo(() => {
    const termo = normalizar(busca.trim());
    return monitorados.filter(
      (a) =>
        (!fazenda || a.fazenda === fazenda) &&
        (!modulo || a.modulo === modulo) &&
        (!tipo || a.tipo === tipo) &&
        (!termo || normalizar(`${a.nome} ${a.casaBombas || ''} ${a.fazenda} ${a.modulo}`).includes(termo)),
    );
  }, [monitorados, fazenda, modulo, tipo, busca]);
  const casas = useMemo(
    () => ATIVOS_IRRIGACAO.filter((a) => a.tipo === 'casa_bombas' && (!ativo || !ativo.fazenda || a.fazenda === ativo.fazenda)),
    [ativo],
  );

  function escolher(a: AtivoIrrigacao) {
    setAtivo(a);
    setFazenda(a.fazenda);
    setModulo(a.modulo);
    setTipo(a.tipo);
    setBusca('');
    setCasaBombas(a.tipo === 'pivo' ? a.casaBombas || '' : a.tipo === 'casa_bombas' ? a.nome : '');
  }

  function limpar() {
    setAtivo(null);
    setCasaBombas('');
    setTipoFalha('');
    setDescricao('');
    setFotos([]);
    setPrioridade('Alta');
    setIdentificadoEm(isoParaInputLocal(new Date().toISOString()));
  }

  async function enviar() {
    const erros: string[] = [];
    if (!ativo) erros.push('selecione o equipamento');
    if (!tipoFalha) erros.push('selecione o tipo de falha');
    const identificadoIso = inputLocalParaIso(identificadoEm);
    if (!identificadoIso) erros.push('informe data e hora da identificação');
    else if (new Date(identificadoIso).getTime() > Date.now() + 5 * 60000) erros.push('a identificação não pode estar no futuro');
    if (!descricao.trim()) erros.push('descreva a ocorrência');
    if (erros.length || !ativo) {
      toast.error(`⚠ Antes de continuar: ${erros.join(', ')}.`);
      return;
    }
    setEnviando(true);
    try {
      const { num, fotosComFalha } = await criar({ ativo, casaBombas, tipoFalha, identificadoEm: identificadoIso, descricao, prioridade, fotos });
      toast(`✓ Chamado ${num} aberto.`);
      if (fotosComFalha) toast.error(`${fotosComFalha} foto(s) não foram salvas. Anexe de novo pelo chamado.`);
      limpar();
      onCriado(num);
    } catch (erro) {
      // eslint-disable-next-line no-console -- sem isso a causa real da falha se perde.
      console.error('[irrigacao] falha ao abrir chamado', erro);
      toast.error(`Não foi possível abrir o chamado. Detalhe: ${erro instanceof Error ? erro.message.slice(0, 160) : String(erro)}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-subtle">Equipamento</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label="Fazenda" htmlFor="irr-fazenda">
            <Select value={fazenda || NENHUMA} onValueChange={(v) => { setFazenda(v === NENHUMA ? '' : v); setModulo(''); setAtivo(null); }}>
              <SelectTrigger id="irr-fazenda"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUMA}>Todas</SelectItem>
                {fazendas.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Módulo" htmlFor="irr-modulo">
            <Select value={modulo || NENHUMA} onValueChange={(v) => { setModulo(v === NENHUMA ? '' : v); setAtivo(null); }}>
              <SelectTrigger id="irr-modulo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUMA}>Todos</SelectItem>
                {modulos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Tipo de equipamento" htmlFor="irr-tipo">
            <Select value={tipo || NENHUMA} onValueChange={(v) => { setTipo(v === NENHUMA ? '' : v); setAtivo(null); }}>
              <SelectTrigger id="irr-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUMA}>Todos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t}>{TIPO_ATIVO_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
        </div>

        {ativo ? (
          <div className="flex flex-col gap-3 rounded-sm border border-primary bg-primary-light/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-foreground">{ativo.nome}</div>
                <div className="text-xs text-muted-foreground">{TIPO_ATIVO_LABEL[ativo.tipo]}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAtivo(null)}>Trocar</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Meta label="Fazenda" value={ativo.fazenda || '—'} />
              <Meta label="Módulo" value={ativo.modulo || '—'} />
              <Meta label="Plataforma de telemetria" value={ativo.plataforma || 'Não classificada'} />
              {ativo.marca && <Meta label="Marca" value={ativo.marca} />}
              {ativo.pivosAbastecidos && <Meta label="Pivôs abastecidos" value={ativo.pivosAbastecidos} />}
              {ativo.bombas && <Meta label="Bombas" value={String(ativo.bombas.length)} />}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar equipamento (ex.: Pivô 27, R7, PRM 03)…" aria-label="Buscar equipamento" />
            <div className="max-h-64 overflow-y-auto rounded-sm border border-border" role="listbox" aria-label="Equipamentos monitorados">
              {candidatos.length === 0 && <p className="p-3 text-sm text-subtle">Nenhum equipamento monitorado com esses filtros.</p>}
              {candidatos.slice(0, 80).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => escolher(a)}
                  className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{a.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {TIPO_ATIVO_LABEL[a.tipo]} · {a.fazenda || '—'} · {a.modulo || '—'}
                    {a.casaBombas ? ` · ${a.casaBombas}` : ''} · {a.plataforma || 'sem plataforma'}
                  </span>
                </button>
              ))}
              {candidatos.length > 80 && <p className="p-2 text-center text-xs text-subtle">Mostrando 80 de {candidatos.length}. Use os filtros ou a busca.</p>}
            </div>
          </div>
        )}

        <Campo label="Casa de bombas relacionada" htmlFor="irr-casa">
          <Select value={casaBombas || NENHUMA} onValueChange={(v) => setCasaBombas(v === NENHUMA ? '' : v)}>
            <SelectTrigger id="irr-casa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUMA}>Não se aplica</SelectItem>
              {casaBombas && !casas.some((c) => c.nome === casaBombas) && <SelectItem value={casaBombas}>{casaBombas} (do cadastro do pivô)</SelectItem>}
              {casas.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}{c.fazenda ? ` · ${c.fazenda}` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </Campo>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-subtle">Ocorrência</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Tipo de falha *" htmlFor="irr-falha">
            <Select value={tipoFalha || undefined} onValueChange={setTipoFalha}>
              <SelectTrigger id="irr-falha"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {tiposFalha.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Identificada em *" htmlFor="irr-identificado">
            <Input id="irr-identificado" type="datetime-local" value={identificadoEm} onChange={(e) => setIdentificadoEm(e.target.value)} />
          </Campo>
          <Campo label="Prioridade" htmlFor="irr-prioridade">
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as PrioridadeIrrigacao)}>
              <SelectTrigger id="irr-prioridade"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORIDADES_IRRIGACAO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Operador responsável pela abertura">
            <Input value={usuario?.nome || ''} readOnly aria-readonly className="opacity-80" />
          </Campo>
        </div>
        <Campo label="Descrição da ocorrência *" htmlFor="irr-desc">
          <textarea
            id="irr-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            placeholder="O que a plataforma de telemetria mostra? Desde quando? Algo já foi tentado?"
            className="w-full rounded-sm border border-border bg-muted p-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </Campo>
        <Campo label={`Fotos ou evidências (até ${MAX_FOTOS})`} htmlFor="irr-fotos">
          <div className="flex flex-wrap items-center gap-2">
            {fotos.map((f, i) => (
              <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full bg-surface3 px-2.5 py-1 text-xs">
                {f.name}
                <button type="button" aria-label={`Remover ${f.name}`} onClick={() => setFotos((l) => l.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {fotos.length < MAX_FOTOS && (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary">
                <ImagePlus className="h-4 w-4" /> Adicionar foto
                <input
                  id="irr-fotos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    const novas = [...(e.target.files || [])];
                    setFotos((l) => [...l, ...novas].slice(0, MAX_FOTOS));
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </Campo>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={limpar} disabled={enviando}>Limpar</Button>
        <Button onClick={enviar} disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Abrir chamado
        </Button>
      </div>
    </div>
  );
}
