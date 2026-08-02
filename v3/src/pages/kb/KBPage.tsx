import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Campo } from '@/components/shared/FormField';
import { useBancoSolucoes, useSalvarSolucaoKB } from '@/hooks/useBancoSolucoes';
import type { SolucaoKB } from '@/types/auditoria';

/** Banco de Soluções — CRUD, portado de renderKB()/salvarKB()
 * (equipamentos/index.js). Alimentado também automaticamente pelo
 * encerramento de chamados (ver Pendências — integração ainda não
 * portada, pra não duplicar lógica de encerramento antes da hora). */
export function KBPage() {
  const { data: solucoes, carregando } = useBancoSolucoes();
  const salvar = useSalvarSolucaoKB();

  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<SolucaoKB | null>(null);
  const [form, setForm] = useState<Partial<SolucaoKB>>({});

  const categorias = useMemo(() => [...new Set(solucoes.map((k) => k.categoria).filter(Boolean))], [solucoes]);
  const topCategoria = useMemo(
    () => [...categorias].sort((a, b) => solucoes.filter((k) => k.categoria === b).length - solucoes.filter((k) => k.categoria === a).length)[0] || '—',
    [categorias, solucoes],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return solucoes;
    return solucoes.filter((k) => k.problema.toLowerCase().includes(q) || k.solucao.toLowerCase().includes(q));
  }, [solucoes, busca]);

  function abrirNova() {
    setEditando(null);
    setForm({});
    setOpen(true);
  }

  function abrirEditar(k: SolucaoKB) {
    setEditando(k);
    setForm(k);
    setOpen(true);
  }

  async function handleSalvar() {
    if (!form.problema?.trim() || !form.categoria || !form.solucao?.trim()) {
      toast.error('Preencha Problema, Categoria e Solução.');
      return;
    }
    const entry: SolucaoKB = {
      id: editando?.id || `kb${Date.now()}`,
      problema: form.problema.trim(),
      categoria: form.categoria,
      sistema: form.sistema || '',
      solucao: form.solucao.trim(),
      materiais: form.materiais?.trim() || '',
      tempo: form.tempo || '',
      obs: form.obs?.trim() || '',
      criadoEm: editando?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    try {
      await salvar.mutateAsync(entry);
      toast('Solução salva no Banco de Soluções!');
      setOpen(false);
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  const columns: DataTableColumn<SolucaoKB>[] = [
    { key: 'problema', header: 'Problema', render: (k) => <span className="max-w-[220px] truncate font-medium text-foreground">{k.problema}</span> },
    { key: 'categoria', header: 'Categoria', render: (k) => k.categoria },
    { key: 'sistema', header: 'Sistema', render: (k) => k.sistema || '—' },
    { key: 'solucao', header: 'Solução', render: (k) => <span className="max-w-[260px] truncate">{k.solucao}</span> },
    { key: 'tempo', header: 'Tempo', render: (k) => k.tempo || '—' },
    {
      key: 'acoes',
      header: 'Ações',
      render: (k) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); abrirEditar(k); }}>
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Total de Soluções" value={carregando ? '—' : solucoes.length} color="blue" />
        <KpiCard label="Categorias" value={categorias.length} color="green" />
        <KpiCard label="Mais Frequente" value={topCategoria} color="amber" />
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar problema, solução…" className="w-64" />
        <Button className="ml-auto" size="sm" onClick={abrirNova}>
          <Plus className="h-3.5 w-3.5" /> Nova Solução
        </Button>
      </FilterBar>

      <DataTable columns={columns} rows={filtradas} rowKey={(k) => k.id} loading={carregando} emptyTitle="Nenhuma solução cadastrada" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Solução' : 'Nova Solução'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Campo label="Problema *" htmlFor="kb-problema">
              <Input id="kb-problema" value={form.problema || ''} onChange={(e) => setForm((f) => ({ ...f, problema: e.target.value }))} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Categoria *" htmlFor="kb-categoria">
                <Input id="kb-categoria" value={form.categoria || ''} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
              </Campo>
              <Campo label="Sistema" htmlFor="kb-sistema">
                <Input id="kb-sistema" value={form.sistema || ''} onChange={(e) => setForm((f) => ({ ...f, sistema: e.target.value }))} />
              </Campo>
            </div>
            <Campo label="Solução *" htmlFor="kb-solucao">
              <textarea
                id="kb-solucao"
                value={form.solucao || ''}
                onChange={(e) => setForm((f) => ({ ...f, solucao: e.target.value }))}
                rows={3}
                className="rounded-sm border border-border bg-muted p-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Materiais" htmlFor="kb-materiais">
                <Input id="kb-materiais" value={form.materiais || ''} onChange={(e) => setForm((f) => ({ ...f, materiais: e.target.value }))} />
              </Campo>
              <Campo label="Tempo médio" htmlFor="kb-tempo">
                <Input id="kb-tempo" value={form.tempo || ''} onChange={(e) => setForm((f) => ({ ...f, tempo: e.target.value }))} />
              </Campo>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
