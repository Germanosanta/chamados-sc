/** tecnicos/{key} — fonte única dos seletores de Responsável/Técnico em
 * todo o sistema (equivalente a _tecnicosAtivos() da V2). */
export interface Tecnico {
  key: string;
  nome: string;
  apelido?: string;
  telefone?: string;
  email?: string;
  area?: string;
  cargo?: string;
  status: 'Ativo' | 'Inativo' | 'Férias' | 'Afastado';
  admissao?: string;
  obs?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}
