import { useEffect, useState } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { escutarColecao, type ColName } from '@/services/firebase/firestore';
import { useSessionStore } from '@/store/session';

interface State<T> {
  data: (T & { id: string })[];
  carregando: boolean;
  erro: Error | null;
}

interface Entry {
  state: State<unknown>;
  listeners: Set<(s: State<unknown>) => void>;
  unsub: (() => void) | null;
}

// Registro compartilhado por coleção — várias telas pedem a mesma
// coleção ao mesmo tempo (ex. "chamados" é lido por Aberto, Dashboard,
// Painel e pelo Centro Operacional simultaneamente, já que este último é
// um modal global sempre montado; "auditoria" é lido tanto pela própria
// tela de Auditoria quanto pelo bloco de auditoria-por-chamado do Centro
// Operacional). Sem isso, cada componente abriria seu próprio
// onSnapshot para a mesma coleção. Aqui, todos os assinantes ativos de
// uma coleção compartilham 1 único listener; ele só é desligado quando o
// último assinante desmonta.
const registry = new Map<ColName, Entry>();

function getEntry(colName: ColName): Entry {
  let entry = registry.get(colName);
  if (!entry) {
    entry = { state: { data: [], carregando: true, erro: null }, listeners: new Set(), unsub: null };
    registry.set(colName, entry);
  }
  return entry;
}

/**
 * Escuta a coleção inteira em tempo real (mesmo padrão de
 * fsStartRealtime() da V2 — sem `where`/paginação, volumes pequenos o
 * bastante pra isso ser viável). Só assina depois que há sessão (as
 * regras do Firestore exigem `request.auth != null` pra quase tudo).
 */
export function useFirestoreCollection<T = DocumentData>(colName: ColName) {
  const usuario = useSessionStore((s) => s.usuario);
  const [state, setState] = useState<State<T>>(() => getEntry(colName).state as State<T>);

  useEffect(() => {
    const entry = getEntry(colName);

    if (!usuario) {
      entry.state = { data: [], carregando: false, erro: null };
      setState(entry.state as State<T>);
      return;
    }

    const listener = (s: State<unknown>) => setState(s as State<T>);
    entry.listeners.add(listener);
    setState(entry.state as State<T>);

    if (!entry.unsub) {
      entry.state = { ...entry.state, carregando: true };
      entry.unsub = escutarColecao<T>(colName, (items) => {
        entry.state = { data: items, carregando: false, erro: null };
        entry.listeners.forEach((l) => l(entry.state));
      });
    }

    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0 && entry.unsub) {
        entry.unsub();
        entry.unsub = null;
        registry.delete(colName);
      }
    };
  }, [colName, usuario]);

  return state;
}
