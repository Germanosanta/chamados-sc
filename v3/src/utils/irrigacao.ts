import type {
  AtivoIrrigacao,
  ChamadoIrrigacao,
  PlataformaTelemetria,
  PrioridadeIrrigacao,
  StatusIrrigacao,
  TipoAtivoIrrigacao,
} from '@/types/irrigacao';

/** Regras do módulo de irrigação em funções puras: testáveis sem Firestore
 * e reaproveitadas por painel, indicadores, encerramento e relatório. */

export const TIPOS_FALHA_PADRAO = [
  'Equipamento sem comunicação',
  'Comunicação intermitente',
  'Falha na transmissão de dados',
  'Falha no sistema de telemetria',
  'Falha de alimentação do sistema de comunicação',
  'Outro problema relacionado à telemetria',
];

export const PRIORIDADES_IRRIGACAO: PrioridadeIrrigacao[] = ['Baixa', 'Média', 'Alta', 'Urgente'];

export const PLATAFORMAS_TELEMETRIA: PlataformaTelemetria[] = ['Lindsay', '3V3', 'BestStation'];

/** Valor do filtro para chamados de ativos ainda sem plataforma. */
export const SEM_PLATAFORMA = 'sem_plataforma';

/** Aplica as definições da tela de configurações sobre o cadastro. Nunca
 * inventa: ativo sem plataforma no cadastro e sem definição fica sem. */
export function aplicarPlataformas(ativos: AtivoIrrigacao[], definidas: Record<string, PlataformaTelemetria | ''> = {}): AtivoIrrigacao[] {
  return ativos.map((a) => {
    if (!(a.id in definidas)) return a;
    const p = definidas[a.id];
    const { plataforma: _antiga, ...resto } = a;
    return p && PLATAFORMAS_TELEMETRIA.includes(p) ? { ...resto, plataforma: p } : resto;
  });
}

export const TIPO_ATIVO_LABEL: Record<TipoAtivoIrrigacao, string> = {
  pivo: 'Pivô',
  casa_bombas: 'Reservatório / Casa de bombas',
  captacao: 'Captação',
  elevatoria: 'Elevatória',
  poco: 'Poço',
  concentrador: 'Concentrador',
  repetidor: 'Repetidor',
  dispositivo: 'Dispositivo de telemetria',
  sensor: 'Sensor (hidrômetro)',
};

export const STATUS_IRRIGACAO: Record<StatusIrrigacao, { label: string; variant: 'red' | 'amber' | 'purple' | 'green' | 'neutral' }> = {
  aguardando: { label: 'Aguardando atendimento', variant: 'red' },
  em_atendimento: { label: 'Em atendimento', variant: 'amber' },
  aguardando_pecas: { label: 'Aguardando peças/materiais', variant: 'purple' },
  restabelecida: { label: 'Comunicação restabelecida', variant: 'green' },
  encerrado: { label: 'Encerrado', variant: 'neutral' },
};

/** Transições manuais permitidas na gestão. Encerrar passa sempre pelo
 * formulário de encerramento técnico; reabrir, pela ação própria. */
export const TRANSICOES_IRRIGACAO: Record<StatusIrrigacao, StatusIrrigacao[]> = {
  aguardando: ['em_atendimento'],
  em_atendimento: ['aguardando_pecas', 'restabelecida'],
  aguardando_pecas: ['em_atendimento', 'restabelecida'],
  restabelecida: ['em_atendimento'],
  encerrado: [],
};

/** Janela para considerar uma falha como reincidente no mesmo ativo. */
export const DIAS_REINCIDENCIA = 30;

export function formatarNumeroIrrigacao(n: number): string {
  return `IRR-${String(n).padStart(4, '0')}`;
}

export function numeroIrrigacao(num: string): number | null {
  const m = /^IRR-(\d{1,6})$/.exec(num || '');
  return m ? Number(m[1]) : null;
}

/** Minutos entre dois instantes ISO; null se algum for inválido ou fim < início. */
export function minutosEntre(inicioISO?: string | null, fimISO?: string | null): number | null {
  if (!inicioISO || !fimISO) return null;
  const ini = new Date(inicioISO).getTime();
  const fim = new Date(fimISO).getTime();
  if (Number.isNaN(ini) || Number.isNaN(fim) || fim < ini) return null;
  return Math.round((fim - ini) / 60000);
}

export function formatarDuracao(min: number | null | undefined): string {
  if (min === null || min === undefined || Number.isNaN(min)) return '—';
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const partes: string[] = [];
  if (d) partes.push(`${d}d`);
  if (h) partes.push(`${h}h`);
  if (m || !partes.length) partes.push(`${m}min`);
  return partes.join(' ');
}

