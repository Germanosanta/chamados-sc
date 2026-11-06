import { useEffect, useState } from 'react';
import { escutarAuditoriaDoChamado } from '@/services/firebase/firestore';
import type { Auditoria } from '@/types/auditoria';

/** Logs de 1 chamado, mais recentes primeiro. Sem `num` nada é lido: o
 * Centro Operacional fica montado em toda tela, mesmo fechado. */
export function useAuditoriaDoChamado(num: string | null | undefined): Auditoria[] {
  const [itens, setItens] = useState<Auditoria[]>([]);

  useEffect(() => {
    setItens([]);
    if (!num) return;
    return escutarAuditoriaDoChamado<Auditoria>(num, (logs) => {
      setItens([...logs].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')));
    });
  }, [num]);

  return itens;
}
