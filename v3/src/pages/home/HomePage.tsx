import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Grid3x3, User2, Wrench } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChamados, useAbertos } from '@/hooks/useChamados';
import { diasAberto, formatDataBR } from '@/utils/chamado-helpers';
import { useSessionStore } from '@/store/session';
import { useDetalheStore } from '@/store/detalhe';

const ATALHOS = [
  { icon: ClipboardList, label: 'Novo Chamado', path: '/novo' },
  { icon: Wrench, label: 'Equipamentos', path: '/equipamentos' },
  { icon: Grid3x3, label: 'Kanban', path: '/aberto' },
  { icon: User2, label: 'Área do Técnico', path: '/area-tecnico' },
  { icon: AlertTriangle, label: 'Relatórios', path: '/pormes' },
];

/** Equivalente a renderHome() da V2 — mesmos cálculos (computeStats
 * simplificado: KPIs clicáveis, críticos, últimas atividades, atalhos). */
export function HomePage() {
  const navigate = useNavigate();
  const usuario = useSessionStore((s) => s.usuario);
  const abrirDetalhe = useDetalheStore((s) => s.abrir);
  const { data: todos, carregando: carregandoTodos } = useChamados();
  const { data: abertos, carregando } = useAbertos();

  const stats = useMemo(() => {
    const criticos = abertos.filter((c) => c.prior === 'Urgente');
    const slaVencendo = abertos.filter((c) => diasAberto(c.data) > 7);
    const emAtendimento = abertos.filter((c) => c.status === 'Em Atendimento' || c.status === 'Em Andamento');
    return { criticos, slaVencendo, emAtendimento };
  }, [abertos]);

  const ultimasAtividades = useMemo(
    () => [...todos].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 5),
    [todos],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Olá, {usuario?.nome.split(' ')[0]} 👋</h1>
        <p className="text-sm text-muted-foreground">Aqui está o panorama operacional de agora.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Em Aberto" value={carregando ? '—' : abertos.length} color="red" onClick={() => navigate('/aberto')} />
        <KpiCard
          label="Críticos"
          value={carregando ? '—' : stats.criticos.length}
          color="amber"
          onClick={() => navigate('/criticidade')}
        />
        <KpiCard
          label="SLA Vencendo (+7d)"
          value={carregando ? '—' : stats.slaVencendo.length}
          color="purple"
          onClick={() => navigate('/aberto')}
        />
        <KpiCard label="Em Atendimento" value={carregando ? '—' : stats.emAtendimento.length} color="blue" onClick={() => navigate('/aberto')} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>🚨 Chamados Críticos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {carregando &&
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            {!carregando && stats.criticos.length === 0 && <EmptyState title="Nenhum chamado crítico agora" />}
            {!carregando &&
              stats.criticos.slice(0, 5).map((c) => (
                <button
                  key={c.num}
                  onClick={() => abrirDetalhe(c.num)}
                  className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-base hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="font-mono-num font-semibold text-primary">{c.num}</span>{' '}
                    <span className="truncate text-muted-foreground">{c.titulo}</span>
                  </span>
                  <StatusBadge status={c.status} />
                </button>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📋 Últimas Atividades</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {carregandoTodos &&
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            {!carregandoTodos &&
              ultimasAtividades.map((c) => (
                <button
                  key={c.num}
                  onClick={() => abrirDetalhe(c.num)}
                  className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-base hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="font-mono-num font-semibold text-primary">{c.num}</span>{' '}
                    <span className="truncate text-muted-foreground">{c.titulo}</span>
                  </span>
                  <span className="whitespace-nowrap text-sm text-subtle">{formatDataBR(c.data)}</span>
                </button>
              ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Atalhos rápidos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ATALHOS.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow"
            >
              <a.icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
