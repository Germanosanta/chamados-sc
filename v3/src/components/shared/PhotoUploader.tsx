import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';
import type { FotoAnexo } from '@/types/chamado';

const MAX_ARQUIVOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

/** Portado de handleFotoInput()/handleFotoDrop()/renderFotoPreview()
 * (chamados/index.js) — mesmo limite (5 arquivos, 5MB cada), mesma
 * codificação base64 (fotos nunca vão ao Firestore, ver types/chamado.ts). */
export function PhotoUploader({ value, onChange }: { value: FotoAnexo[]; onChange: (fotos: FotoAnexo[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const restantes = MAX_ARQUIVOS - value.length;
    if (restantes <= 0) {
      toast('Limite de 5 fotos por chamado.');
      return;
    }
    [...files].slice(0, restantes).forEach((f) => {
      if (f.size > MAX_BYTES) {
        toast(`${f.name} ultrapassa 5 MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        onChange([...value, { name: f.name, type: f.type, data: ev.target?.result as string }]);
      };
      reader.readAsDataURL(f);
    });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors',
          dragOver && 'border-primary bg-primary-light',
        )}
      >
        <Upload className="h-6 w-6 text-subtle" />
        <div className="text-sm font-medium text-muted-foreground">Arraste fotos aqui ou clique para selecionar</div>
        <div className="text-xs text-subtle">JPG, PNG, PDF — máx. 5 MB cada · até 5 arquivos</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {value.map((f, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-sm border border-border bg-muted">
              {f.type === 'application/pdf' ? (
                <div className="flex h-full items-center justify-center">
                  <FileText className="h-6 w-6 text-subtle" />
                </div>
              ) : (
                <img src={f.data} alt={f.name} className="h-full w-full object-cover" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((_, idx) => idx !== i));
                }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
