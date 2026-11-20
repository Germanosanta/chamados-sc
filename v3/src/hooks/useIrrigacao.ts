import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { useSessionStore } from '@/store/session';
import {
  adicionarDocumento,
  atualizarComListas,
  atualizarSeLivre,
  criarChamadoIrrigacaoComNumero,
  escutarPorCampo,
  setMerge,
} from '@/services/firebase/firestore';
import { audit } from '@/services/firebase/audit';
import { comprimirImagem } from '@/utils/imagem';
import {
  STATUS_IRRIGACAO,
  TIPOS_FALHA_PADRAO,
  aplicarPlataformas,
  ativosMonitorados,
  formatarNumeroIrrigacao,
  minutosEntre,
  motivoNaoPodeAssumirIrrigacao,
  type FormEncerramentoIrrigacao,
} from '@/utils/irrigacao';
import ativosJson from '@/data/irrigacao_ativos.json';
import type {
  AtivoIrrigacao,
  ChamadoIrrigacao,
  ConfigIrrigacao,
  EventoIrrigacao,
  FotoIrrigacao,
  PrioridadeIrrigacao,
  StatusIrrigacao,
  TipoEventoIrrigacao,
} from '@/types/irrigacao';
import type { Usuario } from '@/types';

/** Cadastro base dos ativos (gerado da planilha original, ver scripts/gerar-ativos-irrigacao.js). */
export const ATIVOS_IRRIGACAO = (ativosJson as unknown as { ativos: AtivoIrrigacao[] }).ativos;

export function useChamadosIrrigacao() {
  const { data, carregando, erro } = useFirestoreCollection<ChamadoIrrigacao>('irrigacao_chamados');
  const ordenados = useMemo(() => [...data].sort((a, b) => (b.identificadoEm || '').localeCompare(a.identificadoEm || '')), [data]);
  return { data: ordenados, carregando, erro };
}

export function useConfigIrrigacao() {
  const { data, carregando } = useFirestoreCollection<ConfigIrrigacao & { id: string }>('irrigacao_config');
  return useMemo(() => {
    const geral = data.find((d) => d.id === 'geral');
    const tiposFalha = geral?.tiposFalha?.length ? geral.tiposFalha : TIPOS_FALHA_PADRAO;
    const naoMonitorados = geral?.naoMonitorados || [];
    const plataformas = geral?.plataformas || {};
    // Cadastro efetivo: plataforma do cadastro com as definições da tela de configurações por cima.
    const ativos = aplicarPlataformas(ATIVOS_IRRIGACAO, plataformas);
    const tecnicoPadrao = geral?.tecnicoPadrao || null;
    return { tiposFalha, naoMonitorados, plataformas, tecnicoPadrao, ativos, monitorados: ativosMonitorados(ativos, naoMonitorados), carregando };
  }, [data, carregando]);
}

function evento(tipo: TipoEventoIrrigacao, detalhe: string, usuario: Usuario | null): EventoIrrigacao {
  return { ts: new Date().toISOString(), tipo, autor: usuario?.nome || 'Sistema', detalhe };
}

/** Auditoria nunca pode derrubar a ação principal, que já foi gravada. */
async function registrarAuditoria(tipo: string, detalhe: string, usuario: Usuario | null, num: string) {
  try {
    await audit(tipo, detalhe, usuario, num);
  } catch (erro) {
    // eslint-disable-next-line no-console -- diagnóstico intencional.
    console.error('[irrigacao] falha ao registrar auditoria', num, erro);
  }
}

export interface NovoChamadoIrrigacao {
  ativo: AtivoIrrigacao;
  casaBombas: string;
  tipoFalha: string;
  identificadoEm: string;
  descricao: string;
  prioridade: PrioridadeIrrigacao;
  fotos: File[];
  /** Técnico responsável desde a abertura (obrigatório na tela). */
  tecnico: { key: string; nome: string; uid: string | null };
}

