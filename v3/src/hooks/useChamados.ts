import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirestoreCollection } from './useFirestoreCollection';
import { appendToArrayField, list, setMerge } from '@/services/firebase/firestore';
import { audit } from '@/services/firebase/audit';
import { useSessionStore } from '@/store/session';
import { EVT_LABELS, isFechado, tuplaParaChamado } from '@/utils/chamado-helpers';
import type { Chamado, ChamadoHistoricoTupla, ChecklistEncerramento, Encerramento, EventoTimeline, PecaUsada } from '@/types/chamado';
import type { Peca, Movimentacao } from '@/types/peca';
import chamadosHistorico from '@/data/chamados_historico.json';

interface HistoricoDoc {
  num: string;
  encerramento?: Encerramento;
  eventos?: EventoTimeline[];
}

const HISTORICO_TUPLAS = chamadosHistorico as unknown as ChamadoHistoricoTupla[];

/**
 * Combina, exatamente como allRecords()/getLocal() da V2:
 * 1. dataset histórico estático (não está no Firestore — embutido no
 *    client, ver types/chamado.ts);
 * 2. overrides em tempo real da coleção `chamados` (chamado aberto pela
 *    própria V2/V3, ou histórico com campo reatribuído/assumido);
 * 3. status "Concluída" quando existe um doc correspondente em
 *    `historico/{num}` com `encerramento` preenchido.
 */
export function useChamados() {
  const chamadosFs = useFirestoreCollection<Chamado>('chamados');
  const historicoFs = useFirestoreCollection<HistoricoDoc>('historico');

  const data = useMemo(() => {
    const historicoMap = new Map(historicoFs.data.map((h) => [h.id, h]));
    const overridesMap = new Map(chamadosFs.data.map((c) => [c.num, c]));

    const base: Chamado[] = HISTORICO_TUPLAS.map(tuplaParaChamado).map((c) => {
      const override = overridesMap.get(c.num);
      return override ? { ...c, ...override } : c;
    });

    // registros que só existem no Firestore (abertos pela própria V2/V3,
    // fora do dataset histórico) entram por completo.
    const numsBase = new Set(base.map((c) => c.num));
    const novos = chamadosFs.data.filter((c) => !numsBase.has(c.num));

    return [...base, ...novos].map((c) => {
      const h = historicoMap.get(c.num);
      if (!h?.encerramento) return c;
      return { ...c, status: 'Concluída' as const, encerramento: h.encerramento, eventos: h.eventos };
    });
  }, [chamadosFs.data, historicoFs.data]);

  return {
    data,
    carregando: chamadosFs.carregando || historicoFs.carregando,
  };
}

export function useAbertos() {
  const { data, carregando } = useChamados();
  const abertos = useMemo(() => data.filter((c) => !isFechado(c)), [data]);
  return { data: abertos, carregando };
}

export function useEncerradosLista() {
  const { data, carregando } = useChamados();
  const encerrados = useMemo(() => data.filter(isFechado), [data]);
  return { data: encerrados, carregando };
}

/** Próximo número sequencial (mesma regra da V2: allRecords().length+1,
 * formatado "CHM-0001"). Recalculado sempre que `data` muda — como é só
 * lido no momento de abrir o formulário/enviar, uma colisão exigiria 2
 * chamados sendo abertos no exato mesmo instante por usuários
 * diferentes, mesmo risco (baixo) que a V2 já assume. */
export function useProximoNumero(): string {
  const { data } = useChamados();
  return `CHM-${String(data.length + 1).padStart(4, '0')}`;
}

/** Grava só o campo alterado — mesma estratégia "cria override se o
 * chamado só existir no histórico estático" da V2 (alterarResp/
 * assumirChamado). `chamadoBase` é o registro atual (já mesclado) usado
 * como seed quando ainda não existe doc em `chamados/{num}`. */
function useChamadoPatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ chamadoBase, patch }: { chamadoBase: Chamado; patch: Partial<Chamado> }) => {
      const { encerramento: _encerramento, eventos: _eventos, ...seed } = chamadoBase;
      await setMerge('chamados', chamadoBase.num, { ...seed, ...patch });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chamados'] }),
  });
}

export function useReatribuirResponsavel() {
  const { mutateAsync } = useChamadoPatch();
  // useCallback (não só a função crua): quem consome isso é a Kanban
  // (KanbanCard/KanbanColumn memoizados) — sem uma referência estável
  // aqui, todo card re-renderiza a cada tecla digitada num filtro,
  // mesmo sem nenhuma mudança real no card em si.
  return useCallback((chamadoBase: Chamado, novoResp: string) => mutateAsync({ chamadoBase, patch: { resp: novoResp } }), [mutateAsync]);
}

/** Transição simples de status (Kanban) — as duas transições que exigem
 * checklist de encerramento não passam por aqui (ver KanbanBoard). */
export function useAlterarStatusChamado() {
  const { mutateAsync } = useChamadoPatch();
  return useCallback((chamadoBase: Chamado, novoStatus: Chamado['status']) => mutateAsync({ chamadoBase, patch: { status: novoStatus } }), [mutateAsync]);
}

export function useAssumirChamado() {
  const { mutateAsync } = useChamadoPatch();
  const usuario = useSessionStore((s) => s.usuario);
  return useCallback(
    async (chamadoBase: Chamado) => {
      if (!usuario) return Promise.reject(new Error('Sem sessão ativa.'));
      await mutateAsync({
        chamadoBase,
        patch: { assumidoPor: usuario.nome, assumidoEm: new Date().toISOString(), tecnico: usuario.nome },
      });
      await audit('assumiu', `Chamado ${chamadoBase.num} assumido`, usuario, chamadoBase.num);
    },
    [mutateAsync, usuario],
  );
}

