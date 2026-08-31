import { useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection } from './useFirestoreCollection';
import { useSouTecnicoAtivo } from './useTecnicos';
import { alocarProximoNumeroChamado, appendToArrayField, gravarEmLoteMisto, list, setMerge } from '@/services/firebase/firestore';
import { audit } from '@/services/firebase/audit';
import { useSessionStore } from '@/store/session';
import { EVT_LABELS, fmtDateHora, isFechado, normalizarChamado, podeAgirNoChamado, tuplaParaChamado } from '@/utils/chamado-helpers';
import type { Chamado, ChamadoHistoricoTupla, ChecklistEncerramento, Encerramento, EventoTimeline, PecaUsada } from '@/types/chamado';
import type { EquipamentoEstatico } from '@/types/equipamento';
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

    // normalizarChamado por último: cobre tanto os registros do dataset
    // histórico (já bem formados, mas sem custo revalidar) quanto —
    // principalmente — os `novos` (só existem no Firestore, então vêm
    // exatamente como o documento foi gravado, sem passar por
    // tuplaParaChamado; um doc antigo/incompleto sem `data`/`titulo`/etc.
    // não pode derrubar nenhuma tela que ordene ou renderize esses campos).
    return [...base, ...novos].map((c) => {
      const h = historicoMap.get(c.num);
      const withEncerramento = h?.encerramento ? { ...c, status: 'Concluída' as const, encerramento: h.encerramento, eventos: h.eventos } : c;
      return normalizarChamado(withEncerramento);
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

/**
 * Achado real na investigação de "auditoria mostrando eventos de outros
 * equipamentos": esta conta (`data.length + 1`, herdada 1:1 da V2) NÃO é
 * uma alocação de verdade — é só uma ESTIMATIVA pra mostrar antes do
 * envio ("Número: CHM-0042"). Dois chamados abertos por pessoas
 * diferentes num intervalo curto acabavam colidindo no mesmo número de
 * verdade (`chamados/{num}` usa o número como ID do documento — a
 * segunda gravação mesclava por cima da primeira, apagando seus dados),
 * porque o número REAL usado na gravação também vinha só daqui. A
 * alocação de verdade agora é atômica (ver alocarProximoNumeroChamado,
 * services/firebase/firestore.ts, chamada de dentro de useCriarChamado)
 * — o valor que ESTA função devolve nunca mais é usado pra gravar nada,
 * só pra exibir uma prévia (pode divergir por 1 do número final, se
 * outro chamado for aberto entre a prévia e o envio — inofensivo, é só
 * texto). */
export function useProximoNumero(): string {
  const { data } = useChamados();
  return `CHM-${String(data.length + 1).padStart(4, '0')}`;
}

/** Grava só o campo alterado — mesma estratégia "cria override se o
 * chamado só existir no histórico estático" da V2 (alterarResp/
 * assumirChamado). `chamadoBase` é o registro atual (já mesclado) usado
 * como seed quando ainda não existe doc em `chamados/{num}`. */
function useChamadoPatch() {
  // Sem invalidação manual de cache: `useFirestoreCollection` já escuta
  // `chamados` em tempo real (onSnapshot) — a UI atualiza sozinha assim
  // que o write é confirmado (mesmo padrão documentado em usePecas.ts).
  return useMutation({
    mutationFn: async ({ chamadoBase, patch }: { chamadoBase: Chamado; patch: Partial<Chamado> }) => {
      const { encerramento: _encerramento, eventos: _eventos, ...seed } = chamadoBase;
      await setMerge('chamados', chamadoBase.num, { ...seed, ...patch });
    },
  });
}

/**
 * Reatribuição administrativa — único jeito de trocar o responsável de um
 * chamado já assumido (ver AbertoPage: o seletor só aparece pra quem é
 * admin, e lista `tecnicos` ativos — cada um carregando seu próprio
 * `usuarioUid` do cadastro, ver types/tecnico.ts). `resp`/`assumidoPor`
 * são gravados juntos, sempre em sincronia, mas servem só pra exibição —
 * `assumidoPorUid` é quem passa a valer pra autorização
 * (souResponsavelDoChamado, chamado-helpers.ts). Quando o técnico
 * escolhido ainda não tem `usuarioUid` vinculado (cadastro pendente de
 * migração), grava `null` explicitamente em vez de inventar um uid —
 * mais honesto que fingir um vínculo que não existe.
 */
export function useReatribuirResponsavel() {
  const { mutateAsync } = useChamadoPatch();
  const usuario = useSessionStore((s) => s.usuario);
  // useCallback (não só a função crua): quem consome isso é a Kanban
  // (KanbanCard/KanbanColumn memoizados) — sem uma referência estável
  // aqui, todo card re-renderiza a cada tecla digitada num filtro,
  // mesmo sem nenhuma mudança real no card em si.
  return useCallback(
    (chamadoBase: Chamado, novoResp: string, novoUid?: string | null) => {
      if (usuario?.perfil !== 'admin') return Promise.reject(new Error('Somente administradores podem reatribuir o responsável.'));
      return mutateAsync({
        chamadoBase,
        patch: { resp: novoResp, assumidoPor: novoResp, assumidoEm: new Date().toISOString(), assumidoPorUid: novoUid ?? null },
      });
    },
    [mutateAsync, usuario],
  );
}

/**
 * Vincular frota a um chamado que nasceu sem equipamento (ou com um
 * código que não corresponde a nenhum equipamento cadastrado) — mesmo
 * campo já usado na abertura (`equipCodigo`/`equipModelo`/`equipGrupo`/
 * `equipStatus`, ver NovoChamadoPage), só gravado depois via patch em vez
 * de na criação. Não mexe em nenhum outro campo do chamado, e não faz
 * sentido pra um chamado que já tem frota — quem chama isso (UI) é quem
 * decide exibir a ação só nesse caso (ver `equipamentoDoChamado` em
 * chamado-helpers.ts) e checa a permissão de editar (`p_editar`,
 * usePermission) antes de oferecer o botão.
 */
export function useVincularFrota() {
  const { mutateAsync } = useChamadoPatch();
  return useCallback(
    (chamadoBase: Chamado, equip: EquipamentoEstatico) =>
      mutateAsync({
        chamadoBase,
        patch: { equipCodigo: equip.c, equipModelo: equip.m, equipGrupo: equip.g, equipStatus: equip.s },
      }),
    [mutateAsync],
  );
}

/** Transição simples de status (Kanban) — as duas transições que exigem
 * checklist de encerramento não passam por aqui (ver KanbanBoard). */
export function useAlterarStatusChamado() {
  const { mutateAsync } = useChamadoPatch();
  return useCallback((chamadoBase: Chamado, novoStatus: Chamado['status']) => mutateAsync({ chamadoBase, patch: { status: novoStatus } }), [mutateAsync]);
}

/**
 * Assumir chamado — único jeito de um chamado ganhar responsável (além da
 * reatribuição administrativa). Só quem está logado como técnico ativo
 * pode fazer isso (useSouTecnicoAtivo — checa perfil/status direto em
 * usuarios/{uid}, ver hooks/useTecnicos.ts); `resp` e `assumidoPor` são
 * gravados juntos com o mesmo nome (fonte única — ver temResponsavel/
 * souResponsavelDoChamado em chamado-helpers.ts), e o uid da própria
 * conta fica registrado em `assumidoPorUid`.
 */
export function useAssumirChamado() {
  const { mutateAsync } = useChamadoPatch();
  const usuario = useSessionStore((s) => s.usuario);
  const souTecnicoAtivo = useSouTecnicoAtivo();
  return useCallback(
    async (chamadoBase: Chamado) => {
      if (!usuario) return Promise.reject(new Error('Sem sessão ativa.'));
      if (!souTecnicoAtivo) return Promise.reject(new Error('Somente técnicos ativos podem assumir chamados.'));
      await mutateAsync({
        chamadoBase,
        patch: { resp: usuario.nome, assumidoPor: usuario.nome, assumidoEm: new Date().toISOString(), assumidoPorUid: usuario.id },
      });
      await audit('assumiu', `Chamado ${chamadoBase.num} assumido`, usuario, chamadoBase.num);
    },
    [mutateAsync, usuario, souTecnicoAtivo],
  );
}

/**
 * Abertura de chamado — mesma lógica de submitChamado() (V2): grava o
 * registro completo em `chamados/{num}` e dá baixa das peças
 * selecionadas no estoque (pecas/{id} + novo doc em movimentacoes).
 * Tudo num único `writeBatch` (gravarEmLoteMisto): antes, cada peça era
 * gravada com um `setMerge` isolado e só no final vinha o chamado — uma
 * falha no meio do loop (rede, permissão) deixava estoque decrementado
 * sem nenhum chamado correspondente. Em lote, ou tudo é gravado, ou nada.
 *
 * `chamado.num` NÃO vem mais de quem chama (ver useProximoNumero acima):
 * é alocado aqui dentro, no momento real do envio, via
 * `alocarProximoNumeroChamado` (transação atômica) — a única forma de
 * garantir que duas aberturas concorrentes nunca recebam o mesmo número
 * e se sobrescrevam em `chamados/{num}`.
 */
export function useCriarChamado() {
  const usuario = useSessionStore((s) => s.usuario);
  return useMutation({
    mutationFn: async ({
      chamado: chamadoSemNum,
      pecasUsadas,
      numEstimado,
    }: {
      chamado: Omit<Chamado, 'num'>;
      pecasUsadas: PecaUsada[];
      numEstimado: number;
    }) => {
      const num = await alocarProximoNumeroChamado(numEstimado);
      const chamado: Chamado = { ...chamadoSemNum, num };
      const itens: Parameters<typeof gravarEmLoteMisto>[0] = [{ col: 'chamados', id: chamado.num, data: chamado }];

      if (pecasUsadas.length) {
        // list() em vez de reaproveitar o cache do useFirestoreCollection já
        // assinado por quem chama isso (NovoChamadoPage): decrementar estoque
        // é uma escrita, então precisa do saldo mais recente possível no
        // momento do envio, não do que estava em cache quando a tela abriu
        // (evita baixa duplicada se o snapshot local ainda não tiver
        // refletido uma venda concorrente).
        const estoqueAtual = await list<Peca>('pecas');
        const now = new Date().toISOString();
        for (const pu of pecasUsadas) {
          const peca = estoqueAtual.find((p) => p.id === pu.id);
          if (!peca) continue;
          const before = Number(peca.qtd) || 0;
          const after = Math.max(0, before - pu.qtd);
          itens.push({ col: 'pecas', id: pu.id, data: { ...peca, qtd: after } });
          const movId = `m${Date.now()}_${pu.id}`;
          const movimentacao: Movimentacao = {
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
          };
          itens.push({ col: 'movimentacoes', id: movId, data: movimentacao });
        }
      }

      await gravarEmLoteMisto(itens);
      await audit('abriu', `Chamado ${chamado.num} aberto: ${chamado.titulo}`, usuario, chamado.num);
      return chamado;
    },
  });
}

/**
 * Ações rápidas do Centro Operacional (Iniciar/Solicitar Peça/Peça
 * Recebida/Observação) — mesma lógica de registrarEvento()+
 * confirmarEvento() (V2): grava o evento em `historico/{num}.eventos`
 * (arrayUnion) e, se o tipo mexe em status, atualiza `chamados/{num}`.
 *
 * Sem guarda de "técnico responsável ou admin" aqui dentro (diferente de
 * useEncerrarChamado): este hook também é reaproveitado por
 * useReabrirChamado, que tem sua própria regra de permissão (p_reabrir,
 * não exige ser o responsável) — a guarda de responsável fica só na UI
 * que chama isso pras ações rápidas (CentroOperacionalModal).
 */
export function useRegistrarEvento() {
  const usuario = useSessionStore((s) => s.usuario);
  const { mutateAsync } = useChamadoPatch();
  return useCallback(
    async (chamadoBase: Chamado, tipo: string, detail: string, novoStatus?: Chamado['status']) => {
      const evento: EventoTimeline = { ts: new Date().toISOString(), type: tipo, actor: usuario?.nome || 'Sistema', detail };
      await appendToArrayField('historico', chamadoBase.num, 'eventos', evento, { num: chamadoBase.num });
      if (novoStatus) await mutateAsync({ chamadoBase, patch: { status: novoStatus } });
      await audit(tipo, `${EVT_LABELS[tipo as keyof typeof EVT_LABELS] || tipo}: ${detail}`, usuario, chamadoBase.num);
    },
    [usuario, mutateAsync],
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
  const usuario = useSessionStore((s) => s.usuario);
  const { mutateAsync } = useChamadoPatch();
  return useCallback(
    async (chamadoBase: Chamado, chk: ChecklistPayload) => {
      if (!podeAgirNoChamado(chamadoBase, usuario)) {
        return Promise.reject(new Error('Somente o técnico responsável ou um administrador pode encerrar este chamado.'));
      }
      const now = new Date();
      const { date: dataEncerramento, time: horaEncerramento } = fmtDateHora(now);
      const encerramento: Encerramento = {
        encerradoEm: now.toISOString(),
        dataEncerramento,
        horaEncerramento,
        encerradoPor: usuario?.nome || 'Sistema',
        status: 'Encerrado',
        ...chk,
      };
      await setMerge('historico', chamadoBase.num, { num: chamadoBase.num, encerramento });
      await mutateAsync({ chamadoBase, patch: { status: 'Encerrado' } });
      await audit('encerrou', `Chamado ${chamadoBase.num} encerrado`, usuario, chamadoBase.num);
    },
    [usuario, mutateAsync],
  );
}

/** Reabertura — mesma lógica de reabrirChamado() (V2): limpa o
 * encerramento e volta o status pra "Em Andamento". */
export function useReabrirChamado() {
  const registrarEvento = useRegistrarEvento();
  const { mutateAsync } = useChamadoPatch();
  return useCallback(
    async (chamadoBase: Chamado) => {
      await setMerge('historico', chamadoBase.num, { num: chamadoBase.num, encerramento: null });
      await mutateAsync({ chamadoBase, patch: { status: 'Em Andamento' } });
      await registrarEvento(chamadoBase, 'reabriu', '');
    },
    [registrarEvento, mutateAsync],
  );
}
