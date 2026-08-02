import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection } from './useFirestoreCollection';
import { setMerge } from '@/services/firebase/firestore';
import { useSessionStore } from '@/store/session';
import type { Peca, Movimentacao } from '@/types/peca';

export function usePecas() {
  return useFirestoreCollection<Peca>('pecas');
}

export function useMovimentacoes() {
  return useFirestoreCollection<Movimentacao>('movimentacoes');
}

/**
 * Nota de arquitetura: `useFirestoreCollection` já escuta a coleção em
 * tempo real (onSnapshot) — a UI atualiza sozinha assim que a escrita
 * abaixo é confirmada no Firestore, sem precisar de invalidação manual
 * de cache (TanStack Query aqui só empresta o `useMutation` pelo estado
 * de loading/erro, não guarda cache de leitura).
 */

/** Portado de salvarPeca() (equipamentos/index.js). */
export function useSalvarPeca() {
  return useMutation({
    mutationFn: async (peca: Peca) => {
      await setMerge('pecas', peca.id, peca);
    },
  });
}

/** Portado de registrarMovimentacao() (equipamentos/index.js) — mesma
 * lógica de atualizar o saldo + gravar o log de movimentação. */
export function useRegistrarMovimentacao() {
  const usuario = useSessionStore((s) => s.usuario);
  return useMutation({
    mutationFn: async ({ peca, tipo, qtd, obs, chamado }: { peca: Peca; tipo: 'entrada' | 'saida'; qtd: number; obs: string; chamado: string }) => {
      const before = Number(peca.qtd) || 0;
      const after = tipo === 'entrada' ? before + qtd : Math.max(0, before - qtd);
      await setMerge('pecas', peca.id, { ...peca, qtd: after });
      const movId = `m${Date.now()}`;
      const mov: Movimentacao = {
        id: movId,
        pecaId: peca.id,
        pecaNome: peca.nome,
        tipo,
        qtd,
        before,
        after,
        chamado,
        obs,
        ts: new Date().toISOString(),
        usuario: usuario?.nome || 'Sistema',
      };
      await setMerge('movimentacoes', movId, mov);
    },
  });
}
