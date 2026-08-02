import { useSessionStore } from '@/store/session';
import type { Permissao } from '@/types/permissoes';

export function usePermission(perm: Permissao): boolean {
  return useSessionStore((s) => s.temPermissao(perm));
}
