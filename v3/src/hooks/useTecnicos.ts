import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection, type FirestoreCollectionState } from './useFirestoreCollection';
import { setMerge } from '@/services/firebase/firestore';
import { useSessionStore } from '@/store/session';
import { normalizarNome } from '@/utils/chamado-helpers';
import type { Tecnico, Usuario } from '@/types';

/**
 * Causa raiz da "duplicação" de técnicos (fase de estabilização): a V2
 * (salvarTec(), config/index.js) grava o cadastro usando o apelido/
 * primeiro-nome como ID do documento no Firestore, mas NUNCA grava esse
 * valor como campo `key` dentro do próprio documento — só existe como ID
 * do doc, nunca como dado. `Tecnico.key` é declarado obrigatório no tipo,
 * então todo componente que faz `key={t.key}` (linhas de tabela, chips do
 * checklist de encerramento, itens de <Select> de reatribuição) recebia
 * `undefined` pra TODOS os técnicos cadastrados pela V2 — que é 100% do
 * cadastro até hoje. Um monte de elementos irmãos com a mesma key
 * `undefined` é exatamente o cenário em que o React reconcilia errado
 * entre re-renders (o listener em tempo real de `tecnicos` dispara um
 * re-render a cada leitura), o que aparece pra quem usa o sistema como
 * "cada técnico está duplicado". Também quebrava silenciosamente
 * `useVincularTecnicos` (setMerge('tecnicos', undefined, …) é um path
 * inválido no Firestore) e fazia `abrirEditar` recalcular um ID novo em
 * vez de reaproveitar o documento existente ao salvar.
 *
 * Correção na origem: todo consumidor de `tecnicos` passa por aqui, e o
 * `key` é sempre garantido a partir do ID real do documento (`id`, que o
 * Firestore sempre entrega e nunca diverge) quando o campo dentro do
 * documento estiver ausente. Não apaga nem sobrescreve nada — só
 * preenche em memória o que a V2 nunca gravou. A partir do primeiro save
 * feito pela V3 (useSalvarTecnico já grava `key` no documento), o
 * técnico fica auto-corrigido também nos dados.
 */
function comKeyGarantida(data: (Tecnico & { id: string })[]): (Tecnico & { id: string })[] {
  return data.map((t) => (t.key ? t : { ...t, key: t.id }));
}

export interface TecnicoDuplicata {
  /** UID vinculado (mais confiável) ou nome normalizado — o critério que
   * agrupou estes documentos como "provavelmente a mesma pessoa". */
  identidade: string;
  /** Todos os documentos do grupo, do mais recentemente atualizado pro
   * mais antigo — o primeiro é o que a V3 mostra como representante em
   * toda a UI; os demais ficam ocultos das telas normais mas continuam
   * intactos no Firestore. */
  tecnicos: (Tecnico & { id: string })[];
}

/**
 * Documentos genuinamente duplicados no Firestore (pessoa real cadastrada
 * mais de uma vez, com IDs de documento diferentes) são um problema de
 * dado, não de código — nenhuma normalização em memória apaga um
 * documento de verdade. Ainda assim, "cada técnico aparece apenas uma vez
 * em toda a V3" é garantido aqui: agrupamos por identidade (UID vinculado
 * quando existe — o sinal mais forte — senão nome normalizado) e cada
 * consumidor de `useTecnicos()`/`useTecnicosAtivos()` só recebe 1
 * representante por grupo. Os grupos com mais de 1 documento são expostos
 * à parte por `useTecnicosDuplicados()`, pra um admin decidir o que fazer
 * — nada é apagado automaticamente (exigência explícita desta fase).
 */
function agruparPorIdentidade(data: (Tecnico & { id: string })[]): {
  unicos: (Tecnico & { id: string })[];
  duplicatas: TecnicoDuplicata[];
} {
  const grupos = new Map<string, (Tecnico & { id: string })[]>();
  for (const t of data) {
    const identidade = t.usuarioUid ? `uid:${t.usuarioUid}` : `nome:${normalizarNome(t.nome)}`;
    const lista = grupos.get(identidade);
    if (lista) lista.push(t);
    else grupos.set(identidade, [t]);
  }
  const unicos: (Tecnico & { id: string })[] = [];
  const duplicatas: TecnicoDuplicata[] = [];
  for (const [identidade, lista] of grupos) {
    const ordenados = [...lista].sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
    unicos.push(ordenados[0]);
    if (ordenados.length > 1) duplicatas.push({ identidade, tecnicos: ordenados });
  }
  return { unicos, duplicatas };
}

export function useTecnicos(): FirestoreCollectionState<Tecnico> {
  const { data, carregando, erro } = useFirestoreCollection<Tecnico>('tecnicos');
  const { unicos } = useMemo(() => agruparPorIdentidade(comKeyGarantida(data)), [data]);
  return { data: unicos, carregando, erro };
}

/**
 * Lista crua (sem o agrupamento de `useTecnicos()`) — só com `key`
 * garantida. Existe exclusivamente para a tela de Cadastro de Técnicos
 * (TecnicosPage): em qualquer outro lugar da V3, mostrar 1 representante
 * por identidade é o comportamento certo (seletor de reatribuição, chips
 * de encerramento, contadores), mas na tela onde um admin efetivamente
 * corrige o cadastro, esconder um documento por trás de outro faz
 * exatamente o documento que a pessoa precisa editar ficar inacessível —
 * regressão real encontrada nesta fase de homologação. A tela de cadastro
 * continua mostrando o aviso de duplicatas (useTecnicosDuplicados) pra
 * deixar claro por que um nome pode repetir ali.
 */
export function useTecnicosCadastro(): FirestoreCollectionState<Tecnico> {
  const { data, carregando, erro } = useFirestoreCollection<Tecnico>('tecnicos');
  const corrigido = useMemo(() => comKeyGarantida(data), [data]);
  return { data: corrigido, carregando, erro };
}

/** Grupos de documentos que parecem ser o mesmo técnico cadastrado mais
 * de uma vez no Firestore — só leitura/diagnóstico, nunca apaga nada. Use
 * pra mostrar um aviso administrativo (ver TecnicosPage) apontando o que
 * precisa de uma decisão humana antes de mesclar/excluir manualmente. */
export function useTecnicosDuplicados(): TecnicoDuplicata[] {
  const { data } = useFirestoreCollection<Tecnico>('tecnicos');
  return useMemo(() => agruparPorIdentidade(comKeyGarantida(data)).duplicatas, [data]);
}

/** Equivalente a _tecnicosAtivos() da V2 — fonte única dos seletores de
 * Responsável/Técnico em todo o sistema. */
export function useTecnicosAtivos() {
  const { data, carregando } = useTecnicos();
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
        // Defesa extra: nunca gravar num doc sem id (ver comKeyGarantida
        // acima — não deveria mais acontecer, mas um `setMerge` com id
        // vazio é exatamente o tipo de escrita que cria um documento
        // "fantasma" no Firestore em vez de falhar alto).
        if (!t.key) {
          resultado.naoVinculados.push(t);
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
