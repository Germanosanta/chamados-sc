/**
 * Portado 1:1 de docs/js/core/init.js (ALL_PERMS / PERFIL_PERMS) — os
 * mesmos valores, sem tradução — porque firestore.rules (permsPadrao())
 * depende exatamente dessa tabela para autorizar escritas. As duas
 * cópias (aqui e nas regras do Firestore) precisam ficar manualmente
 * sincronizadas — a V2 já opera assim (mesmo risco documentado lá), não
 * é uma regressão introduzida pela V3.
 */
export const ALL_PERMS = {
  p_dashboard: 'Dashboard',
  p_chamados: 'Chamados',
  p_aberto: 'Chamados em Aberto',
  p_encerrados: 'Chamados Encerrados',
  p_novo: 'Novo Chamado',
  p_responsaveis: 'Responsáveis',
  p_relatorios: 'Relatórios',
  p_usuarios: 'Cadastro de Usuários',
  p_config: 'Configurações',
  p_abrir: 'Abrir Chamados',
  p_editar: 'Editar Chamados',
  p_encerrar: 'Encerrar Chamados',
  p_reabrir: 'Reabrir Chamados',
  p_excluir: 'Excluir Chamados',
  p_exportar: 'Exportar Relatórios',
} as const;

export type Permissao = keyof typeof ALL_PERMS;

export type Perfil = 'admin' | 'supervisor' | 'tecnico' | 'visualizador';

/** Rótulo de exibição — "supervisor" é mostrado como "Gestor" (mesma
 * troca de nomenclatura feita na V2, chave interna preservada). */
export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: 'Administrador',
  supervisor: 'Gestor',
  tecnico: 'Técnico',
  visualizador: 'Visualizador',
};

const ALL_PERMS_KEYS = Object.keys(ALL_PERMS) as Permissao[];

export const PERFIL_PERMS: Record<Perfil, Permissao[]> = {
  admin: [...ALL_PERMS_KEYS],
  supervisor: [
    'p_dashboard',
    'p_chamados',
    'p_aberto',
    'p_encerrados',
    'p_novo',
    'p_responsaveis',
    'p_relatorios',
    'p_abrir',
    'p_editar',
    'p_encerrar',
    'p_reabrir',
    'p_exportar',
  ],
  tecnico: ['p_dashboard', 'p_chamados', 'p_aberto', 'p_encerrados', 'p_novo', 'p_abrir', 'p_editar'],
  visualizador: ['p_dashboard', 'p_chamados', 'p_aberto', 'p_encerrados', 'p_responsaveis', 'p_relatorios', 'p_exportar'],
};

export function permsPadrao(perfil: Perfil): Permissao[] {
  return PERFIL_PERMS[perfil] ?? [];
}
