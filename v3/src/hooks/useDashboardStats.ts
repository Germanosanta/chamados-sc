import { useMemo } from 'react';
import { useChamados } from './useChamados';
import { getChamadoEquip } from '@/utils/chamado-helpers';
import type { Chamado } from '@/types/chamado';

/** Mesma janela fixa de meses da V2 (MONTHS, dashboard/index.js) —
 * jun/2022 até o mês corrente conhecido da base. */
export const MONTHS = [
  '2022-06', '2022-07', '2022-08', '2022-09', '2022-10', '2022-11', '2022-12',
  '2023-01', '2023-02', '2023-03', '2023-04', '2023-05', '2023-06', '2023-07', '2023-08', '2023-09', '2023-10', '2023-11', '2023-12',
  '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
];

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
 * na V2). */
export function useComputeStats(records?: Chamado[]): { stats: DashboardStats; carregando: boolean } {
  const { data: todos, carregando } = useChamados();
  const all = records || todos;

  const stats = useMemo<DashboardStats>(() => {
    const isCancelado = (r: Chamado) => r.status === 'Cancelado';
    const isConcluido = (r: Chamado) => (r.status === 'Encerrado' || r.status === 'Concluída' || !!r.encerramento) && !isCancelado(r);
    const isAguardando = (r: Chamado) => r.status === 'Aguardando Peça';
    const isAtendimento = (r: Chamado) => (r.status === 'Em Andamento' || r.status === 'Em Atendimento') && !isCancelado(r) && !isConcluido(r) && !isAguardando(r);
    const isAberto = (r: Chamado) => (r.status === 'Não iniciado' || r.status === 'Aberto') && !isConcluido(r) && !isCancelado(r);

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

    const byYear: DashboardStats['byYear'] = {};
    for (const yr of [2022, 2023, 2024, 2025, 2026]) {
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

    let somaDias = 0;
    let cntDias = 0;
    for (const r of all) {
      if (r.encerramento?.encerradoEm && r.data) {
        const d = Math.round((new Date(r.encerramento.encerradoEm).getTime() - new Date(r.data + 'T00:00').getTime()) / 86400000);
        if (d >= 0) {
          somaDias += d;
          cntDias++;
        }
      }
    }
    const tempoMedio = cntDias ? (somaDias / cntDias).toFixed(1) : '—';

    const hoje = new Date();
    const vencidos = all.filter((r) => !isConcluido(r) && r.data && Math.floor((hoje.getTime() - new Date(r.data + 'T00:00').getTime()) / 86400000) > 7).length;

    const issues: [string, number][] = ISSUE_KEYWORDS.map(([label, rx]) => [label, all.filter((r) => rx.test(r.num + (r.titulo || ''))).length]);

    const equipMap: Record<string, number> = {};
    for (const r of all) {
      const eq = getChamadoEquip(r.num, r.equipCodigo);
      if (eq) {
        const label = `${eq.codigo} · ${eq.descricao}`;
        equipMap[label] = (equipMap[label] || 0) + 1;
      }
    }

    return { all, total, concluidos, emAberto, atendimento, aguardando, cancelados, mediaMes, respMap, cultMap, bktMap, equipMap, byYear, monthsG, monthsT, monthsC, monthsO, tempoMedio, vencidos, issues };
  }, [all]);

  return { stats, carregando };
}