/**
 * Abertura de chamado — mesma lógica de submitChamado() (V2): grava o
 * registro completo em `chamados/{num}` e dá baixa das peças
 * selecionadas no estoque (pecas/{id} + novo doc em movimentacoes),
 * exatamente como a V2 faz antes de gravar o chamado.
 */
export function useCriarChamado() {
  const queryClient = useQueryClient();
  const usuario = useSessionStore((s) => s.usuario);
  return useMutation({
    mutationFn: async ({ chamado, pecasUsadas }: { chamado: Chamado; pecasUsadas: PecaUsada[] }) => {
      if (pecasUsadas.length) {
        const estoqueAtual = await list<Peca>('pecas');
        const now = new Date().toISOString();
        for (const pu of pecasUsadas) {
          const peca = estoqueAtual.find((p) => p.id === pu.id);
          if (!peca) continue;
          const before = Number(peca.qtd) || 0;
          const after = Math.max(0, before - pu.qtd);
          await setMerge('pecas', pu.id, { ...peca, qtd: after });
          const movId = `m${Date.now()}_${pu.id}`;
          await setMerge<Movimentacao>('movimentacoes', movId, {
            id: movId,
            pecaId: pu.id,
            pecaNome: pu.nome,
            tipo: 'saida',
            qtd: pu.qtd,
            before,
            after,
            chamado: chamado.num,
            obs: 'Registrado na abertura do chamado',
            ts: now,
            usuario: usuario?.nome || 'Sistema',
          });
        }
      }
      await setMerge('chamados', chamado.num, chamado);
      await audit('abriu', `Chamado ${chamado.num} aberto: ${chamado.titulo}`, usuario, chamado.num);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
      queryClient.invalidateQueries({ queryKey: ['pecas'] });
    },
  });
}

/**
 * Ações rápidas do Centro Operacional (Iniciar/Solicitar Peça/Peça
 * Recebida/Observação) — mesma lógica de registrarEvento()+
 * confirmarEvento() (V2): grava o evento em `historico/{num}.eventos`
 * (arrayUnion) e, se o tipo mexe em status, atualiza `chamados/{num}`.
 */
export function useRegistrarEvento() {
  const queryClient = useQueryClient();
  const usuario = useSessionStore((s) => s.usuario);
  const { mutateAsync } = useChamadoPatch();
  return useCallback(
    async (chamadoBase: Chamado, tipo: string, detail: string, novoStatus?: Chamado['status']) => {
      const evento: EventoTimeline = { ts: new Date().toISOString(), type: tipo, actor: usuario?.nome || 'Sistema', detail };
      await appendToArrayField('historico', chamadoBase.num, 'eventos', evento, { num: chamadoBase.num });
      if (novoStatus) await mutateAsync({ chamadoBase, patch: { status: novoStatus } });
      await audit(tipo, `${EVT_LABELS[tipo as keyof typeof EVT_LABELS] || tipo}: ${detail}`, usuario, chamadoBase.num);
      queryClient.invalidateQueries({ queryKey: ['historico'] });
    },
    [queryClient, usuario, mutateAsync],
  );
}

interface ChecklistPayload {
  solucao: string;
  tecnicos: string;
  materiais: string;
  equipamentos: string;
  observacoes: string;
  checklist: ChecklistEncerramento;
}

/** Encerramento com checklist — mesma lógica de _doEncerramento() (V2):
 * grava `historico/{num}.encerramento` e atualiza `chamados/{num}.status`. */
export function useEncerrarChamado() {
  const queryClient = useQueryClient();
  const usuario = useSessionStore((s) => s.usuario);
  const { mutateAsync } = useChamadoPatch();
  return useCallback(
    async (chamadoBase: Chamado, chk: ChecklistPayload) => {
      const now = new Date();
      const encerramento: Encerramento = {
        encerradoEm: now.toISOString(),
        dataEncerramento: now.toLocaleDateString('pt-BR'),
        horaEncerramento: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        encerradoPor: usuario?.nome || 'Sistema',
        status: 'Encerrado',
        ...chk,
      };
      await setMerge('historico', chamadoBase.num, { num: chamadoBase.num, encerramento });
      await mutateAsync({ chamadoBase, patch: { status: 'Encerrado' } });
      await audit('encerrou', `Chamado ${chamadoBase.num} encerrado`, usuario, chamadoBase.num);
      queryClient.invalidateQueries({ queryKey: ['historico'] });
    },
    [queryClient, usuario, mutateAsync],
  );
}

/** Reabertura — mesma lógica de reabrirChamado() (V2): limpa o
 * encerramento e volta o status pra "Em Andamento". */
export function useReabrirChamado() {
  const queryClient = useQueryClient();
  const registrarEvento = useRegistrarEvento();
  const { mutateAsync } = useChamadoPatch();
  return useCallback(
    async (chamadoBase: Chamado) => {
      await setMerge('historico', chamadoBase.num, { num: chamadoBase.num, encerramento: null });
      await mutateAsync({ chamadoBase, patch: { status: 'Em Andamento' } });
      await registrarEvento(chamadoBase, 'reabriu', '');
      queryClient.invalidateQueries({ queryKey: ['historico'] });
    },
    [queryClient, registrarEvento, mutateAsync],
  );
}
