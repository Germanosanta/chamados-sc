/** auditoria/{log_<timestamp>} — log append-only (cap de 2000 na V2,
 * mesma disciplina mantida aqui pelo lado do serviço, não do tipo). */
export interface Auditoria {
  id: string;
  ts: string;
  tipo: string;
  usuario: string;
  login?: string;
  detalhe?: string;
  chamado?: string;
}

/** configuracoes/{id} — coleção genérica de configuração; hoje usada
 * também pra Banco de Soluções via prefixo "kb__" (mesma convenção da
 * V2, ver services/firebase/firestore.ts). */
export interface ConfiguracaoDoc {
  id: string;
  __kind?: 'kb' | 'email' | string;
  [key: string]: unknown;
}

/** Banco de Soluções — persistido em `configuracoes/kb__{id}` (campos
 * conferidos contra equipamentos/index.js::salvarKB()). */
export interface SolucaoKB {
  id: string;
  problema: string;
  categoria: string;
  sistema?: string;
  solucao: string;
  materiais?: string;
  tempo?: string;
  obs?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}
