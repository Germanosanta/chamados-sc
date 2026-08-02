import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/store/theme';

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
