import type { Chamado } from '@/types/chamado';
import type { ChamadoIrrigacao } from '@/types/irrigacao';
import { fazendaLabel, frotaLabel, isAguardandoPeca, isEmAtendimento, isFechado, souResponsavelDoChamado, temResponsavel } from './chamado-helpers';
import { ehResponsavelIrrigacao } from './irrigacao';

/**
 * Filas da Área Técnica, iguais nos dois módulos. "Disponíveis" é a fila
 * que faltava: chamado aberto e ainda sem responsável aparece para todos
 * os técnicos assim que é aberto, sem atribuição prévia, e sai dela quando
 * alguém assume ou é atribuído.
 */
export type FilaAreaTecnica = 'disponiveis' | 'meus' | 'execucao' | 'pecas' | 'urgentes' | 'historico' | 'encerrados';

export const FILAS_AREA_TECNICA: { key: FilaAreaTecnica; label: string }[] = [
  { key: 'disponiveis', label: 'Disponíveis para assumir' },
  { key: 'meus', label: 'Atribuídos a mim' },
  { key: 'execucao', label: 'Em execução' },
  { key: 'pecas', label: 'Aguardando peças' },
  { key: 'urgentes', label: 'Urgentes' },
  { key: 'historico', label: 'Meu histórico' },
  { key: 'encerrados', label: 'Encerrados' },
];

type UsuarioAT = { id: string; nome: string } | null | undefined;

export function filasCampo(todos: Chamado[], usuario: UsuarioAT, apelido?: string | null): Record<FilaAreaTecnica, Chamado[]> {
  const abertos = todos.filter((c) => !isFechado(c));
  const encerrados = todos.filter(isFechado);
  const meu = (c: Chamado) => souResponsavelDoChamado(c, usuario, apelido);
  return {
    disponiveis: abertos.filter((c) => !temResponsavel(c)),
    meus: abertos.filter(meu),
    execucao: abertos.filter(isEmAtendimento),
    pecas: abertos.filter(isAguardandoPeca),
    urgentes: abertos.filter((c) => c.prior === 'Urgente'),
    historico: encerrados.filter(meu),
    encerrados,
  };
}

export function filasIrrigacao(todos: ChamadoIrrigacao[], usuario: UsuarioAT): Record<FilaAreaTecnica, ChamadoIrrigacao[]> {
  const abertos = todos.filter((c) => c.status !== 'encerrado');
  const encerrados = todos.filter((c) => c.status === 'encerrado');
  const meu = (c: ChamadoIrrigacao) => ehResponsavelIrrigacao(c, usuario);
  return {
    disponiveis: abertos.filter((c) => !c.tecnico),
    meus: abertos.filter(meu),
    execucao: abertos.filter((c) => c.status === 'em_atendimento'),
    pecas: abertos.filter((c) => c.status === 'aguardando_pecas'),
    urgentes: abertos.filter((c) => c.prioridade === 'Urgente'),
    historico: encerrados.filter((c) => meu(c) || (!!usuario && c.encerramento?.encerradoPorUid === usuario.id)),
    encerrados,
  };
}

const STATUS_TERMINAIS = ['Concluída', 'Encerrado', 'Cancelado'];

/** Motivo para recusar "Assumir" um chamado de campo, com o estado lido no
 * servidor dentro da transação; null = pode assumir. */
export function motivoNaoPodeAssumirCampo(atual: Partial<Chamado>, uid: string): string | null {
  if (atual.status && STATUS_TERMINAIS.includes(atual.status)) return 'este chamado já foi encerrado';
  if (atual.assumidoPorUid) return atual.assumidoPorUid === uid ? null : `este chamado já foi assumido por ${atual.assumidoPor || 'outro técnico'}`;
  const resp = (atual.assumidoPor || atual.resp || '').trim();
  return resp ? `este chamado já está com ${resp}` : null;
}

export interface FiltrosAreaTecnicaCampo {
  fazenda?: string;
  prioridade?: string;
  equipamento?: string;
  situacao?: string;
}

export function filtrarAreaTecnicaCampo(lista: Chamado[], f: FiltrosAreaTecnicaCampo): Chamado[] {
  const termo = (f.equipamento || '').trim().toLowerCase();
  return lista.filter((c) => {
    if (f.fazenda && fazendaLabel(c.bucket) !== f.fazenda) return false;
    if (f.prioridade && (c.prior || 'Média') !== f.prioridade) return false;
    if (f.situacao && c.status !== f.situacao) return false;
    if (termo && ![c.num, c.titulo, frotaLabel(c)].some((v) => (v || '').toLowerCase().includes(termo))) return false;
    return true;
  });
}
