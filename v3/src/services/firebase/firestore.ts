import {
  addDoc,
  arrayUnion,
  collection,
  increment,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
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
  /** Mini-espelho público de acompanhamento por protocolo — ver
   * utils/acompanhamentoPublico.ts. Doc id = token aleatório (nunca o
   * número do chamado), só com os campos não sensíveis; regra do
   * Firestore permite `get` público mas nunca `list` (ver
   * firestore.rules) — só quem já tem o link exato consegue ler. */
  acompanhamentoPublico: 'acompanhamento_publico',
  /** Módulo Chamados de Irrigação — separado dos chamados de campo. */
  irrigacaoChamados: 'irrigacao_chamados',
  irrigacaoFotos: 'irrigacao_fotos',
  irrigacaoConfig: 'irrigacao_config',
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
/**
 * Achado na investigação de "Técnicos sem dados": `onSnapshot` nunca
 * recebia um callback de erro aqui — se a leitura de uma coleção
 * caísse em erro (regra do Firestore negando, `db` ainda não pronto,
 * queda de rede), o SDK loga um `FirebaseError` no console e simplesmente
 * PARA de chamar o callback de sucesso, sem nunca disparar de novo. Do
 * lado de quem usa o hook (useFirestoreCollection → qualquer
 * useXxxCadastro/useXxx), isso é indistinguível de "a coleção está
 * vazia": `carregando` já tinha virado `false` na tentativa anterior (ou
 * fica `true` pra sempre, se for a primeira leitura), `data` continua
 * `[]`, e a tela mostra "Nenhum registro encontrado" — uma mensagem que
 * é verdade pra coleção vazia e MENTIRA pra erro de leitura, sem
 * nenhuma forma de diferenciar as duas coisas. `onError` agora propaga
 * esse erro pro estado (`erro`, já existia no tipo mas nunca era
 * preenchido) — quem consome o hook decide se quer mostrar isso.
 */
export function escutarColecao<T = DocumentData>(
  colName: ColName,
  callback: (items: (T & { id: string })[]) => void,
  onError?: (erro: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, colName),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
    },
    (erro) => {
      // eslint-disable-next-line no-console -- diagnóstico intencional: sem isso, um erro de leitura de coleção inteira desaparecia em silêncio (ver comentário acima).
      console.error(`[Firestore] onSnapshot('${colName}') falhou:`, erro);
      onError?.(erro);
    },
  );
}

/** Escuta só os logs de auditoria de 1 chamado: a coleção cresce sem
 * limite, e lê-la inteira em toda sessão consome a cota diária de
 * leituras do Firestore. */
export function escutarAuditoriaDoChamado<T = DocumentData>(
  num: string,
  callback: (items: (T & { id: string })[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'auditoria'), where('chamado', '==', num)),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
    },
    (erro) => {
      // eslint-disable-next-line no-console -- mesmo raciocínio de escutarColecao: uma falha de leitura não pode parecer "sem registros".
      console.error(`[Firestore] onSnapshot('auditoria/${num}') falhou:`, erro);
    },
  );
}

/** Escuta 1 doc específico em tempo real — usado pela consulta pública
 * de acompanhamento (ver hooks/useAcompanhamentoPublico.ts): o status
 * precisa refletir sozinho qualquer mudança feita pelo técnico (Assumir/
 * Iniciar/Encerrar), sem o visitante precisar recarregar a página. Mesmo
 * tratamento de erro de `escutarColecao` — nunca falha em silêncio. */
export function escutarDocumento<T = DocumentData>(
  colName: ColName,
  docId: string,
  callback: (item: (T & { id: string }) | null) => void,
  onError?: (erro: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, colName, docId),
    (snap) => {
      callback(snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null);
    },
    (erro) => {
      // eslint-disable-next-line no-console -- mesmo raciocínio de escutarColecao: sem isso, um erro de leitura vira silenciosamente "documento não existe".
      console.error(`[Firestore] onSnapshot('${colName}/${docId}') falhou:`, erro);
      onError?.(erro);
    },
  );
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

/** Igual a `gravarEmLote`, mas aceita gravações em coleções diferentes no
 * mesmo lote (ex.: baixa de estoque em `pecas` + registro em
 * `movimentacoes` + criação do doc em `chamados`, tudo atômico — ou tudo
 * falha, ou nada é gravado, evitando estoque decrementado sem chamado
 * correspondente). */
