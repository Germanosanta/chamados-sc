import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/globals.css';

// Mesma disciplina da V2: nunca skipWaiting() sozinho — só quando o
// usuário confirma no aviso. Nada é recarregado sem ação explícita.
const updateSW = registerSW({
  onNeedRefresh() {
    toast('Nova versão disponível', {
      duration: Infinity,
      action: { label: 'Atualizar', onClick: () => updateSW(true) },
    });
  },
  onOfflineReady() {
    toast('App pronto para uso offline.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
