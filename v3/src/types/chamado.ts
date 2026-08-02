/**
 * Modelo de chamado da V3 — normalizado num único tipo.
 *
 * Na V2 esse mesmo dado está fragmentado em 4 lugares: um array
 * posicional de 7 campos (histórico estático + registros locais
 * remapeados), um "registro local" mais rico gravado em `chamados/{num}`,
 * um mapa de encerramento em `historico/{num}.encerramento` e um mapa de
 * eventos em `historico/{num}.eventos`. Aqui os três primeiros viram um
 * único `Chamado` — a V3 só modela melhor no cliente; os nomes de
 * campo/coleção do Firestore continuam exatamente os mesmos, então a V2
 * lê/escreve os mesmos documentos sem saber que a V3 existe.
 */

export type Prioridade = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

export type ChamadoStatus =
  | 'Não iniciado'
  | 'Aberto'
  | 'Em Andamento'
  | 'Em Atendimento'
  | 'Aguardando Peça'
  | 'Concluída'
  | 'Encerrado'
  | 'Cancelado';

/** "Fazenda/Sistema" — 4 opções no formulário, mas o campo aceita
 * qualquer string por causa do dataset histórico (bucket 'string' livre
 * em registros antigos). */
export type Bucket = 'Solinftec KRT' | 'Solinftec RDM' | 'Rádio' | 'John Deere' | (string & {});

export type Cultura = 'Grãos e Fibras' | 'Tabaco' | 'Cacau' | 'Geral' | '';

/** Tupla posicional usada pelo dataset histórico estático
 * (data/chamados_historico.json): [num, titulo, cultura, resp, data, status, bucket] */
export type ChamadoHistoricoTupla = [string, string, string, string, string, string, string];

export interface FotoAnexo {
  name: string;
  type: string;
  /** base64 — só existe em cache local, nunca é gravado no Firestore
   * (limite de tamanho de documento) — mesma limitação da V2. */
  data: string;
}

export interface PecaUsada {
  id: string;
  nome: string;
  qtd: number;
  unidade: string;
}

export interface ChecklistEncerramento {
  problemaResolvido: boolean;
  testeRealizado: boolean;
  equipamentoLiberado: boolean;
  usuarioInformado: boolean;
}

export interface Encerramento {
  encerradoEm: string;
  dataEncerramento: string;
  horaEncerramento: string;
  encerradoPor: string;
  status: 'Encerrado';
  solucao: string;
  tecnicos: string;
  materiais: string;
  equipamentos: string;
  observacoes: string;
  checklist: ChecklistEncerramento;
}

export interface EventoTimeline {
  ts: string;
  type: string;
  actor: string;
  detail?: string;
}

/** Documento normalizado — union do "registro local" (chamados/{num})
 * mais o encerramento/eventos relacionados (historico/{num}), quando
 * carregados juntos pelas queries da V3. */
export interface Chamado {
  num: string;
  titulo: string;
  cultura: Cultura;
  /** responsáveis separados por vírgula, como a V2 grava — ver
   * utils/chamado-helpers.ts para (des)serializar em array. */
  resp: string;
  data: string;
  status: ChamadoStatus;
  bucket: Bucket;

  desc?: string;
  prior?: Prioridade;
  categoria?: string;
  tecnico?: string;
  solicitante?: string;
  observacoes?: string;
  fotos?: FotoAnexo[];
  pecasUsadas?: PecaUsada[];

  equipCodigo?: string;
  equipModelo?: string;
  equipGrupo?: string;
  equipStatus?: string;

  abertoPor?: string;
  dataHoraAbertura?: string;
  dataHoraISO?: string;

  assumidoPor?: string;
  assumidoEm?: string;

  encerramento?: Encerramento;
  eventos?: EventoTimeline[];
}
