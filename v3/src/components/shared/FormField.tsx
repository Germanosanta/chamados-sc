import { Label } from '@/components/ui/label';

/** Par label+campo padrão de todos os formulários/dialogs (Novo Chamado,
 * Centro Operacional, CRUDs de Equipamentos/Peças/Técnicos/Usuários/KB) —
 * antes duplicado localmente em cada arquivo; consolidado aqui pra
 * garantir o mesmo espaçamento/tipografia e, com `htmlFor`, associação
 * programática real entre label e campo (leitor de tela). */
export function Campo({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/** Par label+valor somente-leitura (fichas/resumos) — mesmo componente
 * em Centro Operacional, Ficha do Equipamento e Novo Chamado. */
export function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</span>
      <span className="truncate text-sm text-foreground">{value}</span>
    </div>
  );
}
