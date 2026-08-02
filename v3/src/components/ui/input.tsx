import * as React from 'react';
import { cn } from '@/utils/cn';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-8 w-full rounded-sm border border-border bg-muted px-3 text-base text-foreground placeholder:text-subtle transition-colors',
        'focus-visible:outline-none focus-visible:bg-surface focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
