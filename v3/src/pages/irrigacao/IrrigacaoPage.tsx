import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Droplets, LayoutDashboard, LogOut, PlusCircle, Settings, Tractor } from 'lucide-react';
import { logout } from '@/services/firebase/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useSessionStore } from '@/store/session';
import { cn } from '@/utils/cn';
import { PainelIrrigacao } from './PainelIrrigacao';
import { NovoChamadoIrrigacao } from './NovoChamadoIrrigacao';
import { IndicadoresIrrigacao } from './IndicadoresIrrigacao';
import { ConfigIrrigacao } from './ConfigIrrigacao';
import { ChamadoIrrigacaoDialog } from './ChamadoIrrigacaoDialog';

type Aba = 'painel' | 'novo' | 'indicadores' | 'config';

/**
 * Módulo Chamados de Irrigação — falhas de comunicação da telemetria.
 * Layout próprio (fora do AppShell dos chamados de campo) para os dois
 * módulos nunca se misturarem na navegação; mesmo visual da Central de
 * Tecnologia. Acesso exige p_chamados (mesma regra da lista de campo).
 */
export function IrrigacaoPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const usuario = useSessionStore((s) => s.usuario);
  const temPermissao = useSessionStore((s) => s.temPermissao);
  const [aberto, setAberto] = useState<string | null>(null);

  async function sair() {
    await logout();
    navigate('/login', { replace: true });
  }

  const abas: { id: Aba; label: string; icon: typeof Droplets; visivel: boolean }[] = [
    { id: 'painel', label: 'Painel', icon: LayoutDashboard, visivel: true },
    { id: 'novo', label: 'Novo chamado', icon: PlusCircle, visivel: temPermissao('p_novo') },
    { id: 'indicadores', label: 'Indicadores', icon: BarChart3, visivel: true },
    { id: 'config', label: 'Ativos e configurações', icon: Settings, visivel: true },
  ];
  const pedida = params.get('aba') as Aba | null;
  const aba: Aba = abas.some((a) => a.id === pedida && a.visivel) ? (pedida as Aba) : 'painel';
  const irPara = (id: Aba) => setParams(id === 'painel' ? {} : { aba: id }, { replace: true });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal')} aria-label="Voltar para a Central de Tecnologia" title="Central de Tecnologia">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-primary-text">
            <Droplets className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-foreground">Chamados de Irrigação</h1>
            <p className="truncate text-xs text-muted-foreground">Falhas de comunicação da telemetria · {usuario?.nome}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/home')} title="Ir para Chamados de Campo" aria-label="Ir para Chamados de Campo">
            <Tractor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Chamados de Campo</span>
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={sair} title="Sair" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4" aria-label="Seções do módulo de irrigação">
          {abas
            .filter((a) => a.visivel)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => irPara(a.id)}
                aria-current={aba === a.id ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition',
                  aba === a.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <a.icon className="h-4 w-4" />
                {a.label}
              </button>
            ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        {aba === 'painel' && <PainelIrrigacao onAbrir={setAberto} />}
        {aba === 'novo' && (
          <NovoChamadoIrrigacao
            onCriado={(num) => {
              irPara('painel');
              setAberto(num);
            }}
          />
        )}
        {aba === 'indicadores' && <IndicadoresIrrigacao onAbrir={setAberto} />}
        {aba === 'config' && <ConfigIrrigacao />}
      </main>

      <ChamadoIrrigacaoDialog num={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}
