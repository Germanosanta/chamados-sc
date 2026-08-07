import { useMemo } from 'react';
import { useChamados } from './useChamados';
import { equipamentoDoChamado, isAbertoStatus, isAguardandoPeca, isCancelado, isConcluido, isEmAtendimento, isSlaCritico, tempoMedioDias } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';

/**
 * Janela de meses do Dashboard — começa em jun/2022 (mesmo início da V2,
 * dashboard/index.js) e vai até o mês corrente.
 *
 * A V2 grava essa lista como array fixo (hardcoded, congelado no dia em
 * que o arquivo foi escrito) e por isso já nasce desatualizada: qualquer
 * mês além do último valor da lista simplesmente não existe pros
 * gráficos, e o "Evolução Mensal" mostra zero no mês corrente até
 * alguém lembrar de editar o array na V2 e publicar. Achado durante a
 * fase de estabilização (relatórios com indicador zerado) — mesmo bug,
 * herdado 1:1 na V3. Como aqui não há arquivo estático pra manter
 * sincronizado, calculamos a janela em tempo real a partir da data
 * atual: o mês corrente sempre aparece, sem depender de ninguém lembrar
 * de atualizar nada. Não muda a V2 (o array de lá continua do jeito que
 * está) nem a janela inicial (ainda jun/2022).
 */
