import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ComponentType } from 'react';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppShell } from '@/layouts/AppShell';
import { ProtectedRoute } from '@/layouts/ProtectedRoute';
import { RouteLoading } from '@/components/shared/RouteLoading';
import { SECTIONS, NAV_TOP, NAV_GROUPS, NAV_BOTTOM, type SectionId } from '@/utils/sections';
import type { Permissao } from '@/types/permissoes';

const LoginPage = lazy(() => import('@/pages/login/LoginPage').then((m) => ({ default: m.LoginPage })));
const PortalPage = lazy(() => import('@/pages/portal/PortalPage').then((m) => ({ default: m.PortalPage })));
const HomePage = lazy(() => import('@/pages/home/HomePage').then((m) => ({ default: m.HomePage })));
const AbertoPage = lazy(() => import('@/pages/aberto/AbertoPage').then((m) => ({ default: m.AbertoPage })));
const ChamadosPage = lazy(() => import('@/pages/chamados/ChamadosPage').then((m) => ({ default: m.ChamadosPage })));
const NovoChamadoPage = lazy(() => import('@/pages/novo/NovoChamadoPage').then((m) => ({ default: m.NovoChamadoPage })));
const EncerradosPage = lazy(() => import('@/pages/encerrados/EncerradosPage').then((m) => ({ default: m.EncerradosPage })));
const CriticidadePage = lazy(() => import('@/pages/criticidade/CriticidadePage').then((m) => ({ default: m.CriticidadePage })));
const AreaTecnicoPage = lazy(() => import('@/pages/area-tecnico/AreaTecnicoPage').then((m) => ({ default: m.AreaTecnicoPage })));
const EquipamentosPage = lazy(() => import('@/pages/equipamentos/EquipamentosPage').then((m) => ({ default: m.EquipamentosPage })));
const FrotasPage = lazy(() => import('@/pages/frotas/FrotasPage').then((m) => ({ default: m.FrotasPage })));
const PecasPage = lazy(() => import('@/pages/pecas/PecasPage').then((m) => ({ default: m.PecasPage })));
const KBPage = lazy(() => import('@/pages/kb/KBPage').then((m) => ({ default: m.KBPage })));
const TecnicosPage = lazy(() => import('@/pages/tecnicos/TecnicosPage').then((m) => ({ default: m.TecnicosPage })));
const UsuariosPage = lazy(() => import('@/pages/usuarios/UsuariosPage').then((m) => ({ default: m.UsuariosPage })));
const ConfigPage = lazy(() => import('@/pages/config/ConfigPage').then((m) => ({ default: m.ConfigPage })));
const AuditoriaPage = lazy(() => import('@/pages/auditoria/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage })));
const ResponsaveisPage = lazy(() => import('@/pages/responsaveis/ResponsaveisPage').then((m) => ({ default: m.ResponsaveisPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const PainelPage = lazy(() => import('@/pages/painel/PainelPage').then((m) => ({ default: m.PainelPage })));
const PorMesPage = lazy(() => import('@/pages/pormes/PorMesPage').then((m) => ({ default: m.PorMesPage })));
const PlaceholderPage = lazy(() => import('@/pages/placeholder/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })));

/** Páginas 100% funcionais desta fase — o resto das rotas cai no mesmo
 * PlaceholderPage genérico (rota real, protegida, dentro do shell, sem
 * lógica ainda — ver Pendências no relatório). Todas carregadas via
 * React.lazy: cada tela vira seu próprio chunk (code splitting), só
 * baixado quando o usuário navega até ela; o Suspense de cada layout
 * (AuthLayout/AppShell) cobre o tempo de download com um fallback leve. */
const REAL_PAGES: Partial<Record<SectionId, ComponentType>> = {
  home: HomePage,
  aberto: AbertoPage,
  chamados: ChamadosPage,
  novo: NovoChamadoPage,
  encerrados: EncerradosPage,
  criticidade: CriticidadePage,
  'area-tecnico': AreaTecnicoPage,
  equipamentos: EquipamentosPage,
  frotas: FrotasPage,
  pecas: PecasPage,
  kb: KBPage,
  tecnicos: TecnicosPage,
  usuarios: UsuariosPage,
  config: ConfigPage,
  auditoria: AuditoriaPage,
  responsaveis: ResponsaveisPage,
  dashboard: DashboardPage,
  painel: PainelPage,
  pormes: PorMesPage,
};

const PERM_BY_SECTION: Partial<Record<SectionId, Permissao>> = {};
for (const item of [...NAV_TOP, ...NAV_GROUPS.flatMap((g) => g.items), ...NAV_BOTTOM]) {
  if (item.perm) PERM_BY_SECTION[item.id] = item.perm;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/home" replace /> },
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/portal',
        element: (
          <Suspense fallback={<RouteLoading />}>
            <PortalPage />
          </Suspense>
        ),
      },
      {
        element: <AppShell />,
        children: SECTIONS.map((id) => {
          const Page = REAL_PAGES[id] ?? PlaceholderPage;
          const perm = PERM_BY_SECTION[id];
          const route = { path: `/${id}`, element: <Page /> };
          return perm ? { element: <ProtectedRoute perm={perm} />, children: [route] } : route;
        }),
      },
    ],
  },
  { path: '*', element: <Navigate to="/home" replace /> },
]);
