import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection, type FirestoreCollectionState } from './useFirestoreCollection';
import { setMerge, excluirDocumento } from '@/services/firebase/firestore';
import { criarContaAuth } from '@/services/firebase/auth';
import { useSessionStore } from '@/store/session';
import type { Usuario } from '@/types';

export function useUsuarios(): FirestoreCollectionState<Usuario> {
  return useFirestoreCollection<Usuario>('usuarios');
}

export class SalvarUsuarioError extends Error {}

interface SalvarUsuarioInput {
  id: string | null;
  nome: string;
  login: string;
  email: string;
  senha: string;
  cargo: string;
  perfil: Usuario['perfil'];
  status: string;
  perms: Usuario['perms'];
  usuariosAtuais: Usuario[];
}

/**
 * Portado de salvarUsuario() (usuarios/index.js) — mesma validação
 * (login único, e-mail válido, senha ≥6 na criação), mesmo fluxo de
 * criação (Firebase Auth via app secundário → doc usuarios/{uid} →
 * doc logins/{login}) e de edição (atualiza usuarios/{id}, ressincroniza
 * logins/{login}, remove o login antigo se o login mudou).
 */
export function useSalvarUsuario() {
  const usuarioLogado = useSessionStore((s) => s.usuario);
  return useMutation({
    mutationFn: async (input: SalvarUsuarioInput) => {
      if (usuarioLogado?.perfil !== 'admin') throw new SalvarUsuarioError('Apenas administradores podem salvar usuários.');
      const { id, nome, login, email, senha, cargo, perfil, status, perms, usuariosAtuais } = input;
      if (!nome || !login || !email || (!id && !senha)) throw new SalvarUsuarioError('Nome, login, e-mail e senha são obrigatórios.');
      if (!id && senha.length < 6) throw new SalvarUsuarioError('A senha deve ter no mínimo 6 caracteres.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SalvarUsuarioError('E-mail inválido.');

      const loginLower = login.toLowerCase();
      if (usuariosAtuais.some((u) => u.login.toLowerCase() === loginLower && u.id !== id)) {
        throw new SalvarUsuarioError('Já existe um usuário com esse login.');
      }

      const dadosBase = { nome, login: loginLower, email, cargo, perfil, status, perms: perms?.length ? perms : undefined };

      if (id) {
        const antigo = usuariosAtuais.find((u) => u.id === id);
        await setMerge('usuarios', id, dadosBase);
        await setMerge('logins', loginLower, { email, uid: id });
        if (antigo && antigo.login !== loginLower) {
          await excluirDocumento('logins', antigo.login).catch(() => {});
        }
        return { id, ...dadosBase } as Usuario;
      }

      const uid = await criarContaAuth(email, senha);
      const extras = { criadoPor: usuarioLogado?.nome || 'Sistema', criadoEm: new Date().toISOString() };
      await setMerge('usuarios', uid, { ...dadosBase, ...extras });
      await setMerge('logins', loginLower, { email, uid });
      return { id: uid, ...dadosBase, ...extras } as Usuario;
    },
  });
}

export function useAlterarStatusUsuario() {
  return useMutation({
    mutationFn: async ({ usuario, status }: { usuario: Usuario; status: string }) => {
      // `id` não entra no payload — é só a chave do doc, mesma convenção
      // da V2 (ver _rewrapShadowed em firebase.js).
      const { id: _id, ...resto } = usuario;
      await setMerge('usuarios', usuario.id, { ...resto, status });
    },
  });
}
