import type { Chamado, ChamadoHistoricoTupla, ChamadoStatus, Prioridade } from '@/types/chamado';
import matchMap from '@/data/match_map.json';
import equipIdx from '@/data/equip_idx.json';
import type { EquipIdxEntry } from '@/types/equipamento';

/**
 * Funções puras portadas 1:1 de docs/js/modules/chamados/index.js e
 * dashboard/index.js — mesmos limiares/regras, só reescritas para
 * devolver dado tipado em vez de montar string de HTML.
 */

export const DIAS_ATRASO_ALERTA = 3;
export const DIAS_ATRASO_CRITICO = 7;

const STATUS_TERMINAIS = new Set<ChamadoStatus>(['Concluída', 'Encerrado', 'Cancelado']);

export function isFechado(c: Chamado): boolean {
  return STATUS_TERMINAIS.has(c.status) || !!c.encerramento;
}

export function diasAberto(dataStr?: string): number {
  if (!dataStr) return 0;
  const d = new Date(dataStr + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.floor((hoje.getTime() - d.getTime()) / 86400000);
}

export type DiasVariant = 'red' | 'amber' | 'green';

export function diasVariant(dias: number): DiasVariant {
  if (dias > DIAS_ATRASO_CRITICO) return 'red';
  if (dias >= DIAS_ATRASO_ALERTA) return 'amber';
  return 'green';
}

const DIAS_BORDER_CLASS: Record<DiasVariant, string> = {
  red: 'border-l-destructive',
  amber: 'border-l-warning',
  green: 'border-l-success',
};

/** Faixa colorida de SLA usada como indicador rápido (borda esquerda) em
 * listas/cards de chamado — mesma paleta/limiares de `diasVariant`, só
 * como classe Tailwind pronta pra usar em `className`. */
export function diasBorderClass(dias: number): string {
  return DIAS_BORDER_CLASS[diasVariant(dias)];
}

export function isSlaCritico(c: Chamado): boolean {
  return !isFechado(c) && diasAberto(c.data) > DIAS_ATRASO_CRITICO;
}

export type StatusVariant = 'green' | 'amber' | 'purple' | 'neutral' | 'red';

export function statusVariant(status: ChamadoStatus | string): StatusVariant {
  if (status === 'Concluída' || status === 'Encerrado') return 'green';
  if (status === 'Em Andamento' || status === 'Em Atendimento') return 'amber';
  if (status === 'Aguardando Peça') return 'purple';
  if (status === 'Cancelado') return 'neutral';
  return 'red';
}

export type CulturaVariant = 'graos' | 'tabaco' | 'cacau' | 'neutral';

export function culturaVariant(cultura: string): CulturaVariant {
  if (cultura === 'Grãos e Fibras') return 'graos';
  if (cultura === 'Tabaco') return 'tabaco';
  if (cultura === 'Cacau') return 'cacau';
  return 'neutral';
}

export const PRIORIDADE_ICON: Record<Prioridade, string> = {
  Urgente: '⚡',
  Alta: '🔴',
  Média: '🟡',
  Baixa: '🟢',
};

export function prioridadeVariant(p?: Prioridade): DiasVariant | 'neutral' {
  if (p === 'Urgente' || p === 'Alta') return 'red';
  if (p === 'Média') return 'amber';
  if (p === 'Baixa') return 'green';
  return 'neutral';
}

export function fazendaLabel(bucket?: string): string {
  if (bucket === 'Solinftec KRT') return 'Karitel';
  if (bucket === 'Solinftec RDM') return 'Rio do Meio';
  return bucket || '—';
}

interface EquipRef {
  codigo: string;
  descricao: string;
  modelo: string;
  grupo: string;
  status: string;
}

const EQUIP_IDX = equipIdx as unknown as Record<string, EquipIdxEntry>;
const MATCH_MAP = matchMap as unknown as Record<string, string>;

export function getChamadoEquip(num: string, equipCodigo?: string): EquipRef | null {
  const code = equipCodigo || MATCH_MAP[num];
  if (!code) return null;
  const eq = EQUIP_IDX[code];
  if (!eq) return null;
  return { codigo: code, descricao: eq.d ?? '', modelo: eq.m ?? '', grupo: eq.g ?? '', status: eq.s ?? '' };
}

export function frotaLabel(num: string, equipCodigo?: string): string {
  const eq = getChamadoEquip(num, equipCodigo);
  if (!eq) return '';
  return `${eq.codigo} · ${eq.descricao}`;
}

export function formatDataBR(iso?: string): string {
  if (!iso) return '—';
  return iso.split('-').reverse().join('/');
}

/** Portado 1:1 de STATUS_STEPS/_statusStepIndex/_kbLaneKey/_KB_TRANSICOES
 * (chamados/index.js) — mesmas 4 raias do Kanban (Cancelado removida de
 * propósito na V2 dentro da tela "Em Aberto": getAbertos() já exclui
 * cancelados por definição, a raia nunca teria card nem transição). */
export const KANBAN_LANES = [
  { key: 'aberto', label: 'Aberto' },
  { key: 'atendimento', label: 'Em Atendimento' },
  { key: 'peca', label: 'Aguardando Peça' },
  { key: 'concluido', label: 'Encerrado' },
] as const;

export type LaneKey = (typeof KANBAN_LANES)[number]['key'];

export function laneKey(status: string): LaneKey {
  if (status === 'Concluída' || status === 'Encerrado') return 'concluido';
  if (status === 'Aguardando Peça') return 'peca';
  if (status === 'Em Andamento' || status === 'Em Atendimento') return 'atendimento';
  return 'aberto';
}

/** Transições com ação direta (mudança de status simples) — as duas que
 * terminam em "concluido" exigem o checklist de encerramento (Centro
 * Operacional, fase seguinte da V3) e por isso não entram aqui. */
export const KANBAN_TRANSICOES: Partial<Record<`${LaneKey}>${LaneKey}`, ChamadoStatus>> = {
  'aberto>atendimento': 'Em Atendimento',
  'atendimento>peca': 'Aguardando Peça',
  'peca>atendimento': 'Em Atendimento',
};

/** Converte a tupla posicional do dataset histórico estático num
 * `Chamado` parcial — mesmos 7 campos que a V2 já expõe pra esse dado
 * (o resto simplesmente não existe pra registros históricos antigos, tal
 * qual na V2). */
/** Portado 1:1 de EVT_NEEDS_INPUT/EVT_LABELS/EVT_PLACEHOLDERS/
 * EVT_STATUS_CHANGE (chamados/index.js) — ações rápidas do Centro
 * Operacional. */
export type EventoTipo = 'iniciou' | 'peca_solicitada' | 'peca_recebida' | 'obs' | 'assumiu' | 'reabriu' | 'encerrou';

export const EVT_NEEDS_INPUT: Partial<Record<EventoTipo, boolean>> = {
  iniciou: false,
  peca_solicitada: true,
  peca_recebida: true,
  obs: true,
};

export const EVT_LABELS: Record<EventoTipo, string> = {
  iniciou: 'Iniciar Atendimento',
  peca_solicitada: 'Solicitar Peça',
  peca_recebida: 'Peça Recebida',
  obs: 'Observação',
  assumiu: 'Assumiu o chamado',
  reabriu: 'Reabriu o chamado',
  encerrou: 'Encerrou o chamado',
};

export const EVT_PLACEHOLDERS: Partial<Record<EventoTipo, string>> = {
  peca_solicitada: 'Descreva a peça solicitada (ex: Fusível 5A, Cabo USB…)',
  peca_recebida: 'Confirme a peça recebida (ex: Fusível 5A recebido)',
  obs: 'Digite a observação…',
};

/** Status que cada evento aplica no registro local, quando aplicável. */
export const EVT_STATUS_CHANGE: Partial<Record<EventoTipo, ChamadoStatus>> = {
  iniciou: 'Em Atendimento',
  peca_solicitada: 'Aguardando Peça',
  peca_recebida: 'Em Atendimento',
};

/** Portado de TYPE_CFG (buildTimeline) — ícone/rótulo/cor por tipo de
 * evento na timeline do Centro Operacional. */
export const TIMELINE_TYPE_CFG: Record<string, { icon: string; label: string; color: DiasVariant | 'neutral' | 'purple' | 'blue' }> = {
  abriu: { icon: '🟢', label: 'Chamado aberto', color: 'green' },
  assumiu: { icon: '⚡', label: 'Atendimento iniciado', color: 'amber' },
  iniciou: { icon: '▶️', label: 'Atendimento iniciado', color: 'blue' },
  peca_solicitada: { icon: '📦', label: 'Peça solicitada', color: 'purple' },
  peca_recebida: { icon: '✔️', label: 'Peça recebida', color: 'green' },
  status_alterado: { icon: '🔄', label: 'Status alterado', color: 'neutral' },
  editou: { icon: '✏️', label: 'Chamado editado', color: 'neutral' },
  reabriu: { icon: '↩', label: 'Chamado reaberto', color: 'blue' },
  cancelou: { icon: '🚫', label: 'Chamado cancelado', color: 'red' },
  obs: { icon: '💬', label: 'Observação registrada', color: 'neutral' },
  encerrou: { icon: '✅', label: 'Chamado concluído', color: 'green' },
};

export interface TimelineItem {
  ts: string;
  icon: string;
  label: string;
  color: DiasVariant | 'neutral' | 'purple' | 'blue';
  actor: string;
  date: string;
  time: string;
  detail?: string;
  checklist?: import('@/types/chamado').ChecklistEncerramento;
}

function fmtDateHora(d: Date | null): { date: string; time: string } {
  if (!d || isNaN(d.getTime())) return { date: '—', time: '' };
  return {
    date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Portado de buildTimeline() (chamados/index.js) — mesmas 3 fontes
 * (abertura + eventos + encerramento), devolvendo dado estruturado em
 * vez de string de HTML (quem renderiza é components/shared/Timeline). */
export function buildTimeline(c: Chamado): TimelineItem[] {
  const items: TimelineItem[] = [];

  const tsAbertura = c.dataHoraISO || (c.data ? c.data + 'T00:00:00' : '');
  if (tsAbertura) {
    const { date, time } = fmtDateHora(new Date(tsAbertura));
    const detail = [
      c.categoria ? `Categoria: ${c.categoria}` : '',
      c.prior ? `Prioridade: ${c.prior}` : '',
      c.tecnico ? `Técnico: ${c.tecnico}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    items.push({ ts: tsAbertura, icon: '🟢', label: 'Chamado aberto', color: 'green', actor: c.solicitante || c.abertoPor || 'Sistema', date, time, detail });
  }

  (c.eventos || []).forEach((e) => {
    const cfg = TIMELINE_TYPE_CFG[e.type] || { icon: '📌', label: e.type, color: 'neutral' as const };
    const { date, time } = fmtDateHora(new Date(e.ts));
    items.push({ ts: e.ts, icon: cfg.icon, label: cfg.label, color: cfg.color, actor: e.actor, date, time, detail: e.detail });
  });

  if (c.encerramento?.encerradoPor) {
    const enc = c.encerramento;
    const d = enc.encerradoEm ? new Date(enc.encerradoEm) : null;
    const { date, time } = d ? fmtDateHora(d) : { date: enc.dataEncerramento || '', time: enc.horaEncerramento || '' };
    const detail = [
      enc.tecnicos ? `Técnico(s): ${enc.tecnicos}` : '',
      enc.solucao ? `Solução: ${enc.solucao}` : '',
      enc.materiais ? `Materiais: ${enc.materiais}` : '',
      enc.equipamentos ? `Equipamentos: ${enc.equipamentos}` : '',
      enc.observacoes ? `Obs: ${enc.observacoes}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    items.push({
      ts: enc.encerradoEm || '',
      icon: '✅',
      label: 'Chamado concluído',
      color: 'green',
      actor: enc.encerradoPor,
      date,
      time,
      detail,
      checklist: enc.checklist,
    });
  }

  return items.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
}

/** Portado de getTecnicoResponsavel() (chamados/index.js) — cascata:
 * campo tecnico → assumidoPor → último evento assumiu/iniciou. Usado
 * pra pré-selecionar o técnico no checklist de encerramento. */
export function getTecnicoResponsavel(c: Chamado): string | null {
  if (c.tecnico) return c.tecnico;
  if (c.assumidoPor) return c.assumidoPor;
  const eventos = c.eventos || [];
  for (let i = eventos.length - 1; i >= 0; i--) {
    if ((eventos[i].type === 'assumiu' || eventos[i].type === 'iniciou') && eventos[i].actor) return eventos[i].actor;
  }
  return null;
}

export function tuplaParaChamado(t: ChamadoHistoricoTupla): Chamado {
  const [num, titulo, cultura, resp, data, status, bucket] = t;
  return {
    num,
    titulo,
    cultura: cultura as Chamado['cultura'],
    resp,
    data,
    status: status as ChamadoStatus,
    bucket,
  };
}
