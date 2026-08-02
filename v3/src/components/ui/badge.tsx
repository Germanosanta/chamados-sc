import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

// Família única .badge da V2 (style.css) — mesmas variantes de cor,
// mesmo formato (pill, 10px, peso 650).
const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      neutral: 'bg-surface3 text-muted-foreground',
      green: 'bg-success-bg text-success',
      amber: 'bg-warning-bg text-warning',
      red: 'bg-destructive-bg text-destructive',
      purple: 'bg-purple-bg text-purple',
      graos: 'bg-primary-light text-primary-text',
      tabaco: 'bg-warning-bg text-warning',
      cacau: 'bg-cacau-bg text-cacau',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
