/** equipamentos/{frota} — cadastro (overrides locais sobre a base
 * histórica estática em src/data/equipamentos.json + equip_idx.json). */
export interface Equipamento {
  frota: string;
  patrimonio?: string;
  serie?: string;
  modelo?: string;
  fabricante?: string;
  ano?: string;
  tipo?: string;
  horimetro?: string;
  status?: 'Ativo' | 'Inativo' | 'Manutenção' | string;
  fazenda?: string;
  cultura?: string;
  responsavel?: string;
  obs?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

/** Entrada estática de src/data/equip_idx.json — índice rápido usado
 * como fallback/autocomplete (não é doc do Firestore). */
export interface EquipIdxEntry {
  d?: string; // descrição
  m?: string; // modelo
  g?: string; // grupo
  s?: string; // status
}

/** Entrada estática de src/data/equipamentos.json (base xlsx histórica —
 * mesmo dataset embutido no client da V2, não é doc do Firestore). Usada
 * pelo autocomplete de equipamento (Novo Chamado, Cadastro). */
export interface EquipamentoEstatico {
  c: string; // código/frota
  d: string; // descrição
  e: string; // string de busca (código+descrição[+patrimônio/fabricante do cadastro])
  m: string; // modelo
  t: string; // tipo
  g: string; // grupo
  s: string; // status
}
