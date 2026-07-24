import { initializeApp }                           from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
    import { getFirestore, collection, doc, setDoc,
             getDoc, getDocs, onSnapshot, serverTimestamp }
                                                       from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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

    // ── Expose db + helpers on window so the main (classic) script can call them
    window._db = db;
    window._fsDoc        = (path) => doc(db, ...path.split('/'));
    window._fsCollection = (path) => collection(db, path);
    window._fsSet        = setDoc;
    window._fsGet        = getDoc;
    window._fsGetDocs    = getDocs;
    window._fsTimestamp  = serverTimestamp;
    window._fsOnSnapshot = onSnapshot;

    // ── Generic write: col/docId ← data (merges, non-destructive)
    window.fsSave = async function(colName, docId, data) {
      try {
        await setDoc(doc(db, colName, docId), { ...data, _updatedAt: serverTimestamp() }, { merge: true });
      } catch(e) {
        console.warn('[Firebase] fsSave failed:', colName, docId, e.message);
      }
    };

    // ── Generic read: returns document data or null
    window.fsGet = async function(colName, docId) {
      try {
        const snap = await getDoc(doc(db, colName, docId));
        return snap.exists() ? snap.data() : null;
      } catch(e) {
        console.warn('[Firebase] fsGet failed:', colName, docId, e.message);
        return null;
      }
    };

    // ── Generic list: returns array of {id, ...data}
    window.fsList = async function(colName) {
      try {
        const snap = await getDocs(collection(db, colName));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e) {
        console.warn('[Firebase] fsList failed:', colName, e.message);
        return [];
      }
    };

    // ── Real-time listener for a collection
    // Returns unsubscribe function
    window.fsListen = function(colName, callback) {
      return onSnapshot(collection(db, colName), snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(docs);
      }, err => console.warn('[Firebase] fsListen error:', err.message));
    };

    // ── Sync on startup: pull Firestore → localStorage for each collection
    window.fsSyncAll = async function() {
      const COLLECTIONS = [
        { name:'chamados',    key:'chm_local_v1'    },
        { name:'encerramentos',key:'chm_closed_v1'  },
        { name:'kb',          key:'chm_kb_v1'       },
        { name:'pecas',       key:'chm_pecas_v1'    },
        { name:'movimentacoes',key:'chm_movs_v1'    },
        { name:'events',      key:'chm_events_v1'   },
        { name:'auditoria',   key:'chm_audit_v1'    },
        { name:'cad_eq',      key:'chm_cad_eq_v1'   },
        { name:'cad_tec',     key:'chm_cad_tec_v1'  },
        { name:'usuarios',    key:'chm_users_v1'    },
      ];
      for (const col of COLLECTIONS) {
        try {
          const snap = await getDocs(collection(db, col.name));
          if (!snap.empty) {
            // For array collections: store as array
            if (['chamados','kb','pecas','movimentacoes'].includes(col.name)) {
              const arr = snap.docs.map(d => { const {_updatedAt,...rest}=d.data(); return rest; });
              localStorage.setItem(col.key, JSON.stringify(arr));
            } else {
              // For object collections (events, auditoria, cad_eq, etc.)
              const obj = {};
              snap.docs.forEach(d => { const {_updatedAt,...rest}=d.data(); obj[d.id]=rest; });
              localStorage.setItem(col.key, JSON.stringify(obj));
            }
          }
        } catch(e) {
          console.warn('[Firebase] fsSyncAll failed for', col.name, e.message);
        }
      }
      console.log('[Firebase] Sync completo.');
      if (typeof refreshAfterAction === 'function') refreshAfterAction();
    };

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
      // Auto-sync after login (called from doLogin)
    });

    console.log('[Firebase] SDK carregado — projeto: chamdos-sc');