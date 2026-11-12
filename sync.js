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
  var J = function(v){ try { return JSON.stringify(v === undefined ? null : v); } catch(e){ return null; } };

  /* ---------- مؤشر الاتصال ---------- */
  var pill = document.createElement('div');
  pill.id = 'dbPill';
  pill.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;font:600 12px "IBM Plex Sans Arabic",Tahoma,sans-serif;padding:6px 12px;border-radius:999px;display:flex;gap:6px;align-items:center;box-shadow:0 4px 14px rgba(20,60,84,.18);direction:rtl;cursor:default';
  function status(kind, text){
    var c = {ok:['#E3F3EA','#1F6B45'], wait:['#F3ECDD','#8A6F3D'], off:['#ECEFF2','#5B7383'], err:['#FFDAD6','#93000A']}[kind] || ['#ECEFF2','#5B7383'];
    pill.style.background = c[0]; pill.style.color = c[1];
    pill.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + c[1] + '"></span>' + text;
    pill.title = text;
  }
  function placePill(){ pill.style.bottom = (window.innerWidth <= 900 && document.querySelector('.bottom-nav,#bottomNav')) ? '78px' : '12px'; }
  document.body.appendChild(pill); placePill(); window.addEventListener('resize', placePill);

  var veil = document.createElement('div');
  veil.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(245,247,249,.86);display:none;align-items:center;justify-content:center;font:600 16px "IBM Plex Sans Arabic",Tahoma,sans-serif;color:#143C54;direction:rtl;text-align:center;padding:20px';
  veil.textContent = 'جاري تحميل البيانات من قاعدة البيانات…';
  document.body.appendChild(veil);
  function showVeil(on){ veil.style.display = on ? 'flex' : 'none'; }

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
          if (qs.metadata.hasPendingWrites) return;
          var ids = [];
          qs.docChanges().forEach(function(ch){
            if (ch.type === 'removed') { delete cache[ch.doc.id]; return; }
            cache[ch.doc.id] = ch.doc.data(); ids.push(ch.doc.id);
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
    var typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest && a.closest('#view');
    if (typing) {
      if (pendingRender) return; pendingRender = true;
      a.addEventListener('blur', function(){ pendingRender = false; setTimeout(safeRender, 50); }, { once: true });
      return;
    }
    try { render(); } catch(e){ console.error('[zulfi-sync] render', e); }
  }
  function apply(map){
    var changed = false;
    Object.keys(map).forEach(function(k){
      if (!isShared(k) && !(k in S) && k.charAt(0) === '_') return;
      if (k.charAt(0) === '_') return;
      var str = map[k];
      base[k] = str;
      if (J(S[k]) === str) return;
      try { S[k] = JSON.parse(str); changed = true; } catch(e){ console.warn('[zulfi-sync] قسم تالف', k); }
    });
    if (changed) { localSave(); if (ready) safeRender(); }
    return changed;
  }

  /* ---------- الحفظ: محلياً ثم إلى القاعدة ---------- */
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
  save = function(){ var r = localSave.apply(this, arguments); if (ready && !pushTimer) pushTimer = setTimeout(push, 400); return r; };
  window.addEventListener('beforeunload', function(){ if (pushTimer) { clearTimeout(pushTimer); push(); } });

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
    apply(remote);
    /* الأقسام الموجودة هنا وغير الموجودة في القاعدة تُرفع (أول تشغيل) */
    ready = true;
    Object.keys(S).forEach(function(k){ if (canWrite(k) && !(k in remote)) delete base[k]; });
    push();
    adapter.subscribe(function(m){ apply(m); });
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
