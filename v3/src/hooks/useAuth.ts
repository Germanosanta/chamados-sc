import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase/app';
import { getOne } from '@/services/firebase/firestore';
import { useSessionStore } from '@/store/session';
import type { Usuario } from '@/types';

/**
 * Monta 1x no topo do app (ver App.tsx) — mantém a sessão sincronizada
 * com o Firebase Auth de verdade (equivalente ao restaurador de sessão
 * da V2 em core/init.js, só que aqui reage a onAuthStateChanged em vez
 * de ler sessionStorage no boot).
 */
export function useAuthListener() {
  const setUsuario = useSessionStore((s) => s.setUsuario);
  const setCarregando = useSessionStore((s) => s.setCarregando);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUsuario(null);
        setCarregando(false);
        return;
      }
      try {
        const perfil = await getOne<Usuario>('usuarios', user.uid);
        setUsuario(perfil && perfil.status?.toLowerCase() === 'ativo' ? perfil : null);
      } catch {
        setUsuario(null);
      } finally {
        setCarregando(false);
      }
    });
    return () => unsub();
  }, [setUsuario, setCarregando]);
}
