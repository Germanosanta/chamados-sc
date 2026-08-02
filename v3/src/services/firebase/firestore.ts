import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './app';

/**
 * Primitivas genéricas — espelham docs/js/firebase/firestore.js
 * (FirestoreStorage), mesmas 9 coleções + auxiliares, mesmo padrão de
 * escrita (`setDoc` com `merge:true` + `_updatedAt: serverTimestamp()`
 * carimbado em toda gravação). Nenhuma regra/estrutura de dados muda —
 * é só a mesma camada, tipada.
 */
export const COL = {
  usuarios: 'usuarios',
  equipamentos: 'equipamentos',
  chamados: 'chamados',
  historico: 'historico',
  pecas: 'pecas',
  movimentacoes: 'movimentacoes',
  auditoria: 'auditoria',
  configuracoes: 'configuracoes',
  tecnicos: 'tecnicos',
  logins: 'logins',
} as const;

export type ColName = (typeof COL)[keyof typeof COL];

export async function setMerge<T extends DocumentData>(colName: ColName, docId: string, data: T): Promise<void> {
  await setDoc(doc(db, colName, docId), { ...data, _updatedAt: serverTimestamp() }, { merge: true });
}

export async function getOne<T = DocumentData>(colName: ColName, docId: string): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(db, colName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as T) };
}

export async function list<T = DocumentData>(colName: ColName): Promise<(T & { id: string })[]> {
  const snap = await getDocs(collection(db, colName));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
}

export async function buscarPorCampo<T = DocumentData>(
  colName: ColName,
  campo: string,
  valor: unknown,
): Promise<(T & { id: string })[]> {
  const q = query(collection(db, colName), where(campo, '==', valor));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
}

export async function excluirDocumento(colName: ColName, docId: string): Promise<void> {
  await deleteDoc(doc(db, colName, docId));
}

/** Acrescenta 1 item a um array dentro de um doc (ex.:
 * `historico/{num}.eventos`) sem sobrescrever o resto do doc — mesmo
 * padrão de `addEvent()` na V2 (historico/{num}.eventos), só que via
 * `arrayUnion` em vez de ler+reescrever o array inteiro. `extra` cobre
 * campos que devem sempre acompanhar o doc (ex. `num`, pro doc recém-
 * criado por este write já nascer com o mesmo formato que a V2 espera). */
export async function appendToArrayField(
  colName: ColName,
  docId: string,
  field: string,
  item: unknown,
  extra?: DocumentData,
): Promise<void> {
  await setDoc(doc(db, colName, docId), { ...extra, [field]: arrayUnion(item), _updatedAt: serverTimestamp() }, { merge: true });
}

/** Escuta a coleção inteira (mesmo padrão da V2 — sem `where`, sem
 * paginação — os volumes reais dessas coleções são pequenos o bastante
 * pra isso continuar viável). O callback recebe o array completo a cada
 * mudança; quem chama decide como mesclar no cache (ver
 * hooks/useFirestoreCollection.ts). */
export function escutarColecao<T = DocumentData>(
  colName: ColName,
  callback: (items: (T & { id: string })[]) => void,
): Unsubscribe {
  return onSnapshot(collection(db, colName), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
  });
}

export async function gravarEmLote(colName: ColName, items: { id: string; data: DocumentData }[]): Promise<void> {
  // writeBatch tem limite de 500 operações — mesma proteção da V2.
  const CHUNK = 500;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + CHUNK)) {
      batch.set(doc(db, colName, item.id), { ...item.data, _updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }
}
