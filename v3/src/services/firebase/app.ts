import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

/**
 * Mesmo projeto Firebase da V2 (docs/js/firebase/firebase.js) — config
 * pública do client, não é segredo (já publicada no bundle da V2 hoje).
 * Lida via env do Vite (ver .env.example) pra seguir a prática padrão do
 * ecossistema, mas os valores em si são idênticos aos hardcoded na V2.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Cache persistente (IndexedDB) com abas compartilhando uma só conexão: ao
 * recarregar a página, abrir outra aba ou aplicar uma versão nova, o
 * Firestore usa o que já está no navegador e só busca no servidor o que
 * mudou — antes cada recarga relia ~2.800 chamados + histórico e esgotava a
 * cota diária gratuita de leituras. O cache é apagado ao clicar em "Sair"
 * (ver logout em auth.ts), por causa dos terminais compartilhados.
 */
function criarFirestore() {
  try {
    return initializeFirestore(firebaseApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    // Já inicializado (recarga a quente em desenvolvimento).
    return getFirestore(firebaseApp);
  }
}

export const db = criarFirestore();

export const auth = getAuth(firebaseApp);
// Sessão dura só enquanto a aba fica aberta — mesmo comportamento da V2
// (browserSessionPersistence), decisão deliberada de segurança operacional
// (terminais compartilhados de campo), preservada na V3.
void auth.setPersistence(browserSessionPersistence);
