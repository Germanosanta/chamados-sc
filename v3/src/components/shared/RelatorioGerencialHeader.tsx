import logoCoa from '@/assets/img/coa.jpeg';

/**
 * Cabeçalho institucional reutilizável — base de QUALQUER relatório
 * gerencial futuro da plataforma (não só o de chamados). Props
 * propositalmente genéricas (`titulo`/`periodo`/`filtrosAplicados`) para
 * que um próximo relatório (peças, equipamentos, SLA, etc.) reaproveite
 * este mesmo componente sem precisar generalizar nada depois.
 *
 * Usado tanto na tela (preview, ver RelatorioGerencialPage) quanto
 * embutido no PDF gerado (ver utils/relatorioGerencialPdf.ts, que desenha
 * um equivalente vetorial deste mesmo layout em cada página do PDF —
 * canvas/jsPDF não renderizam componentes React diretamente, então a
 * geração do PDF replica esta mesma estrutura visual "à mão"; qualquer
 * mudança de layout aqui deve ser espelhada lá).
 *
 * LOGO SANTA COLOMBA: não existe nenhum arquivo de logo oficial da Santa
 * Colomba neste projeto (busca completa já feita — só existe o logo da
 * COA, `src/assets/img/coa.jpeg`, usado no restante do app). Em vez de
 * inventar/baixar uma imagem genérica no lugar (proibido), este
 * componente mostra um placeholder tracejado neutro. Assim que o arquivo
 * oficial for fornecido, salve-o em `src/assets/img/santa-colomba.png`
 * (ou `.svg`) e troque o placeholder abaixo por
 * `<img src={logoSantaColomba} alt="Santa Colomba" .../>` — mesmo padrão
 * de import usado para `logoCoa` nesta mesma linha.
 */

export interface FiltroAplicado {
  label: string;
  valor: string;
}

export interface RelatorioGerencialHeaderProps {
  /** Nome do relatório, ex. "RELATÓRIO GERENCIAL DE CHAMADOS". */
  titulo: string;
  /** Período já formatado para exibição, ex. "01/01/2026 a 18/08/2026"
   * ou "Todo o histórico" quando nenhuma data foi filtrada. */
  periodo: string;
  /** Só os filtros que o usuário efetivamente selecionou — nunca inclua
   * aqui um filtro não aplicado ("Todos"); a lista vazia é o caso normal
   * de "nenhum filtro selecionado" e o componente lida com isso sem
   * mostrar uma linha vazia. */
  filtrosAplicados: FiltroAplicado[];
  /** Data/hora de geração já formatada, ex. "18/08/2026 14:32". Opcional
   * — nem todo consumidor deste header (ex. um preview de rascunho)
   * precisa mostrar isso. */
  geradoEm?: string;
  /** Classe extra no container raiz — usada pelo gerador de PDF para
   * ajustar largura/quebra de página quando necessário; a tela não
   * costuma precisar disso. */
  className?: string;
}

export function RelatorioGerencialHeader({ titulo, periodo, filtrosAplicados, geradoEm, className }: RelatorioGerencialHeaderProps) {
  return (
    <header className={`flex flex-col gap-3 border-b-2 border-border pb-3 ${className || ''}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={logoCoa} alt="COA" className="h-12 w-12 shrink-0 rounded-sm object-cover" />
          {/* Placeholder do logo Santa Colomba — ver comentário no topo do
             arquivo. Nunca substituir por uma imagem genérica. */}
          <div
            className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-sm border border-dashed border-border2 bg-muted text-center"
            role="img"
            aria-label="Logo Santa Colomba pendente"
            title="Logo Santa Colomba pendente"
          >
            <span className="px-0.5 text-[7px] font-semibold leading-tight text-subtle">Logo Santa Colomba pendente</span>
          </div>
        </div>
        <div className="flex-1 text-right">
          <h1 className="text-lg font-extrabold uppercase tracking-wide text-foreground">{titulo}</h1>
          <div className="text-sm font-medium text-muted-foreground">Período: {periodo}</div>
        </div>
      </div>

      {filtrosAplicados.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-sm bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          {filtrosAplicados.map((f, i) => (
            <span key={f.label} className="whitespace-nowrap">
              <span className="font-semibold text-foreground">{f.label}:</span> {f.valor}
              {i < filtrosAplicados.length - 1 && <span className="ml-1.5 text-subtle">|</span>}
            </span>
          ))}
        </div>
      )}

      {geradoEm && <div className="text-right text-xs text-subtle">Gerado em {geradoEm}</div>}
    </header>
  );
}
