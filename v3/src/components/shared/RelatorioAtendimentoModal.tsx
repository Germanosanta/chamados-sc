import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { gerarRelatorioAtendimento } from '@/utils/relatorioAtendimento';
import type { Chamado } from '@/types/chamado';

interface RelatorioAtendimentoModalProps {
  chamado: Chamado;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Prévia editável do relatório de atendimento (texto puro, sem HTML/
 * markdown) — gerado deterministicamente a partir do próprio `Chamado`
 * via `gerarRelatorioAtendimento` (utils/relatorioAtendimento.ts), sem
 * nenhuma leitura/escrita adicional no Firestore. A edição no textarea é
 * só local a este componente (nunca persistida) — reabrir o modal
 * (encerramento seguinte ou "Ver relatório" depois) sempre regenera o
 * texto a partir do dado real do chamado, nunca de um rascunho salvo.
 *
 * Reaproveitado em dois pontos: abertura automática ao concluir o
 * checklist de encerramento (ChecklistDialog) e o botão "Ver relatório"
 * de um chamado já fechado (CentroOperacionalModal) — mesmo componente,
 * sem duplicação.
 */
export function RelatorioAtendimentoModal({ chamado, open, onOpenChange }: RelatorioAtendimentoModalProps) {
  const [texto, setTexto] = useState('');
  // Regenera o texto só na transição fechado→aberto, nunca enquanto já
  // está aberto: `chamado` vem de `useChamados()` e ganha uma referência
  // nova a cada snapshot do Firestore (qualquer escrita em `chamados`/
  // `historico`, de qualquer chamado) — sem essa guarda, o efeito
  // disparava de novo a cada snapshot e apagava silenciosamente o texto
  // que o técnico já tivesse editado na textarea.
  const estavaAberto = useRef(false);

  useEffect(() => {
    if (open && !estavaAberto.current) setTexto(gerarRelatorioAtendimento(chamado));
    estavaAberto.current = open;
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
      toast('✓ Relatório copiado.');
    } catch {
      toast.error('Não foi possível copiar o relatório.');
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
          <DialogTitle>Relatório de atendimento</DialogTitle>
          <DialogDescription>
            {chamado.num} · revise o texto antes de enviar — a edição abaixo não altera o chamado.
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
            📋 Copiar relatório
          </Button>
          <Button className="h-11 w-full sm:h-9 sm:w-auto" onClick={handleEnviarWhatsapp}>
            📲 Enviar pelo WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