export async function gravarEmLoteMisto(items: { col: ColName; id: string; data: DocumentData }[]): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + CHUNK)) {
      batch.set(doc(db, item.col, item.id), { ...item.data, _updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Achado na investigação de "auditoria de um chamado mostrando eventos
 * de outros equipamentos/chamados completamente diferentes": o número de
 * um chamado novo (`CHM-0001`, `CHM-0002`, ...) era calculado só no
 * cliente, como `data.length + 1` (useProximoNumero, hooks/useChamados.ts)
 * — sem transação, sem contador no servidor. Dois chamados abertos por
 * pessoas diferentes num intervalo curto (antes do listener em tempo
 * real de `chamados` refletir o primeiro) calculam o MESMO `data.length`
 * e geram o MESMO número. Como o número vira o próprio ID do documento
 * em `chamados/{num}` (useCriarChamado), o segundo `setMerge` não cria
 * um chamado novo — ele MESCLA por cima do primeiro, cujos dados
 * (equipamento, descrição, fazenda) desaparecem substituídos pelos do
 * segundo. A entrada de auditoria de CADA abertura, porém, é gravada à
 * parte (`auditoria/log_<ts>`, nunca sobrescrita) com o mesmo `chamado`
 * colidido — por isso a mesma tela de auditoria acumula, ao longo do
 * tempo, aberturas de vários equipamentos completamente diferentes sob
 * o mesmo número: o número foi reaproveitado várias vezes de verdade.
 *
 * Correção: aloca o número dentro de uma `runTransaction` contra um
 * contador único (`configuracoes/contadorChamados.ultimoNumero`) — o
 * SDK do Firestore reexecuta a transação automaticamente em caso de
 * disputa concorrente, então duas aberturas simultâneas NUNCA mais saem
 * com o mesmo número, sem precisar de Cloud Functions (plano Spark).
 * `maiorExistente` é o maior número já usado: o contador nasceu da
 * contagem de chamados, que pode ficar abaixo da numeração real, e a
 * sequência nunca pode voltar para trás. A checagem de `chamados/{num}`
 * garante que um número já usado nunca seja reaproveitado, porque a
 * gravação do chamado faz merge e escreveria por cima do existente.
 */
export async function alocarProximoNumeroChamado(maiorExistente: number): Promise<string> {
  const ref = doc(db, 'configuracoes', 'contadorChamados');
  const formatar = (n: number) => `CHM-${String(n).padStart(4, '0')}`;
  const proximo = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const contador = snap.exists() && typeof snap.data().ultimoNumero === 'number' ? (snap.data().ultimoNumero as number) : 0;
    let novo = Math.max(contador, maiorExistente) + 1;
    while ((await tx.get(doc(db, 'chamados', formatar(novo)))).exists()) novo += 1;
    tx.set(ref, { ultimoNumero: novo, _updatedAt: serverTimestamp() }, { merge: true });
    return novo;
  });
  return formatar(proximo);
}

// ── Chamados de Irrigação ───────────────────────────────────────────────

/**
 * Cria o chamado de irrigação e aloca o número na MESMA transação: lê o
 * contador próprio (irrigacao_config/contador), pula qualquer número que
 * já exista e grava o chamado sem merge. Nunca sobrescreve um chamado e
 * nunca deixa um número reservado sem chamado.
 */
export async function criarChamadoIrrigacaoComNumero(
  dados: (num: string) => DocumentData,
  formatar: (n: number) => string,
): Promise<string> {
  const contadorRef = doc(db, COL.irrigacaoConfig, 'contador');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(contadorRef);
    const atual = snap.exists() && typeof snap.data().ultimoNumero === 'number' ? (snap.data().ultimoNumero as number) : 0;
    let novo = atual + 1;
    while ((await tx.get(doc(db, COL.irrigacaoChamados, formatar(novo)))).exists()) novo += 1;
    const num = formatar(novo);
    tx.set(contadorRef, { ultimoNumero: novo, _updatedAt: serverTimestamp() }, { merge: true });
    tx.set(doc(db, COL.irrigacaoChamados, num), { ...dados(num), _updatedAt: serverTimestamp() });
    return num;
  });
}

/** Atualiza campos e acrescenta itens a campos-lista (histórico, materiais)
 * sem regravar a lista inteira. `updateDoc` falha se o chamado não existir. */
export async function atualizarComListas(
  colName: ColName,
  docId: string,
  campos: DocumentData,
  listas: Record<string, unknown[]> = {},
  incrementos: Record<string, number> = {},
): Promise<void> {
  const extra: DocumentData = {};
  for (const [campo, itens] of Object.entries(listas)) if (itens.length) extra[campo] = arrayUnion(...itens);
  for (const [campo, n] of Object.entries(incrementos)) extra[campo] = increment(n);
  await updateDoc(doc(db, colName, docId), { ...campos, ...extra, _updatedAt: serverTimestamp() });
}

export async function adicionarDocumento(colName: ColName, data: DocumentData): Promise<string> {
  const ref = await addDoc(collection(db, colName), { ...data, _updatedAt: serverTimestamp() });
  return ref.id;
}

/** Escuta só os documentos de uma coleção cujo `campo` é igual a `valor`. */
export function escutarPorCampo<T = DocumentData>(
  colName: ColName,
  campo: string,
  valor: string,
  callback: (items: (T & { id: string })[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, colName), where(campo, '==', valor)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))),
    (erro) => {
      // eslint-disable-next-line no-console -- uma falha de leitura não pode parecer "sem registros".
      console.error(`[Firestore] onSnapshot('${colName}' ${campo}=${valor}) falhou:`, erro);
    },
  );
}

/**
 * Assume/atualiza um documento só se `bloqueio` permitir, lendo o estado
 * atual dentro de uma transação: dois técnicos clicando "Assumir" ao mesmo
 * tempo nunca ficam os dois como responsáveis; o segundo recebe o motivo.
 * `seed` cria o documento quando ele ainda não existe no Firestore (chamado
 * de campo que só existe no histórico estático); sem `seed`, documento
 * inexistente é erro.
 */
export async function atualizarSeLivre(
  colName: ColName,
  docId: string,
  opcoes: { seed?: DocumentData; campos: DocumentData; listas?: Record<string, unknown[]> },
  bloqueio: (atual: DocumentData) => string | null,
): Promise<void> {
  const ref = doc(db, colName, docId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() && !opcoes.seed) throw new Error('chamado não encontrado');
    const atual = snap.exists() ? snap.data() : (opcoes.seed as DocumentData);
    const motivo = bloqueio(atual);
    if (motivo) throw new Error(motivo);
    const extra: DocumentData = {};
    for (const [campo, itens] of Object.entries(opcoes.listas || {})) if (itens.length) extra[campo] = arrayUnion(...itens);
    const dados = { ...opcoes.campos, ...extra, _updatedAt: serverTimestamp() };
    if (snap.exists()) tx.update(ref, dados);
    else tx.set(ref, { ...opcoes.seed, ...dados });
  });
}
