import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipAutocomplete } from './EquipAutocomplete';
import { useSalvarEquipamento } from '@/hooks/useEquipamentos';
import { useSessionStore } from '@/store/session';
import type { Equipamento, EquipamentoEstatico } from '@/types/equipamento';

/** Cadastro/edição de equipamento — portado de abrirFormEq()/salvarEq()
 * (equipamentos/index.js): overrides gravados em `equipamentos/{frota}`
 * por cima da base estática (equipamentos.json). */
export function EquipCrudDialog({
  frota,
  cadastroAtual,
  open,
  onOpenChange,
}: {
  frota: string | null;
  cadastroAtual: Equipamento | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const usuario = useSessionStore((s) => s.usuario);
  const salvar = useSalvarEquipamento();
  const [equipBase, setEquipBase] = useState<EquipamentoEstatico | null>(null);
  const [form, setForm] = useState<Partial<Equipamento>>({});
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErro(null);
    setEquipBase(null);
    setForm(frota ? { frota, ...cadastroAtual } : {});
  }, [open, frota, cadastroAtual]);

  const frotaAtual = frota || equipBase?.c || '';

  async function handleSalvar() {
    if (!frotaAtual) {
      setErro('Selecione um equipamento da lista (Frota é obrigatório).');
      return;
    }
    const equipamento: Equipamento = {
      frota: frotaAtual,
      patrimonio: form.patrimonio || '',
      serie: form.serie || '',
      modelo: form.modelo || equipBase?.m || '',
      fabricante: form.fabricante || '',
      ano: form.ano || '',
      tipo: form.tipo || equipBase?.g || '',
      horimetro: form.horimetro || '',
      status: form.status || 'Ativo',
      fazenda: form.fazenda || '',
      cultura: form.cultura || '',
      responsavel: form.responsavel || '',
      obs: form.obs || '',
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: usuario?.nome || 'Sistema',
    };
    try {
      await salvar.mutateAsync(equipamento);
      toast('✓ Equipamento salvo no cadastro!');
      onOpenChange(false);
    } catch {
      setErro('Não foi possível salvar. Tente novamente.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{frota ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[65vh] flex-col gap-3.5 overflow-y-auto pr-1">
          {!frota && (
            <div className="flex flex-col gap-1.5">
              <Label>Equipamento *</Label>
              <EquipAutocomplete onSelect={setEquipBase} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Patrimônio">
              <Input value={form.patrimonio || ''} onChange={(e) => setForm((f) => ({ ...f, patrimonio: e.target.value }))} />
            </Campo>
            <Campo label="Série">
              <Input value={form.serie || ''} onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))} />
            </Campo>
            <Campo label="Modelo">
              <Input value={form.modelo || ''} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} />
            </Campo>
            <Campo label="Fabricante">
              <Input value={form.fabricante || ''} onChange={(e) => setForm((f) => ({ ...f, fabricante: e.target.value }))} />
            </Campo>
            <Campo label="Ano">
              <Input value={form.ano || ''} onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))} />
            </Campo>
            <Campo label="Horímetro">
              <Input value={form.horimetro || ''} onChange={(e) => setForm((f) => ({ ...f, horimetro: e.target.value }))} />
            </Campo>
            <Campo label="Tipo">
              <Input value={form.tipo || ''} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} />
            </Campo>
            <Campo label="Status">
              <Select value={form.status || 'Ativo'} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Fazenda">
              <Input value={form.fazenda || ''} onChange={(e) => setForm((f) => ({ ...f, fazenda: e.target.value }))} />
            </Campo>
            <Campo label="Cultura">
              <Input value={form.cultura || ''} onChange={(e) => setForm((f) => ({ ...f, cultura: e.target.value }))} />
            </Campo>
            <Campo label="Responsável">
              <Input value={form.responsavel || ''} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} />
            </Campo>
          </div>
          <Campo label="Observações">
            <textarea
              value={form.obs || ''}
              onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
              rows={2}
              className="rounded-sm border border-border bg-muted p-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Campo>
          {erro && <p className="text-sm text-destructive">⛔ {erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
