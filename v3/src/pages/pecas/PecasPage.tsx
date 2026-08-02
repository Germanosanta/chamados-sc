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
import { usePecas, useMovimentacoes, useSalvarPeca, useRegistrarMovimentacao } from '@/hooks/usePecas';
import type { Peca } from '@/types/peca';

/** Peças e Estoque — CRUD + movimentação de entrada/saída, portado de
 * salvarPeca()/registrarMovimentacao() (equipamentos/index.js). */
export function PecasPage() {
  const { data: pecas, carregando } = usePecas();
  const { data: movs } = useMovimentacoes();
  const salvar = useSalvarPeca();
  const movimentar = useRegistrarMovimentacao();

  const [busca, setBusca] = useState('');
  const [crudOpen, setCrudOpen] = useState(false);
  const [editando, setEditando] = useState<Peca | null>(null);
  const [form, setForm] = useState<Partial<Peca>>({});

  const [movOpen, setMovOpen] = useState(false);
  const [movPeca, setMovPeca] = useState<Peca | null>(null);
  const [movTipo, setMovTipo] = useState<'entrada' | 'saida'>('entrada');
  const [movQtd, setMovQtd] = useState(1);
  const [movObs, setMovObs] = useState('');
  const [movChamado, setMovChamado] = useState('');

  const baixoEstoque = useMemo(() => pecas.filter((p) => Number(p.qtd) <= Number(p.minimo || 2)), [pecas]);
  const maisConsumida = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const m of movs) if (m.tipo === 'saida') contagem.set(m.pecaNome, (contagem.get(m.pecaNome) || 0) + m.qtd);
    return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [movs]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pecas;
    return pecas.filter((p) => p.nome.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q));
  }, [pecas, busca]);

  function abrirNovo() {
    setEditando(null);
    setForm({ unidade: 'un', minimo: 2 });
    setCrudOpen(true);
  }

  function abrirEditar(p: Peca) {
    setEditando(p);
    setForm(p);
    setCrudOpen(true);
  }

  async function handleSalvar() {
    if (!form.nome?.trim()) {
      toast.error('Informe o nome da peça.');
      return;
    }
    const peca: Peca = {
      id: editando?.id || `p${Date.now()}`,
      nome: form.nome.trim(),
      qtd: Number(form.qtd) || 0,
      codigo: form.codigo?.trim() || '',
      categoria: form.categoria || '',
      unidade: form.unidade || 'un',
      minimo: Number(form.minimo) || 2,
      local: form.local?.trim() || '',
      fornecedor: form.fornecedor?.trim() || '',
      obs: form.obs?.trim() || '',
      criadoEm: editando?.criadoEm || new Date().toISOString(),
    };
    try {
      await salvar.mutateAsync(peca);
      toast('Peça salva no estoque!');
      setCrudOpen(false);
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  function abrirMovimentacao(p: Peca) {
    setMovPeca(p);
    setMovTipo('entrada');
    setMovQtd(1);
    setMovObs('');
    setMovChamado('');
    setMovOpen(true);
  }

  async function handleMovimentar() {
    if (!movPeca || !movQtd) {
      toast.error('Informe a quantidade.');
      return;
    }
    try {
      await movimentar.mutateAsync({ peca: movPeca, tipo: movTipo, qtd: movQtd, obs: movObs.trim(), chamado: movChamado.trim() });
      toast(`✓ ${movTipo === 'entrada' ? 'Entrada' : 'Saída'} de ${movQtd} ${movPeca.nome} registrada.`);
      setMovOpen(false);
    } catch {
      toast.error('Não foi possível registrar a movimentação.');
    }
  }

  const columns: DataTableColumn<Peca>[] = [
    { key: 'nome', header: 'Nome', render: (p) => <span className="font-medium text-foreground">{p.nome}</span> },
    { key: 'codigo', header: 'Código', render: (p) => <span className="font-mono-num text-sm">{p.codigo || '—'}</span> },
    { key: 'categoria', header: 'Categoria', render: (p) => p.categoria || '—' },
    {
      key: 'qtd',
      header: 'Estoque',
      render: (p) => (
        <span className="flex items-center gap-1.5">
          <span className="font-mono-num font-bold">{p.qtd} {p.unidade}</span>
          {Number(p.qtd) <= Number(p.minimo || 2) && <Badge variant="red">baixo</Badge>}
        </span>
      ),
    },
    { key: 'local', header: 'Local', render: (p) => p.local || '—' },
    {
      key: 'acoes',
      header: 'Ações',
      render: (p) => (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => abrirMovimentacao(p)}>Movimentar</Button>
          <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)}>Editar</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Itens Cadastrados" value={carregando ? '—' : pecas.length} color="blue" />
        <KpiCard label="Estoque Baixo" value={baixoEstoque.length} color="red" />
        <KpiCard label="Mais Consumida" value={maisConsumida} color="green" />
        <KpiCard label="Movimentações" value={movs.length} color="amber" />
      </div>

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça, código…" className="w-56" />
        <Button className="ml-auto" size="sm" onClick={abrirNovo}>
          <Plus className="h-3.5 w-3.5" /> Nova Peça
        </Button>
      </FilterBar>

      <DataTable columns={columns} rows={filtradas} rowKey={(p) => p.id} loading={carregando} emptyTitle="Nenhuma peça cadastrada" />

      <Dialog open={crudOpen} onOpenChange={setCrudOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Peça' : 'Nova Peça'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome *" htmlFor="peca-nome">
              <Input id="peca-nome" value={form.nome || ''} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </Campo>
            <Campo label="Código" htmlFor="peca-codigo">
              <Input id="peca-codigo" value={form.codigo || ''} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} />
            </Campo>
            <Campo label="Categoria" htmlFor="peca-categoria">
              <Input id="peca-categoria" value={form.categoria || ''} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
            </Campo>
            <Campo label="Unidade" htmlFor="peca-unidade">
              <Input id="peca-unidade" value={form.unidade || 'un'} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} />
            </Campo>
            <Campo label="Estoque atual" htmlFor="peca-qtd">
              <Input id="peca-qtd" type="number" value={form.qtd ?? 0} onChange={(e) => setForm((f) => ({ ...f, qtd: Number(e.target.value) }))} />
            </Campo>
            <Campo label="Estoque mínimo" htmlFor="peca-minimo">
              <Input id="peca-minimo" type="number" value={form.minimo ?? 2} onChange={(e) => setForm((f) => ({ ...f, minimo: Number(e.target.value) }))} />
            </Campo>
            <Campo label="Local" htmlFor="peca-local">
              <Input id="peca-local" value={form.local || ''} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} />
            </Campo>
            <Campo label="Fornecedor" htmlFor="peca-fornecedor">
              <Input id="peca-fornecedor" value={form.fornecedor || ''} onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))} />
            </Campo>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCrudOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentar estoque — {movPeca?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Campo label="Tipo" htmlFor="mov-tipo">
              <Select value={movTipo} onValueChange={(v) => setMovTipo(v as 'entrada' | 'saida')}>
                <SelectTrigger id="mov-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Quantidade" htmlFor="mov-qtd">
              <Input id="mov-qtd" type="number" value={movQtd} onChange={(e) => setMovQtd(Number(e.target.value))} />
            </Campo>
            <Campo label="Chamado vinculado (opcional)" htmlFor="mov-chamado">
              <Input id="mov-chamado" value={movChamado} onChange={(e) => setMovChamado(e.target.value)} placeholder="CHM-0000" />
            </Campo>
            <Campo label="Observação" htmlFor="mov-obs">
              <Input id="mov-obs" value={movObs} onChange={(e) => setMovObs(e.target.value)} />
            </Campo>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMovOpen(false)}>Cancelar</Button>
            <Button onClick={handleMovimentar}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
