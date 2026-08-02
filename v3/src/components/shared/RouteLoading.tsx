import { Loader2 } from 'lucide-react';

/** Fallback do Suspense de rota (code splitting) — mostrado só durante o
 * download do chunk da tela (imperceptível em conexões normais, com
 * cache do browser depois do 1º acesso). */
export function RouteLoading() {
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
