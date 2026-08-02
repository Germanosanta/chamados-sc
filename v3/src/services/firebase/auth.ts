import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { auth } from './app';
import { buscarPorCampo, getOne, setMerge } from './firestore';
import type { LoginLookup, Usuario } from '@/types';

export class LoginError extends Error {}

/**
 * Mesmo fluxo real da V2 (docs/js/modules/usuarios/index.js::doLogin):
 * 1. resolve "login" (não e-mail) → e-mail via a coleção pública `logins`
 *    (aceita digitar e-mail direto também);
 * 2. autentica de verdade no Firebase Auth;
 * 3. busca o doc de perfil em `usuarios/{uid}`, com fallback de
 *    autocorreção por e-mail se o uid não tiver doc (conta migrada/
 *    criada manualmente no console);
 * 4. exige status "Ativo".
 */
export async function loginComUsuarioOuEmail(loginOuEmail: string, senha: string): Promise<{ user: User; perfil: Usuario }> {
  let email = loginOuEmail;
  if (!loginOuEmail.includes('@')) {
    const lookup = await getOne<LoginLookup>('logins', loginOuEmail);
    if (lookup?.email) email = lookup.email;
  }

  const cred = await signInWithEmailAndPassword(auth, email, senha);
  // Força propagação do token antes de qualquer leitura Firestore —
  // evita erro de permissão por corrida logo após o signIn (mesma
  // proteção da V2).
  await cred.user.getIdToken(true);

  let perfil = await getOne<Usuario>('usuarios', cred.user.uid);
  if (!perfil) {
    perfil = await autocorrigirUsuarioPorEmail(cred.user.uid, email);
  }
  if (!perfil) {
    await fbSignOut(auth);
    throw new LoginError('Usuário autenticado, mas sem cadastro de perfil. Contate o administrador.');
  }

  if ((perfil.status || '').toLowerCase() !== 'ativo') {
    await fbSignOut(auth);
    throw new LoginError('Usuário inativo. Contate o administrador.');
  }

  return { user: cred.user, perfil };
}

/** Conta criada manualmente no console (uid não bate com nenhum doc em
 * `usuarios`) — busca por e-mail um doc antigo e clona perfil/status/perms
 * pro uid novo, marcando o antigo como migrado. Mesma lógica da V2. */
async function autocorrigirUsuarioPorEmail(uid: string, email: string): Promise<Usuario | null> {
  const candidatos = await buscarPorCampo<Usuario>('usuarios', 'email', email);
  const antigo = candidatos.find((c) => c.id !== uid);
  if (!antigo) return null;

  const novo: Usuario = {
    ...antigo,
    id: uid,
    migradoDeId: antigo.id,
  };
  await setMerge('usuarios', uid, novo);
  await setMerge('usuarios', antigo.id, { migrado: true, migradoParaUid: uid });
  return novo;
}

export async function logout(): Promise<void> {
  await fbSignOut(auth);
}

export async function trocarSenha(novaSenha: string): Promise<void> {
  if (!auth.currentUser) throw new LoginError('Sessão expirada — faça login novamente.');
  await updatePassword(auth.currentUser, novaSenha);
  await setMerge('usuarios', auth.currentUser.uid, { precisaTrocarSenha: false });
}

export async function enviarResetSenha(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}
