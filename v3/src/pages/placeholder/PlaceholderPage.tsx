import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { TITLES, SUBS, type SectionId } from '@/utils/sections';

/**
 * Rota real, protegida por permissão, dentro do shell definitivo — não
 * é uma tela falsa/mockada. A lógica desta tela ainda não foi portada
 * da V2 (ver "Pendências" no relatório da Fase 1); quando entrar, ela vai
 * reaproveitar os componentes já prontos (DataTable, KpiCard, FilterBar,
 * Pagination, StatusBadge, etc.), do mesmo jeito que /aberto já faz hoje.
 */
export function PlaceholderPage() {
  const location = useLocation();
  const sectionId = location.pathname.replace('/', '') as SectionId;
  const title = TITLES[sectionId] || 'Em construção';
  const sub = SUBS[sectionId];

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-3 pt-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-bg text-warning">
            <Construction className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">{title}</div>
            {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
          </div>
          <p className="text-sm text-muted-foreground">
            Rota real, protegida por permissão, dentro do shell definitivo — a lógica desta tela ainda não foi
            portada da V2 nesta fase. Entra numa próxima entrega.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
