import { useState } from 'react';
import { Download, FileText, Image } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from './EmptyState';
import type { FotoAnexo } from '@/types/chamado';

/** Galeria de anexos do Centro Operacional — thumbnails + lightbox,
 * portado de abrirLightbox() (chamados/index.js). */
export function PhotoGallery({ fotos }: { fotos: FotoAnexo[] }) {
  const [aberta, setAberta] = useState<FotoAnexo | null>(null);

  if (!fotos.length) return <EmptyState icon={Image} title="Nenhum anexo neste chamado" />;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {fotos.map((f, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Abrir anexo ${f.name}`}
            onClick={() => setAberta(f)}
            className="aspect-square overflow-hidden rounded-sm border border-border bg-muted transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {f.type === 'application/pdf' ? (
              <div className="flex h-full items-center justify-center">
                <FileText className="h-6 w-6 text-subtle" />
              </div>
            ) : (
              <img src={f.data} alt={f.name} className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!aberta} onOpenChange={(open) => !open && setAberta(null)}>
        <DialogContent className="max-w-2xl">
          {aberta && (
            <div className="flex flex-col gap-3">
              <DialogTitle className="sr-only">{aberta.name}</DialogTitle>
              {aberta.type === 'application/pdf' ? (
                <div className="flex h-64 items-center justify-center rounded-sm bg-muted">
                  <FileText className="h-10 w-10 text-subtle" />
                </div>
              ) : (
                <img src={aberta.data} alt={aberta.name} className="max-h-[70vh] w-full rounded-sm object-contain" />
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-muted-foreground">{aberta.name}</span>
                <a
                  href={aberta.data}
                  download={aberta.name}
                  className="flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
