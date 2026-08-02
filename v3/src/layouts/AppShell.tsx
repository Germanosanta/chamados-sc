import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CentroOperacionalModal } from '@/components/shared/CentroOperacionalModal';
import { RouteLoading } from '@/components/shared/RouteLoading';

/** Shell definitivo — sidebar recolhível + topbar, aplicado a TODAS as
 * rotas protegidas (as já portadas e as ainda "em construção"). O Centro
 * Operacional é montado 1x aqui (singleton, igual ao #modal-detalhe da
 * V2) — qualquer tela abre o mesmo modal via useDetalheStore.abrir(num). */
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Suspense fallback={<RouteLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CentroOperacionalModal />
    </div>
  );
}