export function useCriarChamadoIrrigacao() {
  const usuario = useSessionStore((s) => s.usuario);
  return useCallback(
    async (n: NovoChamadoIrrigacao): Promise<{ num: string; fotosComFalha: number }> => {
      if (!usuario) throw new Error('sessão expirada, entre novamente');
      // Fotos comprimidas antes da gravação: um arquivo inválido barra a abertura em vez de sumir depois.
      const fotos = await Promise.all(n.fotos.map(async (f) => ({ nome: f.name, data: await comprimirImagem(f) })));
      const agora = new Date().toISOString();
      const num = await criarChamadoIrrigacaoComNumero(
        (numero) => ({
          num: numero,
          ativoId: n.ativo.id,
          ativoNome: n.ativo.nome,
          ativoTipo: n.ativo.tipo,
          fazenda: n.ativo.fazenda,
          modulo: n.ativo.modulo,
          casaBombas: n.casaBombas,
          local: n.ativo.local || '',
          plataforma: n.ativo.plataforma ?? null,
          tipoFalha: n.tipoFalha,
          identificadoEm: n.identificadoEm,
          descricao: n.descricao.trim(),
          prioridade: n.prioridade,
          abertoPor: usuario.nome,
          abertoPorUid: usuario.id,
          abertoEm: agora,
          status: 'aguardando' satisfies StatusIrrigacao,
          materiais: [],
          qtdFotos: 0,
          // Nasce atribuído: aparece em "Atribuídos a mim" do técnico, sem passar pela fila de disponíveis.
          tecnico: n.tecnico.nome,
          tecnicoKey: n.tecnico.key,
          tecnicoUid: n.tecnico.uid,
          eventos: [
            evento('abertura', `${n.tipoFalha} · ${n.ativo.nome}`, usuario),
            evento('atribuicao', `${n.tecnico.nome} (atribuído na abertura)`, usuario),
          ],
        }),
        formatarNumeroIrrigacao,
      );
      let fotosComFalha = 0;
      for (const f of fotos) {
        try {
          await salvarFoto(num, f.nome, f.data, usuario);
        } catch {
          fotosComFalha += 1;
        }
      }
      await registrarAuditoria('abriu', `Chamado de irrigação ${num} aberto: ${n.ativo.nome}`, usuario, num);
      return { num, fotosComFalha };
    },
    [usuario],
  );
}

async function salvarFoto(num: string, nome: string, data: string, usuario: Usuario) {
  const foto: FotoIrrigacao = {
    chamado: num,
    nome,
    tipo: 'image/jpeg',
    data,
    criadoEm: new Date().toISOString(),
    autor: usuario.nome,
    autorUid: usuario.id,
  };
  await adicionarDocumento('irrigacao_fotos', foto);
}

export function useFotosIrrigacao(num: string | null) {
  const [fotos, setFotos] = useState<(FotoIrrigacao & { id: string })[]>([]);
  useEffect(() => {
    setFotos([]);
    if (!num) return;
    return escutarPorCampo<FotoIrrigacao>('irrigacao_fotos', 'chamado', num, (itens) =>
      setFotos([...itens].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))),
    );
  }, [num]);
  return fotos;
}

