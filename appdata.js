/* =====================================================================
   لوحة التحكم ← بيانات تطبيق المساجد مباشرة من القاعدة القديمة (قراءة حية)
   يعمل بعد sync.js (يستخدم نفس اتصال Firebase)
   ===================================================================== */
(function(){
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof NAV_FULL === 'undefined') return;

  /* أقسام التطبيق في القاعدة */
  var COLS = [
    {k:'maintenance_requests', t:'طلبات الصيانة', i:'build', req:1},
    {k:'repair_requests', t:'طلبات الإصلاح والترميم', i:'handyman', req:1},
    {k:'cleaning_requests', t:'النظافة والتعقيم', i:'cleaning_services', req:1},
    {k:'care_requests', t:'مواد العناية', i:'inventory_2', req:1},
    {k:'water_requests', t:'السقيا', i:'water_drop', req:1},
    {k:'prayer_room_requests', t:'المصليات المتنقلة', i:'mosque', req:1},
    {k:'tree_requests', t:'النخيل والري', i:'park', req:1},
    {k:'users', t:'المستخدمون', i:'group'},
    {k:'services', t:'الخدمات', i:'home_repair_service'},
    {k:'conversations', t:'المحادثات', i:'forum'},
    {k:'driverAdminChats', t:'محادثات المناديب', i:'chat'},
    {k:'agent_ratings', t:'تقييمات المناديب', i:'star'},
    {k:'quick_replies', t:'الردود السريعة', i:'bolt'},
    {k:'settings', t:'الإعدادات', i:'tune'},
    {k:'admin_settings', t:'إعدادات الإدارة', i:'admin_panel_settings'},
    {k:'panel', t:'panel', i:'dashboard'}
  ];
  var DATA = {};        /* col -> [{id, d}] */
  var STATE = {};       /* col -> 'loading' | 'ok' | 'denied' | 'error' */
  var started = false;

  /* ---------- اكتشاف الحقول الشائعة ---------- */
  var F = {
    mosque: ['mosqueName','mosque_name','mosque','masjid','masjidName','mosqueTitle','mosque_title','mosqueId'],
    title:  ['title','serviceName','service_name','service','type','requestType','request_type','category','subject'],
    desc:   ['description','desc','details','notes','note','problem','message','body','text'],
    status: ['status','state','requestStatus','request_status','orderStatus'],
    date:   ['createdAt','created_at','date','timestamp','time','requestDate','request_date','updatedAt','created'],
    user:   ['userName','user_name','name','fullName','full_name','imamName','requesterName','displayName'],
    phone:  ['phone','phoneNumber','phone_number','mobile','userPhone','user_phone'],
    district:['district','neighborhood','hay','area','city'],
    images: ['images','photos','imageUrls','image_urls','imageUrl','image','photo','attachments','pictures']
  };
  function pick(d, list){
    if (!d) return undefined;
    var keys = Object.keys(d), lower = {};
    keys.forEach(function(k){ lower[k.toLowerCase()] = k; });
    for (var i = 0; i < list.length; i++) { var k = lower[list[i].toLowerCase()]; if (k !== undefined && d[k] !== '' && d[k] != null) return d[k]; }
    return undefined;
  }
  function toDate(v){
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v.seconds) return new Date(v.seconds * 1000);
    if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000);
    var d = new Date(v); return isNaN(d) ? null : d;
  }
  function fmtD(v){ var d = toDate(v); return d ? d.toLocaleDateString('en-GB') + ' ' + d.toTimeString().slice(0,5) : (v ? String(v) : '—'); }
  function txt(v){
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v.toDate === 'function') return fmtD(v);
    if (v.path && v.id) return v.path;
    try { return JSON.stringify(v); } catch(e){ return String(v); }
  }
  function imgs(v){
    var out = [];
    (function walk(x){
      if (!x) return;
      if (typeof x === 'string') {
        var t = x.trim();
        if (t.charAt(0) === '{' || t.charAt(0) === '[') { try { walk(JSON.parse(t)); } catch(e){} return; }
        if (/^https?:\/\/|^data:image/.test(t) && (/\.(jpe?g|png|webp|gif|heic)(\?|$)/i.test(t) || /res\.cloudinary\.com|firebasestorage|googleusercontent|^data:image/.test(t))) out.push(t.replace(/^http:\/\//, 'https://'));
        return;
      }
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (typeof x === 'object') { if (x.secure_url) { walk(x.secure_url); return; } ['url','src','downloadUrl','downloadURL','link','imageUrl','image'].forEach(function(k){ if (x[k]) walk(x[k]); }); }
    })(v);
    return out.filter(function(u, i){ return out.indexOf(u) === i; });
  }
  function th(u, w){ return typeof window.cldThumb === 'function' ? window.cldThumb(u, w) : u; }
  function allImgs(d){ var L = imgs(pick(d, F.images)); if (!L.length) Object.keys(d).forEach(function(k){ if (/image|photo|attach|pic|صور/i.test(k)) L = L.concat(imgs(d[k])); }); return L.filter(function(u, i){ return L.indexOf(u) === i; }); }
  function stTone(s){
    s = String(s || '').toLowerCase();
    if (/منته|مكتمل|تم|done|complet|closed|finish/.test(s)) return 'ok';
    if (/رفض|ملغ|reject|cancel/.test(s)) return 'bad';
    if (/جار|تنفيذ|progress|working|accepted|مقبول/.test(s)) return 'gold';
    return 'warn';
  }

  /* ---------- الاتصال ---------- */
  function fbReady(){ return window.firebase && firebase.apps && firebase.apps.length && firebase.firestore; }
  function start(){
    if (started) return; if (!fbReady()) { setTimeout(start, 800); return; }
    started = true;
    var db = firebase.firestore();
    var go2 = function(){
      COLS.forEach(function(c){
        STATE[c.k] = 'loading';
        db.collection(c.k).limit(500).onSnapshot(function(qs){
          var L = []; qs.forEach(function(doc){ L.push({id: doc.id, d: doc.data()}); });
          L.sort(function(a,b){ var x = toDate(pick(a.d,F.date)), y = toDate(pick(b.d,F.date)); return (y ? y.getTime() : 0) - (x ? x.getTime() : 0); });
          DATA[c.k] = L; STATE[c.k] = 'ok'; refresh();
        }, function(err){
          STATE[c.k] = /permission/i.test(String(err && (err.code || err.message))) ? 'denied' : 'error';
          console.warn('[app-data]', c.k, err && err.code); refresh();
        });
      });
    };
    var u = firebase.auth && firebase.auth().currentUser;
    if (u) go2(); else if (firebase.auth) { var un = firebase.auth().onAuthStateChanged(function(){ un(); go2(); }); } else go2();
  }
  var rT = null;
  function refresh(){ if (UI.view !== 'app_live') return; clearTimeout(rT); rT = setTimeout(function(){ var a = document.activeElement; if (a && /INPUT|TEXTAREA/.test(a.tagName) && a.closest('#view')) return; render(); }, 250); }

  /* ---------- الصفحة ---------- */
  function counts(c){ return STATE[c.k] === 'ok' ? (DATA[c.k] || []).length : STATE[c.k] === 'denied' ? '🔒' : '…'; }
  VIEWS.app_live = function(){
    start();
    var cur = UI.appCol || 'maintenance_requests';
    var c = COLS.filter(function(x){ return x.k === cur; })[0] || COLS[0];
    var L = DATA[c.k] || [], q = (UI.appQ || '').trim();
    if (q) L = L.filter(function(r){ return JSON.stringify(r.d).indexOf(q) > -1 || r.id.indexOf(q) > -1; });
    var reqTotal = COLS.filter(function(x){ return x.req; }).reduce(function(a,x){ return a + ((DATA[x.k] || []).length); }, 0);
    var body;
    if (!fbReady()) body = '<div class="card empty">' + ic('cloud_off') + ' النظام غير متصل بقاعدة البيانات. تأكد من ملف firebase-config.js</div>';
    else if (STATE[c.k] === 'denied') body = '<div class="card card-b"><b>' + ic('lock') + ' القاعدة ترفض قراءة «' + esc(c.k) + '»</b><p class="small muted">أضف في قواعد Firestore سطراً يسمح لحساب لوحة التحكم بالقراءة، أو أرسل صورة القواعد الحالية لتعديلها.</p></div>';
    else if (STATE[c.k] !== 'ok') body = '<div class="card empty">' + ic('hourglass_top') + ' جاري التحميل من القاعدة…</div>';
    else if (!L.length) body = '<div class="card empty">لا توجد سجلات' + (q ? ' مطابقة للبحث' : '') + '.</div>';
    else if (c.req) body = '<div class="tbl-wrap card"><table><thead><tr><th>#</th><th>المسجد</th><th>الطلب</th><th>الحالة</th><th>التاريخ</th><th>مقدم الطلب</th><th></th></tr></thead><tbody>' +
      L.map(function(r){ var d = r.d, st = pick(d,F.status);
        return '<tr><td class="num tiny">' + esc(r.id.slice(0,10)) + '</td><td>' + (function(){ var im = allImgs(d); return im.length ? '<div class="row" style="flex-wrap:nowrap;gap:8px;margin-bottom:4px"><img src="' + esc(th(im[0], 120)) + '" style="width:44px;height:44px;border-radius:6px;object-fit:cover;flex:none" alt=""><span class="tiny muted">' + im.length + ' صور</span></div>' : ''; })() + '<b class="small">' + esc(txt(pick(d,F.mosque)) || '—') + '</b>' + (pick(d,F.district) ? '<div class="tiny muted">' + esc(txt(pick(d,F.district))) + '</div>' : '') + '</td>' +
          '<td class="small">' + esc((txt(pick(d,F.title)) || c.t)) + '<div class="tiny muted">' + esc(txt(pick(d,F.desc)).slice(0,70)) + '</div></td>' +
          '<td>' + (st != null ? '<span class="pill ' + stTone(st) + '">' + esc(txt(st)) + '</span>' : '—') + '</td><td class="num tiny">' + esc(fmtD(pick(d,F.date))) + '</td>' +
          '<td class="small">' + esc(txt(pick(d,F.user)) || '—') + '<div class="tiny muted num">' + esc(txt(pick(d,F.phone))) + '</div></td>' +
          '<td><div class="row"><button class="btn sm" data-act="appDoc" data-id="' + esc(r.id) + '">' + ic('visibility') + 'عرض</button><button class="btn sm pri" data-act="appImport" data-id="' + esc(r.id) + '">' + ic('add_task') + 'تحويل لطلب</button></div></td></tr>'; }).join('') + '</tbody></table></div>';
    else body = '<div class="tbl-wrap card"><table><thead><tr><th>المعرّف</th><th>أهم الحقول</th><th></th></tr></thead><tbody>' +
      L.map(function(r){ var ks = Object.keys(r.d).slice(0,4);
        return '<tr><td class="num tiny">' + esc(r.id.slice(0,14)) + '</td><td class="small">' + ks.map(function(k){ return '<span class="muted">' + esc(k) + ':</span> ' + esc(txt(r.d[k]).slice(0,50)); }).join(' · ') + '</td><td><button class="btn sm" data-act="appDoc" data-id="' + esc(r.id) + '">' + ic('visibility') + 'عرض</button></td></tr>'; }).join('') + '</tbody></table></div>';
    return head('بيانات التطبيق', 'بيانات تطبيق المساجد (مباشر)', 'تُقرأ مباشرة من قاعدة التطبيق وتتحدث لحظياً، دون أي تعديل عليها. يمكن تحويل أي طلب إلى طلب في النظام لإسناده وتنفيذه بالمراحل الخمس.',
        '<button class="btn" data-act="appSchema">' + ic('data_object') + 'نسخ هيكل الحقول</button>') +
      '<div class="grid g3">' + [['طلبات التطبيق', reqTotal, 'assignment'], ['المستخدمون', (DATA.users || []).length, 'group'], ['الخدمات', (DATA.services || []).length, 'home_repair_service']].map(function(k){ return '<div class="card kpi"><div class="k-top"><span>' + k[0] + '</span><span class="k-ic">' + ic(k[2]) + '</span></div><div class="k-val num">' + k[1] + '</div></div>'; }).join('') + '</div>' +
      '<div class="chips">' + COLS.map(function(x){ return '<button class="chip ' + (x.k === c.k ? 'on' : '') + '" data-act="appCol" data-id="' + x.k + '">' + ic(x.i) + ' ' + esc(x.t) + ' (' + counts(x) + ')</button>'; }).join('') + '</div>' +
      '<div class="field"><input class="inp" id="appQ" placeholder="ابحث في «' + esc(c.t) + '» بأي كلمة أو رقم…" value="' + esc(UI.appQ || '') + '"></div>' + body;
  };

  function findDoc(id){ var c = UI.appCol || 'maintenance_requests'; return (DATA[c] || []).filter(function(r){ return r.id === id; })[0]; }
  function docModal(r){
    var c = UI.appCol || 'maintenance_requests';
    var rows = Object.keys(r.d).sort().map(function(k){ var v = r.d[k], im = imgs(v);
      return '<tr><td class="num tiny" style="white-space:nowrap">' + esc(k) + '</td><td class="small" style="word-break:break-word">' + (im.length ? im.map(function(u){ return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(th(u, 300)) + '" style="height:90px;border-radius:6px;margin:2px;object-fit:cover"></a>'; }).join('') : esc(txt(v))) + '</td></tr>'; }).join('');
    modal({title: c + ' / ' + r.id, icon: 'data_object', wide: 1, ok: 'إغلاق', onOk: function(){},
      body: '<div class="tbl-wrap"><table><thead><tr><th>الحقل</th><th>القيمة</th></tr></thead><tbody>' + rows + '</tbody></table></div>'});
  }
  function importReq(r){
    var c = COLS.filter(function(x){ return x.k === (UI.appCol || 'maintenance_requests'); })[0];
    var exist = S.requests.filter(function(x){ return x.appRef && x.appRef.col === c.k && x.appRef.id === r.id; })[0];
    if (exist) { toast('هذا الطلب محوَّل مسبقاً: ' + exist.id, 'info'); UI.rv = exist.id; try { openReq(exist.id); } catch(e){} return; }
    var d = r.d, svcByCol = {maintenance_requests:'SRV-103', repair_requests:'SRV-106', cleaning_requests:'SRV-102', care_requests:'SRV-108', water_requests:'SRV-105', prayer_room_requests:'SRV-107', tree_requests:'SRV-104'};
    var dt = toDate(pick(d,F.date)), num = 1000 + S.requests.length + 1;
    while (S.requests.some(function(x){ return x.id === 'APP-' + num; })) num++;
    var atts = allImgs(d).map(function(u, i){ return {id: 'F-APP-' + num + '-' + i, name: 'صورة من التطبيق ' + (i + 1), type: 'image', data: th(u, 1600)}; });
    var nr = {id: 'APP-' + num, mosque: txt(pick(d,F.mosque)) || 'غير محدد', district: txt(pick(d,F.district)), svc: svcByCol[c.k] || 'SRV-103',
      title: txt(pick(d,F.title)) || c.t, by: txt(pick(d,F.user)) || 'مستخدم التطبيق', byRole: 'مقدم الطلب', phone: txt(pick(d,F.phone)),
      date: dt ? dt.toISOString().slice(0,10) : today(), priority: 'متوسطة', status: 'جديدة', rep: '', opts: [], note: txt(pick(d,F.desc)),
      atts: atts, rating: 0, notes: [{t: 'حُوِّل من تطبيق المساجد (' + c.k + ' / ' + r.id + ')', by: (me() || {}).name || 'الإدارة', at: today()}], appRef: {col: c.k, id: r.id}};
    S.requests.unshift(nr); save(); toast('حُوِّل إلى الطلب ' + nr.id + '، ويمكنك إسناده الآن', 'add_task');
    try { openReq(nr.id); } catch(e){ go('requests'); }
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-act="appCol"],[data-act="appDoc"],[data-act="appImport"],[data-act="appSchema"]'); if (!t) return;
    e.stopImmediatePropagation(); var a = t.dataset.act;
    if (a === 'appCol') { UI.appCol = t.dataset.id; UI.appQ = ''; render(); }
    else if (a === 'appDoc') { var r = findDoc(t.dataset.id); if (r) docModal(r); }
    else if (a === 'appImport') { var r2 = findDoc(t.dataset.id); if (r2) importReq(r2); }
    else if (a === 'appSchema') {
      var out = {};
      COLS.forEach(function(c){ var L = DATA[c.k] || []; if (!L.length) { out[c.k] = STATE[c.k] || 'لم يُحمّل'; return; }
        var s = {}; L.slice(0, 5).forEach(function(r){ Object.keys(r.d).forEach(function(k){ var v = r.d[k]; if (s[k]) return;
          s[k] = v == null ? 'null' : typeof v.toDate === 'function' ? 'Timestamp' : Array.isArray(v) ? 'Array(' + v.length + ')' : typeof v === 'object' ? 'Object{' + Object.keys(v).slice(0,6).join(',') + '}' : typeof v; }); });
        out[c.k] = {count: L.length, fields: s}; });
      var str = JSON.stringify(out, null, 1);
      (navigator.clipboard ? navigator.clipboard.writeText(str) : Promise.reject()).then(function(){ toast('نُسخ هيكل الحقول، الصقه في المحادثة', 'content_copy'); })
        .catch(function(){ modal({title: 'هيكل الحقول', icon: 'data_object', wide: 1, ok: 'إغلاق', onOk: function(){}, body: '<textarea class="inp" style="height:50vh;direction:ltr" readonly>' + esc(str) + '</textarea>'}); });
    }
  }, true);
  document.addEventListener('input', function(e){ if (e.target.id === 'appQ') { UI.appQ = e.target.value; clearTimeout(rT); rT = setTimeout(function(){ render(); var i = document.getElementById('appQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); } });

  /* ---------- إضافة الخانة للقائمة الجانبية (للموظفين) ---------- */
  var item = {k: 'app_live', t: 'بيانات التطبيق (مباشر)', i: 'smartphone', b: function(){ return 0; }};
  var gi = NAV_FULL.findIndex(function(g){ return g.g === 'الطلبات والميدان'; });
  if (gi > -1) NAV_FULL[gi].items.splice(1, 0, item); else NAV_FULL.splice(1, 0, {g: 'تطبيق المساجد', items: [item]});
  try { if (typeof applyNavPerms === 'function' && STAFF.user) applyNavPerms(); } catch(e){}
  setTimeout(start, 1500);
})();
