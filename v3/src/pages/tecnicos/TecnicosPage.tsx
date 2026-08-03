import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Campo } from '@/components/shared/FormField';
import { useTecnicos, useSalvarTecnico } from '@/hooks/useTecnicos';
import { useChamados } from '@/hooks/useChamados';
import { isFechado } from '@/utils/chamado-helpers';
import type { Tecnico } from '@/types/tecnico';

/** Cadastro de Técnicos (RH) — portado de renderTecnicos()/salvarTec()
 * (config/index.js). Distinto de "Área do Técnico" (workspace pessoal):
 * esta é a tela administrativa de equipe, com ranking de performance. */
export function TecnicosPage() {
  const { data: tecnicos, carregando } = useTecnicos();
  const { data: chamados } = useChamados();
  const salvar = useSalvarTecnico();

  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Tecnico>>({});

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; encerrados: number; pendentes: number; somaDias: number; cntDias: number }>();
    for (const t of tecnicos) m.set(t.apelido || t.nome, { total: 0, encerrados: 0, pendentes: 0, somaDias: 0, cntDias: 0 });
    for (const c of chamados) {
      const nomes = (c.resp || '').split(',').map((n) => n.trim());
      for (const n of nomes) {
        const s = m.get(n);
        if (!s) continue;
        s.total++;
        if (isFechado(c)) {
          s.encerrados++;
          if (c.encerramento?.encerradoEm && c.data) {
            const dias = Math.round((new Date(c.encerramento.encerradoEm).getTime() - new Date(c.data + 'T00:00').getTime()) / 86400000);
            if (dias >= 0) {
              s.somaDias += dias;
              s.cntDias++;
            }
          }
        } else {
          s.pendentes++;
        }
      }
    }
    return m;
  }, [tecnicos, chamados]);

  const maisProdutivo = useMemo(() => {
    let melhor: { nome: string; encerrados: number } | null = null;
    for (const t of tecnicos) {
      const s = stats.get(t.apelido || t.nome);
      if (s && (!melhor || s.encerrados > melhor.encerrados)) melhor = { nome: t.nome, encerrados: s.encerrados };
    }
    return melhor?.nome || '—';
  }, [tecnicos, stats]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return tecnicos;
    return tecnicos.filter((t) => t.nome.toLowerCase().includes(q) || (t.apelido || '').toLowerCase().includes(q));
  }, [tecnicos, busca]);

  function abrirNovo() {
    setEditKey(null);
    setForm({ status: 'Ativo' });
    setOpen(true);
  }

  function abrirEditar(t: Tecnico) {
    setEditKey(t.key);
    setForm(t);
    setOpen(true);
  }

  async function handleSalvar() {
    if (!form.nome?.trim()) {
      toast.error('O nome completo é obrigatório.');
      return;
    }
    try {
      await salvar.mutateAsync({
        key: editKey,
        tecnico: {
          nome: form.nome.trim(),
          apelido: form.apelido?.trim() || '',
          telefone: form.telefone?.trim() || '',
          email: form.email?.trim() || '',
          area: form.area || '',
          cargo: form.cargo || '',
          status: (form.status as Tecnico['status']) || 'Ativo',
          admissao: form.admissao || '',
          obs: form.obs?.trim() || '',
        },
      });
      toast('✓ Técnico salvo no cadastro!');
      setOpen(false);
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  const columns: DataTableColumn<Tecnico>[] = [
    { key: 'nome', header: 'Nome', render: (t) => <span className="font-medium text-foreground">{t.nome}</span> },
    { key: 'apelido', header: 'Apelido', render: (t) => t.apelido || '—' },
    { key: 'area', header: 'Área', render: (t) => t.area || '—' },
    { key: 'cargo', header: 'Cargo', render: (t) => t.cargo || '—' },
    { key: 'status', header: 'Status', render: (t) => <Badge variant={t.status === 'Ativo' ? 'green' : t.status === 'Férias' ? 'amber' : 'neutral'}>{t.status}</Badge> },
    { key: 'total', header: 'Total', render: (t) => stats.get(t.apelido || t.nome)?.total ?? 0 },
    { key: 'encerrados', header: 'Encerrados', render: (t) => stats.get(t.apelido || t.nome)?.encerrados ?? 0 },
    { key: 'pendentes', header: 'Pendentes', render: (t) => stats.get(t.apelido || t.nome)?.pendentes ?? 0 },
    {
      key: 'tempo',
      header: 'Tempo Médio',
      render: (t) => {
        const s = stats.get(t.apelido || t.nome);
        return s?.cntDias ? `${(s.somaDias / s.cntDias).toFixed(1)}d` : '—';
      },
    },
    {
      key: 'acoes',
      header: 'Ações',
      render: (t) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); abrirEditar(t); }}>
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total" value={carregando ? '—' : tecnicos.length} color="blue" />
        <KpiCard label="Mais Produtivo" value={carregando ? '—' : maisProdutivo} color="green" />
        <KpiCard label="Ativos" value={carregando ? '—' : tecnicos.filter((t) => t.status === 'Ativo').length} color="amber" />
        <KpiCard label="Pendentes (total)" value={carregando ? '—' : [...stats.values()].reduce((a, s) => a + s.pendentes, 0)} color="purple" />
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, apelido…" className="w-56" />
        <Button className="ml-auto" size="sm" onClick={abrirNovo}>
          <Plus className="h-3.5 w-3.5" /> Novo Técnico
        </Button>
      </FilterBar>

      <DataTable columns={columns} rows={filtrados} rowKey={(t) => t.key} loading={carregando} emptyTitle="Nenhum técnico cadastrado" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editKey ? 'Editar Técnico' : 'Novo Técnico'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Nome completo *" htmlFor="tec-nome">
              <Input id="tec-nome" value={form.nome || ''} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </Campo>
            <Campo label="Apelido" htmlFor="tec-apelido">
              <Input id="tec-apelido" value={form.apelido || ''} onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value }))} placeholder="Usado como chave nos chamados" />
            </Campo>
            <Campo label="Telefone" htmlFor="tec-telefone">
              <Input id="tec-telefone" value={form.telefone || ''} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            </Campo>
            <Campo label="E-mail" htmlFor="tec-email">
              <Input id="tec-email" value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Campo>
            <Campo label="Área" htmlFor="tec-area">
              <Input id="tec-area" value={form.area || ''} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
            </Campo>
            <Campo label="Cargo" htmlFor="tec-cargo">
              <Input id="tec-cargo" value={form.cargo || ''} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} />
            </Campo>
            <Campo label="Status" htmlFor="tec-status">
              <Select value={form.status || 'Ativo'} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Tecnico['status'] }))}>
                <SelectTrigger id="tec-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Férias">Férias</SelectItem>
                  <SelectItem value="Afastado">Afastado</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Admissão" htmlFor="tec-admissao">
              <Input id="tec-admissao" type="date" value={form.admissao || ''} onChange={(e) => setForm((f) => ({ ...f, admissao: e.target.value }))} />
            </Campo>
          </div>
          <Campo label="Observações" htmlFor="tec-obs">
            <textarea
              id="tec-obs"
              value={form.obs || ''}
              onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
              rows={2}
              className="rounded-sm border border-border bg-muted p-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Campo>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
