import type { Chamado } from '@/types/chamado';
import { fazendaLabel } from './chamado-helpers';
import { linkAcompanhamento } from './acompanhamentoPublico';

/**
 * Comprovante de abertura — texto puro (compatível com WhatsApp), mesmo
 * espírito de gerarRelatorioAtendimento (utils/relatorioAtendimento.ts),
 * só que pra ABERTURA em vez de encerramento: gerado a partir do próprio
 * `Chamado` já gravado (retorno de useCriarChamado), sem nenhum novo
 * campo digitado pelo usuário e sem nenhuma escrita adicional no
 * Firestore. `tokenPublico` precisa existir (sempre existe pra todo
 * chamado criado depois desta funcionalidade — ver useCriarChamado) —
 * sem ele, não há link de acompanhamento pra incluir, então a função
 * devolve `null` em vez de montar um comprovante sem link.
 */
export function gerarComprovanteAbertura(chamado: Chamado): string | null {
  if (!chamado.tokenPublico) return null;

  const setor = fazendaLabel(chamado.bucket) !== '—' ? fazendaLabel(chamado.bucket) : chamado.cultura || '';
  const dataHora = chamado.dataHoraAbertura || chamado.data || '';

  const linhas: string[] = [];
  linhas.push('CHAMADOS SC — COMPROVANTE DE ABERTURA');
  linhas.push('');
  linhas.push(`Protocolo: ${chamado.num}`);
  if (dataHora) linhas.push(`Data: ${dataHora}`);
  linhas.push(`Assunto: ${chamado.titulo || '(sem título)'}${setor ? ` — ${setor}` : ''}`);
  linhas.push('Status: Aberto');
  linhas.push('');
  linhas.push('Descrição:');
  linhas.push(chamado.desc || chamado.titulo || '(sem descrição)');
  linhas.push('');
  linhas.push('Acompanhe seu chamado:');
  linhas.push(linkAcompanhamento(chamado.tokenPublico));

  return linhas.join('\n');
}
