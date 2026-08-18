import type { Chamado } from '@/types/chamado';
import { equipamentoDoChamado, fazendaLabel, formatDataBR } from './chamado-helpers';

/**
 * Relatório de atendimento — texto puro (sem HTML/markdown, compatível
 * com WhatsApp) gerado a partir dos mesmos dados já gravados no
 * encerramento do chamado (Encerramento/ChecklistEncerramento, ver
 * types/chamado.ts). Função pura e determinística: o mesmo `Chamado`
 * sempre produz o mesmo texto, então não precisa de nenhum estado extra
 * nem de escrita nova no Firestore — ver useEncerrarChamado/
 * RelatorioAtendimentoModal.
 *
 * Escolhas de mapeamento (documentadas aqui por serem a única decisão
 * de negócio desta função):
 * - "AÇÃO REALIZADA" = `encerramento.solucao` (campo obrigatório do
 *   checklist de encerramento — é o único texto que descreve o que foi
 *   de fato feito; `observacoes`/`materiais`/`equipamentos` entram como
 *   linhas extras opcionais, nunca substituindo a solução).
 * - "DESCRIÇÃO DO CHAMADO" = `titulo` (+ `desc`, quando existir, numa
 *   linha própria) — `titulo` é sempre preenchido (normalizarChamado
 *   garante `string`), `desc` é o campo de descrição livre da abertura.
 * - "EQUIPAMENTO" = `equipamentoDoChamado(chamado)` (fonte única de
 *   frota do chamado, já trata match_map/equip_idx) — omitido quando
 *   não há equipamento vinculado, nunca inventado.
 * - "[SETOR/ÁREA]" do título = `fazendaLabel(bucket)` quando existir
 *   (Karitel/Rio do Meio/etc. — já é o rótulo humano da fazenda/sistema
 *   exibido em todo o resto do app), com fallback pra `cultura` quando
 *   o bucket não resolve pra nada exibível, e por fim "Geral" — nunca
 *   deixado em branco no título.
 * - Data/hora do atendimento = `encerramento.encerradoEm` (ISO com
 *   horário, gravado via `new Date().toISOString()` em
 *   useEncerrarChamado) formatada com `toLocaleString('pt-BR', ...)` —
 *   Date nativo interpreta o "Z"/offset do ISO e converte pro fuso local
 *   do navegador automaticamente, sem parse manual de string (evita o
 *   bug clássico de deslocamento de fuso de tratar "YYYY-MM-DD" como
 *   meia-noite UTC). Fallback pras strings já formatadas
 *   `dataEncerramento`/`horaEncerramento` (gravadas por fmtDateHora, já
 *   em pt-BR) quando por algum motivo `encerradoEm` não parsear.
 */
export function gerarRelatorioAtendimento(chamado: Chamado): string {
  const enc = chamado.encerramento;
  const equip = equipamentoDoChamado(chamado);

  const setor = fazendaLabel(chamado.bucket) !== '—' ? fazendaLabel(chamado.bucket) : chamado.cultura || 'Geral';

  const linhas: string[] = [];
  linhas.push(`ATENDIMENTO OPERACIONAL - ${setor}`);
  linhas.push('---');
  linhas.push(`CHAMADO: ${chamado.num}`);

  if (equip) {
    const equipTxt = [equip.codigo, equip.descricao].filter(Boolean).join(' - ');
    if (equipTxt) linhas.push(`EQUIPAMENTO: ${equipTxt}`);
  }

  linhas.push('DESCRIÇÃO DO CHAMADO:');
  linhas.push(chamado.titulo || '(sem título)');
  if (chamado.desc) linhas.push(chamado.desc);

  if (enc?.solucao) {
    linhas.push('AÇÃO REALIZADA:');
    linhas.push(enc.solucao);
  }

  if (enc?.tecnicos) linhas.push(`TÉCNICO(S): ${enc.tecnicos}`);
  if (enc?.materiais) linhas.push(`MATERIAIS: ${enc.materiais}`);
  if (enc?.equipamentos) linhas.push(`EQUIPAMENTOS: ${enc.equipamentos}`);
  if (enc?.observacoes) linhas.push(`OBSERVAÇÕES: ${enc.observacoes}`);

  const dataAtendimento = formatarDataEncerramento(chamado);
  if (dataAtendimento) linhas.push(`DATA: ${dataAtendimento}`);

  return linhas.join('\n');
}

function formatarDataEncerramento(chamado: Chamado): string {
  const enc = chamado.encerramento;
  if (enc?.encerradoEm) {
    const d = new Date(enc.encerradoEm);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  if (enc?.dataEncerramento) {
    return enc.horaEncerramento ? `${enc.dataEncerramento} às ${enc.horaEncerramento}` : enc.dataEncerramento;
  }
  return formatDataBR(chamado.data) !== '—' ? formatDataBR(chamado.data) : '';
}
