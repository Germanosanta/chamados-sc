import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFirestoreCollection, type FirestoreCollectionState } from './useFirestoreCollection';
import { setMerge, excluirDocumento } from '@/services/firebase/firestore';
import { criarContaAuth } from '@/services/firebase/auth';
import { useSessionStore } from '@/store/session';
import { normalizarNome } from '@/utils/chamado-helpers';
import type { Usuario } from '@/types';

/**
 * Causa raiz do "já existe usuário" ao editar (fase de homologação): a
 * migração automática pro Firebase Auth real (services/firebase/auth.ts,
 * mesma lógica de finalizarLogin() na V2) cria um NOVO doc
 * usuarios/{uid} e marca o doc ANTIGO como `migrado: true` — de
 * propósito, nunca apaga o doc antigo (é o mesmo comportamento da V2,
 * ver docs/js/modules/usuarios/index.js). Os dois docs continuam com o
 * mesmo `login`/`email`. A V2 já sabia disso e filtra: `getUsers()`
 * (usuarios/index.js) faz `list.filter(x=>!x.migrado)` antes de usar a
 * lista pra qualquer coisa — inclusive a checagem de duplicidade. A V3
 * portou a leitura da coleção mas esqueceu esse filtro: `useUsuarios()`
 * devolvia os dois docs, e a checagem de login único em
 * useSalvarUsuario (`u.id !== id`) via o doc antigo como um "outro
 * usuário com o mesmo login" e bloqueava a edição do usuário real.
 * Replicando o mesmo filtro da V2 aqui — na origem, pra nenhuma tela
 * precisar lembrar disso sozinha.
 *
 * "Todos os usuários aparecem duplicados" (relatado depois desse fix):
 * o filtro `migrado` cobre a causa mais comum, mas não cobre outros
 * jeitos de existir mais de um documento pra mesma pessoa (ex.: conta
 * recriada no Firebase Auth com um novo uid, mesmo e-mail; edição feita
 * direto no Console). Mesma solução já usada em técnicos
 * (useTecnicos.ts): agrupar por identidade (e-mail normalizado — é o
 * campo que o próprio Firebase Auth trata como único) e mostrar só 1
 * representante por grupo em toda a V3, sem apagar nenhum documento —
 * os grupos com mais de 1 doc ficam disponíveis à parte
 * (useUsuariosDuplicados) pra um admin decidir o que fazer.
 */
export interface UsuarioDuplicata {
  identidade: string;
  usuarios: (Usuario & { id: string })[];
}

function agruparPorIdentidade(data: (Usuario & { id: string })[]): {
  unicos: (Usuario & { id: string })[];
  duplicatas: UsuarioDuplicata[];
} {
  const grupos = new Map<string, (Usuario & { id: string })[]>();
  for (const u of data) {
    const identidade = normalizarNome(u.email || u.login || u.id);
    const lista = grupos.get(identidade);
    if (lista) lista.push(u);
    else grupos.set(identidade, [u]);
  }
  const unicos: (Usuario & { id: string })[] = [];
  const duplicatas: UsuarioDuplicata[] = [];
  for (const [identidade, lista] of grupos) {
    // Sem atualizadoEm em Usuario — mantém a ordem de chegada do
    // Firestore; o primeiro representante é só uma escolha estável, não
    // uma afirmação de qual conta é "a certa" (por isso o aviso de
    // duplicata sempre mostra todos os IDs, pra decisão humana).
    unicos.push(lista[0]);
    if (lista.length > 1) duplicatas.push({ identidade, usuarios: lista });
  }
  return { unicos, duplicatas };
}

export function useUsuarios(): FirestoreCollectionState<Usuario> {
  const { data, carregando, erro } = useFirestoreCollection<Usuario>('usuarios');
  const { unicos } = useMemo(() => {
    const ativos = data.filter((u) => !u.migrado);
    return agruparPorIdentidade(ativos);
  }, [data]);
  return { data: unicos, carregando, erro };
}

/**
 * Lista crua (só sem os docs `migrado`), sem o agrupamento por
 * identidade de `useUsuarios()` — exclusiva pra tela de Cadastro de
 * Usuários (UsuariosPage). Mesmo raciocínio de useTecnicosCadastro
 * (hooks/useTecnicos.ts): a tela onde um admin efetivamente gerencia
 * as contas não pode esconder um documento por trás de outro, senão
 * vira impossível editar/investigar exatamente o duplicado que precisa
 * de atenção. Em qualquer outro lugar (ex.: seletor de vínculo em
 * Técnicos), 1 representante por pessoa é o certo — por isso
 * `useUsuarios()` continua deduplicado pros demais consumidores.
 */
export function useUsuariosCadastro(): FirestoreCollectionState<Usuario> {
  const { data, carregando, erro } = useFirestoreCollection<Usuario>('usuarios');
  const ativos = useMemo(() => data.filter((u) => !u.migrado), [data]);
  return { data: ativos, carregando, erro };
}

/** Grupos de documentos que parecem ser o mesmo usuário cadastrado mais
 * de uma vez no Firestore — só leitura/diagnóstico, nunca apaga nada.
 * Mesmo padrão de useTecnicosDuplicados (hooks/useTecnicos.ts). */
export function useUsuariosDuplicados(): UsuarioDuplicata[] {
  const { data } = useFirestoreCollection<Usuario>('usuarios');
  return useMemo(() => {
    const ativos = data.filter((u) => !u.migrado);
    return agruparPorIdentidade(ativos).duplicatas;
  }, [data]);
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
  const usuarioLogado = useSessionStore((s) => s.usuario);
  return useMutation({
    mutationFn: async ({ usuario, status }: { usuario: Usuario; status: string }) => {
      // Mesma checagem de useSalvarUsuario: sem ela, o único bloqueio real
      // era a Firestore rule — um usuário sem perfil admin via botão
      // (visível a qualquer um com a permissão p_usuarios) clicava e só
      // via um erro genérico, sem entender por quê.
      if (usuarioLogado?.perfil !== 'admin') throw new SalvarUsuarioError('Apenas administradores podem alterar o status de usuários.');
      // `id` não entra no payload — é só a chave do doc, mesma convenção
      // da V2 (ver _rewrapShadowed em firebase.js).
      const { id: _id, ...resto } = usuario;
      await setMerge('usuarios', usuario.id, { ...resto, status });
    },
  });
}
