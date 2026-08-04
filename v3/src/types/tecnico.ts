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
  /** Vínculo oficial com a conta de login correspondente (usuarios/{uid})
   * — única fonte de identidade usada em autorização. nome/apelido/email
   * continuam existindo aqui só para cadastro/exibição (RH), nunca mais
   * para identificar alguém em uma decisão de permissão. Preenchido pelo
   * seletor de usuário no cadastro (nunca digitado à mão) ou pela
   * migração automática (ver hooks/useTecnicos.ts). */
  usuarioUid?: string | null;
}
