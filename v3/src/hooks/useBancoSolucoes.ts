import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection } from './useFirestoreCollection';
import { setMerge } from '@/services/firebase/firestore';
import type { SolucaoKB, ConfiguracaoDoc } from '@/types/auditoria';

const PREFIXO = 'kb__';

/** Banco de Soluções — vive dentro da coleção genérica `configuracoes`
 * com prefixo de id "kb__" (mesma convenção normalizada da V2, ver
 * docs/js/firebase/firebase.js). Filtra client-side pelo prefixo. */
export function useBancoSolucoes() {
  const { data, carregando } = useFirestoreCollection<ConfiguracaoDoc>('configuracoes');
  const solucoes = useMemo(
    () =>
      data
        .filter((d) => d.id.startsWith(PREFIXO))
        .map((d) => ({ ...(d as unknown as SolucaoKB), id: d.id.slice(PREFIXO.length) })),
    [data],
  );
  return { data: solucoes, carregando };
}

export function useSalvarSolucaoKB() {
  return useMutation({
    mutationFn: async (solucao: SolucaoKB) => {
      await setMerge('configuracoes', PREFIXO + solucao.id, solucao);
    },
  });
}
