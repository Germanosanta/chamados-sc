import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { ComponentType } from 'react';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppShell } from '@/layouts/AppShell';
import { ProtectedRoute } from '@/layouts/ProtectedRoute';
import { LoginPage } from '@/pages/login/LoginPage';
import { PortalPage } from '@/pages/portal/PortalPage';
import { HomePage } from '@/pages/home/HomePage';
import { AbertoPage } from '@/pages/aberto/AbertoPage';
import { ChamadosPage } from '@/pages/chamados/ChamadosPage';
import { NovoChamadoPage } from '@/pages/novo/NovoChamadoPage';
import { EncerradosPage } from '@/pages/encerrados/EncerradosPage';
import { CriticidadePage } from '@/pages/criticidade/CriticidadePage';
import { AreaTecnicoPage } from '@/pages/area-tecnico/AreaTecnicoPage';
import { EquipamentosPage } from '@/pages/equipamentos/EquipamentosPage';
import { FrotasPage } from '@/pages/frotas/FrotasPage';
import { PecasPage } from '@/pages/pecas/PecasPage';
import { KBPage } from '@/pages/kb/KBPage';
import { TecnicosPage } from '@/pages/tecnicos/TecnicosPage';
import { UsuariosPage } from '@/pages/usuarios/UsuariosPage';
import { ConfigPage } from '@/pages/config/ConfigPage';
import { AuditoriaPage } from '@/pages/auditoria/AuditoriaPage';
import { ResponsaveisPage } from '@/pages/responsaveis/ResponsaveisPage';
import { PlaceholderPage } from '@/pages/placeholder/PlaceholderPage';
import { SECTIONS, NAV_TOP, NAV_GROUPS, NAV_BOTOM, type SectionId } from '@/utils/sections';
import type { Permissao } from '@/types/permissoes';

/** Páginas 100% funcionais desta fase — o resto das rotas cai no mesmo
 * PlaceholderPage genérico (rota real, protegida, dentro do shell, sem
 * lógica ainda — ver Pendências no relatório). */
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
};

const PERM_BY_SECTION: Partial<Record<SectionId, Permissao>> = {};
for (const item of [...NAV_TOP, ...NAV_GROUPS.flatMap((g) => g.items), ...NAV_BOTOM]) {
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
      { path: '/portal', element: <PortalPage /> },
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
