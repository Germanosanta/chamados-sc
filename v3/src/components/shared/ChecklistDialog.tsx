import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils/cn';
import { useTecnicosAtivos } from '@/hooks/useTecnicos';
import { useEncerrarChamado } from '@/hooks/useChamados';
import { getTecnicoResponsavel } from '@/utils/chamado-helpers';
import type { Chamado, ChecklistEncerramento } from '@/types/chamado';

const ITENS: { key: keyof ChecklistEncerramento; label: string }[] = [
  { key: 'problemaResolvido', label: 'Problema resolvido' },
  { key: 'testeRealizado', label: 'Teste realizado' },
  { key: 'equipamentoLiberado', label: 'Equipamento liberado' },
  { key: 'usuarioInformado', label: 'Usuário informado' },
];

/** Checklist de encerramento — portado de openChecklist()/
 * submitChecklist()/_doEncerramento() (chamados/index.js): técnico(s) +
 * solução são obrigatórios, os 4 itens do checklist precisam estar
 * todos marcados. */
export function ChecklistDialog({ chamado, open, onOpenChange }: { chamado: Chamado; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: tecnicos } = useTecnicosAtivos();
  const encerrar = useEncerrarChamado();

  const [tecSelecionados, setTecSelecionados] = useState<string[]>([]);
  const [solucao, setSolucao] = useState('');
  const [materiais, setMateriais] = useState('');
  const [equipamentos, setEquipamentos] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [checks, setChecks] = useState<ChecklistEncerramento>({
    problemaResolvido: false,
    testeRealizado: false,
    equipamentoLiberado: false,
    usuarioInformado: false,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSolucao('');
    setMateriais('');
    setEquipamentos('');
    setObservacoes('');
    setChecks({ problemaResolvido: false, testeRealizado: false, equipamentoLiberado: false, usuarioInformado: false });
    setErro(null);
    const tecResp = getTecnicoResponsavel(chamado);
    setTecSelecionados(tecResp ? [tecResp] : []);
  }, [open, chamado]);

  const done = Object.values(checks).filter(Boolean).length;

  function toggleTec(nome: string) {
    setTecSelecionados((prev) => (prev.includes(nome) ? prev.filter((t) => t !== nome) : [...prev, nome]));
  }

  async function handleSubmit() {
    const erros: string[] = [];
    if (!tecSelecionados.length) erros.push('Selecione pelo menos um técnico que realizou o atendimento.');
    if (!solucao.trim()) erros.push('Informe a solução executada.');
    if (Object.values(checks).some((v) => !v)) erros.push('Todos os itens do checklist devem ser marcados.');
    if (erros.length) {
      setErro(erros.join(' '));
      return;
    }
    setEnviando(true);
    try {
      await encerrar(chamado, {
        solucao: solucao.trim(),
        tecnicos: tecSelecionados.join(', '),
        materiais: materiais.trim(),
        equipamentos: equipamentos.trim(),
        observacoes: observacoes.trim(),
        checklist: checks,
      });
      toast(`Chamado ${chamado.num} encerrado com sucesso.`);
      onOpenChange(false);
    } catch {
      setErro('Não foi possível encerrar o chamado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Encerrar chamado</DialogTitle>
          <DialogDescription>
            {chamado.num} · {chamado.titulo?.slice(0, 50)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-3.5 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label>Técnico(s) que atenderam *</Label>
            <div className="flex flex-wrap gap-1.5">
              {tecnicos.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTec(t.apelido || t.nome)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-sm font-semibold transition-colors',
                    tecSelecionados.includes(t.apelido || t.nome)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-surface text-muted-foreground hover:border-border2',
                  )}
                >
                  {t.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Solução executada *</Label>
            <textarea
              value={solucao}
              onChange={(e) => setSolucao(e.target.value)}
              rows={3}
              className="rounded-sm border border-border bg-muted p-2.5 text-base text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Descreva o que foi feito para resolver o problema…"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Materiais utilizados</Label>
              <input
                value={materiais}
                onChange={(e) => setMateriais(e.target.value)}
                className="h-8 rounded-sm border border-border bg-muted px-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Equipamentos</Label>
              <input
                value={equipamentos}
                onChange={(e) => setEquipamentos(e.target.value)}
                className="h-8 rounded-sm border border-border bg-muted px-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Observações</Label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="rounded-sm border border-border bg-muted p-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-sm border border-border bg-muted p-3">
            <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
              <span>Checklist de encerramento</span>
              <span>{done} de 4 itens</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
              <div className="h-full bg-success transition-all" style={{ width: `${(done / 4) * 100}%` }} />
            </div>
            {ITENS.map((it) => (
              <label key={it.key} className="flex items-center gap-2 text-base text-foreground">
                <input
                  type="checkbox"
                  checked={checks[it.key]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [it.key]: e.target.checked }))}
                  className="h-4 w-4 rounded-xs border-border2"
                />
                {it.label}
              </label>
            ))}
          </div>

          {erro && <p className="text-sm text-destructive">⛔ {erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={enviando}>
            Confirmar encerramento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
