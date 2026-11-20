import { Suspense } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '@/store/session';
import { RouteLoading } from '@/components/shared/RouteLoading';
import { Loader2 } from 'lucide-react';

/** Layout da tela de login — se já há sessão ativa, pula direto pro
 * Portal (mesmo comportamento da V2: login-overlay nunca aparece por
 * cima de uma sessão já restaurada). */
export function AuthLayout() {
  const usuario = useSessionStore((s) => s.usuario);
  const carregando = useSessionStore((s) => s.carregando);

  if (carregando) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c1712]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (usuario) return <Navigate to="/portal" replace />;

  return (
    <div className="fundo-login relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Brilho sutil sobre a foto aérea dos pivôs (fundo-login, globals.css),
          mesma paleta institucional (verde escuro). */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(127,191,156,0.12),_transparent_45%),radial-gradient(circle_at_80%_75%,_rgba(127,191,156,0.10),_transparent_45%)]" />
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
