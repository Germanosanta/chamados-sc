import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EquipAutocomplete } from './EquipAutocomplete';
import { useVincularFrota } from '@/hooks/useChamados';
import type { Chamado } from '@/types/chamado';
import type { EquipamentoEstatico } from '@/types/equipamento';

interface VincularFrotaButtonProps {
  chamado: Chamado;
}

/**
 * Ação "Vincular Frota" — só aparece pra chamados abertos sem
 * equipamento vinculado (equipamentoDoChamado(chamado) === null, ver
 * chamado-helpers.ts) e pra quem já tem a mesma permissão que qualquer
 * outra edição de chamado (p_editar) — a checagem de permissão fica no
 * componente que decide se renderiza este botão (ver
 * CentroOperacionalModal), não aqui, pra não duplicar a regra.
 *
 * Reaproveita o mesmo autocomplete de equipamento usado na abertura do
 * chamado (EquipAutocomplete) e a mesma mutação incremental que qualquer
 * outra ação de chamado usa (useVincularFrota → setMerge em
 * `chamados/{num}`, useChamados.ts) — nenhum campo/coleção novo.
 */
export function VincularFrotaButton({ chamado }: VincularFrotaButtonProps) {
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const vincularFrota = useVincularFrota();

  async function handleSelect(equip: EquipamentoEstatico) {
    setSalvando(true);
    try {
      await vincularFrota(chamado, equip);
      toast(`✓ Frota ${equip.c} vinculada ao chamado ${chamado.num}`);
      setOpen(false);
    } catch {
      toast.error('Não foi possível vincular a frota.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Vincular Frota
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Frota</DialogTitle>
            <DialogDescription>Chamado {chamado.num} — selecione o equipamento/frota.</DialogDescription>
          </DialogHeader>
          <EquipAutocomplete id="vincular-frota-equip" onSelect={handleSelect} />
          {salvando && <p className="text-sm text-subtle">Salvando…</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
