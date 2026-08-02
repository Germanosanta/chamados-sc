/** pecas/{id} — estoque. Campos conferidos contra
 * docs/js/modules/equipamentos/index.js::salvarPeca() — nota: o campo de
 * quantidade se chama `qtd`, não `estoque`. */
export interface Peca {
  id: string;
  nome: string;
  qtd: number;
  codigo?: string;
  categoria?: string;
  unidade: string;
  minimo?: number;
  local?: string;
  fornecedor?: string;
  obs?: string;
  criadoEm?: string;
}

/** movimentacoes/{id} — entrada/saída de estoque, opcionalmente
 * vinculada a um chamado. Campos conferidos contra
 * equipamentos/index.js::registrarMovimentacao() — nota: o campo do
 * chamado se chama `chamado` (só o número), não `chamadoNum`; `before`/
 * `after` registram o saldo antes/depois do movimento. */
export interface Movimentacao {
  id: string;
  pecaId: string;
  pecaNome: string;
  tipo: 'entrada' | 'saida';
  qtd: number;
  before: number;
  after: number;
  chamado?: string;
  obs?: string;
  ts: string;
  usuario: string;
}
