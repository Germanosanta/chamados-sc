/** Motivo legível de uma falha do Firebase para mostrar ao usuário — antes
 * as telas diziam só "não foi possível…", e não dava para saber se era o
 * limite diário do plano gratuito, permissão ou conexão. */
export function motivoErro(erro: unknown): string {
  const codigo = typeof erro === 'object' && erro && 'code' in erro ? String((erro as { code: unknown }).code) : '';
  const msg = erro instanceof Error ? erro.message : String(erro ?? '');
  if (codigo.includes('resource-exhausted') || /quota exceeded/i.test(msg)) {
    return 'limite diário gratuito do Firebase atingido; volta a funcionar por volta das 05:00';
  }
  if (codigo.includes('permission-denied') || /insufficient permissions/i.test(msg)) return 'sem permissão para esta ação';
  if (codigo.includes('unavailable') || /offline|network/i.test(msg)) return 'sem conexão com o servidor; tente de novo em instantes';
  return msg.replace(/^FirebaseError:\s*/, '').slice(0, 160) || 'erro desconhecido';
}
