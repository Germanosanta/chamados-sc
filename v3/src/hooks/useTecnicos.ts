import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection, type FirestoreCollectionState } from './useFirestoreCollection';
import { setMerge } from '@/services/firebase/firestore';
import { useSessionStore } from '@/store/session';
import type { Tecnico } from '@/types';

export function useTecnicos(): FirestoreCollectionState<Tecnico> {
  return useFirestoreCollection<Tecnico>('tecnicos');
}

/** Equivalente a _tecnicosAtivos() da V2 — fonte única dos seletores de
 * Responsável/Técnico em todo o sistema. */
export function useTecnicosAtivos() {
  const { data, carregando } = useFirestoreCollection<Tecnico>('tecnicos');
  const ativos = useMemo(
    () =>
      data
        .filter((t) => t.nome && t.status !== 'Inativo')
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [data],
  );
  return { data: ativos, carregando };
}

/** Portado de salvarTec() (config/index.js) — chave do doc é o apelido
 * (ou primeiro nome), pra bater com o valor gravado no campo `resp` dos
 * chamados; ao editar, a chave existente é preservada. */
export function useSalvarTecnico() {
  const usuario = useSessionStore((s) => s.usuario);
  return useMutation({
    mutationFn: async ({ key, tecnico }: { key: string | null; tecnico: Omit<Tecnico, 'key'> }) => {
      const chave = key || tecnico.apelido || tecnico.nome.split(' ')[0];
      const doc: Tecnico = {
        ...tecnico,
        key: chave,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: usuario?.nome || 'Sistema',
      };
      await setMerge('tecnicos', chave, doc);
      return doc;
    },
  });
}
