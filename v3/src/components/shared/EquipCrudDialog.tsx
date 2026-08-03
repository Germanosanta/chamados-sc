import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquipAutocomplete } from './EquipAutocomplete';
import { Campo } from './FormField';
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
              <Label htmlFor="equip-crud-autocomplete">Equipamento *</Label>
              <EquipAutocomplete id="equip-crud-autocomplete" onSelect={setEquipBase} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Patrimônio" htmlFor="equip-patrimonio">
              <Input id="equip-patrimonio" value={form.patrimonio || ''} onChange={(e) => setForm((f) => ({ ...f, patrimonio: e.target.value }))} />
            </Campo>
            <Campo label="Série" htmlFor="equip-serie">
              <Input id="equip-serie" value={form.serie || ''} onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))} />
            </Campo>
            <Campo label="Modelo" htmlFor="equip-modelo">
              <Input id="equip-modelo" value={form.modelo || ''} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} />
            </Campo>
            <Campo label="Fabricante" htmlFor="equip-fabricante">
              <Input id="equip-fabricante" value={form.fabricante || ''} onChange={(e) => setForm((f) => ({ ...f, fabricante: e.target.value }))} />
            </Campo>
            <Campo label="Ano" htmlFor="equip-ano">
              <Input id="equip-ano" value={form.ano || ''} onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))} />
            </Campo>
            <Campo label="Horímetro" htmlFor="equip-horimetro">
              <Input id="equip-horimetro" value={form.horimetro || ''} onChange={(e) => setForm((f) => ({ ...f, horimetro: e.target.value }))} />
            </Campo>
            <Campo label="Tipo" htmlFor="equip-tipo">
              <Input id="equip-tipo" value={form.tipo || ''} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} />
            </Campo>
            <Campo label="Status" htmlFor="equip-status">
              <Select value={form.status || 'Ativo'} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger id="equip-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Fazenda" htmlFor="equip-fazenda">
              <Input id="equip-fazenda" value={form.fazenda || ''} onChange={(e) => setForm((f) => ({ ...f, fazenda: e.target.value }))} />
            </Campo>
            <Campo label="Cultura" htmlFor="equip-cultura">
              <Input id="equip-cultura" value={form.cultura || ''} onChange={(e) => setForm((f) => ({ ...f, cultura: e.target.value }))} />
            </Campo>
            <Campo label="Responsável" htmlFor="equip-responsavel">
              <Input id="equip-responsavel" value={form.responsavel || ''} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} />
            </Campo>
          </div>
          <Campo label="Observações" htmlFor="equip-obs">
            <textarea
              id="equip-obs"
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
