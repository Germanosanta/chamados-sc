import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '@/store/session';
import { Loader2 } from 'lucide-react';

/** Layout da tela de login — se já há sessão ativa, pula direto pro
 * Portal (mesmo comportamento da V2: login-overlay nunca aparece por
 * cima de uma sessão já restaurada). */
export function AuthLayout() {
  const usuario = useSessionStore((s) => s.usuario);
  const carregando = useSessionStore((s) => s.carregando);

  if (carregando) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (usuario) return <Navigate to="/portal" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Outlet />
    </div>
  );
}