/** Ações da gestão do chamado. Cada uma grava o campo e o evento no histórico juntos. */
export function useAcoesIrrigacao() {
  const usuario = useSessionStore((s) => s.usuario);

  const atualizar = useCallback(
    (c: ChamadoIrrigacao, campos: Partial<ChamadoIrrigacao>, eventos: EventoIrrigacao[], listas: Record<string, unknown[]> = {}) =>
      atualizarComListas('irrigacao_chamados', c.num, campos, { ...listas, eventos }),
    [],
  );

  return useMemo(
    () => ({
      /** Técnico assume para si, em transação: recusa se outro já assumiu. */
      assumir: async (c: ChamadoIrrigacao, tecnico: { key: string; nome: string }) => {
        if (!usuario) throw new Error('sessão expirada, entre novamente');
        const campos: Partial<ChamadoIrrigacao> = { tecnico: tecnico.nome, tecnicoKey: tecnico.key, tecnicoUid: usuario.id };
        const eventos = [evento('atribuicao', `${tecnico.nome} assumiu o chamado`, usuario)];
        if (c.status === 'aguardando') {
          campos.status = 'em_atendimento';
          eventos.push(evento('status', STATUS_IRRIGACAO.em_atendimento.label, usuario));
        }
        await atualizarSeLivre('irrigacao_chamados', c.num, { campos, listas: { eventos } }, (atual) =>
          motivoNaoPodeAssumirIrrigacao(atual as Partial<ChamadoIrrigacao>, usuario.id),
        );
        await registrarAuditoria('assumiu', `Chamado de irrigação ${c.num} assumido`, usuario, c.num);
      },
      atribuirTecnico: (c: ChamadoIrrigacao, tecnico: { key: string; nome: string; uid: string | null }) => {
        const campos: Partial<ChamadoIrrigacao> = { tecnico: tecnico.nome, tecnicoKey: tecnico.key, tecnicoUid: tecnico.uid };
        const eventos = [evento('atribuicao', c.tecnico ? `${c.tecnico} → ${tecnico.nome}` : tecnico.nome, usuario)];
        if (c.status === 'aguardando') {
          campos.status = 'em_atendimento';
          eventos.push(evento('status', STATUS_IRRIGACAO.em_atendimento.label, usuario));
        }
        return atualizar(c, campos, eventos);
      },
      alterarStatus: (c: ChamadoIrrigacao, status: StatusIrrigacao, restabelecidoEm?: string) => {
        const campos: Partial<ChamadoIrrigacao> = { status };
        const eventos = [evento('status', STATUS_IRRIGACAO[status].label, usuario)];
        if (status === 'restabelecida') {
          if (!restabelecidoEm) return Promise.reject(new Error('informe quando a comunicação foi restabelecida'));
          campos.restabelecidoEm = restabelecidoEm;
          eventos.push(evento('restabelecimento', `Comunicação restabelecida em ${new Date(restabelecidoEm).toLocaleString('pt-BR')}`, usuario));
        } else if (c.status === 'restabelecida') {
          campos.restabelecidoEm = null;
        }
        return atualizar(c, campos, eventos);
      },
      registrarDiagnostico: (c: ChamadoIrrigacao, texto: string) => atualizar(c, { diagnostico: texto }, [evento('diagnostico', texto, usuario)]),
      registrarProvidencia: (c: ChamadoIrrigacao, texto: string) => atualizar(c, {}, [evento('providencia', texto, usuario)]),
      registrarObservacao: (c: ChamadoIrrigacao, texto: string) => atualizar(c, {}, [evento('observacao', texto, usuario)]),
      registrarMaterial: (c: ChamadoIrrigacao, descricao: string, quantidade: number, unidade: string) => {
        const ts = new Date().toISOString();
        const material = { descricao, quantidade, unidade, ts, autor: usuario?.nome || 'Sistema' };
        return atualizar(c, {}, [evento('material', `${quantidade} ${unidade} · ${descricao}`, usuario)], { materiais: [material] });
      },
      adicionarFotos: async (c: ChamadoIrrigacao, arquivos: File[]) => {
        if (!usuario) throw new Error('sessão expirada, entre novamente');
        for (const arquivo of arquivos) await salvarFoto(c.num, arquivo.name, await comprimirImagem(arquivo), usuario);
        await atualizarComListas(
          'irrigacao_chamados',
          c.num,
          {},
          { eventos: [evento('foto', `${arquivos.length} foto(s) anexada(s)`, usuario)] },
          { qtdFotos: arquivos.length },
        );
      },
      encerrar: async (c: ChamadoIrrigacao, f: FormEncerramentoIrrigacao) => {
        const indisponibilidadeMin = minutosEntre(c.identificadoEm, f.restabelecidoEm) ?? 0;
        await atualizar(
          c,
          {
            status: 'encerrado',
            diagnostico: f.diagnostico.trim(),
            restabelecidoEm: f.restabelecidoEm,
            encerramento: {
              tecnico: f.tecnico.trim(),
              diagnostico: f.diagnostico.trim(),
              servico: f.servico.trim(),
              solucao: f.solucao.trim(),
              restabelecidoEm: f.restabelecidoEm,
              encerradoEm: f.encerradoEm,
              observacoes: f.observacoes.trim(),
              indisponibilidadeMin,
              encerradoPor: usuario?.nome || 'Sistema',
              encerradoPorUid: usuario?.id || '',
            },
          },
          [evento('encerramento', `Encerrado · indisponibilidade de ${indisponibilidadeMin} min`, usuario)],
        );
        await registrarAuditoria('encerrou', `Chamado de irrigação ${c.num} encerrado`, usuario, c.num);
      },
      reabrir: async (c: ChamadoIrrigacao, motivo: string) => {
        await atualizar(c, { status: 'em_atendimento', encerramento: null, restabelecidoEm: null }, [evento('reabertura', motivo, usuario)]);
        await registrarAuditoria('reabriu', `Chamado de irrigação ${c.num} reaberto: ${motivo}`, usuario, c.num);
      },
    }),
    [atualizar, usuario],
  );
}

export function useSalvarConfigIrrigacao() {
  return useCallback((config: ConfigIrrigacao) => setMerge('irrigacao_config', 'geral', config), []);
}
