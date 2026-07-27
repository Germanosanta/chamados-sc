import { initializeApp, deleteApp }                from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
    import { getFirestore, collection, doc, setDoc,
             getDoc, getDocs, onSnapshot, serverTimestamp }
                                                       from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
    import { getAuth, setPersistence, browserSessionPersistence,
             signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
             createUserWithEmailAndPassword, updatePassword }
                                                       from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
    import FirestoreStorage                           from "./firestore.js";

    const firebaseConfig = {
      apiKey:            "AIzaSyDalH6I1uHQyW5cfZresj-Q9EieGk58g54",
      authDomain:        "chamdos-sc.firebaseapp.com",
      projectId:         "chamdos-sc",
      storageBucket:     "chamdos-sc.firebasestorage.app",
      messagingSenderId: "813048921429",
      appId:             "1:813048921429:web:5cccf543918d5b0dbb83dc",
    };

    const app = initializeApp(firebaseConfig);
    const db  = getFirestore(app);
    FirestoreStorage.configure(db); // src/firestoreStorage.js passa a ser o único módulo que fala com o Firestore

    // ── Firebase Authentication — sessão dura só enquanto a aba fica aberta
    //    (mesmo comportamento que a sessão baseada em sessionStorage já tinha).
    const auth = getAuth(app);
    setPersistence(auth, browserSessionPersistence).catch(e => console.warn('[Firebase] setPersistence falhou:', e.message));
    window._auth = auth;

    window.fbSignIn = (email, senha) => signInWithEmailAndPassword(auth, email, senha);
    window.fbSignOut = () => signOut(auth);
    window.fbSendPasswordReset = (email) => sendPasswordResetEmail(auth, email);
    // Troca de senha do PRÓPRIO usuário logado (fluxo de troca obrigatória no 1º acesso).
    window.fbUpdatePassword = (novaSenha) => updatePassword(auth.currentUser, novaSenha);

    // ── Cria a conta de OUTRO usuário sem afetar a sessão do admin logado:
    //    usa uma instância secundária do app Firebase só para o createUser,
    //    depois descarta essa instância. Padrão documentado do Firebase para
    //    esse cenário — não exige Cloud Functions/Admin SDK.
    window.fbCreateAuthUser = async function(email, senha) {
      const secondaryApp = initializeApp(firebaseConfig, 'Secondary-' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
        await signOut(secondaryAuth);
        return cred.user.uid;
      } finally {
        await deleteApp(secondaryApp);
      }
    };

    // ── Expose db + helpers on window so the main (classic) script can call them
    window._db = db;
    window._fsDoc        = (path) => doc(db, ...path.split('/'));
    window._fsCollection = (path) => collection(db, path);
    window._fsSet        = setDoc;
    window._fsGet        = getDoc;
    window._fsGetDocs    = getDocs;
    window._fsTimestamp  = serverTimestamp;
    window._fsOnSnapshot = onSnapshot;

    // ── Chaves do cache local (devem casar com src/storage.js)
    const K = {
      chamados:'chm_local_v1', closed:'chm_closed_v1', users:'chm_users_v1',
      kb:'chm_kb_v1', pecas:'chm_pecas_v1', movs:'chm_movs_v1',
      events:'chm_events_v1', audit:'chm_audit_v1', cadEq:'chm_cad_eq_v1', cadTec:'chm_cad_tec_v1',
    };

    // ── Coleções PADRONIZADAS (9) — mesmos nomes de src/firestoreStorage.js#COL
    const COL = FirestoreStorage.COL;

    // ── Normalização (escrita): mapeia nomes LEGADOS (usados por src/config/index.js
    //    e pelo rewrap abaixo) para as coleções padronizadas + formato de dado esperado.
    function _normalize(colName, docId, data) {
      switch (colName) {
        case 'cad_eq':        return { col:COL.EQUIPAMENTOS,  id:docId, data };
        case 'events':        return { col:COL.HISTORICO,     id:docId, data:{ num:docId, eventos:(data && data.eventos) ? data.eventos : data } };
        case 'encerramentos': return { col:COL.HISTORICO,     id:docId, data:{ num:docId, encerramento:data } };
        case 'kb':            return { col:COL.CONFIGURACOES, id:'kb__'+docId, data:{ __kind:'kb', ...(data||{}) } };
        case 'cad_tec':       return { col:COL.TECNICOS,      id:docId, data };
        default:              return { col:colName,           id:docId, data };
      }
    }
    // ── Normalização (leitura): só resolve o nome da coleção, sem transformar dado.
    function _normalizeColName(colName) {
      const map = { cad_eq:COL.EQUIPAMENTOS, events:COL.HISTORICO, encerramentos:COL.HISTORICO, kb:COL.CONFIGURACOES, cad_tec:COL.TECNICOS };
      return map[colName] || colName;
    }

    // ── Generic write/read/list/listen: delegam para src/firestoreStorage.js
    //    (única implementação real de acesso ao Firestore no projeto).
    window.fsSave = async function(colName, docId, data) {
      const t = _normalize(colName, docId, data);
      const res = await FirestoreStorage.salvarDocumento(t.col, t.id, t.data);
      if (!res.ok) console.warn('[Firebase] fsSave falhou:', t.col, t.id, res.error);
      return res;
    };

    window.fsGet = async function(colName, docId) {
      const res = await FirestoreStorage.lerDocumento(_normalizeColName(colName), docId);
      if (!res.ok) { console.warn('[Firebase] fsGet falhou:', colName, docId, res.error); return null; }
      return res.data;
    };

    window.fsList = async function(colName) {
      const res = await FirestoreStorage.listarColecao(_normalizeColName(colName));
      if (!res.ok) { console.warn('[Firebase] fsList falhou:', colName, res.error); return []; }
      return res.data.items;
    };

    window.fsListen = function(colName, callback) {
      return FirestoreStorage.escutarColecao(_normalizeColName(colName), callback);
    };

    // ════════════════════════════════════════════════════════════
    // FIRESTORE → CACHE (localStorage). Merge não destrutivo: dados criados
    // offline (ainda não no Firestore) são preservados; o Firestore vence por id.
    // As funções _apply* abaixo recebem um array de itens já normalizados
    // ({id, ...data}), vindo de FirestoreStorage.listarColecao/escutarColecao.
    // ════════════════════════════════════════════════════════════
    const _clean = d => { const {_updatedAt, ...rest} = d; return rest; };
    const _readLS  = (key, def) => { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } };
    const _writeLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

    // Array por id: Firestore vence; itens locais sem correspondente são mantidos.
    function _applyArray(items, key, idField) {
      if (!items.length) return;
      const remote = items.map(_clean);
      const local  = _readLS(key, []);
      const ids = new Set(remote.map(r => r[idField]));
      const keptLocal = Array.isArray(local) ? local.filter(l => l && !ids.has(l[idField])) : [];
      _writeLS(key, [...remote, ...keptLocal]);
    }
    // Map por docId: merge de chaves; Firestore vence por chave.
    function _applyMap(items, key) {
      if (!items.length) return;
      const merged = { ..._readLS(key, {}) };
      items.forEach(it => { merged[it.id] = _clean(it); });
      _writeLS(key, merged);
    }
    // Chamados: como array por 'num', preservando as fotos (base64) que só existem no cache.
    function _applyChamados(items) {
      if (!items.length) return;
      const local = _readLS(K.chamados, []);
      const fotosByNum = {};
      (Array.isArray(local)?local:[]).forEach(r => { if (r && r.num && r.fotos) fotosByNum[r.num] = r.fotos; });
      const remote = items.map(it => {
        const rec = _clean(it);
        if (fotosByNum[rec.num]) rec.fotos = fotosByNum[rec.num];
        return rec;
      });
      const nums = new Set(remote.map(r => r.num));
      const keptLocal = (Array.isArray(local)?local:[]).filter(l => l && !nums.has(l.num));
      _writeLS(K.chamados, [...remote, ...keptLocal]);
    }
    // Histórico: um doc por chamado com {eventos, encerramento} → separa nos 2 caches.
    function _applyHistorico(items) {
      if (!items.length) return;
      const events = { ..._readLS(K.events, {}) };
      const closed = { ..._readLS(K.closed, {}) };
      items.forEach(it => {
        const data = _clean(it);
        if (data.eventos)      events[it.id] = data.eventos;
        if (data.encerramento) closed[it.id] = data.encerramento;
      });
      _writeLS(K.events, events);
      _writeLS(K.closed, closed);
    }
    // Configurações: hoje só o Banco de Soluções (KB) vive aqui (prefixo kb__).
    function _applyConfig(items) {
      if (!items.length) return;
      const kbLocal = _readLS(K.kb, []);
      const kb = [];
      const seenKb = new Set();
      items.forEach(it => {
        const data = _clean(it);
        if (it.id.startsWith('kb__') || data.__kind === 'kb') {
          const { __kind, ...k } = data; kb.push(k); if (k.id) seenKb.add(k.id);
        }
      });
      const keptKb = (Array.isArray(kbLocal)?kbLocal:[]).filter(k => k && !seenKb.has(k.id));
      if (kb.length) _writeLS(K.kb, [...kb, ...keptKb]);
    }
    // Auditoria: log append-only → união deduplicada por assinatura, ordenada, cap 2000.
    function _applyAudit(items) {
      if (!items.length) return;
      const local  = _readLS(K.audit, []);
      const remote = items.map(_clean);
      const seen = new Set();
      const all = [...(Array.isArray(local)?local:[]), ...remote].filter(e => {
        const sig = (e.ts||'')+'|'+(e.tipo||'')+'|'+(e.detalhe||'')+'|'+(e.chamado||'');
        if (seen.has(sig)) return false; seen.add(sig); return true;
      });
      all.sort((a,b) => (a.ts||'').localeCompare(b.ts||''));
      _writeLS(K.audit, all.slice(-2000));
    }

    // Mapa único das coleções sincronizadas — usado tanto pelo pull completo (fsSyncAll)
    // quanto pelos listeners em tempo real (fsStartRealtime), evitando duplicar a lista.
    const SYNC_JOBS = [
      [COL.CHAMADOS,      _applyChamados],
      [COL.HISTORICO,     _applyHistorico],
      [COL.USUARIOS,      items => _applyArray(items, K.users, 'id')],
      [COL.PECAS,         items => _applyArray(items, K.pecas, 'id')],
      [COL.MOVIMENTACOES, items => _applyArray(items, K.movs,  'id')],
      [COL.EQUIPAMENTOS,  items => _applyMap(items, K.cadEq)],
      [COL.CONFIGURACOES, _applyConfig],
      [COL.TECNICOS,      items => _applyMap(items, K.cadTec)],
    ];

    // ── Sync completo Firestore → cache (usado no startup e nos botões do config)
    window.fsSyncAll = async function() {
      for (const [col, apply] of SYNC_JOBS) {
        const res = await FirestoreStorage.listarColecao(col);
        if (res.ok) apply(res.data.items);
        else console.warn('[Firebase] fsSyncAll falhou em', col, res.error);
      }
      // Auditoria: log crescente, sincronizado aqui (não entra no tempo real, ver fsStartRealtime).
      const auditRes = await FirestoreStorage.listarColecao(COL.AUDITORIA);
      if (auditRes.ok) _applyAudit(auditRes.data.items);
      else console.warn('[Firebase] fsSyncAll falhou em', COL.AUDITORIA, auditRes.error);

      console.log('[Firebase] Sync completo.');
      if (typeof refreshAfterAction === 'function') refreshAfterAction();
    };

    // ── Listeners em tempo real → cache sempre reflete o Firestore (fonte principal).
    //    Auditoria fica de fora (log crescente) — sincroniza sob demanda via fsSyncAll.
    let _realtimeUnsubs = [];
    window.fsStartRealtime = function() {
      if (window._fsRealtimeOn) return;
      window._fsRealtimeOn = true;
      let pending = false;
      const relay = () => {
        if (pending) return; pending = true;
        setTimeout(() => { pending = false; if (typeof refreshAfterAction === 'function') refreshAfterAction(); }, 250);
      };
      for (const [col, apply] of SYNC_JOBS) {
        const unsub = FirestoreStorage.escutarColecao(col, items => {
          try { apply(items); } catch(e) { console.warn('[Firebase] realtime', col, e.message); }
          relay();
        });
        _realtimeUnsubs.push(unsub);
      }
    };

    // ── Encerra os listeners (chamado no logout). Sem isso, um login seguinte
    //    na mesma aba não reativaria o tempo real (guard _fsRealtimeOn ficaria
    //    travado em true com os listeners antigos já invalidados pelo signOut).
    window.fsStopRealtime = function() {
      _realtimeUnsubs.forEach(unsub => { try { unsub(); } catch(e) {} });
      _realtimeUnsubs = [];
      window._fsRealtimeOn = false;
    };

    // ════════════════════════════════════════════════════════════
    // RE-WRAP pós-init: js/modules/usuarios/index.js redefine saveUsers DEPOIS de
    // js/core/storage.js (ambos scripts clássicos) numa versão sem persistência
    // remota. Como este módulo executa por último, reinstalamos o push ao
    // Firestore sobre a versão final. (saveClosed/saveKB/savePecas já não são
    // mais redefinidas em nenhum outro script — js/core/storage.js é a única
    // declaração e já empurra pro Firestore nativamente, sem precisar de
    // rewrap. addEvent() faz o próprio push inline, não usa saveEvents.)
    // ════════════════════════════════════════════════════════════
    (function _rewrapShadowed() {
      function rewrap(name, push) {
        if (typeof window[name] !== 'function' || window[name]._fbHooked) return;
        const orig = window[name];
        const wrapped = function(...args) {
          orig.apply(this, args);
          try { push(...args); } catch(e) { console.warn('[Firebase] rewrap', name, 'falhou:', e.message); }
        };
        wrapped._fbHooked = true;
        window[name] = wrapped;
      }
      rewrap('saveUsers', u => (u||[]).forEach(usr => { if (usr && usr.id) window.fsSave(COL.USUARIOS, String(usr.id), usr); }));
    })();

    // ── Status indicator in topbar
    async function pingFirestore() {
      try {
        const t0=Date.now();
        await getDoc(doc(db,'_ping','_ping'));
        const ms=Date.now()-t0;
        window._fbOnline=true;
        setFbStatus('online', ms+'ms');
      } catch(e) {
        window._fbOnline=false;
        setFbStatus('offline');
      }
    }

    function setFbStatus(status, latency) {
      const el=document.getElementById('fb-status');
      if (!el) return;
      if (status==='online') {
        el.title=`Firebase conectado (${latency})`;
        el.style.background='var(--green)';
      } else {
        el.title='Firebase offline — dados locais';
        el.style.background='var(--red)';
      }
    }

    // Run on load
    window.addEventListener('load', () => {
      pingFirestore();
      setInterval(pingFirestore, 30000);
      // As regras do Firestore agora exigem login (request.auth != null) para ler
      // qualquer coleção real. Só dá pra sincronizar aqui se já existir uma sessão
      // (caso de F5 na mesma aba — o Firebase Auth restaura o login sozinho via
      // persistência de sessão). Login novo dispara o sync via fbSyncAfterLogin()
      // (js/modules/config/index.js), chamado dentro de doLogin().
      if (typeof getSession === 'function' && getSession()) {
        window.fsSyncAll()
          .then(() => window.fsStartRealtime())
          .catch(e => { console.warn('[Firebase] fsSyncAll rejeitou:', e.message); window.fsStartRealtime(); });
      }
    });

    console.log('[Firebase] SDK carregado — projeto: chamdos-sc');
