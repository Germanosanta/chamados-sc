import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/utils/cn';

// Cor determinística por nome (mesmo nome sempre cai na mesma cor) — dá pra
// reconhecer um responsável pela cor do avatar de relance, mesmo sem ler o
// texto, no mesmo espírito dos avatares coloridos de Jira/Linear/Trello.
const CORES = ['bg-primary text-primary-foreground', 'bg-info text-white', 'bg-purple text-white', 'bg-graos text-white', 'bg-cacau text-white', 'bg-tabaco text-white'];

function corPorNome(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES[hash % CORES.length];
}

function iniciais(nome: string): string {
  return (
    nome
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

/** Avatar compacto de responsável — usado no Kanban e na lista de Chamados
 * em Aberto pra identificar o técnico responsável visualmente (cor +
 * iniciais) em vez de só texto, reduzindo a leitura a um relance. */
export function RespAvatar({ nome, className }: { nome?: string; className?: string }) {
  return (
    <Avatar className={cn('h-5 w-5', className)}>
      <AvatarFallback className={cn('text-[9px] font-bold', nome ? corPorNome(nome) : 'bg-surface3 text-subtle')}>
        {nome ? iniciais(nome) : '?'}
      </AvatarFallback>
    </Avatar>
  );
}
