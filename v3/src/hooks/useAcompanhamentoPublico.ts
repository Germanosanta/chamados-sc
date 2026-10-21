import { useEffect, useState } from 'react';
import { escutarDocumento } from '@/services/firebase/firestore';
import type { DadosPublicosChamado } from '@/utils/acompanhamentoPublico';

export type EstadoAcompanhamento =
  | { status: 'carregando' }
  | { status: 'encontrado'; dados: DadosPublicosChamado }
  | { status: 'nao-encontrado' }
  | { status: 'erro' };

/**
 * Lê (em tempo real) o espelho público de acompanhamento por token — ver
 * utils/acompanhamentoPublico.ts. Sem sessão/login: a tela pública
 * (pages/acompanhar/AcompanharPage.tsx) é a ÚNICA consumidora deste
 * hook, por isso não reaproveita useFirestoreCollection (feito pra
 * coleções inteiras, sempre atrás de `estouAtivo()`) — este é 1 doc só,
 * de uma coleção que permite leitura pública por id exato (ver
 * firestore.rules). `onSnapshot` (não `getDoc` único) porque o pedido é
 * explícito: o status deve se atualizar sozinho quando o técnico mexer
 * no chamado, sem o visitante recarregar a página.
 */
export function useAcompanhamentoPublico(token: string | undefined): EstadoAcompanhamento {
  const [estado, setEstado] = useState<EstadoAcompanhamento>({ status: 'carregando' });

  useEffect(() => {
    if (!token) {
      setEstado({ status: 'nao-encontrado' });
      return;
    }
    setEstado({ status: 'carregando' });
    const unsub = escutarDocumento<DadosPublicosChamado>(
      'acompanhamento_publico',
      token,
      (item) => setEstado(item ? { status: 'encontrado', dados: item } : { status: 'nao-encontrado' }),
      () => setEstado({ status: 'erro' }),
    );
    return unsub;
  }, [token]);

  return estado;
}
