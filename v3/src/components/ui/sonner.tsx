import { Toaster as Sonner } from 'sonner';
import { useThemeStore } from '@/store/theme';

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-foreground group-[.toaster]:text-background group-[.toaster]:border-none group-[.toaster]:shadow-lg group-[.toaster]:rounded-sm',
          description: 'group-[.toast]:opacity-90',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
