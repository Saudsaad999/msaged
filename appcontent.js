/* =====================================================================
   محتوى التطبيق من لوحة التحكم:
   ١) عدادات الأثر: حساب تلقائي من البيانات (طلبات النظام + طلبات التطبيق) أو إدخال يدوي
   ٢) نشر العدادات والخدمات إلى Firestore ليقرأها التطبيق:
      impact_counters/{id}   ·   app_services/{id}
   ===================================================================== */
(function(){
  'use strict';
  if (typeof S === 'undefined' || typeof VIEWS === 'undefined') return;
  function ready(){ return window.firebase && firebase.apps && firebase.apps.length && firebase.firestore && window.__zulfiSyncReady; }
  var DONE = /الانتهاء|انتهى|منته|مكتمل|مغلق|done|complet|closed|finish/i;
  var REQ_COLS = ['maintenance_requests','repair_requests','cleaning_requests','care_requests','water_requests','prayer_room_requests','tree_requests'];
  var SVC_COL = {'SRV-103':'maintenance_requests','SRV-106':'repair_requests','SRV-102':'cleaning_requests','SRV-108':'care_requests','SRV-105':'water_requests','SRV-107':'prayer_room_requests','SRV-104':'tree_requests'};
  function norm(s){ return String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim(); }

  /* ---------- مصادر البيانات ---------- */
  function doneList(){
    var L = [], seenApp = {};
    (S.requests || []).forEach(function(r){
      if (r.appRef) seenApp[r.appRef.col + '/' + r.appRef.id] = 1;
      if (r.closed || r.status === 'منتهي') L.push({mosque: r.mosque, svc: r.svc, pieces: r.pieces || {}, date: r.doneAt || r.date});
    });
    var D = window.ZAPPDATA || {};
    REQ_COLS.forEach(function(col){
      (D[col] || []).forEach(function(r){
        if (seenApp[col + '/' + r.id]) return;          /* مستورد للنظام: يُحسب مرة واحدة */
        var d = r.d || {}; if (!DONE.test(String(d.status || ''))) return;
        L.push({mosque: d.mosqueName || d.mosque || '', col: col, pieces: {}, date: null});
      });
    });
    return L;
  }
  function allCount(){
    var n = (S.requests || []).length, D = window.ZAPPDATA || {}, imported = {};
    (S.requests || []).forEach(function(r){ if (r.appRef) imported[r.appRef.col + '/' + r.appRef.id] = 1; });
    REQ_COLS.forEach(function(col){ (D[col] || []).forEach(function(r){ if (!imported[col + '/' + r.id]) n++; }); });
    return n;
  }
  function uniq(L, f){ var m = {}; L.forEach(function(x){ var k = norm(x.mosque); if (k && (!f || f(k))) m[k] = 1; }); return Object.keys(m).length; }
  var FORMULAS = [
    ['manual', 'إدخال يدوي', null],
    ['mosques', 'تلقائي: المساجد المخدومة (كل الطلبات المنجزة)', function(){ return uniq(doneList()); }],
    ['jawami', 'تلقائي: الجوامع المخدومة (اسمها يبدأ بـ«جامع»)', function(){ return uniq(doneList(), function(k){ return /^جامع/.test(k); }); }],
    ['masajid', 'تلقائي: المساجد والمصليات المخدومة (غير الجوامع)', function(){ return uniq(doneList(), function(k){ return !/^جامع/.test(k); }); }],
    ['historic', 'تلقائي: المساجد التاريخية والتراثية المخدومة', function(){ return uniq(doneList(), function(k){ return /تاريخ|تراث|قديم|اثري/.test(k); }); }],
    ['done', 'تلقائي: الطلبات المنجزة', function(){ return doneList().length; }],
    ['all', 'تلقائي: كل الطلبات الواردة', function(){ return allCount(); }],
    ['pieces', 'تلقائي: القطع والمواد المركبة', function(){ return doneList().reduce(function(a, x){ return a + Object.keys(x.pieces || {}).reduce(function(b, k){ return b + (+x.pieces[k] || 0); }, 0); }, 0); }],
    ['water', 'تلقائي: طلبات السقيا المنجزة', function(){ return doneList().filter(function(x){ return x.svc === 'SRV-105' || x.col === 'water_requests'; }).length; }],
    ['maint', 'تلقائي: طلبات الصيانة المنجزة', function(){ return doneList().filter(function(x){ return x.svc === 'SRV-103' || x.svc === 'SRV-106' || x.col === 'maintenance_requests' || x.col === 'repair_requests'; }).length; }]
  ];
  function formula(k){ return FORMULAS.filter(function(f){ return f[0] === k; })[0]; }
  function guess(label){ var l = norm(label);
    if (/تاريخ|تراث/.test(l)) return 'historic'; if (/جوامع|جامع/.test(l)) return 'jawami'; if (/مصلي|فروض|احياء/.test(l)) return 'masajid';
    if (/مساجد/.test(l)) return 'mosques'; if (/قطع|مواد/.test(l)) return 'pieces'; if (/طلب/.test(l)) return 'done'; return 'manual'; }

  /* ---------- التحديث التلقائي ---------- */
  function recompute(){
    var changed = false;
    (S.counters || []).forEach(function(c){
      if (c.auto === undefined) { c.auto = guess(c.label); changed = true; }
      var f = formula(c.auto); if (!f || !f[2]) return;
      var v = f[2](); if (+c.v !== v) { c.v = v; changed = true; }
    });
    if (changed) { try { _s.call(window); } catch(e){} schedulePush(); if (UI.view === 'counters' || UI.view === 'home') { var a = document.activeElement; if (!(a && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) try { render(); } catch(e){} } }
  }

  /* ---------- صفحة العدادات: اختيار طريقة الحساب لكل عداد ---------- */
  if (VIEWS.counters) { var _vc = VIEWS.counters; VIEWS.counters = function(){ var h = _vc.apply(this, arguments);
    h = h.replace(/<div class="stepper"><button data-act="kStep" data-id="([^"]+)" data-d="-1"/g, function(m, id){
      var c = (S.counters || []).filter(function(x){ return String(x.id) === id; })[0]; if (!c) return m; var auto = c.auto && c.auto !== 'manual';
      return '<select class="inp" data-act="kAuto" data-id="' + esc(id) + '" style="font-size:.8rem;padding:6px 8px">' + FORMULAS.map(function(f){ return '<option value="' + f[0] + '"' + ((c.auto || 'manual') === f[0] ? ' selected' : '') + '>' + esc(f[1]) + '</option>'; }).join('') + '</select>' +
        (auto ? '<span class="tiny muted">' + ic('autorenew') + ' يُحسب تلقائياً ويتحدث مع كل طلب</span><div class="stepper" style="display:none"><button data-act="kStep" data-id="' + id + '" data-d="-1"' : m); });
    return h.replace('الأرقام الظاهرة في صفحة الأثر بالتطبيق. عدّل القيم مباشرة أو أضف عداداً جديداً.', 'الأرقام الظاهرة في صفحة الأثر بالتطبيق. اختر لكل عداد: حساب تلقائي من الطلبات المنجزة في النظام والتطبيق، أو إدخال يدوي.');
  }; }
  document.addEventListener('change', function(e){ var s = e.target.closest && e.target.closest('[data-act="kAuto"]'); if (!s) return;
    var c = (S.counters || []).filter(function(x){ return String(x.id) === s.dataset.id; })[0]; if (!c) return;
    c.auto = s.value; save(); recompute(); render(); toast(c.auto === 'manual' ? 'العداد يُدخل يدوياً' : 'العداد يُحسب تلقائياً', 'autorenew'); }, true);

  /* ---------- النشر إلى التطبيق ---------- */
  var SENT = {}; try { SENT = JSON.parse(localStorage.getItem('zulfi-content-sent') || '{}') || {}; } catch(e){}
  function keep(){ try { localStorage.setItem('zulfi-content-sent', JSON.stringify(SENT)); } catch(e){} }
  var err = '', pT = null, busy = false;
  function schedulePush(){ clearTimeout(pT); pT = setTimeout(push, 900); }
  function push(){
    if (!ready() || busy) return;
    var db = firebase.firestore(), jobs = [], now = {};
    (S.counters || []).forEach(function(c, i){ if (!c || !c.id) return; var key = 'K:' + c.id; now[key] = 1;
      var d = {id: c.id, label: c.label || '', value: +c.v || 0, unit: c.unit || '', tag: c.tag || '', order: i + 1, auto: c.auto && c.auto !== 'manual' ? c.auto : null}; var sig = JSON.stringify(d);
      if (SENT[key] === sig) return; d.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      jobs.push(db.collection('impact_counters').doc(String(c.id)).set(d, {merge: true}).then(function(){ SENT[key] = sig; })); });
    (S.services || []).forEach(function(s, i){ if (!s || !s.id) return; var key = 'S:' + s.id; now[key] = 1;
      var d = {id: s.id, name: s.name || '', category: s.cat || '', description: s.desc || '', icon: s.icon || '', active: s.on !== false, order: i + 1,
        attachmentRule: s.rule || '', requestMode: s.mode || '', weeklyLimit: +s.week || 0, limit: +s.limit || 0, fulfill: s.fulfill || 'field',
        options: (s.opts || []).map(function(o){ return typeof o === 'string' ? o : (o && o.n) || ''; }).filter(Boolean),
        images: (s.imgs || []).filter(function(u){ return typeof u === 'string' && /^https:\/\//.test(u); }), requestsCollection: SVC_COL[s.id] || ''};
      var sig = JSON.stringify(d); if (SENT[key] === sig) return; d.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      jobs.push(db.collection('app_services').doc(String(s.id)).set(d, {merge: true}).then(function(){ SENT[key] = sig; })); });
    Object.keys(SENT).forEach(function(k){ if (now[k]) return; var col = k.charAt(0) === 'K' ? 'impact_counters' : 'app_services';
      jobs.push(db.collection(col).doc(k.slice(2)).delete().then(function(){ delete SENT[k]; })); });
    if (!jobs.length) return; busy = true;
    Promise.all(jobs).then(function(){ err = ''; keep(); })
      .catch(function(e){ err = /permission/i.test(String(e && (e.code || e.message))) ? 'القاعدة ترفض نشر العدادات والخدمات: راجع قواعد الأمان' : 'تعذر النشر للتطبيق'; console.warn('[app-content]', e); try { toast(err, 'sync_problem'); } catch(x){} })
      .then(function(){ busy = false; });
  }
  /* شريط في صفحة الخدمات */
  if (VIEWS.catalog) { var _vs = VIEWS.catalog; VIEWS.catalog = function(){ var h = _vs.apply(this, arguments);
    var bar = '<div class="card card-b small" style="border-color:var(--gold-line,#C5A976);background:var(--gold-soft,#FBF8F1)">' + ic('smartphone') + ' <b>مربوطة بالتطبيق:</b> أي تعديل على الخدمات (الاسم، الوصف، الإتاحة، الخيارات، الحد الأسبوعي) يُحفظ تلقائياً في التطبيق.' + (err ? ' <span style="color:var(--bad,#BA1A1A)">' + esc(err) + '</span>' : '') + '</div>';
    var i = h.indexOf('</div>', h.indexOf('class="page-head')); if (h.indexOf('class="page-head') > -1 && i > -1) { var j = h.indexOf('</div>', i + 6); return h.slice(0, j + 6) + bar + h.slice(j + 6); } return bar + h; }; }

  var _s = save;
  save = function(){ var r = _s.apply(this, arguments); schedulePush(); return r; };
  setInterval(recompute, 4000);
  var w = setInterval(function(){ if (!ready()) return; clearInterval(w); recompute(); push(); }, 1000);
})();
