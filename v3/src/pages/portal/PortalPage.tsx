import { useNavigate } from 'react-router-dom';
import { Droplets, Tractor } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useSessionStore } from '@/store/session';
import { logout } from '@/services/firebase/auth';
import logo from '@/assets/img/coa.jpeg';

const MODULOS = [
  {
    id: 'campo',
    icon: Tractor,
    title: 'Chamados de Campo',
    desc: 'Manutenção, monitoramento e suporte de equipamentos em campo.',
    path: '/home',
    ativo: true,
  },
  {
    id: 'irrigacao',
    icon: Droplets,
    title: 'Chamados de Irrigação',
    desc: 'Gestão de chamados do sistema de irrigação.',
    path: '/irrigacao',
    ativo: false,
  },
];

/** Portal de módulos — 2 cards (Chamados de Campo ativo, Irrigação "Em
 * breve" com rota real por trás, ver PlaceholderPage). O módulo "Chips de
 * Abastecimento" existia aqui só como card placeholder ("Em breve", sem
 * nenhuma página/lógica por trás) e foi removido na fase de estabilização
 * — a área de Tecnologia não é mais responsável por ele (decisão de
 * escopo do produto, não técnica). */
export function PortalPage() {
  const navigate = useNavigate();
  const usuario = useSessionStore((s) => s.usuario);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src={logo} alt="Santa Colomba" className="h-auto w-full max-w-[260px] object-contain" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Tecnologia</h1>
          <p className="text-sm text-muted-foreground">
            Olá, {usuario?.nome.split(' ')[0]} — escolha um módulo para continuar
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {MODULOS.map((m) => (
          <button
            key={m.id}
            onClick={() => navigate(m.path)}
            className={cn(
              'group flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 text-center shadow-sm transition',
              'hover:-translate-y-0.5 hover:border-primary hover:shadow',
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary-text">
              <m.icon className="h-6 w-6" />
            </div>
            <div className="text-base font-bold text-foreground">{m.title}</div>
            <p className="text-sm text-muted-foreground">{m.desc}</p>
            {!m.ativo && (
              <span className="rounded-full bg-surface3 px-2.5 py-0.5 text-xs font-semibold text-subtle">Em breve</span>
            )}
          </button>
        ))}
      </div>

      <button onClick={handleLogout} className="text-sm text-muted-foreground hover:text-primary">
        Sair
      </button>
    </div>
  );
}
