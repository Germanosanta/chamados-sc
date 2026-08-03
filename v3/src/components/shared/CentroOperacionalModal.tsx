import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PrioridadeBadge, DiasChip } from './StatusBadge';
import { Meta } from './FormField';
import { StatusStepper } from './StatusStepper';
import { Timeline } from './Timeline';
import { PhotoGallery } from './PhotoGallery';
import { ChecklistDialog } from './ChecklistDialog';
import { useDetalheStore } from '@/store/detalhe';
import { useSessionStore } from '@/store/session';
import { usePermission } from '@/hooks/usePermission';
import { useChamados, useAssumirChamado, useRegistrarEvento, useReabrirChamado } from '@/hooks/useChamados';
import { diasAberto, diasBorderClass, EVT_NEEDS_INPUT, EVT_PLACEHOLDERS, EVT_STATUS_CHANGE, fazendaLabel, formatDataBR, getChamadoEquip } from '@/utils/chamado-helpers';
import { cn } from '@/utils/cn';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
import type { Auditoria } from '@/types/auditoria';

/**
 * Centro Operacional do Chamado — modal global único (montado 1x no
 * AppShell), equivalente ao #modal-detalhe da V2: cabeçalho + ações
 * rápidas + timeline + equipamento vinculado + galeria + observações +
 * auditoria. Aberto/fechado via useDetalheStore, de qualquer tela.
 */
