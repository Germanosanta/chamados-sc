import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { motivoErro } from '@/utils/erros';
import { ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Meta } from '@/components/shared/FormField';
import { PhotoGallery } from '@/components/shared/PhotoGallery';
import { PrioridadeBadge } from '@/components/shared/StatusBadge';
import { useSessionStore } from '@/store/session';
import { useSouTecnicoAtivo, useTecnicosAtivos } from '@/hooks/useTecnicos';
import { useAcoesIrrigacao, useChamadosIrrigacao, useFotosIrrigacao } from '@/hooks/useIrrigacao';
import {
  STATUS_IRRIGACAO,
  TIPO_ATIVO_LABEL,
  TRANSICOES_IRRIGACAO,
  formatarDataHora,
  formatarDuracao,
  inputLocalParaIso,
  isReincidente,
  isoParaInputLocal,
  minutosEntre,
  restabelecimentoDe,
  souResponsavelIrrigacao,
} from '@/utils/irrigacao';
import type { ChamadoIrrigacao, StatusIrrigacao } from '@/types/irrigacao';
import { EncerramentoIrrigacaoDialog } from './EncerramentoIrrigacaoDialog';
import { RelatorioIrrigacaoDialog } from './RelatorioIrrigacaoDialog';

const classeTexto =
  'w-full rounded-sm border border-border bg-muted p-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const EVENTO_LABEL: Record<string, string> = {
  abertura: 'Abertura',
  atribuicao: 'Técnico',
  status: 'Situação',
  diagnostico: 'Diagnóstico',
  providencia: 'Providência',
  material: 'Material',
  foto: 'Fotos',
  observacao: 'Observação',
  restabelecimento: 'Restabelecimento',
  encerramento: 'Encerramento',
  reabertura: 'Reabertura',
};

type TipoRegistro = 'diagnostico' | 'providencia' | 'observacao';

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-subtle">{titulo}</h3>
      {children}
    </section>
  );
}

/** Detalhe e gestão do chamado. Permissões iguais às dos chamados de campo:
 * p_editar gerencia; técnico ativo assume; só o admin reatribui; encerrar
 * exige p_encerrar e ser o responsável (ou admin); reabrir exige p_reabrir. */
