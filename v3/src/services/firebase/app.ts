import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const db = getFirestore(firebaseApp);

export const auth = getAuth(firebaseApp);
// Sessão dura só enquanto a aba fica aberta — mesmo comportamento da V2
// (browserSessionPersistence), decisão deliberada de segurança operacional
// (terminais compartilhados de campo), preservada na V3.
void auth.setPersistence(browserSessionPersistence);
