/* =====================================================================
   جمعية المساجد بالزلفي — ربط لوحة التحكم وبوابة المناديب بقاعدة Firebase
   - يقرأ الإعدادات من firebase-config.js (window.ZULFI_FIREBASE)
   - يدعم Cloud Firestore (الافتراضي) أو Realtime Database (إذا وُجد databaseURL)
   - كل قسم من بيانات النظام يُحفظ في سجل مستقل، والتحديثات تصل للجميع لحظياً
   ===================================================================== */
(function(){
  'use strict';
  var CFG = window.ZULFI_FIREBASE || {};
  var APP = (typeof IS_PORTAL !== 'undefined' && IS_PORTAL) ? 'portal' : 'admin';
  var ROOT = CFG.root || 'zulfi';
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  /* البوابة لا تكتب حسابات الموظفين ومصفوفة الصلاحيات (تُدار من لوحة التحكم فقط) */
  var NO_WRITE = APP === 'portal' ? ['users', 'perms', 'boardCfg'] : [];
  var CHUNK = 300000;           /* حجم الجزء في Firestore (حد المستند 1MB) */
  var base = {};                /* آخر نسخة متزامنة لكل قسم */
  var adapter = null, ready = false, pushTimer = null, pendingRender = false;

  var isShared = function(k){ return k && k.charAt(0) !== '_' && typeof S[k] !== 'function'; };
  var canWrite = function(k){ return isShared(k) && NO_WRITE.indexOf(k) < 0; };
  /* عناصر محلية فقط (مثل محادثات التطبيق المعروضة في مركز المحادثات) لا تُحفظ ولا تُرفع */
  var LOCALONLY = function(k, v){ return (Array.isArray(v) && v.some(function(e){ return e && e._app; })) ? v.filter(function(e){ return !(e && e._app); }) : v; };
  var J = function(v){ try { return JSON.stringify(v === undefined ? null : v, LOCALONLY); } catch(e){ return null; } };

  /* ---------- مؤشر الاتصال ---------- */
  var pill = document.createElement('div');
  pill.id = 'dbPill';
  pill.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;width:14px;height:14px;padding:0;border-radius:50%;display:block;box-shadow:0 0 0 3px rgba(255,255,255,.9),0 2px 8px rgba(20,60,84,.25);cursor:help';
  function status(kind, text){
    var c = {ok:['#E3F3EA','#1F6B45'], wait:['#F3ECDD','#8A6F3D'], off:['#ECEFF2','#5B7383'], err:['#FFDAD6','#93000A']}[kind] || ['#ECEFF2','#5B7383'];
    pill.innerHTML = ''; pill.style.background = c[1]; pill.setAttribute('role', 'status'); pill.setAttribute('aria-label', text);
    pill.title = text;
  }
  function placePill(){ pill.style.bottom = (window.innerWidth <= 900 && document.querySelector('.bottom-nav,#bottomNav')) ? '78px' : '12px'; }
  document.body.appendChild(pill); placePill(); window.addEventListener('resize', placePill);

  /* شاشة التحميل بشعار الجمعية */
  var isDarkUI = function(){ var t = document.documentElement.dataset.theme; return t ? t === 'dark' : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); };
  var st = document.createElement('style');
  st.textContent = '#zVeil{position:fixed;inset:0;z-index:9998;display:none;align-items:center;justify-content:center;flex-direction:column;gap:22px;background:#F5F7F9;direction:rtl;font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;padding:24px;text-align:center}' +
    '#zVeil img{width:min(300px,70vw);height:auto;animation:zFade 1.6s ease-in-out infinite alternate}' +
    '#zVeil .zs{width:46px;height:46px;border-radius:50%;border:4px solid #E2E8F0;border-top-color:#C5A976;border-left-color:#1D5271;animation:zSpin .9s linear infinite}' +
    '#zVeil b{font-size:18px;color:#143C54;font-weight:700}#zVeil small{font-size:13px;color:#8A6F3D}' +
    '#zVeil.dk{background:#0F1B22}#zVeil.dk b{color:#E6EEF3}#zVeil.dk small{color:#C5A976}#zVeil.dk .zs{border-color:#2B3F4B;border-top-color:#C5A976;border-left-color:#9CCCF0}' +
    '@keyframes zSpin{to{transform:rotate(360deg)}}@keyframes zFade{from{opacity:.75}to{opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){#zVeil img,#zVeil .zs{animation:none}}';
  document.head.appendChild(st);
  var veil = document.createElement('div'); veil.id = 'zVeil'; veil.setAttribute('role', 'status'); veil.setAttribute('aria-label', 'جاري التحميل');
  var logoSrc = function(){ var el = document.getElementById('logoColor'); return (el && el.src) || 'logo.png'; };
  veil.innerHTML = '<img alt="جمعية المساجد بالزلفي"><div class="zs" aria-hidden="true"></div><small>جمعية المساجد بالزلفي · خدمتكم هدفنا</small>';
  document.body.appendChild(veil);
  function showVeil(on){
    if (on) { var dk = isDarkUI(); veil.classList.toggle('dk', dk); var im = veil.querySelector('img'); im.src = logoSrc(); im.style.filter = dk ? 'brightness(0) invert(1)' : ''; }
    veil.style.display = on ? 'flex' : 'none';
  }

  if (!CFG.apiKey || !CFG.projectId) {
    status('off', 'غير مربوط بقاعدة البيانات: أكمل firebase-config.js');
    console.warn('[zulfi-sync] إعدادات Firebase ناقصة (projectId مطلوب). يعمل النظام محلياً فقط.');
    return;
  }

  /* ---------- تحميل مكتبات Firebase ---------- */
  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = function(){ rej(new Error('تعذر تحميل ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadSDK(){
    if (window.__ZULFI_TEST_ADAPTER) return Promise.resolve();
    var useRTDB = !!CFG.databaseURL;
    return loadScript(SDK + 'firebase-app-compat.js')
      .then(function(){ return loadScript(SDK + 'firebase-auth-compat.js'); })
      .then(function(){ return loadScript(SDK + (useRTDB ? 'firebase-database-compat.js' : 'firebase-firestore-compat.js')); });
  }

  /* ---------- Realtime Database ---------- */
  function rtdbAdapter(){
    var ref = firebase.database().ref(ROOT + '/state');
    return {
      name: 'Realtime Database',
      loadAll: function(){
        return ref.once('value').then(function(snap){
          var out = {}; var v = snap.val() || {};
          Object.keys(v).forEach(function(k){ if (v[k] && typeof v[k].v === 'string') out[k] = v[k].v; });
          return out;
        });
      },
      write: function(k, str){
        return ref.child(k).set({ v: str, by: APP, t: firebase.database.ServerValue.TIMESTAMP });
      },
      subscribe: function(cb){
        var h = function(snap){ var d = snap.val(); if (d && typeof d.v === 'string') { var o = {}; o[snap.key] = d.v; cb(o); } };
        ref.on('child_added', h); ref.on('child_changed', h);
      }
    };
  }

  /* ---------- Cloud Firestore (مع تقسيم الأقسام الكبيرة) ---------- */
  function firestoreAdapter(){
    var db = firebase.firestore();
    var col = db.collection(ROOT + '_state');
    var cache = {};   /* id -> data */
    function assemble(key){
      var m = cache[key]; if (!m || typeof m.v !== 'string') return null;
      var n = m.parts || 1; if (n === 1) return m.v;
      var s = m.v;
      for (var i = 1; i < n; i++) {
        var c = cache[key + '~' + i];
        if (!c || c.rev !== m.rev) return null;
        s += c.v;
      }
      return s;
    }
    function keysOf(ids){
      var ks = {}; ids.forEach(function(id){ ks[id.split('~')[0]] = 1; }); return Object.keys(ks);
    }
    return {
      name: 'Cloud Firestore',
      loadAll: function(){
        return col.get().then(function(qs){
          var ids = [];
          qs.forEach(function(d){ cache[d.id] = d.data(); ids.push(d.id); });
          var out = {};
          keysOf(ids).forEach(function(k){ var s = assemble(k); if (s !== null) out[k] = s; });
          return out;
        });
      },
      write: function(k, str){
        var parts = Math.max(1, Math.ceil(str.length / CHUNK));
        var rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        var batch = db.batch();
        for (var i = 1; i < parts; i++) batch.set(col.doc(k + '~' + i), { v: str.slice(i * CHUNK, (i + 1) * CHUNK), rev: rev });
        batch.set(col.doc(k), { v: str.slice(0, CHUNK), parts: parts, rev: rev, by: APP, t: firebase.firestore.FieldValue.serverTimestamp() });
        return batch.commit();
      },
      subscribe: function(cb){
        col.onSnapshot(function(qs){
          /* لا نتجاهل اللقطة كاملة عند وجود كتابة محلية معلّقة، وإلا ضاعت تحديثات الطرف الآخر التي وصلت معها */
          var ids = [];
          qs.docChanges().forEach(function(ch){
            if (ch.type === 'removed') { delete cache[ch.doc.id]; return; }
            cache[ch.doc.id] = ch.doc.data();
            if (!(ch.doc.metadata && ch.doc.metadata.hasPendingWrites)) ids.push(ch.doc.id);
          });
          var out = {}, any = false;
          keysOf(ids).forEach(function(k){ var s = assemble(k); if (s !== null) { out[k] = s; any = true; } });
          if (any) cb(out);
        }, function(err){ status('err', 'انقطع الاتصال بقاعدة البيانات'); console.error('[zulfi-sync]', err); });
      }
    };
  }

  /* ---------- تطبيق البيانات الواردة ---------- */
  function safeRender(){
    var a = document.activeElement;
    if (a && a.id === 'msgIn') { try { render(); } catch(e){ console.error('[zulfi-sync] render', e); } try { scrollMsgs(); } catch(e){} return; }
    var typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest && a.closest('#view');
    if (typing) {
      if (pendingRender) return; pendingRender = true;
      a.addEventListener('blur', function(){ pendingRender = false; setTimeout(safeRender, 50); }, { once: true });
      return;
    }
    try { render(); } catch(e){ console.error('[zulfi-sync] render', e); }
  }
  /* ---------- دمج السجلات: كل عنصر له id يُدمج وحده (الأحدث يفوز) بدل استبدال القائمة كاملة ---------- */
  var seen = {};
  function idArr(v){ return Array.isArray(v) && v.length > 0 && v.every(function(e){ return e && typeof e === 'object' && (typeof e.id === 'string' || typeof e.id === 'number'); }); }
  function ej(e){ var u = e._u; if (u !== undefined) delete e._u; var j = J(e); if (u !== undefined) e._u = u; return j; }
  function remember(k){ if (!idArr(S[k])) { delete seen[k]; return; } var m = {}; S[k].forEach(function(e){ if (!e._app) m[e.id] = ej(e); }); seen[k] = m; }
  function stamp(){
    var now = Date.now();
    Object.keys(S).forEach(function(k){ if (!canWrite(k) || !idArr(S[k])) return; var sk = seen[k] || (seen[k] = {});
      S[k].forEach(function(e){ if (e._app) return; if (Array.isArray(e.msgs)) e.msgs.forEach(function(m){ if (m && typeof m === 'object' && !m.ts) m.ts = now; });
        var j = ej(e); if (sk[e.id] !== j) { e._u = now; sk[e.id] = j; } }); });
  }
  function merge(k, R){
    var L = S[k]; if (!idArr(L) || !Array.isArray(R) || !(R.length === 0 || idArr(R))) return R;
    var Bm = {}; try { var B = base[k] ? JSON.parse(base[k]) : []; if (Array.isArray(B)) B.forEach(function(e){ if (e && e.id != null) Bm[e.id] = 1; }); } catch(e){}
    var Lm = {}, Rm = {}; L.forEach(function(e){ Lm[e.id] = e; }); R.forEach(function(e){ Rm[e.id] = e; });
    var out = [];
    L.forEach(function(e){ if (!Rm[e.id] && !Bm[e.id]) out.push(e); });           /* جديد محلياً لم يُرفع بعد */
    R.forEach(function(r){ var l = Lm[r.id];
      if (!l) { if (!Bm[r.id]) out.push(r); return; }                              /* جديد من القاعدة، أو حُذف محلياً */
      var w = (+l._u || 0) > (+r._u || 0) ? l : r, o = w === l ? r : l;
      out.push(Array.isArray(w.msgs) && Array.isArray(o.msgs) ? joinMsgs(w, o) : w); });
    return out;
  }
  /* المحادثات: لا تضيع رسالة أرسلها طرف أثناء تعديل الطرف الآخر لنفس المحادثة */
  function mkey(m){ return m && typeof m === 'object' ? (m.me ? 1 : 0) + '|' + (m.at || '') + '|' + (m.t || '') + '|' + ((m.atts || []).length) : String(m); }
  function joinMsgs(w, o){
    var have = {}; w.msgs.forEach(function(m){ have[mkey(m)] = 1; });
    var extra = o.msgs.filter(function(m){ return !have[mkey(m)]; });
    if (!extra.length) return w;
    var c = {}; Object.keys(w).forEach(function(k){ c[k] = w[k]; });
    c.msgs = w.msgs.concat(extra);
    if (c.msgs.every(function(m){ return m && m.ts; })) c.msgs.sort(function(a, b){ return a.ts - b.ts; });
    c.unread = (+w.unread || 0) + extra.filter(function(m){ return !m.me; }).length;
    c._u = Math.max(+w._u || 0, +o._u || 0) + 1;
    return c;
  }
  var firstLoad = true;
  function apply(map){
    var changed = false, needPush = false;
    Object.keys(map).forEach(function(k){
      if (k.charAt(0) === '_') return;
      var str = map[k], R;
      try { R = JSON.parse(str); } catch(e){ console.warn('[zulfi-sync] قسم تالف', k); return; }
      var V = firstLoad ? R : merge(k, R);
      base[k] = str;
      var vj = J(V);
      if (vj !== str && canWrite(k)) needPush = true;
      if (J(S[k]) === vj) { remember(k); return; }
      S[k] = V; changed = true; remember(k);
    });
    if (changed) { localSave(); if (ready) safeRender(); }
    if (needPush && ready && !pushTimer) pushTimer = setTimeout(push, 400);
    return changed;
  }

  /* ---------- الحفظ: محلياً ثم إلى القاعدة ---------- */
  /* النسخة المحلية في المتصفح مجرد نسخة احتياطية: البيانات كاملة في Firebase.
     إذا امتلأت مساحة المتصفح تُحفظ نسخة خفيفة بدون الملفات الكبيرة، دون أي تنبيه للمستخدم */
  var LKEY = (typeof STORE !== 'undefined') ? STORE : null, slim = false;
  function slimmer(k, v){ v = LOCALONLY(k, v); return (typeof v === 'string' && v.length > 3000 && v.slice(0, 5) === 'data:') ? '' : v; }
  if (LKEY && typeof save === 'function') save = function(){
    if (!slim) { try { localStorage.setItem(LKEY, JSON.stringify(S, LOCALONLY)); return; } catch(e){ slim = true; } }
    try { localStorage.setItem(LKEY, JSON.stringify(S, slimmer)); }
    catch(e){ try { localStorage.removeItem(LKEY); } catch(x){} }
  };
  var localSave = (typeof save === 'function') ? save : function(){};
  function push(){
    pushTimer = null; if (!adapter || !ready) return;
    var jobs = [];
    Object.keys(S).forEach(function(k){
      if (!canWrite(k)) return;
      var str = J(S[k]); if (str === null || str === base[k]) return;
      base[k] = str;
      jobs.push(adapter.write(k, str).catch(function(e){ delete base[k]; throw e; }));
    });
    if (!jobs.length) return;
    status('wait', 'جاري الحفظ…');
    Promise.all(jobs).then(function(){ status('ok', 'متصل · محفوظ في قاعدة البيانات'); })
      .catch(function(e){ console.error('[zulfi-sync] write', e); status('err', 'تعذر الحفظ في القاعدة: راجع الصلاحيات'); });
  }
  save = function(){ if (ready) { try { stamp(); } catch(e){} } var r = localSave.apply(this, arguments); if (ready && !pushTimer) pushTimer = setTimeout(push, 400); return r; };
  window.addEventListener('beforeunload', function(){ if (pushTimer) { clearTimeout(pushTimer); push(); } });

  /* مسودة الرسالة لا تُمسح عند وصول رسالة جديدة */
  (function(){ var _r = render; render = function(){
    var i = document.getElementById('msgIn'), v = i ? i.value : '', f = i && document.activeElement === i, chat = typeof UI !== 'undefined' ? UI.chat : null;
    var x = _r.apply(this, arguments);
    var j = document.getElementById('msgIn');
    if (j && v && !j.value && (typeof UI === 'undefined' || UI.chat === chat) && !window.__zSent) { j.value = v; }
    if (j && f) { try { j.focus({ preventScroll: true }); } catch(e){} }
    return x; };
    document.addEventListener('submit', function(e){ if (e.target && e.target.id === 'composer') { window.__zSent = 1; setTimeout(function(){ window.__zSent = 0; }, 0); } }, true);
  })();

  /* ---------- البدء ---------- */
  status('wait', 'يتصل بقاعدة البيانات…'); showVeil(true);
  var veilTimer = setTimeout(function(){ showVeil(false); status('err', 'تعذر الاتصال: يعمل محلياً حالياً'); }, 12000);

  loadSDK().then(function(){
    if (window.__ZULFI_TEST_ADAPTER) return window.__ZULFI_TEST_ADAPTER;
    if (!firebase.apps.length) firebase.initializeApp(CFG);
    return firebase.auth().signInAnonymously().catch(function(e){
      console.warn('[zulfi-sync] الدخول المجهول غير مفعّل في Firebase Authentication', e && e.code);
    }).then(function(){ return CFG.databaseURL ? rtdbAdapter() : firestoreAdapter(); });
  }).then(function(a){
    adapter = a;
    return adapter.loadAll();
  }).then(function(remote){
    apply(remote); firstLoad = false;
    Object.keys(S).forEach(function(k){ if (canWrite(k)) remember(k); });
    /* الأقسام الموجودة هنا وغير الموجودة في القاعدة تُرفع (أول تشغيل) */
    ready = true; window.__zulfiSyncReady = true;
    Object.keys(S).forEach(function(k){ if (canWrite(k) && !(k in remote)) delete base[k]; });
    push();
    adapter.subscribe(function(m){ apply(m); });
    /* عند الرجوع للصفحة (خصوصاً في الجوال) تُجلب آخر نسخة من القاعدة */
    var lastResync = Date.now();
    var resync = function(){ if (document.visibilityState === 'hidden' || Date.now() - lastResync < 15000) return; lastResync = Date.now();
      adapter.loadAll().then(function(m){ apply(m); }).catch(function(e){ console.warn('[zulfi-sync] resync', e); }); };
    document.addEventListener('visibilitychange', resync); window.addEventListener('focus', resync); window.addEventListener('online', resync);
    clearTimeout(veilTimer); showVeil(false);
    status('ok', 'متصل بقاعدة البيانات · ' + adapter.name);
    safeRender();
  }).catch(function(e){
    clearTimeout(veilTimer); showVeil(false);
    console.error('[zulfi-sync]', e);
    var msg = (e && /permission|PERMISSION/.test(String(e.code || e.message))) ? 'القاعدة ترفض الوصول: راجع قواعد الأمان' : 'تعذر الاتصال بقاعدة البيانات: يعمل محلياً';
    status('err', msg);
  });
})();