export function ChamadoIrrigacaoDialog({ num, onClose }: { num: string | null; onClose: () => void }) {
  const { data: todos } = useChamadosIrrigacao();
  const chamado = useMemo(() => todos.find((c) => c.num === num) || null, [todos, num]);

  return (
    <Dialog open={!!num} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {chamado ? (
          <Detalhe chamado={chamado} todos={todos} />
        ) : (
          <>
            <DialogTitle>{num}</DialogTitle>
            <DialogDescription>Carregando chamado…</DialogDescription>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detalhe({ chamado: c, todos }: { chamado: ChamadoIrrigacao; todos: ChamadoIrrigacao[] }) {
  const usuario = useSessionStore((s) => s.usuario);
  const temPermissao = useSessionStore((s) => s.temPermissao);
  const souTecnicoAtivo = useSouTecnicoAtivo();
  const { data: tecnicos } = useTecnicosAtivos();
  const acoes = useAcoesIrrigacao();
  const fotos = useFotosIrrigacao(c.num);

  const souAdmin = usuario?.perfil === 'admin';
  const encerrado = c.status === 'encerrado';
  const podeGerir = !encerrado && (souAdmin || temPermissao('p_editar'));
  const souResponsavel = souResponsavelIrrigacao(c, usuario);
  const podeEncerrar = !encerrado && temPermissao('p_encerrar') && souResponsavel;
  const podeReabrir = encerrado && (souAdmin || temPermissao('p_reabrir'));

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [tecnicoEscolhido, setTecnicoEscolhido] = useState('');
  const [statusRest, setStatusRest] = useState(false);
  const [restabelecidoEm, setRestabelecidoEm] = useState(() => isoParaInputLocal(new Date().toISOString()));
  const [tipoRegistro, setTipoRegistro] = useState<TipoRegistro>('diagnostico');
  const [registro, setRegistro] = useState('');
  const [material, setMaterial] = useState({ descricao: '', quantidade: '1', unidade: 'un' });
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [encerrando, setEncerrando] = useState(false);
  const [relatorio, setRelatorio] = useState(false);

  async function executar(chave: string, acao: () => Promise<unknown>, sucesso: string) {
    setOcupado(chave);
    try {
      await acao();
      toast(sucesso);
      return true;
    } catch (erro) {
      // eslint-disable-next-line no-console -- sem isso a causa real se perde.
      console.error(`[irrigacao] falha em ${chave}`, erro);
      toast.error(`Não foi possível concluir. Detalhe: ${motivoErro(erro)}`);
      return false;
    } finally {
      setOcupado(null);
    }
  }

  const meuTecnico = tecnicos.find((t) => t.usuarioUid === usuario?.id);
  const fim = restabelecimentoDe(c);
  const indisponibilidade = minutosEntre(c.identificadoEm, fim || new Date().toISOString());
  const eventos = [...(c.eventos || [])].sort((a, b) => b.ts.localeCompare(a.ts));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 pr-6">
        <DialogTitle className="font-mono-num text-lg">{c.num}</DialogTitle>
        <Badge variant={STATUS_IRRIGACAO[c.status]?.variant || 'neutral'}>{STATUS_IRRIGACAO[c.status]?.label || c.status}</Badge>
        <PrioridadeBadge prioridade={c.prioridade} />
        {isReincidente(c, todos) && (
          <Badge variant="red">
            <RotateCcw className="mr-1 inline h-3 w-3" /> Reincidente
          </Badge>
        )}
      </div>
      <DialogDescription className="-mt-2">
        {c.ativoNome} · {TIPO_ATIVO_LABEL[c.ativoTipo]} · {c.tipoFalha}
      </DialogDescription>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Meta label="Fazenda" value={c.fazenda || '—'} />
        <Meta label="Módulo" value={c.modulo || '—'} />
        <Meta label="Casa de bombas" value={c.casaBombas || '—'} />
        <Meta label="Plataforma de telemetria" value={c.plataforma || 'Não classificada'} />
        {c.local && <Meta label="Local de instalação" value={c.local} />}
        <Meta label="Técnico" value={c.tecnico || 'Sem técnico'} />
        <Meta label="Identificada em" value={formatarDataHora(c.identificadoEm)} />
        <Meta label="Aberto por" value={`${c.abertoPor} · ${formatarDataHora(c.abertoEm)}`} />
        <Meta label="Restabelecida em" value={formatarDataHora(fim)} />
        <Meta label="Indisponibilidade" value={`${formatarDuracao(indisponibilidade)}${fim ? '' : ' (em curso)'}`} />
      </div>
      <p className="whitespace-pre-wrap rounded-sm bg-muted p-3 text-sm">{c.descricao}</p>
      {c.diagnostico && !encerrado && (
        <p className="text-sm">
          <strong>Diagnóstico atual:</strong> {c.diagnostico}
        </p>
      )}

      {encerrado && c.encerramento && (
        <Bloco titulo="Encerramento técnico">
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Meta label="Técnico responsável" value={c.encerramento.tecnico} />
            <Meta label="Encerrado em" value={`${formatarDataHora(c.encerramento.encerradoEm)} · ${c.encerramento.encerradoPor}`} />
            <Meta label="Diagnóstico" value={c.encerramento.diagnostico} />
            <Meta label="Serviço realizado" value={c.encerramento.servico} />
            <Meta label="Solução aplicada" value={c.encerramento.solucao} />
            <Meta label="Tempo de indisponibilidade" value={formatarDuracao(c.encerramento.indisponibilidadeMin)} />
            <Meta label="Observações finais" value={c.encerramento.observacoes} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRelatorio(true)}>📲 Relatório para WhatsApp</Button>
          </div>
          {podeReabrir && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={motivoReabertura} onChange={(e) => setMotivoReabertura(e.target.value)} placeholder="Motivo da reabertura (obrigatório)" aria-label="Motivo da reabertura" />
              <Button
                variant="ghost"
                disabled={!motivoReabertura.trim() || ocupado === 'reabrir'}
                onClick={async () => {
                  if (await executar('reabrir', () => acoes.reabrir(c, motivoReabertura.trim()), `Chamado ${c.num} reaberto.`)) setMotivoReabertura('');
                }}
              >
                Reabrir chamado
              </Button>
            </div>
          )}
        </Bloco>
      )}

      {podeGerir && (
        <Bloco titulo="Atendimento">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {souAdmin ? (
              <>
                <Select value={tecnicoEscolhido || undefined} onValueChange={setTecnicoEscolhido}>
                  <SelectTrigger className="sm:w-64" aria-label="Técnico responsável">
                    <SelectValue placeholder={c.tecnico ? 'Alterar responsável…' : 'Atribuir técnico…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tecnicos.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  disabled={!tecnicoEscolhido || ocupado === 'atribuir'}
                  onClick={async () => {
                    const t = tecnicos.find((x) => x.key === tecnicoEscolhido);
                    if (!t) return;
                    if (await executar('atribuir', () => acoes.atribuirTecnico(c, { key: t.key, nome: t.nome, uid: t.usuarioUid || null }), `Técnico: ${t.nome}.`)) setTecnicoEscolhido('');
                  }}
                >
                  {c.tecnico ? 'Alterar responsável' : 'Atribuir'}
                </Button>
              </>
            ) : (
              souTecnicoAtivo &&
              !c.tecnico &&
              usuario && (
                <Button
                  disabled={ocupado === 'assumir'}
                  onClick={() =>
                    executar(
                      'assumir',
                      () => acoes.assumir(c, { key: meuTecnico?.key || usuario.id, nome: meuTecnico?.nome || usuario.nome }),
                      `Você assumiu o chamado ${c.num}.`,
                    )
                  }
                >
                  ⚡ Assumir chamado
                </Button>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {TRANSICOES_IRRIGACAO[c.status]
              .filter((s) => s !== 'restabelecida')
              .map((s: StatusIrrigacao) => (
                <Button key={s} variant="ghost" size="sm" disabled={!!ocupado} onClick={() => executar(`status-${s}`, () => acoes.alterarStatus(c, s), `Situação: ${STATUS_IRRIGACAO[s].label}.`)}>
                  → {STATUS_IRRIGACAO[s].label}
                </Button>
              ))}
            {TRANSICOES_IRRIGACAO[c.status].includes('restabelecida') && !statusRest && (
              <Button variant="ghost" size="sm" onClick={() => setStatusRest(true)}>
                → Comunicação restabelecida
              </Button>
            )}
            {podeEncerrar && (
              <Button size="sm" onClick={() => setEncerrando(true)}>
                Encerrar chamado
              </Button>
            )}
          </div>
          {!podeEncerrar && temPermissao('p_encerrar') && !souResponsavel && (
            <p className="text-xs text-subtle">Somente o técnico responsável ou um administrador pode encerrar este chamado.</p>
          )}
          {statusRest && (
            <div className="flex flex-col gap-2 rounded-sm bg-muted p-2.5 sm:flex-row sm:items-center">
              <label className="text-sm" htmlFor="irr-rest">Restabelecida em</label>
              <Input id="irr-rest" type="datetime-local" value={restabelecidoEm} onChange={(e) => setRestabelecidoEm(e.target.value)} className="sm:w-56" />
              <Button
                size="sm"
                disabled={ocupado === 'restabelecer'}
                onClick={async () => {
                  const iso = inputLocalParaIso(restabelecidoEm);
                  if (!iso || minutosEntre(c.identificadoEm, iso) === null) {
                    toast.error('O restabelecimento precisa ser depois da identificação da falha.');
                    return;
                  }
                  if (await executar('restabelecer', () => acoes.alterarStatus(c, 'restabelecida', iso), 'Comunicação restabelecida registrada.')) setStatusRest(false);
                }}
              >
                Confirmar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatusRest(false)}>Cancelar</Button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Select value={tipoRegistro} onValueChange={(v) => setTipoRegistro(v as TipoRegistro)}>
              <SelectTrigger className="sm:w-56" aria-label="Tipo de registro">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                <SelectItem value="providencia">Providência</SelectItem>
                <SelectItem value="observacao">Observação</SelectItem>
              </SelectContent>
            </Select>
            <textarea rows={2} value={registro} onChange={(e) => setRegistro(e.target.value)} className={classeTexto} placeholder="Descreva…" aria-label="Texto do registro" />
            <div>
              <Button
                size="sm"
                disabled={!registro.trim() || ocupado === 'registro'}
                onClick={async () => {
                  const texto = registro.trim();
                  const acao =
                    tipoRegistro === 'diagnostico' ? () => acoes.registrarDiagnostico(c, texto) : tipoRegistro === 'providencia' ? () => acoes.registrarProvidencia(c, texto) : () => acoes.registrarObservacao(c, texto);
                  if (await executar('registro', acao, 'Registro salvo no histórico.')) setRegistro('');
                }}
              >
                Registrar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px_90px_auto]">
            <Input value={material.descricao} onChange={(e) => setMaterial((m) => ({ ...m, descricao: e.target.value }))} placeholder="Peça ou material utilizado" aria-label="Peça ou material" />
            <Input type="number" min="0" step="any" value={material.quantidade} onChange={(e) => setMaterial((m) => ({ ...m, quantidade: e.target.value }))} aria-label="Quantidade" />
            <Input value={material.unidade} onChange={(e) => setMaterial((m) => ({ ...m, unidade: e.target.value }))} aria-label="Unidade" />
            <Button
              size="sm"
              variant="ghost"
              disabled={!material.descricao.trim() || !(Number(material.quantidade) > 0) || ocupado === 'material'}
              onClick={async () => {
                if (await executar('material', () => acoes.registrarMaterial(c, material.descricao.trim(), Number(material.quantidade), material.unidade.trim() || 'un'), 'Material registrado.'))
                  setMaterial({ descricao: '', quantidade: '1', unidade: 'un' });
              }}
            >
              Adicionar material
            </Button>
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-sm border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary">
            {ocupado === 'fotos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Adicionar fotos
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={!!ocupado}
              onChange={(e) => {
                const arquivos = [...(e.target.files || [])].slice(0, 4);
                e.target.value = '';
                if (arquivos.length) void executar('fotos', () => acoes.adicionarFotos(c, arquivos), `${arquivos.length} foto(s) anexada(s).`);
              }}
            />
          </label>
        </Bloco>
      )}

      <Bloco titulo={`Peças e materiais (${c.materiais?.length || 0})`}>
        {c.materiais?.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {c.materiais.map((m, i) => (
              <li key={`${m.ts}-${i}`}>
                {m.quantidade} {m.unidade} · {m.descricao} <span className="text-xs text-subtle">({m.autor}, {formatarDataHora(m.ts)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-subtle">Nenhum material registrado.</p>
        )}
      </Bloco>

      <Bloco titulo={`Fotos e evidências (${fotos.length})`}>
        <PhotoGallery fotos={fotos.map((f) => ({ name: f.nome, type: f.tipo, data: f.data }))} />
      </Bloco>

      <Bloco titulo="Histórico de alterações">
        <ol className="flex flex-col gap-2">
          {eventos.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="flex flex-col border-l-2 border-border pl-3 text-sm">
              <span className="text-xs text-subtle">
                {formatarDataHora(e.ts)} · {e.autor} · <strong>{EVENTO_LABEL[e.tipo] || e.tipo}</strong>
              </span>
              <span className="whitespace-pre-wrap">{e.detalhe}</span>
            </li>
          ))}
        </ol>
      </Bloco>

      <EncerramentoIrrigacaoDialog chamado={c} open={encerrando} onOpenChange={setEncerrando} onEncerrado={() => setRelatorio(true)} />
      <RelatorioIrrigacaoDialog chamado={c} open={relatorio} onOpenChange={setRelatorio} />
    </div>
  );
}
