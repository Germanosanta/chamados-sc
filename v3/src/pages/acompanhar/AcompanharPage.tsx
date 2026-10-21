import { useParams } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useAcompanhamentoPublico } from '@/hooks/useAcompanhamentoPublico';
import type { StatusPublico } from '@/utils/acompanhamentoPublico';
import logo from '@/assets/img/coa.jpeg';

const BADGE_POR_STATUS: Record<StatusPublico, BadgeProps['variant']> = {
  Aberto: 'amber',
  'Em atendimento': 'purple',
  Fechado: 'green',
};

function formatarDataHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Consulta pública de chamado — rota standalone `/acompanhar/:token`
 * (router.tsx), fora de AuthLayout/ProtectedRoute: não exige login nem
 * cadastro, e não redireciona quem já está logado (um técnico/admin
 * também pode querer abrir o mesmo link que foi compartilhado com o
 * solicitante, pra ver exatamente o que ele vê).
 *
 * Só lê o espelho público (`acompanhamento_publico/{token}`, ver
 * utils/acompanhamentoPublico.ts) — nunca o documento completo do
 * chamado. O número sozinho na URL nunca seria suficiente: é o token
 * (parte da própria URL, não adivinhável) que autoriza a leitura via
 * firestore.rules.
 */
export function AcompanharPage() {
  const { token } = useParams<{ token: string }>();
  const estado = useAcompanhamentoPublico(token);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_#1c3a2e,_#0c1712_70%)] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(127,191,156,0.12),_transparent_45%),radial-gradient(circle_at_80%_75%,_rgba(127,191,156,0.10),_transparent_45%)]" />
      <Card className="w-full max-w-md rounded-xl shadow-xl">
        <CardHeader className="items-center text-center">
          <img src={logo} alt="Santa Colomba" className="mb-2 h-auto w-full max-w-[200px] object-contain" />
          <CardTitle>Acompanhar Chamado</CardTitle>
          <CardDescription>Central de Chamados — Santa Colomba Agropecuária</CardDescription>
        </CardHeader>
        <CardContent>
          {estado.status === 'carregando' && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Consultando chamado…</p>
            </div>
          )}

          {estado.status === 'nao-encontrado' && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 opacity-50" />
              <p className="text-sm font-semibold text-foreground">Link de acompanhamento inválido</p>
              <p className="text-sm">
                Não encontramos nenhum chamado com este link. Confira se o endereço foi copiado por completo ou peça um
                novo comprovante a quem abriu o chamado.
              </p>
            </div>
          )}

          {estado.status === 'erro' && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <p className="text-sm font-semibold text-destructive">Não foi possível consultar o chamado agora</p>
              <p className="text-sm">Verifique sua conexão e tente novamente em instantes.</p>
            </div>
          )}

          {estado.status === 'encontrado' && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-num text-base font-bold text-foreground">{estado.dados.num}</span>
                <Badge variant={BADGE_POR_STATUS[estado.dados.status]}>{estado.dados.status}</Badge>
              </div>

              <div className="flex flex-col gap-1 rounded-sm border border-border bg-muted p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Assunto</span>
                <span className="text-foreground">{estado.dados.assunto}</span>
                {estado.dados.setor && <span className="text-xs text-muted-foreground">{estado.dados.setor}</span>}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Abertura</span>
                  <span className="text-foreground">{formatarDataHora(estado.dados.abertoEm)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Última atualização</span>
                  <span className="text-foreground">{formatarDataHora(estado.dados.atualizadoEm)}</span>
                </div>
                {estado.dados.encerradoEm && (
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Encerramento</span>
                    <span className="text-foreground">{formatarDataHora(estado.dados.encerradoEm)}</span>
                  </div>
                )}
              </div>

              <p className="mt-1 text-center text-xs text-subtle">
                Esta página se atualiza automaticamente conforme o andamento do atendimento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
