/**
 * Portado 1:1 de docs/js/core/init.js (SECTIONS/TITLES/SUBS) — mesmos 20
 * ids de seção viram 20 rotas na V3 (ver router.tsx), mesmos títulos/
 * subtítulos de breadcrumb, mesmo agrupamento do menu lateral.
 */
export const SECTIONS = [
  'home',
  'dashboard',
  'chamados',
  'area-tecnico',
  'aberto',
  'encerrados',
  'pormes',
  'responsaveis',
  'criticidade',
  'painel',
  'auditoria',
  'frotas',
  'kb',
  'pecas',
  'novo',
  'usuarios',
  'irrigacao',
  'equipamentos',
  'tecnicos',
  'config',
] as const;

export type SectionId = (typeof SECTIONS)[number];

export const TITLES: Record<SectionId, string> = {
  home: 'Início',
  dashboard: 'Dashboard',
  chamados: 'Chamados',
  'area-tecnico': 'Área do Técnico',
  pormes: 'Por Mês',
  aberto: 'Em Aberto',
  encerrados: 'Chamados Encerrados',
  responsaveis: 'Responsáveis',
  criticidade: 'Criticidade',
  painel: 'Painel Operacional',
  auditoria: 'Auditoria e Logs',
  frotas: 'Histórico por Frota',
  kb: 'Banco de Soluções',
  pecas: 'Peças e Estoque',
  novo: 'Novo Chamado',
  irrigacao: 'Chamados de Irrigação',
  equipamentos: 'Equipamentos',
  tecnicos: 'Técnicos',
  config: 'Configurações',
  usuarios: 'Usuários',
};

export const SUBS: Partial<Record<SectionId, string>> = {
  home: 'Visão geral operacional · atalhos rápidos',
  dashboard: 'Visão geral · Santa Colomba Agropecuária',
  chamados: 'Lista completa editável',
  'area-tecnico': 'Meu painel de trabalho · ações rápidas',
  pormes: 'Relatório mensal por cultura',
  aberto: 'Chamados não concluídos · atualizado em tempo real',
  criticidade: 'Distribuição e acompanhamento por nível de criticidade',
  encerrados: 'Histórico de chamados concluídos',
  usuarios: 'Cadastro e gerenciamento de usuários',
  responsaveis: 'Atendimentos por responsável',
  novo: 'Abrir novo chamado',
  irrigacao: 'Gestão de chamados do sistema de irrigação',
  equipamentos: 'Cadastro de equipamentos e frotas',
  tecnicos: 'Performance e ranking por técnico',
  config: 'Configurações do sistema',
};

/** Grupo de navegação da sidebar — só pra organização visual, não afeta
 * rotas/permissões. */
export interface NavItem {
  id: SectionId;
  label: string;
  perm?: import('@/types/permissoes').Permissao;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_TOP: NavItem[] = [
  { id: 'home', label: 'Início' },
  { id: 'dashboard', label: 'Dashboard', perm: 'p_dashboard' },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Chamados',
    items: [
      { id: 'chamados', label: 'Todos', perm: 'p_chamados' },
      { id: 'area-tecnico', label: 'Área do Técnico' },
      { id: 'aberto', label: 'Em Aberto', perm: 'p_aberto' },
      { id: 'encerrados', label: 'Encerrados', perm: 'p_encerrados' },
      { id: 'novo', label: 'Novo Chamado', perm: 'p_novo' },
      { id: 'criticidade', label: 'Criticidade' },
      { id: 'painel', label: 'Painel Operacional' },
    ],
  },
  {
    label: 'Equipamentos',
    items: [
      { id: 'equipamentos', label: 'Cadastro' },
      { id: 'frotas', label: 'Por Frota' },
      { id: 'pecas', label: 'Peças e Estoque' },
      { id: 'kb', label: 'Banco de Soluções' },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { id: 'pormes', label: 'Por Mês' },
      { id: 'responsaveis', label: 'Responsáveis', perm: 'p_responsaveis' },
      { id: 'auditoria', label: 'Auditoria / Logs' },
    ],
  },
];

export const NAV_BOTTOM: NavItem[] = [
  { id: 'tecnicos', label: 'Técnicos' },
  { id: 'usuarios', label: 'Usuários', perm: 'p_usuarios' },
  { id: 'config', label: 'Configurações', perm: 'p_config' },
];
