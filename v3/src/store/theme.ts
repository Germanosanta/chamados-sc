import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

function applyToDom(theme: Theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: prefersDark ? 'dark' : 'light',
      toggle: () =>
        set((s) => {
          const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
          applyToDom(next);
          return { theme: next };
        }),
      setTheme: (theme) => {
        applyToDom(theme);
        set({ theme });
      },
    }),
    {
      name: 'chm-v3-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyToDom(state.theme);
      },
    },
  ),
);
