import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { router } from './router';
import { useAuthListener } from '@/hooks/useAuth';

// TanStack Query aqui só orquestra `useMutation` (loading/erro de
// escritas) — leituras são tempo-real via onSnapshot (useFirestoreCollection),
// não useQuery. defaultOptions.queries fica como padrão são caso uma
// tela futura precise buscar algo que não seja uma coleção inteira
// (ex. paginação server-side); hoje nenhum useQuery existe no app.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  useAuthListener();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
