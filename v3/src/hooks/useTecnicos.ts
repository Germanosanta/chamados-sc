import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection, type FirestoreCollectionState } from './useFirestoreCollection';
import { setMerge } from '@/services/firebase/firestore';
import { useSessionStore } from '@/store/session';
import type { Tecnico } from '@/types';

export function useTecnicos(): FirestoreCollectionState<Tecnico> {
  return useFirestoreCollection<Tecnico>('tecnicos');
}

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

/**
 * Liga a conta logada (usuarios/{uid}, autenticação) ao cadastro
 * correspondente em `tecnicos` (fonte única de responsáveis) — casamento
 * por e-mail, com fallback por nome, sem exigir nenhum campo novo de
 * vínculo no Firestore (as duas coleções continuam independentes). É o
 * que permite responder "quem está logado é um dos técnicos ativos
 * cadastrados?" — usado por useAssumirChamado e por toda tela que
 * precisa decidir se mostra o botão "Assumir".
 */
export function useMeuTecnico(): Tecnico | null {
  const usuario = useSessionStore((s) => s.usuario);
  const { data: ativos } = useTecnicosAtivos();
  return useMemo(() => {
    if (!usuario) return null;
    const email = usuario.email.trim().toLowerCase();
    const nome = usuario.nome.trim().toLowerCase();
    const porEmail = email ? ativos.find((t) => t.email && t.email.trim().toLowerCase() === email) : undefined;
    return porEmail || ativos.find((t) => t.nome.trim().toLowerCase() === nome) || null;
  }, [usuario, ativos]);
}

/** true se a conta logada corresponde a um técnico ativo cadastrado —
 * único perfil autorizado a assumir chamados. */
export function useSouTecnicoAtivo(): boolean {
  return !!useMeuTecnico();
}

/** Portado de salvarTec() (config/index.js) — chave do doc é o apelido
 * (ou primeiro nome), pra bater com o valor gravado no campo `resp` dos
 * chamados; ao editar, a chave existente é preservada. */
export function useSalvarTecnico() {
  const usuario = useSessionStore((s) => s.usuario);
  return useMutation({
    mutationFn: async ({ key, tecnico }: { key: string | null; tecnico: Omit<Tecnico, 'key'> }) => {
      const chave = key || tecnico.apelido || tecnico.nome.split(' ')[0];
      const doc: Tecnico = {
        ...tecnico,
        key: chave,
        atualizadoEm: new Date().toISOString(),
        atualizadoPor: usuario?.nome || 'Sistema',
      };
      await setMerge('tecnicos', chave, doc);
      return doc;
    },
  });
}