function buildMonths(): string[] {
  const inicio = new Date(2022, 5, 1); // jun/2022
  const fim = new Date();
  const meses: string[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  while (cursor <= fim) {
    meses.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return meses;
}

export const MONTHS = buildMonths();

const ISSUE_KEYWORDS: [string, RegExp][] = [
  ['Formatar Cartão', /formatar|cart[aã]o/i],
  ['Bordo Travado', /bordo travado/i],
  ['GPS Inválido', /gps inv/i],
  ['Falta de Alimentação', /aliment/i],
  ['Sem Comunicação', /sem comunica[çc]/i],
  ['Instalar Solinftec', /instalar sol/i],
  ['Bordo Desligando', /bordo deslig|desligando/i],
  ['Dando Deslocamento', /deslocamento/i],
];

export interface DashboardStats {
  all: Chamado[];
  total: number;
  concluidos: number;
  emAberto: number;
  atendimento: number;
  aguardando: number;
  cancelados: number;
  mediaMes: number;
  respMap: Record<string, number>;
  cultMap: Record<string, number>;
  bktMap: Record<string, number>;
  equipMap: Record<string, number>;
  byYear: Record<number, { total: number; conc: number; aberto: number }>;
  monthsG: number[];
  monthsT: number[];
  monthsC: number[];
  monthsO: number[];
  tempoMedio: string;
  vencidos: number;
  issues: [string, number][];
}

/** Portado 1:1 de computeStats() (dashboard/index.js) — mesmos 6 buckets
 * de status, mesmos mapas de agregação (responsável/cultura/bucket/
 * equipamento), mesma janela mensal fixa, mesmo keyword-matching de
 * "principais problemas" (não é IA — é regex sobre número+título, igual
 * na V2).
 *
 * Os 5 predicados de status (isConcluido/isCancelado/isAguardandoPeca/
 * isEmAtendimento/isAbertoStatus) não são mais reimplementados aqui —
 * antes desta fase de estabilização, este hook tinha sua própria cópia
 * local dessas mesmas regras, ligeiramente diferente da usada pelo
 * Kanban (laneKey) e do critério simplificado que Home/Painel usavam
 * cada um do seu jeito. Agora todos importam de utils/chamado-helpers.ts
 * — uma só fonte de verdade pra "o que conta como Em Aberto/Encerrado/
 * etc" em toda a V3. */
export function useComputeStats(records?: Chamado[]): { stats: DashboardStats; carregando: boolean } {
  const { data: todos, carregando } = useChamados();
  const all = records || todos;

  const stats = useMemo<DashboardStats>(() => {
    const isAtendimento = isEmAtendimento;
    const isAguardando = isAguardandoPeca;
    const isAberto = isAbertoStatus;

    const total = all.length;
    const concluidos = all.filter(isConcluido).length;
    const emAberto = all.filter(isAberto).length;
    const atendimento = all.filter(isAtendimento).length;
    const aguardando = all.filter(isAguardando).length;
    const cancelados = all.filter(isCancelado).length;
    const mediaMes = Math.round(total / (MONTHS.length || 1));

    const respMap: Record<string, number> = {};
    for (const r of all) {
      for (const nome of (r.resp || '').split(',')) {
        const n = nome.trim();
        if (n) respMap[n] = (respMap[n] || 0) + 1;
      }
    }

    const cultMap: Record<string, number> = {};
    for (const r of all) {
      const c = r.cultura || 'Sem cultura';
      cultMap[c] = (cultMap[c] || 0) + 1;
    }

    const bktMap: Record<string, number> = {};
    for (const r of all) {
      if (r.bucket) bktMap[r.bucket] = (bktMap[r.bucket] || 0) + 1;
    }

    // Anos do "Comparativo Anual" — mesmo problema do MONTHS acima
    // (lista fixa, 2026 seria o último ano pra sempre): usa o intervalo
    // real do próprio dataset, de 2022 até o ano corrente, nunca menos.
    const byYear: DashboardStats['byYear'] = {};
    const ultimoAno = Math.max(new Date().getFullYear(), 2022);
    for (let yr = 2022; yr <= ultimoAno; yr++) {
      const ry = all.filter((r) => r.data && r.data.startsWith(String(yr)));
      byYear[yr] = { total: ry.length, conc: ry.filter(isConcluido).length, aberto: ry.filter(isAberto).length };
    }

    const mg: Record<string, number> = {};
    const mt: Record<string, number> = {};
    const mc: Record<string, number> = {};
    const mo: Record<string, number> = {};
    for (const r of all) {
      if (!r.data) continue;
      const ym = r.data.slice(0, 7);
      if (r.cultura === 'Grãos e Fibras') mg[ym] = (mg[ym] || 0) + 1;
      else if (r.cultura === 'Tabaco') mt[ym] = (mt[ym] || 0) + 1;
      else if (r.cultura === 'Cacau') mc[ym] = (mc[ym] || 0) + 1;
      else mo[ym] = (mo[ym] || 0) + 1;
    }
    const monthsG = MONTHS.map((m) => mg[m] || 0);
    const monthsT = MONTHS.map((m) => mt[m] || 0);
    const monthsC = MONTHS.map((m) => mc[m] || 0);
    const monthsO = MONTHS.map((m) => mo[m] || 0);

    // tempoMedioDias (chamado-helpers.ts) — mesma fórmula usada por
    // Encerrados/Painel/Responsáveis/Técnicos, ver auditoria final.
    const mediaDias = tempoMedioDias(all);
    const tempoMedio = mediaDias === null ? '—' : mediaDias.toFixed(1);

    // isSlaCritico (chamado-helpers.ts) — mesmo critério de "vencido"
    // usado por Home/Painel/KanbanCard, em vez do cálculo de dias em
    // duplicata que existia aqui antes (formula ligeiramente diferente:
    // usava a hora exata de "agora" em vez do início do dia, o que podia
    // divergir por horas-limite do que diasAberto() já calculava).
    const vencidos = all.filter(isSlaCritico).length;

    const issues: [string, number][] = ISSUE_KEYWORDS.map(([label, rx]) => [label, all.filter((r) => rx.test(r.num + (r.titulo || ''))).length]);

    const equipMap: Record<string, number> = {};
    for (const r of all) {
      const eq = equipamentoDoChamado(r);
      if (eq) {
        const label = [eq.codigo, eq.descricao].filter(Boolean).join(' · ');
        equipMap[label] = (equipMap[label] || 0) + 1;
      }
    }

    return { all, total, concluidos, emAberto, atendimento, aguardando, cancelados, mediaMes, respMap, cultMap, bktMap, equipMap, byYear, monthsG, monthsT, monthsC, monthsO, tempoMedio, vencidos, issues };
  }, [all]);

  return { stats, carregando };
}
