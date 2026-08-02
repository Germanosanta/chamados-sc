import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '@/store/session';
import type { Permissao } from '@/types/permissoes';
import { Loader2 } from 'lucide-react';

/** Guard de rota — exige sessão ativa e, opcionalmente, uma permissão
 * específica (mesma tabela PERFIL_PERMS usada nas regras do Firestore).
 * Sem sessão → /login. Sem permissão → volta pra Início (mesmo padrão de
 * aplicarNavPerms() da V2, que escondia o item de menu). */
export function ProtectedRoute({ perm }: { perm?: Permissao }) {
  const usuario = useSessionStore((s) => s.usuario);
  const carregando = useSessionStore((s) => s.carregando);
  const temPermissao = useSessionStore((s) => s.temPermissao);

  if (carregando) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (perm && !temPermissao(perm)) return <Navigate to="/home" replace />;

  return <Outlet />;
}
