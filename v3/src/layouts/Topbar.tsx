import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { NetworkStatus } from '@/components/shared/NetworkStatus';
import { GlobalSearch } from '@/components/shared/GlobalSearch';
import { Sidebar } from './Sidebar';
import { useSessionStore } from '@/store/session';
import { useUiStore } from '@/store/ui';
import { logout } from '@/services/firebase/auth';
import { PERFIL_LABEL } from '@/types/permissoes';
import { SUBS, TITLES, type SectionId } from '@/utils/sections';

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const usuario = useSessionStore((s) => s.usuario);
  const mobileMenuOpen = useUiStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useUiStore((s) => s.setMobileMenuOpen);

  const sectionId = location.pathname.replace('/', '') as SectionId;
  const title = TITLES[sectionId] || 'Central de Chamados';
  const sub = SUBS[sectionId];

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)}>
        <Menu className="h-4 w-4" />
      </Button>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar inSheet />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold text-foreground">{title}</div>
        {sub && <div className="hidden truncate text-sm text-muted-foreground sm:block">{sub}</div>}
      </div>

      <GlobalSearch />

      <Button size="sm" onClick={() => navigate('/novo')} title="Novo Chamado">
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Novo</span>
      </Button>

      <NetworkStatus />
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-muted">
            <Avatar>
              <AvatarFallback>{usuario ? iniciais(usuario.nome) : <User className="h-3.5 w-3.5" />}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-semibold text-foreground md:inline">{usuario?.nome.split(' ')[0]}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {usuario?.nome}
            <div className="text-xs font-normal normal-case text-subtle">
              {usuario ? PERFIL_LABEL[usuario.perfil] : ''}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