export function CentroOperacionalModal() {
  const num = useDetalheStore((s) => s.num);
  const fechar = useDetalheStore((s) => s.fechar);
  const { data: chamados, carregando } = useChamados();
  const usuario = useSessionStore((s) => s.usuario);
  const podeEditar = usePermission('p_editar');
  const podeEncerrar = usePermission('p_encerrar');
  const podeReabrir = usePermission('p_reabrir');

  const assumir = useAssumirChamado();
  const registrarEvento = useRegistrarEvento();
  const reabrir = useReabrirChamado();

  const [checklistOpen, setChecklistOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState('');

  const chamado = useMemo(() => chamados.find((c) => c.num === num) || null, [chamados, num]);

  const { data: auditoriaAll } = useFirestoreCollection<Auditoria>('auditoria');
  const auditoriaChamado = useMemo(
    () => (num ? auditoriaAll.filter((a) => a.chamado === num).sort((a, b) => (b.ts || '').localeCompare(a.ts || '')) : []),
    [auditoriaAll, num],
  );

  if (!num) return null;

  const fechado = chamado ? chamado.status === 'Encerrado' || chamado.status === 'Concluída' : false;
  const equip = chamado ? getChamadoEquip(chamado.num, chamado.equipCodigo) : null;
  const dias = chamado ? diasAberto(chamado.data) : 0;

  async function handleAssumir() {
    if (!chamado) return;
    try {
      await assumir(chamado);
      toast(`⚡ ${usuario?.nome} assumiu o chamado ${chamado.num}`);
    } catch {
      toast.error('Não foi possível assumir o chamado.');
    }
  }

  function iniciarAcao(tipo: string) {
    if (EVT_NEEDS_INPUT[tipo as keyof typeof EVT_NEEDS_INPUT]) {
      setPendingAction(tipo);
      setActionInput('');
    } else {
      confirmarAcao(tipo, '');
    }
  }

  async function confirmarAcao(tipo: string, detail: string) {
    if (!chamado) return;
    if (EVT_NEEDS_INPUT[tipo as keyof typeof EVT_NEEDS_INPUT] && !detail.trim()) {
      toast('Descreva o evento antes de confirmar.');
      return;
    }
    try {
      await registrarEvento(chamado, tipo, detail.trim(), EVT_STATUS_CHANGE[tipo as keyof typeof EVT_STATUS_CHANGE]);
      toast(`✓ Evento registrado`);
    } catch {
      toast.error('Não foi possível registrar o evento.');
    } finally {
      setPendingAction(null);
      setActionInput('');
    }
  }

  async function handleReabrir() {
    if (!chamado) return;
    // Reabertura muda o status de "Encerrado" de volta pra "Em Andamento"
    // e apaga o registro de encerramento — mesma classe de ação
    // (irreversível sem refazer o encerramento do zero) que Encerrar já
    // protege com o checklist; Reabrir precisa de pelo menos uma
    // confirmação explícita antes de disparar.
    if (!window.confirm(`Reabrir o chamado ${chamado.num}? O encerramento registrado será desfeito.`)) return;
    try {
      await reabrir(chamado);
      toast(`Chamado ${chamado.num} reaberto.`);
    } catch {
      toast.error('Não foi possível reabrir o chamado.');
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="max-w-4xl gap-0 p-0">
          {carregando || !chamado ? (
            <div className="flex flex-col gap-3 p-6">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="grid max-h-[85vh] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-5 overflow-y-auto p-5">
                {/* Bloco 1 — Cabeçalho */}
                <div className={cn('flex flex-col gap-2 border-b border-l-[3px] border-border pb-4 pl-3', !fechado && diasBorderClass(dias))}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-num text-xl font-bold text-primary">{chamado.num}</span>
                    {equip && <Badge variant="neutral">🚜 {equip.codigo}</Badge>}
                    <PrioridadeBadge prioridade={chamado.prior} />
                    {!fechado && <DiasChip dias={dias} />}
                  </div>
                  <DialogTitle className="text-lg font-bold text-foreground">{chamado.titulo}</DialogTitle>
                  <DialogDescription className="sr-only">
                    Centro Operacional do chamado {chamado.num} — status {chamado.status}
                  </DialogDescription>
                  <StatusStepper
                    status={chamado.status}
                    selos={
                      chamado.assumidoPor ? (
                        <span className="text-xs text-subtle">⚡ Assumido por {chamado.assumidoPor}</span>
                      ) : undefined
                    }
                  />
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                    <Meta label="Fazenda/Sistema" value={fazendaLabel(chamado.bucket)} />
                    <Meta label="Cultura" value={chamado.cultura || '—'} />
                    <Meta label="Solicitante" value={chamado.solicitante || '—'} />
                    <Meta label="Categoria" value={chamado.categoria || '—'} />
                    <Meta label="Abertura" value={formatDataBR(chamado.data)} />
                  </div>
                  {chamado.desc && <p className="rounded-sm bg-muted p-2.5 text-sm text-muted-foreground">{chamado.desc}</p>}
                </div>

                {/* Bloco 2 — Ações rápidas */}
                {podeEditar && (
                  <div className="flex flex-col gap-2 border-b border-border pb-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-subtle">Ações rápidas</div>
                    {!fechado ? (
                      <div className="flex flex-wrap gap-2">
                        {!chamado.assumidoPor && (
                          <Button size="sm" variant="ghost" onClick={handleAssumir}>
                            Assumir
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => iniciarAcao('iniciou')}>
                          Iniciar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => iniciarAcao('peca_solicitada')}>
                          Solicitar Peça
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => iniciarAcao('peca_recebida')}>
                          Peça Recebida
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => iniciarAcao('obs')}>
                          Observação
                        </Button>
                        {podeEncerrar && (
                          <Button size="sm" onClick={() => setChecklistOpen(true)}>
                            Encerrar
                          </Button>
                        )}
                      </div>
                    ) : (
                      podeReabrir && (
                        <Button size="sm" variant="ghost" onClick={handleReabrir}>
                          Reabrir chamado
                        </Button>
                      )
                    )}
                    {pendingAction && (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={actionInput}
                          onChange={(e) => setActionInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmarAcao(pendingAction, actionInput)}
                          placeholder={EVT_PLACEHOLDERS[pendingAction as keyof typeof EVT_PLACEHOLDERS] || 'Descreva…'}
                          className="h-8 flex-1 rounded-sm border border-border bg-muted px-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <Button size="sm" onClick={() => confirmarAcao(pendingAction, actionInput)}>
                          OK
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPendingAction(null)}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Bloco 3 — Timeline */}
                <div className="border-b border-border pb-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Linha do tempo</div>
                  <Timeline chamado={chamado} />
                </div>

                {/* Bloco 6 — Observações (texto inicial) */}
                {chamado.observacoes && (
                  <div className="border-b border-border pb-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Observações da abertura</div>
                    <p className="rounded-sm bg-muted p-2.5 text-sm text-muted-foreground">{chamado.observacoes}</p>
                  </div>
                )}

                {/* Bloco 7 — Auditoria */}
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Auditoria</div>
                  {auditoriaChamado.length === 0 ? (
                    <p className="text-sm text-subtle">Nenhum log de auditoria para este chamado.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {auditoriaChamado.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">
                            <b className="text-foreground">{a.usuario}</b> — {a.detalhe}
                          </span>
                          <span className="whitespace-nowrap font-mono-num text-xs text-subtle">
                            {new Date(a.ts).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna lateral — responsáveis + equipamento + galeria */}
              <div className={cn('flex flex-col gap-5 overflow-y-auto border-t border-border bg-muted p-5 lg:border-l lg:border-t-0')}>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Responsáveis</div>
                  <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-surface p-3 text-sm">
                    <Meta label="Responsável" value={chamado.resp || '—'} />
                    <Meta label="Técnico" value={chamado.tecnico || '—'} />
                    {chamado.assumidoPor && <Meta label="Assumido por" value={chamado.assumidoPor} />}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Equipamento vinculado</div>
                  {equip ? (
                    <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-surface p-3 text-sm">
                      <Meta label="Código/Frota" value={equip.codigo} />
                      <Meta label="Descrição" value={equip.descricao} />
                      <Meta label="Modelo" value={equip.modelo || '—'} />
                      <Meta label="Status" value={equip.status || '—'} />
                    </div>
                  ) : (
                    <p className="text-sm text-subtle">Sem equipamento vinculado.</p>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Anexos</div>
                  <PhotoGallery fotos={chamado.fotos || []} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {chamado && <ChecklistDialog chamado={chamado} open={checklistOpen} onOpenChange={setChecklistOpen} />}
    </>
  );
}
