import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestoreCollection } from '@/hooks/useFirestoreCollection';
import { downloadCSV } from '@/utils/csv';
import type { Auditoria } from '@/types/auditoria';
import type { VariantProps } from 'class-variance-authority';

const TYPE_LABELS: Record<string, string> = {
  abriu: 'Abertura',
  encerrou: 'Encerramento',
  reabriu: 'Reabertura',
  assumiu: 'Assunção',
  login: 'Login',
  logout: 'Logout',
  editou: 'Edição',
};

const TYPE_VARIANTS: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
  abriu: 'green',
  encerrou: 'graos',
  reabriu: 'amber',
  assumiu: 'amber',
  login: 'purple',
  logout: 'neutral',
  editou: 'neutral',
};

/** Auditoria / Logs — portado de renderAuditoria()/exportAuditCSV()
 * (relatorios/index.js): mesmo log global de audit(), mais recentes
 * primeiro, mesmos 3 filtros. */
export function AuditoriaPage() {
  const { data: logsRaw, carregando } = useFirestoreCollection<Auditoria>('auditoria');

  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [login, setLogin] = useState('');

  const logs = useMemo(() => [...logsRaw].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')), [logsRaw]);
  const usuarios = useMemo(() => [...new Set(logs.map((l) => l.login).filter(Boolean))], [logs]);
  const tipos = useMemo(() => [...new Set(logs.map((l) => l.tipo).filter(Boolean))], [logs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return logs.filter((l) => {
      if (q && !(l.detalhe || '').toLowerCase().includes(q) && !(l.chamado || '').toLowerCase().includes(q)) return false;
      if (tipo && l.tipo !== tipo) return false;
      if (login && l.login !== login) return false;
      return true;
    });
  }, [logs, busca, tipo, login]);

  function exportar() {
    downloadCSV('auditoria_santa_colomba.csv', [
      ['Data/Hora', 'Usuário', 'Login', 'Tipo', 'Chamado', 'Detalhe'],
      ...filtrados.map((l) => [l.ts, l.usuario || '', l.login || '', l.tipo || '', l.chamado || '', l.detalhe || '']),
    ]);
  }

  const columns: DataTableColumn<Auditoria>[] = [
    { key: 'ts', header: 'Data/Hora', render: (l) => <span className="font-mono-num text-sm">{new Date(l.ts).toLocaleString('pt-BR')}</span> },
    { key: 'usuario', header: 'Usuário', render: (l) => <span className="font-medium text-foreground">{l.usuario}</span> },
    { key: 'tipo', header: 'Tipo', render: (l) => <Badge variant={TYPE_VARIANTS[l.tipo] || 'neutral'}>{TYPE_LABELS[l.tipo] || l.tipo}</Badge> },
    { key: 'chamado', header: 'Chamado', render: (l) => l.chamado || '—' },
    { key: 'detalhe', header: 'Detalhe', render: (l) => <span className="max-w-[360px] truncate">{l.detalhe}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar detalhe, chamado…" className="w-64" />
        <Select value={tipo || 'todos'} onValueChange={(v) => setTipo(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo tipo</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={login || 'todos'} onValueChange={(v) => setLogin(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo usuário</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" className="ml-auto" onClick={exportar}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </FilterBar>

      <DataTable columns={columns} rows={filtrados.slice(0, 200)} rowKey={(l) => l.id} loading={carregando} emptyTitle="Nenhum log encontrado" />
      {filtrados.length > 200 && <p className="text-center text-sm text-subtle">Mostrando os 200 mais recentes de {filtrados.length.toLocaleString('pt-BR')}.</p>}
    </div>
  );
}
