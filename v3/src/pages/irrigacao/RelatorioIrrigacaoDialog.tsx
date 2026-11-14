import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { gerarRelatorioIrrigacao } from '@/utils/irrigacao';
import type { ChamadoIrrigacao } from '@/types/irrigacao';

/** Relatório de encerramento para WhatsApp — mesmo padrão do
 * RelatorioAtendimentoModal dos chamados de campo, com compartilhamento
 * nativo quando o navegador oferece (celular). */
export function RelatorioIrrigacaoDialog({ chamado, open, onOpenChange }: { chamado: ChamadoIrrigacao; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [texto, setTexto] = useState('');
  const estavaAberto = useRef(false);

  // Gera só ao abrir: o chamado ganha referência nova a cada snapshot e
  // apagaria o texto já editado.
  useEffect(() => {
    if (open && !estavaAberto.current) setTexto(gerarRelatorioIrrigacao(chamado));
    estavaAberto.current = open;
  }, [open, chamado]);

  async function copiar() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const el = document.createElement('textarea');
        el.value = texto;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast('✓ Relatório copiado.');
    } catch {
      toast.error('Não foi possível copiar o relatório.');
    }
  }

  async function compartilhar() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Chamado ${chamado.num}`, text: texto });
        return;
      } catch (erro) {
        if (erro instanceof DOMException && erro.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Relatório de encerramento</DialogTitle>
          <DialogDescription>{chamado.num} · revise antes de enviar. A edição aqui não altera o chamado.</DialogDescription>
        </DialogHeader>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={14}
          aria-label="Texto do relatório"
          className="min-h-[260px] w-full rounded-sm border border-border bg-muted p-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="h-11 w-full sm:h-9 sm:w-auto" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button variant="ghost" className="h-11 w-full sm:h-9 sm:w-auto" onClick={copiar}>📋 Copiar</Button>
          <Button className="h-11 w-full sm:h-9 sm:w-auto" onClick={compartilhar}>📲 Compartilhar / WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
