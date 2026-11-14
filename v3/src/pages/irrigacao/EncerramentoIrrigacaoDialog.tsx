import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Campo } from '@/components/shared/FormField';
import { useAcoesIrrigacao } from '@/hooks/useIrrigacao';
import {
  formatarDuracao,
  inputLocalParaIso,
  isoParaInputLocal,
  minutosEntre,
  validarEncerramentoIrrigacao,
  type FormEncerramentoIrrigacao,
} from '@/utils/irrigacao';
import type { ChamadoIrrigacao } from '@/types/irrigacao';

const classeTexto =
  'w-full rounded-sm border border-border bg-muted p-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

/** Encerramento técnico: todos os campos obrigatórios; a indisponibilidade
 * (identificação → restabelecimento) é calculada e mostrada antes de salvar. */
export function EncerramentoIrrigacaoDialog({
  chamado,
  open,
  onOpenChange,
  onEncerrado,
}: {
  chamado: ChamadoIrrigacao;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEncerrado: () => void;
}) {
  const { encerrar } = useAcoesIrrigacao();
  const [form, setForm] = useState({ tecnico: '', diagnostico: '', servico: '', solucao: '', restabelecidoEm: '', encerradoEm: '', observacoes: '' });
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setErros([]);
    setForm({
      tecnico: chamado.tecnico || '',
      diagnostico: chamado.diagnostico || '',
      servico: '',
      solucao: '',
      restabelecidoEm: isoParaInputLocal(chamado.restabelecidoEm),
      encerradoEm: isoParaInputLocal(new Date().toISOString()),
      observacoes: '',
    });
    // Só ao abrir: não sobrescrever o que o técnico já digitou a cada snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const comoIso = (): FormEncerramentoIrrigacao => ({
    ...form,
    restabelecidoEm: inputLocalParaIso(form.restabelecidoEm),
    encerradoEm: inputLocalParaIso(form.encerradoEm),
  });
  const indisponibilidade = minutosEntre(chamado.identificadoEm, inputLocalParaIso(form.restabelecidoEm));
  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function salvar() {
    const dados = comoIso();
    const problemas = validarEncerramentoIrrigacao(dados, chamado.identificadoEm);
    setErros(problemas);
    if (problemas.length) return;
    setSalvando(true);
    try {
      await encerrar(chamado, dados);
      toast(`✓ Chamado ${chamado.num} encerrado.`);
      onOpenChange(false);
      onEncerrado();
    } catch (erro) {
      toast.error(`Não foi possível encerrar. Detalhe: ${erro instanceof Error ? erro.message.slice(0, 160) : String(erro)}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encerramento técnico · {chamado.num}</DialogTitle>
          <DialogDescription>
            {chamado.ativoNome} · falha identificada em {new Date(chamado.identificadoEm).toLocaleString('pt-BR')}. Todos os campos são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Campo label="Técnico responsável *" htmlFor="enc-tecnico">
            <Input id="enc-tecnico" value={form.tecnico} onChange={campo('tecnico')} />
          </Campo>
          <Campo label="Diagnóstico da falha *" htmlFor="enc-diag">
            <textarea id="enc-diag" rows={2} value={form.diagnostico} onChange={campo('diagnostico')} className={classeTexto} />
          </Campo>
          <Campo label="Serviço realizado *" htmlFor="enc-servico">
            <textarea id="enc-servico" rows={2} value={form.servico} onChange={campo('servico')} className={classeTexto} />
          </Campo>
          <Campo label="Solução aplicada *" htmlFor="enc-solucao">
            <textarea id="enc-solucao" rows={2} value={form.solucao} onChange={campo('solucao')} className={classeTexto} />
          </Campo>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Comunicação restabelecida em *" htmlFor="enc-rest">
              <Input id="enc-rest" type="datetime-local" value={form.restabelecidoEm} onChange={campo('restabelecidoEm')} />
            </Campo>
            <Campo label="Encerrado em *" htmlFor="enc-fim">
              <Input id="enc-fim" type="datetime-local" value={form.encerradoEm} onChange={campo('encerradoEm')} />
            </Campo>
          </div>
          <p className="rounded-sm bg-muted p-2.5 text-sm">
            Tempo de indisponibilidade: <strong>{formatarDuracao(indisponibilidade)}</strong>
          </p>
          <Campo label="Observações finais *" htmlFor="enc-obs">
            <textarea id="enc-obs" rows={2} value={form.observacoes} onChange={campo('observacoes')} className={classeTexto} />
          </Campo>
          {erros.length > 0 && (
            <div role="alert" className="rounded-sm border border-destructive bg-destructive-bg p-2.5 text-sm text-destructive">
              Falta ou está inválido: {erros.join('; ')}.
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Encerrar chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
