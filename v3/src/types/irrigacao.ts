/**
 * Módulo Chamados de Irrigação — falhas de comunicação da telemetria dos
 * ativos de irrigação. Coleções próprias, separadas dos chamados de campo:
 * irrigacao_chamados/{num}, irrigacao_fotos/{id}, irrigacao_config/{geral|contador}.
 */

export type TipoAtivoIrrigacao = 'pivo' | 'casa_bombas' | 'captacao' | 'elevatoria' | 'poco';

/** Ativo do cadastro estático (src/data/irrigacao_ativos.json, gerado por
 * scripts/gerar-ativos-irrigacao.js a partir da planilha original). */
export interface AtivoIrrigacao {
  id: string;
  tipo: TipoAtivoIrrigacao;
  nome: string;
  fazenda: string;
  modulo: string;
  casaBombas?: string;
  marca?: string;
  pivosAbastecidos?: string;
  coordenadas?: { lat: number; lon: number };
  /** Colunas originais da linha da planilha (exceto as sensíveis). */
  dados?: Record<string, string | number>;
  /** Estações de captação/elevatória/poço: bombas da estação. */
  bombas?: Record<string, string | number>[];
}

export type StatusIrrigacao = 'aguardando' | 'em_atendimento' | 'aguardando_pecas' | 'restabelecida' | 'encerrado';

export type PrioridadeIrrigacao = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export type TipoEventoIrrigacao =
  | 'abertura'
  | 'atribuicao'
  | 'status'
  | 'diagnostico'
  | 'providencia'
  | 'material'
  | 'foto'
  | 'observacao'
  | 'restabelecimento'
  | 'encerramento'
  | 'reabertura';

export interface EventoIrrigacao {
  ts: string;
  tipo: TipoEventoIrrigacao;
  autor: string;
  detalhe: string;
}

export interface MaterialIrrigacao {
  descricao: string;
  quantidade: number;
  unidade: string;
  ts: string;
  autor: string;
}

export interface EncerramentoIrrigacao {
  tecnico: string;
  diagnostico: string;
  servico: string;
  solucao: string;
  restabelecidoEm: string;
  encerradoEm: string;
  observacoes: string;
  /** Identificação da falha → restabelecimento da comunicação, em minutos. */
  indisponibilidadeMin: number;
  encerradoPor: string;
  encerradoPorUid: string;
}

/** irrigacao_chamados/{num} — o id do documento é o próprio número (IRR-0001). */
export interface ChamadoIrrigacao {
  num: string;
  ativoId: string;
  ativoNome: string;
  ativoTipo: TipoAtivoIrrigacao;
  fazenda: string;
  modulo: string;
  casaBombas: string;
  tipoFalha: string;
  identificadoEm: string;
  descricao: string;
  prioridade: PrioridadeIrrigacao;
  abertoPor: string;
  abertoPorUid: string;
  abertoEm: string;
  status: StatusIrrigacao;
  tecnico?: string;
  tecnicoKey?: string;
  /** Conta de login do técnico (quem assumiu, ou o vínculo do cadastro de
   * técnicos) — usada para saber se o usuário é o responsável. */
  tecnicoUid?: string | null;
  diagnostico?: string;
  restabelecidoEm?: string | null;
  materiais?: MaterialIrrigacao[];
  eventos?: EventoIrrigacao[];
  qtdFotos?: number;
  encerramento?: EncerramentoIrrigacao | null;
}

/** irrigacao_fotos/{id} — 1 documento por foto (JPEG comprimido em base64),
 * para nunca estourar o limite de 1 MB do documento do chamado. */
export interface FotoIrrigacao {
  chamado: string;
  nome: string;
  tipo: string;
  data: string;
  criadoEm: string;
  autor: string;
  autorUid: string;
}

/** irrigacao_config/geral */
export interface ConfigIrrigacao {
  tiposFalha?: string[];
  /** Todos os ativos começam monitorados; um administrador desmarca os sem telemetria. */
  naoMonitorados?: string[];
}
