import logoInstitucional from '@/assets/img/logo-institucional.jpeg';

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
 * LOGO: `logo-institucional.jpeg` (fornecida pelo usuário em 2026-08-19,
 * `src/assets/img/`) traz as duas marcas — Santa Colomba e Centro de
 * Operações Agrícolas (COA) — combinadas numa única peça horizontal
 * (1458×291px, proporção ~5:1, recorte justo/sem sobra), separadas por
 * uma linha vertical. Cabeçalho usa UMA imagem só (em vez de compor duas
 * logos separadas em código): a arte já vem pronta e no padrão oficial,
 * sem risco de distorcer proporção nem separar o que deve aparecer
 * sempre junto (regra do usuário: "as duas logos devem aparecer
 * juntas").
 *
 * Nota de correção: a investigação inicial deste módulo (busca por nome
 * de arquivo/pasta) concluiu erroneamente que não existia logo da Santa
 * Colomba no projeto. `src/assets/img/coa.jpeg` (usado em Sidebar/Login/
 * Portal) na verdade JÁ contém as duas marcas combinadas — só não foi
 * percebido porque a busca nunca abriu o conteúdo da imagem, só o nome
 * do arquivo. Mesmo assim, optei por manter este arquivo separado (em
 * vez de importar `coa.jpeg` aqui) porque ele é um recorte mais justo/
 * compacto (1458×291 vs. 1600×666 de `coa.jpeg`, que tem bastante
 * espaço em branco ao redor pensado pro uso em miniatura quadrada do
 * Sidebar) — melhor pra uma faixa de cabeçalho fina como esta, sem
 * recalcular proporção/aumentar a altura do header à toa.
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
        <img src={logoInstitucional} alt="Santa Colomba · Centro de Operações Agrícolas" className="h-11 shrink-0 object-contain" />
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
