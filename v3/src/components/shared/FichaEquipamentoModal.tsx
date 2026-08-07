import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { Meta } from './FormField';
import { useChamados } from '@/hooks/useChamados';
import { useCadastroEquipamentos, useEquipUniverso } from '@/hooks/useEquipamentos';
import { useDetalheStore } from '@/store/detalhe';
import { useNovoChamadoPrefill } from '@/store/novoChamadoPrefill';
import { codigoEquipDoChamado, formatDataBR, isFechado } from '@/utils/chamado-helpers';

/** Ficha do Equipamento — modal somente-leitura que compõe cadastro +
 * histórico de chamados + KPIs, portado de abrirFichaEquip()
 * (equipamentos/index.js). Botões "Editar" e "Abrir Chamado" reaproveitam
 * o CRUD e o formulário de Novo Chamado já existentes. */
export function FichaEquipamentoModal({
  frota,
  open,
  onOpenChange,
  onEditar,
}: {
  frota: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditar: () => void;
}) {
  const navigate = useNavigate();
  const universo = useEquipUniverso();
  const { data: cadastro } = useCadastroEquipamentos();
  const { data: todos } = useChamados();
  const abrirDetalhe = useDetalheStore((s) => s.abrir);
  const setPrefill = useNovoChamadoPrefill((s) => s.setEquip);

  const equipBase = useMemo(() => universo.find((e) => e.c === frota), [universo, frota]);
  const cad = useMemo(() => cadastro.find((c) => c.frota === frota), [cadastro, frota]);
  // codigoEquipDoChamado (não só c.equipCodigo direto): chamados antigos
  // do dataset histórico não têm equipCodigo gravado no doc, só resolvem
  // por match_map — sem isso, a ficha do equipamento "perdia" o
  // histórico desses chamados mesmo quando dava pra saber qual frota era.
  const historico = useMemo(
    () => todos.filter((c) => codigoEquipDoChamado(c) === frota).sort((a, b) => (b.data || '').localeCompare(a.data || '')),
    [todos, frota],
  );
  const abertosCount = historico.filter((c) => !isFechado(c)).length;

  // Antes: `if (!frota || !equipBase) return null` — equipBase vem de
  // useEquipUniverso() (índice estático, equip_idx.json), um snapshot
  // que pode não cobrir 100% dos códigos que já existem no cadastro real
  // (`cad`, Firestore ao vivo). Qualquer equipamento cadastrado depois do
  // snapshot, ou um código antigo fora dele, fazia esse modal renderizar
  // nada — mesmo tendo cadastro de verdade e histórico de chamados pra
  // mostrar. Achado na homologação ("não consigo ver nada"). Agora só
  // exige o código (`frota`); todo campo que dependia de `equipBase`
  // cai pro que existir em `cad`, e o pior caso vira "poucos dados", não
  // "tela em branco".
  if (!frota) return null;

  function handleAbrirChamado() {
    const descricao = cad?.modelo || frota;
    setPrefill(
      equipBase || {
        c: frota,
        d: descricao,
        e: [frota, cad?.modelo, cad?.fabricante, cad?.patrimonio].filter(Boolean).join(' '),
        m: cad?.modelo || '',
        t: cad?.tipo || '',
        g: cad?.tipo || '',
        s: cad?.status || '',
      },
    );
    onOpenChange(false);
    navigate('/novo');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              🚜 {frota} {(equipBase?.d || cad?.modelo) && `· ${equipBase?.d || cad?.modelo}`}
            </DialogTitle>
            <div className="mr-6 flex gap-2">
              <Button size="sm" variant="ghost" onClick={onEditar}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
              <Button size="sm" onClick={handleAbrirChamado}>🔧 Abrir Chamado</Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 rounded-sm border border-border bg-muted p-3 text-sm sm:grid-cols-4">
          <Meta label="Código/Frota" value={frota} />
          <Meta label="Modelo" value={cad?.modelo || equipBase?.m || '—'} />
          <Meta label="Fabricante" value={cad?.fabricante || '—'} />
          <Meta label="Patrimônio" value={cad?.patrimonio || '—'} />
          <Meta label="Série" value={cad?.serie || '—'} />
          <Meta label="Ano" value={cad?.ano || '—'} />
          <Meta label="Horímetro" value={cad?.horimetro || '—'} />
          <Meta label="Status" value={cad?.status || equipBase?.s || '—'} />
          <Meta label="Fazenda" value={cad?.fazenda || '—'} />
          <Meta label="Cultura" value={cad?.cultura || '—'} />
          <Meta label="Responsável" value={cad?.responsavel || '—'} />
          <Meta label="Tipo" value={cad?.tipo || equipBase?.g || '—'} />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Kpi label="Total" value={historico.length} />
          <Kpi label="Em Aberto" value={abertosCount} />
          <Kpi label="Concluídos" value={historico.length - abertosCount} />
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Chamados relacionados</div>
          {historico.length === 0 ? (
            <p className="text-sm text-subtle">Nenhum chamado registrado para este equipamento.</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {historico.map((c) => (
                <button
                  key={c.num}
                  onClick={() => {
                    onOpenChange(false);
                    abrirDetalhe(c.num);
                  }}
                  className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono-num font-semibold text-primary">{c.num}</span> {c.titulo}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-subtle">
                      {isFechado(c) ? c.encerramento?.dataEncerramento || 'Data não registrada' : formatDataBR(c.data)}
                    </span>
                    <StatusBadge status={c.status} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-2">
      <div className="font-mono-num text-xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-subtle">{label}</div>
    </div>
  );
}
