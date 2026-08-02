import { create } from 'zustand';

/** Qual chamado está aberto no Centro Operacional — um único modal
 * global (montado 1x no AppShell), igual ao #modal-detalhe singleton da
 * V2, chamável de qualquer tela (Aberto, Chamados, Encerrados,
 * Criticidade, Área do Técnico, busca global). */
interface DetalheState {
  num: string | null;
  abrir: (num: string) => void;
  fechar: () => void;
}

export const useDetalheStore = create<DetalheState>((set) => ({
  num: null,
  abrir: (num) => set({ num }),
  fechar: () => set({ num: null }),
}));
