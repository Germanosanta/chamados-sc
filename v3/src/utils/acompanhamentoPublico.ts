import { setMerge } from '@/services/firebase/firestore';
import { fazendaLabel, isAguardandoPeca, isCancelado, isConcluido, isEmAtendimento } from './chamado-helpers';
import type { Chamado } from '@/types/chamado';

/**
 * Consulta pública de chamado por protocolo (sem login) — pedido:
 * "acompanhar um chamado pelo número do protocolo". O número sozinho
 * nunca autoriza leitura (ver firestore.rules, `chamados` continua
 * exigindo `estouAtivo()`): quem autoriza é um TOKEN aleatório
 * (`Chamado.tokenPublico`, gerado 1x em useCriarChamado), guardado como
 * o próprio ID de um mini-documento espelho nesta coleção separada
 * (`acompanhamento_publico/{token}`) — só com os campos não sensíveis
 * abaixo, nunca o documento completo do chamado (sem descrição interna,
 * solução, materiais, nomes de solicitante/técnico, frota). A regra do
 * Firestore permite "get" público desse documento mas nunca "list" — só
 * quem já tem o link exato (token) consegue ler aquele chamado.
 */
export interface DadosPublicosChamado {
  num: string;
  assunto: string;
  setor: string;
  status: StatusPublico;
  abertoEm: string;
  atualizadoEm: string;
  encerradoEm: string | null;
}

export type StatusPublico = 'Aberto' | 'Em atendimento' | 'Fechado';

/**
 * Mapeia os status internos (ChamadoStatus — "Não iniciado", "Aberto",
 * "Em Andamento", "Em Atendimento", "Aguardando Peça", "Concluída",
 * "Encerrado", "Cancelado", mais qualquer texto legado inesperado) para
 * as 3 categorias públicas pedidas — nunca inventa um 4º status nem
 * expõe o texto interno bruto. Reaproveita os mesmos predicados de
 * bucket já usados em todo o resto da V3 (isConcluido/isCancelado/
 * isAguardandoPeca/isEmAtendimento, chamado-helpers.ts), então o status
 * público nunca diverge do status que a equipe interna já vê.
 */
export function statusPublico(c: Pick<Chamado, 'status' | 'encerramento'>): StatusPublico {
  if (isConcluido(c) || isCancelado(c)) return 'Fechado';
  if (isEmAtendimento(c) || isAguardandoPeca(c)) return 'Em atendimento';
  return 'Aberto';
}

/** Monta só o subconjunto público a partir do chamado completo — função
 * pura, sem nenhuma leitura/escrita, pra poder ser testada/revisada
 * isoladamente do efeito de rede (sincronizarAcompanhamentoPublico). */
export function montarDadosPublicos(c: Chamado): DadosPublicosChamado {
  const agora = new Date().toISOString();
  return {
    num: c.num,
    assunto: c.titulo || '(sem título)',
    setor: fazendaLabel(c.bucket) !== '—' ? fazendaLabel(c.bucket) : c.cultura || '',
    status: statusPublico(c),
    abertoEm: c.dataHoraISO || c.data || agora,
    atualizadoEm: agora,
    encerradoEm: c.encerramento?.encerradoEm || null,
  };
}

/**
 * Espelha o estado atual do chamado no doc público, SE ele tiver um
 * token (chamados sem `tokenPublico` — todo o histórico anterior a esta
 * funcionalidade — simplesmente não têm link de acompanhamento, de
 * propósito: nunca inventamos um token pra um chamado antigo só pra
 * "completar" o recurso). Chamada depois de toda escrita que muda o
 * status visível de um chamado (useCriarChamado na abertura;
 * useChamadoPatch — usado por assumir/reatribuir/registrar evento/
 * encerrar/reabrir) — um único ponto central em vez de espalhar esta
 * sincronização em cada hook. Nunca lança: uma falha aqui (rede, regra
 * ainda não publicada no Console) não pode derrubar a ação real do
 * usuário, que já foi gravada com sucesso no chamado em si.
 */
export async function sincronizarAcompanhamentoPublico(c: Chamado): Promise<void> {
  if (!c.tokenPublico) return;
  try {
    await setMerge('acompanhamento_publico', c.tokenPublico, montarDadosPublicos(c));
  } catch (erro) {
    // eslint-disable-next-line no-console -- diagnóstico intencional, nunca interrompe o fluxo principal (ver comentário acima).
    console.error('[acompanhamentoPublico] falha ao sincronizar', c.num, erro);
  }
}

/** Gera o token de acompanhamento na abertura do chamado —
 * `crypto.randomUUID()` (disponível em todo navegador moderno com
 * contexto seguro, o mesmo exigido pelo próprio Firebase Auth) produz
 * 122 bits de aleatoriedade, inviável de adivinhar por força bruta —
 * muito mais forte que o próprio número sequencial do chamado, que é
 * previsível por definição. */
export function gerarTokenPublico(): string {
  return crypto.randomUUID();
}

export function linkAcompanhamento(token: string): string {
  return `${window.location.origin}/acompanhar/${token}`;
}
