import { useMemo } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import type { Tecnico } from '@/types';

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
