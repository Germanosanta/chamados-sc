import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/globals.css';

// "Failed to fetch dynamically imported module" acontece quando o
// navegador ainda tem o index.html antigo em cache (referenciando
// arquivos com hash de um build anterior) e tenta baixar um chunk que já
// não existe mais no servidor depois de um novo deploy. Cada rota é seu
// próprio chunk (ver router.tsx), então isso aparecia como tela branca de
// erro ao navegar. Um único reload resolve — pega o index.html/manifesto
// novo — então recarregamos automaticamente uma vez (guardado em
// sessionStorage pra nunca entrar em loop caso o erro seja outra coisa).
window.addEventListener('vite:preloadError', () => {
  const key = 'chm-reload-apos-erro-chunk';
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  window.location.reload();
});

// Mesma disciplina da V2: nunca skipWaiting() sozinho — só quando o
// usuário confirma no aviso. Nada é recarregado sem ação explícita.
//
// Causa raiz de "reportei um bug que a Claude disse que já corrigiu, mas
// continua igual" (achado na homologação): o navegador só verifica se
// existe um Service Worker novo automaticamente numa NAVEGAÇÃO de
// verdade (recarregar a página / abrir a aba de novo) — navegar dentro
// do app via React Router nunca dispara essa checagem. Alguém que deixa
// a aba/PWA aberta e só navega pelo menu pode ficar dias rodando um
// build antigo, sem nenhum sinal de que existe versão nova (o toast só
// aparece DEPOIS que o navegador detecta a atualização — e sem checagem
// periódica, isso podia nunca acontecer numa sessão longa). Corrigido
// forçando `registration.update()` a cada 20 minutos enquanto o app
// estiver aberto — só verifica se existe versão nova, não troca nada
// sozinho; o toast "Atualizar" continua exigindo clique, igual antes.
const updateSW = registerSW({
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    window.setInterval(() => {
      registration.update().catch(() => {});
    }, 20 * 60 * 1000);
    // Voltar de outra aba/app é o outro momento comum de ficar "preso"
    // numa versão antiga sem perceber — mesma checagem, só reforçada
    // aqui em vez de depender só do intervalo de 20min.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  },
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

// Limpa a trava alguns segundos depois de um carregamento saudável — sem
// isso, um único erro de chunk (ex.: rede instável) marcaria a sessão
// inteira como "já recarreguei" e um erro de verdade mais tarde no mesmo
// dia nunca mais recarregaria sozinho.
window.setTimeout(() => sessionStorage.removeItem('chm-reload-apos-erro-chunk'), 15000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
