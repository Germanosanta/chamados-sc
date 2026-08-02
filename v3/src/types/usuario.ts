import type { Perfil, Permissao } from './permissoes';

/** usuarios/{uid} — chave do doc é o uid do Firebase Auth. Campo `senha`
 * nunca existe aqui (a V2 remove explicitamente antes de gravar — a
 * senha vive só no Firebase Auth, não no Firestore). */
export interface Usuario {
  id: string; // = uid
  nome: string;
  login: string;
  email: string;
  perfil: Perfil;
  status: 'Ativo' | 'Inativo' | string;
  cargo?: string;
  /** override explícito — se ausente, usa permsPadrao(perfil) */
  perms?: Permissao[];
  precisaTrocarSenha?: boolean;
  migrado?: boolean;
  migradoParaUid?: string;
  migradoDeId?: string;
  fcmToken?: string;
}

/** logins/{loginId} — coleção pública auxiliar, login (texto curto) →
 * e-mail real, usada pra resolver login antes de autenticar. */
export interface LoginLookup {
  email: string;
  uid?: string;
}
