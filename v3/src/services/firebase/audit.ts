import { setMerge } from './firestore';
import { auth } from './app';
import type { Usuario } from '@/types';

/**
 * Portado de audit()/saveAudit() (core/storage.js) — grava 1 entrada em
 * `auditoria/log_<timestamp>`. A V2 só grava se já houver usuário
 * autenticado (regra do Firestore exige `request.auth != null`); mesma
 * condição aqui.
 */
export async function audit(tipo: string, detalhe: string, usuario: Usuario | null, chamado?: string): Promise<void> {
  if (!auth.currentUser) return;
  const id = `log_${Date.now()}`;
  await setMerge('auditoria', id, {
    ts: new Date().toISOString(),
    tipo,
    usuario: usuario?.nome || 'Sistema',
    login: usuario?.login || '',
    detalhe,
    ...(chamado ? { chamado } : {}),
  });
}
