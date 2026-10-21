import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { gerarComprovanteAbertura } from '@/utils/comprovanteAbertura';
import type { Chamado } from '@/types/chamado';

interface ComprovanteAberturaModalProps {
  chamado: Chamado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Comprovante de abertura — mesmo padrão de RelatorioAtendimentoModal
 * (prévia editável em textarea, "Copiar"/"Enviar pelo WhatsApp"), só que
 * disparado na tela de sucesso de NovoChamadoPage em vez do checklist de
 * encerramento. Reaproveita a mesma técnica de compartilhamento
 * (`https://wa.me/?text=`, sem lib nova) já usada ali — não cria uma
 * segunda solução de WhatsApp.
 */
export function ComprovanteAberturaModal({ chamado, open, onOpenChange }: ComprovanteAberturaModalProps) {
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (open && chamado) setTexto(gerarComprovanteAbertura(chamado) || '');
  }, [open, chamado]);

  async function handleCopiar() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const el = document.createElement('textarea');
        el.value = texto;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast('✓ Comprovante copiado.');
    } catch {
      toast.error('Não foi possível copiar o comprovante.');
    }
  }

  function handleEnviarWhatsapp() {
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprovante de abertura</DialogTitle>
          <DialogDescription>
            {chamado?.num} · revise o texto antes de enviar — a edição abaixo não altera o chamado.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={12}
          className="min-h-[240px] w-full rounded-sm border border-border bg-muted p-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="h-11 w-full sm:h-9 sm:w-auto" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button variant="ghost" className="h-11 w-full sm:h-9 sm:w-auto" onClick={handleCopiar}>
            📋 Copiar comprovante
          </Button>
          <Button className="h-11 w-full sm:h-9 sm:w-auto" onClick={handleEnviarWhatsapp}>
            📲 Enviar pelo WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
