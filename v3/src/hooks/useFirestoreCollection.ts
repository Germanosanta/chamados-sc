import { useEffect, useState } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { escutarColecao, type ColName } from '@/services/firebase/firestore';
import { useSessionStore } from '@/store/session';

interface State<T> {
  data: (T & { id: string })[];
  carregando: boolean;
  erro: Error | null;
}

/**
 * Escuta a coleção inteira em tempo real (mesmo padrão de
 * fsStartRealtime() da V2 — sem `where`/paginação, volumes pequenos o
 * bastante pra isso ser viável). Só assina depois que há sessão (as
 * regras do Firestore exigem `request.auth != null` pra quase tudo).
 */
export function useFirestoreCollection<T = DocumentData>(colName: ColName) {
  const usuario = useSessionStore((s) => s.usuario);
  const [state, setState] = useState<State<T>>({ data: [], carregando: true, erro: null });

  useEffect(() => {
    if (!usuario) {
      setState({ data: [], carregando: false, erro: null });
      return;
    }
    setState((s) => ({ ...s, carregando: true }));
    const unsub = escutarColecao<T>(
      colName,
      (items) => setState({ data: items, carregando: false, erro: null }),
    );
    return () => unsub();
  }, [colName, usuario]);

  return state;
}
