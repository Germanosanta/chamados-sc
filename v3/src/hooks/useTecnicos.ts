import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection, type FirestoreCollectionState } from './useFirestoreCollection';
import { setMerge } from '@/services/firebase/firestore';
import { useSessionStore } from '@/store/session';
import type { Tecnico, Usuario } from '@/types';

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
 * true se a conta logada é um técnico ativo — único perfil autorizado a
 * assumir chamados. Checagem direta em usuarios/{uid} (perfil + status),
 * a mesma fonte que já rege todo o resto do RBAC da V3.
 *
 * Versão anterior tentava casar a conta logada com um cadastro em
 * `tecnicos` (RH) por e-mail/nome — sem nenhum campo de vínculo real
 * entre as duas coleções, isso dependia dos dois cadastros terem e-mail/
 * nome idênticos em produção. Quando não bateram, o botão "Assumir"
 * sumiu pra técnicos reais (regressão). `tecnicos` continua sendo a
 * fonte da lista de reatribuição (useTecnicosAtivos, usado só pelo
 * administrador escolher um nome), mas não é mais usado pra decidir
 * "quem pode assumir".
 */
export function useSouTecnicoAtivo(): boolean {
  const usuario = useSessionStore((s) => s.usuario);
  return usuario?.perfil === 'tecnico' && usuario?.status === 'Ativo';
}

export interface VinculacaoTecnicos {
  vinculados: { tecnico: Tecnico; usuario: Usuario }[];
  jaVinculados: Tecnico[];
  naoVinculados: Tecnico[];
}

/**
 * Migração idempotente: liga cada técnico do cadastro RH (`tecnicos`) à
 * conta de login correspondente (`usuarios`, perfil "tecnico"),
 * preenchendo `usuarioUid` — o vínculo oficial entre as duas coleções
 * (ver types/tecnico.ts). Casamento automático por e-mail, com fallback
 * por nome, só como critério de BUSCA nesta migração pontual — depois de
 * vinculado, a identidade passa a ser 100% por UID (ver
 * souResponsavelDoChamado em chamado-helpers.ts); esta é a única função
 * do sistema que ainda compara nome/e-mail, e só porque é exatamente o
 * trabalho de encontrar o vínculo que ainda não existe.
 *
 * Idempotente: técnicos que já têm `usuarioUid` são pulados (nunca
 * sobrescritos); rodar de novo não muda nada que já está vinculado. Não
 * apaga nenhum campo — só acrescenta `usuarioUid` via merge. Em caso de
 * ambiguidade (mais de uma conta com o mesmo e-mail/nome), o técnico
 * entra em `naoVinculados` em vez de adivinhar.
 */
export function useVincularTecnicos() {
  return useMutation({
    mutationFn: async ({ tecnicos, usuarios }: { tecnicos: Tecnico[]; usuarios: Usuario[] }): Promise<VinculacaoTecnicos> => {
      const candidatos = usuarios.filter((u) => u.perfil === 'tecnico');
      const resultado: VinculacaoTecnicos = { vinculados: [], jaVinculados: [], naoVinculados: [] };

      for (const t of tecnicos) {
        if (t.usuarioUid) {
          resultado.jaVinculados.push(t);
          continue;
        }
        const email = (t.email || '').trim().toLowerCase();
        const nome = t.nome.trim().toLowerCase();
        const porEmail = email ? candidatos.filter((u) => u.email.trim().toLowerCase() === email) : [];
        const porNome = porEmail.length === 0 ? candidatos.filter((u) => u.nome.trim().toLowerCase() === nome) : [];
        const match = porEmail.length === 1 ? porEmail[0] : porNome.length === 1 ? porNome[0] : null;

        if (match) {
          await setMerge('tecnicos', t.key, { usuarioUid: match.id });
          resultado.vinculados.push({ tecnico: t, usuario: match });
        } else {
          resultado.naoVinculados.push(t);
        }
      }

      return resultado;
    },
  });
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
