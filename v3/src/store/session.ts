import { create } from 'zustand';
import { permsPadrao, type Permissao } from '@/types/permissoes';
import type { Usuario } from '@/types';

/**
 * Espelha sessionStorage/chm_session_v1 da V2 — sessão nunca vai pro
 * localStorage nem pro Firestore, dura só enquanto a aba fica aberta
 * (mesmo mecanismo de segurança operacional). Aqui é populado por
 * hooks/useAuth.ts a partir do onAuthStateChanged + doc de perfil.
 */
interface SessionState {
  usuario: Usuario | null;
  carregando: boolean;
  setUsuario: (u: Usuario | null) => void;
  setCarregando: (v: boolean) => void;
  temPermissao: (perm: Permissao) => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  usuario: null,
  carregando: true,
  setUsuario: (usuario) => set({ usuario }),
  setCarregando: (carregando) => set({ carregando }),
  temPermissao: (perm) => {
    const u = get().usuario;
    if (!u) return false;
    const perms = u.perms && u.perms.length ? u.perms : permsPadrao(u.perfil);
    return perms.includes(perm);
  },
}));
