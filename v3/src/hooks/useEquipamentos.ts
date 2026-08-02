import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirestoreCollection, type FirestoreCollectionState } from './useFirestoreCollection';
import { setMerge } from '@/services/firebase/firestore';
import type { Equipamento, EquipamentoEstatico } from '@/types/equipamento';
import equipamentosEstatico from '@/data/equipamentos.json';

const EQUIPAMENTOS_ESTATICO = equipamentosEstatico as unknown as EquipamentoEstatico[];

/** Cadastro em tempo real (overrides sobre a base estática) —
 * equivalente a getCadEq() na V2. */
export function useCadastroEquipamentos(): FirestoreCollectionState<Equipamento> {
  return useFirestoreCollection<Equipamento>('equipamentos');
}

/**
 * Universo de busca de equipamento — portado 1:1 de _equipUniverso()
 * (chamados/index.js): base estática (equipamentos.json) + qualquer
 * override/registro extra do cadastro em tempo real (equipamentos/{frota}).
 */
export function useEquipUniverso(): EquipamentoEstatico[] {
  const { data: cadastro } = useCadastroEquipamentos();

  return useMemo(() => {
    const cadMap = new Map(cadastro.map((c) => [c.frota, c]));
    const vistos = new Set<string>();

    const lista = EQUIPAMENTOS_ESTATICO.map((eq) => {
      vistos.add(eq.c);
      const c = cadMap.get(eq.c);
      if (!c) return eq;
      const extra = [c.patrimonio, c.fabricante].filter(Boolean).join(' ');
      return extra ? { ...eq, e: eq.e + ' ' + extra } : eq;
    });

    for (const c of cadastro) {
      if (!c.frota || vistos.has(c.frota)) continue;
      lista.push({
        c: c.frota,
        d: c.modelo || c.fabricante || `Equipamento ${c.frota}`,
        e: [c.frota, c.modelo, c.fabricante, c.patrimonio].filter(Boolean).join(' '),
        m: c.modelo || '',
        t: c.tipo || '',
        g: c.tipo || '',
        s: c.status || 'Ativo',
      });
    }
    return lista;
  }, [cadastro]);
}

export function useSalvarEquipamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (equipamento: Equipamento) => {
      await setMerge('equipamentos', equipamento.frota, equipamento);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipamentos'] }),
  });
}
