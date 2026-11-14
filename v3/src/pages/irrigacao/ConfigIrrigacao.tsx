import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { useSessionStore } from '@/store/session';
import { ATIVOS_IRRIGACAO, useConfigIrrigacao, useSalvarConfigIrrigacao } from '@/hooks/useIrrigacao';
import { TIPO_ATIVO_LABEL } from '@/utils/irrigacao';
import type { AtivoIrrigacao } from '@/types/irrigacao';

const POR_PAGINA = 25;

function detalhes(a: AtivoIrrigacao): string {
  if (a.tipo === 'pivo') return [a.marca, a.casaBombas && `C. bombas ${a.casaBombas}`, a.dados?.['Área (há)'] && `${a.dados['Área (há)']} ha`].filter(Boolean).join(' · ');
  if (a.tipo === 'casa_bombas') return a.pivosAbastecidos ? `Pivôs ${a.pivosAbastecidos}` : '';
  return a.bombas ? `${a.bombas.length} bomba(s)` : '';
}

/** Cadastro dos ativos (vindo da planilha, só leitura) com a marcação de
 * telemetria, e os tipos de falha. Alterar exige p_config. */
export function ConfigIrrigacao() {
  const temPermissao = useSessionStore((s) => s.temPermissao);
  const podeConfigurar = temPermissao('p_config');
  const { tiposFalha, naoMonitorados } = useConfigIrrigacao();
  const salvar = useSalvarConfigIrrigacao();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [novoTipo, setNovoTipo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fora = useMemo(() => new Set(naoMonitorados), [naoMonitorados]);
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return ATIVOS_IRRIGACAO.filter((a) => !t || `${a.nome} ${a.fazenda} ${a.modulo} ${TIPO_ATIVO_LABEL[a.tipo]} ${a.casaBombas || ''}`.toLowerCase().includes(t));
  }, [busca]);

  async function gravar(dados: { tiposFalha?: string[]; naoMonitorados?: string[] }, sucesso: string) {
    setSalvando(true);
    try {
      await salvar(dados);
      toast(sucesso);
    } catch (erro) {
      toast.error(`Não foi possível salvar. Detalhe: ${erro instanceof Error ? erro.message.slice(0, 160) : String(erro)}`);
    } finally {
      setSalvando(false);
    }
  }

  const colunas: DataTableColumn<AtivoIrrigacao>[] = [
    { key: 'nome', header: 'Equipamento', render: (a) => <span className="font-medium text-foreground">{a.nome}</span> },
    { key: 'tipo', header: 'Tipo', render: (a) => TIPO_ATIVO_LABEL[a.tipo] },
    { key: 'local', header: 'Fazenda · Módulo', render: (a) => `${a.fazenda || '—'} · ${a.modulo || '—'}` },
    { key: 'detalhes', header: 'Detalhes', render: (a) => <span className="text-xs text-muted-foreground">{detalhes(a) || '—'}</span> },
    {
      key: 'telemetria',
      header: 'Telemetria',
      render: (a) =>
        podeConfigurar ? (
          <Switch
            checked={!fora.has(a.id)}
            disabled={salvando}
            aria-label={`Telemetria de ${a.nome}`}
            onCheckedChange={(ligado) =>
              gravar(
                { naoMonitorados: ligado ? naoMonitorados.filter((id) => id !== a.id) : [...naoMonitorados, a.id] },
                `${a.nome}: ${ligado ? 'monitorado' : 'sem telemetria'}.`,
              )
            }
          />
        ) : (
          <Badge variant={fora.has(a.id) ? 'neutral' : 'green'}>{fora.has(a.id) ? 'Sem telemetria' : 'Monitorado'}</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Ativos de irrigação ({ATIVOS_IRRIGACAO.length})</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro importado da planilha de pivôs, reservatórios, captações, elevatórias e poços. {ATIVOS_IRRIGACAO.length - fora.size} monitorado(s) por telemetria. Só os
            monitorados aparecem na abertura de chamados.
          </p>
        </div>
        <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar ativo, fazenda, módulo…" className="sm:w-72" aria-label="Buscar ativo" />
        <DataTable columns={colunas} rows={filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)} rowKey={(a) => a.id} emptyTitle="Nenhum ativo encontrado" />
        <Pagination page={pagina} totalItems={filtrados.length} perPage={POR_PAGINA} onPageChange={setPagina} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">Tipos de falha</h2>
        <ul className="flex flex-col gap-1.5">
          {tiposFalha.map((t) => (
            <li key={t} className="flex items-center justify-between gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-sm">
              {t}
              {podeConfigurar && tiposFalha.length > 1 && (
                <Button size="sm" variant="ghost" disabled={salvando} onClick={() => gravar({ tiposFalha: tiposFalha.filter((x) => x !== t) }, 'Tipo de falha removido.')}>
                  Remover
                </Button>
              )}
            </li>
          ))}
        </ul>
        {podeConfigurar && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} placeholder="Novo tipo de falha" aria-label="Novo tipo de falha" />
            <Button
              disabled={salvando || !novoTipo.trim() || tiposFalha.some((t) => t.toLowerCase() === novoTipo.trim().toLowerCase())}
              onClick={async () => {
                await gravar({ tiposFalha: [...tiposFalha, novoTipo.trim()] }, 'Tipo de falha adicionado.');
                setNovoTipo('');
              }}
            >
              Adicionar
            </Button>
          </div>
        )}
        <p className="text-xs text-subtle">Remover um tipo não altera chamados já abertos com ele.</p>
      </section>
    </div>
  );
}
