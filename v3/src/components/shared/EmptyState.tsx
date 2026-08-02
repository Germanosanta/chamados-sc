import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      <div className="text-base font-semibold text-foreground">{title}</div>
      {description && <div className="max-w-sm text-sm">{description}</div>}
    </div>
  );
}