export function formatarDataHora(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
export function isoParaInputLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> (hora local) → ISO; '' se inválido. */
export function inputLocalParaIso(valor: string): string {
  if (!valor) return '';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

const normalizarBusca = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Busca da abertura de chamado (como a de equipamento dos chamados de
 * campo). Ordem: pivô cujo número é o digitado ("27" → Pivô 27), outro
 * equipamento com esse número, demais pivôs, demais equipamentos. */
export function buscarAtivosIrrigacao(ativos: AtivoIrrigacao[], q: string, limite = 30): AtivoIrrigacao[] {
  const termos = normalizarBusca(q).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  // Plataforma fica só para termos de texto: o "3" de "3V3" não pode casar com números.
  const texto = (a: AtivoIrrigacao) =>
    normalizarBusca(
      `${a.nome} ${TIPO_ATIVO_LABEL[a.tipo]} ${a.fazenda} ${a.modulo} ${a.casaBombas || ''} ${a.local || ''} ${a.dispositivo || ''} ${(a.sensores || []).join(' ')}`,
    );
  // Número digitado casa pelo início de um número do texto ("27" → 27, 270;
  // nunca 127), ignorando zeros à esquerda ("1" → "01").
  const casaNumero = (t: string, termo: string) =>
    (t.match(/\d+/g) || []).some((n) => n.startsWith(termo) || String(Number(n)).startsWith(String(Number(termo))));
  // Primeiro quem tem todos os termos no próprio nome ("prm 03" → PRM 03 antes
  // do DIR_NB instalado nele); pivôs antes dos demais em cada grupo.
  // Número exato no nome ("primavera 1" → Primavera 01) vem antes do que só
  // começa com ele (PRESSAO-10-PRIMAVERA-3).
  const numeroExato = (t: string, termo: string) => (t.match(/\d+/g) || []).some((n) => Number(n) === Number(termo));
  const prioridade = (a: AtivoIrrigacao) => {
    const nome = normalizarBusca(a.nome);
    const casa = (exato: boolean) =>
      termos.every((termo) => (/^\d+$/.test(termo) ? (exato ? numeroExato(nome, termo) : casaNumero(nome, termo)) : nome.includes(termo)));
    const grupo = casa(true) ? 0 : casa(false) ? 2 : 4;
    return grupo + (a.tipo === 'pivo' ? 0 : 1);
  };
  return ativos
    .filter((a) => {
      const t = texto(a);
      const plataforma = normalizarBusca(a.plataforma || '');
      return termos.every((termo) => (/^\d+$/.test(termo) ? casaNumero(t, termo) : t.includes(termo) || plataforma.includes(termo)));
    })
    .sort((a, b) => prioridade(a) - prioridade(b) || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
    .slice(0, limite);
}

export function ativosMonitorados(ativos: AtivoIrrigacao[], naoMonitorados: string[] = []): AtivoIrrigacao[] {
  const fora = new Set(naoMonitorados);
  return ativos.filter((a) => !fora.has(a.id));
}

/** Reincidente: o mesmo ativo teve outra falha identificada nos
 * DIAS_REINCIDENCIA dias anteriores a esta. */
export function isReincidente(c: ChamadoIrrigacao, todos: ChamadoIrrigacao[], dias = DIAS_REINCIDENCIA): boolean {
  const atual = new Date(c.identificadoEm).getTime();
  if (Number.isNaN(atual)) return false;
  const janela = dias * 86400000;
  return todos.some((o) => {
    if (o.num === c.num || o.ativoId !== c.ativoId) return false;
    const t = new Date(o.identificadoEm).getTime();
    return !Number.isNaN(t) && t <= atual && atual - t <= janela && !(t === atual && o.num > c.num);
  });
}

export interface FiltrosIrrigacao {
  fazenda?: string;
  modulo?: string;
  tipoAtivo?: string;
  /** Plataforma de telemetria, ou SEM_PLATAFORMA. */
  plataforma?: string;
  ativoId?: string;
  tecnico?: string;
  status?: string;
  prioridade?: string;
  /** 'AAAA-MM-DD', comparado com a data de identificação da falha. */
  de?: string;
  ate?: string;
  busca?: string;
}

export function filtrarChamadosIrrigacao(lista: ChamadoIrrigacao[], f: FiltrosIrrigacao): ChamadoIrrigacao[] {
  const termo = (f.busca || '').trim().toLowerCase();
  return lista.filter((c) => {
    if (f.fazenda && c.fazenda !== f.fazenda) return false;
    if (f.modulo && c.modulo !== f.modulo) return false;
    if (f.tipoAtivo && c.ativoTipo !== f.tipoAtivo) return false;
    if (f.plataforma && (c.plataforma || SEM_PLATAFORMA) !== f.plataforma) return false;
    if (f.ativoId && c.ativoId !== f.ativoId) return false;
    if (f.tecnico && (c.tecnico || '') !== f.tecnico) return false;
    if (f.prioridade && c.prioridade !== f.prioridade) return false;
    if (f.status === 'abertos' ? c.status === 'encerrado' : f.status && c.status !== f.status) return false;
    const dia = isoParaInputLocal(c.identificadoEm).slice(0, 10);
    if (f.de && dia < f.de) return false;
    if (f.ate && dia > f.ate) return false;
    if (termo && ![c.num, c.ativoNome, c.tipoFalha, c.descricao, c.tecnico || ''].some((v) => v.toLowerCase().includes(termo))) return false;
    return true;
  });
}

export interface KpisIrrigacao {
  abertos: number;
  aguardando: number;
  emAtendimento: number;
  aguardandoPecas: number;
  restabelecida: number;
  encerrados: number;
  reincidentes: number;
}

export function calcularKpisIrrigacao(lista: ChamadoIrrigacao[], todos: ChamadoIrrigacao[] = lista): KpisIrrigacao {
  const conta = (s: StatusIrrigacao) => lista.filter((c) => c.status === s).length;
  return {
    abertos: lista.filter((c) => c.status !== 'encerrado').length,
    aguardando: conta('aguardando'),
    emAtendimento: conta('em_atendimento'),
    aguardandoPecas: conta('aguardando_pecas'),
    restabelecida: conta('restabelecida'),
    encerrados: conta('encerrado'),
    reincidentes: lista.filter((c) => isReincidente(c, todos)).length,
  };
}

/** Restabelecimento efetivo: o do encerramento ou, antes dele, o registrado na gestão. */
export function restabelecimentoDe(c: ChamadoIrrigacao): string | null {
  return c.encerramento?.restabelecidoEm || c.restabelecidoEm || null;
}

export interface IndicadoresIrrigacao {
  porAtivo: [string, number][];
  porFazenda: [string, number][];
  porPlataforma: [string, number][];
  porTecnico: [string, number][];
  porMes: [string, number][];
  reincidentes: ChamadoIrrigacao[];
  /** Média em minutos: abertura → encerramento. */
  tempoMedioAtendimentoMin: number | null;
  /** Média em minutos: identificação → restabelecimento. */
  indisponibilidadeMediaMin: number | null;
  indisponibilidadeTotalMin: number;
}

function contar(lista: ChamadoIrrigacao[], chave: (c: ChamadoIrrigacao) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const c of lista) {
    const k = chave(c);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
}

function media(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
}

export function calcularIndicadoresIrrigacao(lista: ChamadoIrrigacao[], todos: ChamadoIrrigacao[] = lista): IndicadoresIrrigacao {
  const indisponibilidades = lista.map((c) => minutosEntre(c.identificadoEm, restabelecimentoDe(c)));
  return {
    porAtivo: contar(lista, (c) => `${c.ativoNome} · ${c.fazenda || '—'}`),
    porFazenda: contar(lista, (c) => c.fazenda || '—'),
    porPlataforma: contar(lista, (c) => c.plataforma || 'Sem plataforma'),
    porTecnico: contar(lista, (c) => c.tecnico || 'Sem técnico'),
    porMes: contar(lista, (c) => isoParaInputLocal(c.identificadoEm).slice(0, 7) || '—').sort((a, b) => a[0].localeCompare(b[0])),
    reincidentes: lista.filter((c) => isReincidente(c, todos)),
    tempoMedioAtendimentoMin: media(lista.filter((c) => c.status === 'encerrado').map((c) => minutosEntre(c.abertoEm, c.encerramento?.encerradoEm))),
    indisponibilidadeMediaMin: media(indisponibilidades),
    indisponibilidadeTotalMin: indisponibilidades.reduce<number>((s, x) => s + (x ?? 0), 0),
  };
}

export interface FormEncerramentoIrrigacao {
  tecnico: string;
  diagnostico: string;
  servico: string;
  solucao: string;
  restabelecidoEm: string;
  encerradoEm: string;
  observacoes: string;
}

/** Erros do encerramento técnico; lista vazia = pode encerrar. */
export function validarEncerramentoIrrigacao(f: FormEncerramentoIrrigacao, identificadoEm: string): string[] {
  const erros: string[] = [];
  if (!f.tecnico.trim()) erros.push('técnico responsável');
  if (!f.diagnostico.trim()) erros.push('diagnóstico da falha');
  if (!f.servico.trim()) erros.push('serviço realizado');
  if (!f.solucao.trim()) erros.push('solução aplicada');
  if (!f.restabelecidoEm) erros.push('data e hora do restabelecimento');
  if (!f.encerradoEm) erros.push('data e hora do encerramento');
  if (!f.observacoes.trim()) erros.push('observações finais');
  if (f.restabelecidoEm && minutosEntre(identificadoEm, f.restabelecidoEm) === null) {
    erros.push('restabelecimento não pode ser antes da identificação da falha');
  }
  if (f.restabelecidoEm && f.encerradoEm && minutosEntre(f.restabelecidoEm, f.encerradoEm) === null) {
    erros.push('encerramento não pode ser antes do restabelecimento');
  }
  if (f.encerradoEm && new Date(f.encerradoEm).getTime() > Date.now() + 5 * 60000) erros.push('encerramento no futuro');
  return erros;
}

/** Mesma regra dos chamados de campo (podeAgirNoChamado): só o técnico
 * responsável ou um administrador. Responsável pelo UID; pelo nome só
 * quando o chamado não tem UID gravado. */
export function souResponsavelIrrigacao(
  c: Pick<ChamadoIrrigacao, 'tecnico' | 'tecnicoUid'>,
  usuario: { id: string; nome: string; perfil: string } | null | undefined,
): boolean {
  if (!usuario) return false;
  return usuario.perfil === 'admin' || ehResponsavelIrrigacao(c, usuario);
}

/** O usuário é o técnico do chamado (sem a exceção de administrador). */
export function ehResponsavelIrrigacao(
  c: Pick<ChamadoIrrigacao, 'tecnico' | 'tecnicoUid'>,
  usuario: { id: string; nome: string } | null | undefined,
): boolean {
  if (!usuario) return false;
  if (c.tecnicoUid) return c.tecnicoUid === usuario.id;
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return !!c.tecnico && norm(c.tecnico) === norm(usuario.nome);
}

/** Motivo para recusar "Assumir" com o estado lido no servidor; null = pode. */
export function motivoNaoPodeAssumirIrrigacao(atual: Partial<ChamadoIrrigacao>, uid: string): string | null {
  if (atual.status === 'encerrado') return 'este chamado já foi encerrado';
  if (atual.tecnico && atual.tecnicoUid !== uid) return `este chamado já foi assumido por ${atual.tecnico}`;
  return null;
}

/** Texto puro para WhatsApp, a partir do chamado já encerrado. */
export function gerarRelatorioIrrigacao(c: ChamadoIrrigacao): string {
  const enc = c.encerramento;
  const restabelecido = restabelecimentoDe(c);
  const indisp = enc?.indisponibilidadeMin ?? minutosEntre(c.identificadoEm, restabelecido);
  const linhas = [
    `*CHAMADO DE IRRIGAÇÃO ${c.num}*`,
    '---',
    `*Fazenda:* ${c.fazenda || '—'}`,
    `*Módulo:* ${c.modulo || '—'}`,
    `*Equipamento:* ${c.ativoNome} (${TIPO_ATIVO_LABEL[c.ativoTipo] || c.ativoTipo})`,
  ];
  if (c.casaBombas) linhas.push(`*Casa de bombas:* ${c.casaBombas}`);
  if (c.local) linhas.push(`*Local de instalação:* ${c.local}`);
  linhas.push(`*Plataforma de telemetria:* ${c.plataforma || 'Não classificada'}`);
  linhas.push(
    `*Tipo de falha:* ${c.tipoFalha}`,
    `*Ocorrência:* ${formatarDataHora(c.identificadoEm)}`,
    `*Técnico responsável:* ${enc?.tecnico || c.tecnico || '—'}`,
    '---',
    `*Diagnóstico:* ${enc?.diagnostico || c.diagnostico || '—'}`,
    `*Serviço executado:* ${enc?.servico || '—'}`,
    `*Solução aplicada:* ${enc?.solucao || '—'}`,
    `*Comunicação restabelecida:* ${formatarDataHora(restabelecido)}`,
    `*Tempo de indisponibilidade:* ${formatarDuracao(indisp)}`,
    `*Resultado:* ${c.status === 'encerrado' ? 'Comunicação restabelecida e chamado encerrado' : STATUS_IRRIGACAO[c.status].label}`,
  );
  if (enc?.observacoes) linhas.push(`*Observações:* ${enc.observacoes}`);
  if (enc?.encerradoEm) linhas.push(`*Encerrado em:* ${formatarDataHora(enc.encerradoEm)}`);
  return linhas.join('\n');
}
