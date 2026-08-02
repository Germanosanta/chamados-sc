import { create } from 'zustand';
import type { EquipamentoEstatico } from '@/types/equipamento';

/** Pré-preenchimento de "Novo Chamado" a partir de outra tela (Ficha do
 * Equipamento → "Abrir Chamado", equivalente a equipSelect() da V2).
 * Consumido 1x pela NovoChamadoPage e limpo em seguida. */
interface PrefillState {
  equip: EquipamentoEstatico | null;
  setEquip: (e: EquipamentoEstatico) => void;
  consumir: () => EquipamentoEstatico | null;
}

export const useNovoChamadoPrefill = create<PrefillState>((set, get) => ({
  equip: null,
  setEquip: (equip) => set({ equip }),
  consumir: () => {
    const e = get().equip;
    if (e) set({ equip: null });
    return e;
  },
}));
