/* =====================================================================
   مسار الكراسة بعد الاعتماد وقبل التنفيذ — لوحة التحكم وبوابة المقاول
   ١) جمع المبلغ: رابط الفرصة المنشورة في موقع الجمعية + المبلغ المجموع حتى الاكتمال
   ٢) العقد: بيانات العقد وطباعته من نموذج الجمعية مع الختم + محضر استلام الموقع
   ٣) التنفيذ: يبدأ بعد استلام الموقع، مع طلبات الدفعات من المقاول
      وطلبات تعديل/إضافة بنود الكراسة من المقاول (تعتمدها الجمعية)
   ٤) اعتماد ختم الجمعية الرسمي (stamp.js) في الكراسات والخطابات والعقود
   ===================================================================== */
(function(){
  'use strict';
  if (typeof S === 'undefined' || typeof VIEWS === 'undefined') return;
  var PORTAL = typeof IS_PORTAL !== 'undefined' && IS_PORTAL;
  var STAMP = window.ZULFI_STAMP || '';
  var REP1 = 'معاذ بن سعد الجبر';

  /* ================= الختم الرسمي ================= */
  if (STAMP) {
    var STI = new Image(); STI.src = STAMP;
    if (typeof drawStamp === 'function') { var _ds = drawStamp; drawStamp = function(g, cx, cy, r, rot){
      if (!STI.complete || !STI.naturalWidth) return _ds.apply(this, arguments);
      var w = r * 2.5, h = w * STI.naturalHeight / STI.naturalWidth; g.save(); g.translate(cx, cy); g.rotate(rot == null ? -0.12 : rot * 0.6); g.globalAlpha = 0.92; g.drawImage(STI, -w / 2, -h / 2, w, h); g.restore(); }; }
    if (typeof stampPNG === 'function') stampPNG = function(){ return STAMP; };
    if (typeof bookletHTML === 'function') { var _bh = bookletHTML; bookletHTML = function(b){ var h = _bh.apply(this, arguments);
      return h.replace('<div class="stamp on">جمعية المساجد<br>بالزلفي<br>معتمد</div>', '<div class="stamp on stamp-img"><img src="' + STAMP + '" alt="ختم جمعية المساجد بالزلفي"></div>'); }; }
  }

  /* ================= أدوات ================= */
  var M = function(n){ return (typeof money === 'function') ? money(n) : Number(n || 0).toLocaleString('en-US'); };
  function nowS(){ return today() + ' ' + nowT(); }
  function who(){ try { if (PORTAL) { var p = repById(SESSION.id); return p ? p.name : ''; } var u = me(); return u ? u.name : ''; } catch(e){ return ''; } }
  function B(id){ return (S.booklets || []).filter(function(x){ return x.id === id; })[0]; }
  function total(b){ try { return Math.round(bookTotals(b).total); } catch(e){ return 0; } }
  function hasProgress(b){ return Object.keys(b.exec || {}).some(function(k){ var e = b.exec[k]; return e && ((+e.pct || 0) > 0 || (e.files || []).length); }); }
  /* الكراسات المعتمدة التي لم يبدأ تنفيذها تدخل المسار الجديد تلقائياً */
  function enroll(){ var ch = false; (S.booklets || []).forEach(function(b){ if (b.pipe != null || b.status !== 'معتمدة') return; b.pipe = hasProgress(b) ? 0 : 1; ch = true; }); if (ch) try { save(); } catch(e){} }
  function F(b){ b.fund = b.fund || {url: '', target: 0, raised: 0, log: []}; return b.fund; }
  function fundTarget(b){ return +F(b).target || total(b); }
  function fundDone(b){ return !!F(b).doneAt; }
  function siteDone(b){ return !!(b.site && b.site.date); }
  function stage(b){ if (!b.pipe) return 4; if (!fundDone(b)) return 1; if (!b.contractor) return 2; if (!siteDone(b)) return 3; return 4; }
  function gated(b){ return b.pipe && stage(b) < 4; }
  function att(a){ return a ? (typeof thumbsHTML === 'function' ? thumbsHTML([a]) : '<a href="' + esc(a.data) + '" target="_blank">' + esc(a.name || 'ملف') + '</a>') : ''; }
  function pickFile(w, id){ return new Promise(function(res){ var i = w.querySelector('#' + id); if (!i || !i.files || !i.files.length) return res(null); readFile(i.files[0]).then(res, function(){ res(null); }); }); }
  function payState(b){ var L = b.payReqs || []; var paid = L.filter(function(p){ return p.status === 'مدفوعة'; }).reduce(function(a, p){ return a + (+p.amount || 0); }, 0);
    var appr = L.filter(function(p){ return p.status === 'معتمدة'; }).reduce(function(a, p){ return a + (+p.amount || 0); }, 0);
    var pend = L.filter(function(p){ return p.status === 'بانتظار'; }).reduce(function(a, p){ return a + (+p.amount || 0); }, 0);
    var val = +((b.ct || {}).value) || total(b); return {paid: paid, appr: appr, pend: pend, val: val, rest: val - paid}; }
  function tone(s){ return /مدفوعة|معتمد|مكتمل|تم/.test(s) ? 'ok' : /مرفوض/.test(s) ? 'bad' : 'warn'; }

  /* ================= بطاقة المسار ================= */
  function steps(b){ var st = stage(b), L = [['campaign', 'جمع المبلغ'], ['gavel', 'الترسية على مقاول'], ['handshake', 'العقد واستلام الموقع'], ['construction', 'التنفيذ والدفعات']];
    return '<div class="bf-steps">' + L.map(function(x, i){ var n = i + 1, c = n < st ? 'done' : n === st ? 'cur' : '';
      return '<div class="bf-step ' + c + '"><span class="bf-dot">' + ic(n < st ? 'check' : x[0], n <= st) + '</span><b class="small">' + x[1] + '</b></div>'; }).join('<span class="bf-line"></span>') + '</div>'; }
  function fundBox(b, admin){
    var f = F(b), tg = fundTarget(b), pct = tg ? Math.min(100, Math.round((+f.raised || 0) / tg * 100)) : 0, done = fundDone(b);
    var link = f.url && !done ? '<a class="btn sm gold" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + ic('open_in_new') + 'رابط الفرصة في موقع الجمعية</a>' : '';
    var h = '<div class="bf-sec"><div class="row" style="justify-content:space-between"><b>' + ic('campaign') + ' جمع مبلغ الكراسة</b>' +
      (done ? '<span class="pill ok">' + ic('check_circle', 1) + ' اكتمل الجمع ' + esc(f.doneAt.slice(0, 10)) + '</span>' : '<span class="pill warn">جارٍ الجمع</span>') + '</div>' +
      '<div class="prog"><div class="bar"><i style="width:' + pct + '%;background:' + (done ? 'var(--ok)' : 'var(--gold)') + '"></i></div><b class="num">' + pct + '%</b></div>' +
      '<div class="small"><b class="num">' + M(f.raised || 0) + '</b> من <b class="num">' + M(tg) + '</b> ر.س' + (done ? '' : ' · المتبقي <b class="num">' + M(Math.max(0, tg - (+f.raised || 0))) + '</b> ر.س') + '</div>';
    if (!done) h += '<div class="row">' + (link || '<span class="tiny muted">' + (admin ? 'أضف رابط الفرصة بعد نشرها في موقع الجمعية.' : 'لم يُنشر رابط الفرصة بعد.') + '</span>') + '</div>';
    else if (f.url) h += '<div class="tiny muted">رابط الفرصة (مؤرشف): <a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url.slice(0, 60)) + '</a></div>';
    if (admin && !done) h += '<div class="row"><button class="btn sm" data-act="bfUrl" data-id="' + b.id + '">' + ic('link') + (f.url ? 'تعديل رابط الفرصة' : 'إضافة رابط الفرصة') + '</button><button class="btn sm pri" data-act="bfRaise" data-id="' + b.id + '">' + ic('savings') + 'تحديث المبلغ المجموع</button></div>';
    if (admin && (f.log || []).length) h += '<details><summary class="tiny muted">سجل التحديثات (' + f.log.length + ')</summary><div class="tiny">' + f.log.slice().reverse().map(function(x){ return '<div>' + esc(x.at) + ' · ' + esc(x.by) + ' · <b class="num">' + M(x.raised) + '</b> ر.س' + (x.note ? ' · ' + esc(x.note) : '') + '</div>'; }).join('') + '</div></details>';
    return h + '</div>';
  }
  function contractBox(b, admin){
    var st = stage(b), c = b.ct || {}, s = b.site || {};
    var h = '<div class="bf-sec ' + (st < 2 ? 'bf-off' : '') + '"><div class="row" style="justify-content:space-between"><b>' + ic('handshake') + ' العقد واستلام الموقع</b>' +
      (siteDone(b) ? '<span class="pill ok">' + ic('check_circle', 1) + ' استُلم الموقع ' + esc(s.date) + '</span>' : st < 3 ? '<span class="pill">' + (st < 2 ? 'بعد اكتمال جمع المبلغ' : 'بعد الترسية على مقاول') + '</span>' : '<span class="pill warn">بانتظار العقد واستلام الموقع</span>') + '</div>';
    if (st >= 3 || siteDone(b) || c.no) {
      h += '<div class="small">' + (c.no ? 'عقد رقم <b class="num">' + esc(c.no) + '</b> · ' + esc(c.cName || (repById(b.contractor) || {}).name || '') + ' · القيمة <b class="num">' + M(c.value || total(b)) + '</b> ر.س · المدة ' + esc(c.months || '—') + ' أشهر' : '<span class="muted">لم تُعبأ بيانات العقد بعد.</span>') + '</div>' +
        '<div class="row">' + (c.file ? '<span class="small">العقد الموقّع:</span>' + att(c.file) : '') + (s.file ? '<span class="small">محضر الاستلام:</span>' + att(s.file) : '') + '</div>' +
        '<div class="row">' + (c.no ? '<button class="btn sm" data-act="bfPrint" data-id="' + b.id + '">' + ic('print') + 'طباعة العقد ومحضر الاستلام</button>' : '') +
        (admin ? '<button class="btn sm" data-act="bfCt" data-id="' + b.id + '">' + ic('edit_document') + (c.no ? 'تعديل بيانات العقد' : 'إنشاء العقد') + '</button>' +
          (c.no && !siteDone(b) ? '<button class="btn sm pri" data-act="bfSite" data-id="' + b.id + '">' + ic('key') + 'استلام الموقع وبدء التنفيذ</button>' : '') : '') + '</div>';
    }
    return h + '</div>';
  }
  function payBox(b, admin){
    var L = b.payReqs || [], P = payState(b), sch = ((b.ct || {}).pays) || [];
    var h = '<div class="bf-sec"><div class="row" style="justify-content:space-between"><b>' + ic('payments') + ' الدفعات</b>' + (!admin ? '<button class="btn sm pri" data-act="bfPayReq" data-id="' + b.id + '">' + ic('request_quote') + 'طلب دفعة</button>' : '') + '</div>' +
      '<div class="grid g4 bf-k"><div><span class="tiny muted">قيمة العقد</span><b class="num">' + M(P.val) + '</b></div><div><span class="tiny muted">المدفوع</span><b class="num">' + M(P.paid) + '</b></div><div><span class="tiny muted">معتمد للصرف</span><b class="num">' + M(P.appr) + '</b></div><div><span class="tiny muted">المتبقي</span><b class="num">' + M(P.rest) + '</b></div></div>';
    if (sch.length) h += '<div class="tiny muted">جدول الدفعات في العقد: ' + sch.map(function(x, i){ return (i + 1) + ') ' + M(x.amount) + ' ر.س ' + esc(x.cond || ''); }).join(' · ') + '</div>';
    h += L.length ? '<div class="tbl-wrap"><table><thead><tr><th>#</th><th>المبلغ</th><th>البيان</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody>' + L.slice().reverse().map(function(p){
      return '<tr><td class="num tiny">' + esc(p.id) + '</td><td class="num"><b>' + M(p.amount) + '</b></td><td class="small">' + esc(p.note || '') + (p.sch != null && sch[p.sch] ? '<div class="tiny muted">مقابل: ' + esc(sch[p.sch].cond || ('الدفعة ' + (+p.sch + 1))) + '</div>' : '') + (p.file ? att(p.file) : '') + (p.reason ? '<div class="tiny" style="color:var(--bad)">' + esc(p.reason) + '</div>' : '') + '</td>' +
        '<td class="num tiny">' + esc(p.at) + '<div class="muted">' + esc(p.by || '') + '</div></td><td><span class="pill ' + tone(p.status) + '">' + esc(p.status) + '</span>' + (p.paidAt ? '<div class="tiny muted num">' + esc(p.paidAt) + '</div>' : '') + '</td><td>' +
        (admin && p.status === 'بانتظار' ? '<div class="row"><button class="btn sm pri" data-act="bfPayOk" data-id="' + b.id + '" data-k="' + p.id + '">اعتماد</button><button class="btn sm" data-act="bfPayNo" data-id="' + b.id + '" data-k="' + p.id + '">رفض</button></div>' :
         admin && p.status === 'معتمدة' ? '<button class="btn sm gold" data-act="bfPaid" data-id="' + b.id + '" data-k="' + p.id + '">' + ic('paid') + 'تم الصرف</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="tiny muted">لا توجد طلبات دفعات بعد.</div>';
    return h + '</div>';
  }
  function chgBox(b, admin){
    var L = b.changes || [];
    var h = '<div class="bf-sec"><div class="row" style="justify-content:space-between"><b>' + ic('edit_note') + ' تعديل وإضافة بنود الكراسة (من المقاول)</b>' + (!admin ? '<button class="btn sm" data-act="bfChg" data-id="' + b.id + '">' + ic('add') + 'طلب تعديل أو إضافة بند</button>' : '') + '</div>';
    var appr = L.filter(function(c){ return c.status === 'معتمد'; }).reduce(function(a, c){ return a + (c.delta || 0); }, 0), base = +((b.ct || {}).value) || total(b);
    if (appr) h += '<div class="tiny ' + (Math.abs(appr) > base * 0.25 ? '' : 'muted') + '" style="' + (Math.abs(appr) > base * 0.25 ? 'color:var(--bad)' : '') + '">صافي التعديلات المعتمدة: <b class="num">' + M(appr) + '</b> ر.س (' + (base ? Math.round(appr / base * 100) : 0) + '% من قيمة العقد، والحد في العقد 25%)</div>';
    h += L.length ? L.slice().reverse().map(function(c){ var it = c.kind === 'edit' ? ((b.chapters[c.ci] || {}).items || [])[c.ii] : null;
      return '<div class="bf-chg"><div class="row" style="justify-content:space-between"><b class="small">' + (c.kind === 'add' ? 'إضافة بند في الباب ' + (+c.ci + 1) : 'تعديل البند ' + (+c.ci + 1) + '.' + (+c.ii + 1)) + '</b><span class="pill ' + tone(c.status) + '">' + esc(c.status) + '</span></div>' +
        '<div class="small">' + esc(c.d) + ' · ' + esc(c.u || '') + ' · الكمية <b class="num">' + esc(c.q) + '</b> · السعر <b class="num">' + M(c.p) + '</b>' + (it ? '<div class="tiny muted">كان: ' + esc(it.d) + ' · ' + esc(it.q) + ' × ' + M(it.p) + '</div>' : '') + '</div>' +
        (c.note ? '<div class="tiny muted">' + esc(c.note) + '</div>' : '') + '<div class="tiny muted">' + esc(c.by || '') + ' · ' + esc(c.at) + ' · أثر على القيمة: <b class="num">' + M(c.delta || 0) + '</b> ر.س</div>' + (c.reason ? '<div class="tiny" style="color:var(--bad)">' + esc(c.reason) + '</div>' : '') +
        (admin && c.status === 'بانتظار' ? '<div class="row"><button class="btn sm pri" data-act="bfChgOk" data-id="' + b.id + '" data-k="' + c.id + '">اعتماد وتطبيق على الكراسة</button><button class="btn sm" data-act="bfChgNo" data-id="' + b.id + '" data-k="' + c.id + '">رفض</button></div>' : '') + '</div>'; }).join('') : '<div class="tiny muted">لا توجد طلبات تعديل.</div>';
    return h + '</div>';
  }
  function pipeCard(b, admin){
    if (!b || b.status !== 'معتمدة') return '';
    if (!b.pipe) return admin ? '<div class="card card-b row" style="justify-content:space-between"><span class="small muted">' + ic('info') + ' هذه الكراسة بدأ تنفيذها قبل تفعيل مسار جمع المبلغ والعقد.</span><button class="btn sm" data-act="bfOn" data-id="' + b.id + '">' + ic('route') + 'تفعيل المسار لها</button></div>' + (b.contractor ? '<div class="card"><div class="card-b bf">' + payBox(b, admin) + chgBox(b, admin) + '</div></div>' : '') : '';
    return '<div class="card bf-card"><div class="card-h"><div><h2>' + ic('route') + ' مسار الكراسة: الجمع ثم العقد ثم التنفيذ</h2><p class="small muted">لا يبدأ التنفيذ إلا بعد اكتمال جمع المبلغ وتوقيع العقد واستلام الموقع</p></div></div><div class="card-b bf">' +
      steps(b) + fundBox(b, admin) + contractBox(b, admin) + (stage(b) >= 4 ? payBox(b, admin) + chgBox(b, admin) : '') + '</div></div>';
  }
  window.zulfiPipeCard = pipeCard;

  /* ================= ربط الواجهات ================= */
  if (!PORTAL && VIEWS.book1) { var _b1 = VIEWS.book1; VIEWS.book1 = function(){ var h = _b1.apply(this, arguments); var b = B(UI.openB); if (!b) return h; enroll();
    var c = pipeCard(b, true); if (!c) return h; var i = h.indexOf('</div></div>'); return i > -1 ? h.slice(0, i + 12) + c + h.slice(i + 12) : c + h; }; }
  if (!PORTAL && VIEWS.exec) { var _ex = VIEWS.exec; VIEWS.exec = function(){ var h = _ex.apply(this, arguments); enroll();
    var pend = []; (S.booklets || []).forEach(function(b){ (b.payReqs || []).forEach(function(p){ if (p.status === 'بانتظار') pend.push([b, 'دفعة ' + M(p.amount) + ' ر.س']); }); (b.changes || []).forEach(function(c){ if (c.status === 'بانتظار') pend.push([b, c.kind === 'add' ? 'إضافة بند' : 'تعديل بند']); }); });
    var wait = (S.booklets || []).filter(function(b){ return b.status === 'معتمدة' && gated(b); });
    var bar = (pend.length || wait.length) ? '<div class="card"><div class="card-h"><div><h2>' + ic('pending_actions') + ' بانتظار الإدارة</h2></div></div><div class="card-b" style="display:flex;flex-direction:column;gap:6px">' +
      pend.map(function(x){ return '<div class="row" style="justify-content:space-between"><span class="small"><b>' + esc(x[1]) + '</b> · ' + esc(x[0].title) + ' · ' + esc((repById(x[0].contractor) || {}).name || '') + '</span><button class="btn sm" data-act="openBook" data-id="' + x[0].id + '">فتح</button></div>'; }).join('') +
      wait.map(function(b){ var s = stage(b); return '<div class="row" style="justify-content:space-between"><span class="small">' + esc(b.title) + ' · <span class="pill warn">' + (s === 1 ? 'جمع المبلغ ' + Math.min(100, Math.round((+F(b).raised || 0) / (fundTarget(b) || 1) * 100)) + '%' : s === 2 ? 'بانتظار الترسية' : 'بانتظار العقد واستلام الموقع') + '</span></span><button class="btn sm" data-act="openBook" data-id="' + b.id + '">فتح</button></div>'; }).join('') + '</div></div>' : '';
    var i = h.indexOf('</div>', h.indexOf('class="page-head')); if (i > -1) { var j = h.indexOf('</div>', i + 6); return h.slice(0, j + 6) + bar + h.slice(j + 6); } return bar + h; }; }
  /* البوابة: جدول التنفيذ مقفل حتى استلام الموقع، وبعده الدفعات والتعديلات */
  if (PORTAL && typeof execTable === 'function') { var _et = execTable; execTable = function(b, editable){
    if (!editable) return _et.apply(this, arguments); enroll();
    if (gated(b)) { var s = stage(b); return '<div class="card bf-card"><div class="card-h"><div><h2>' + ic('lock_clock') + ' لم يبدأ التنفيذ بعد</h2><p class="small muted">' + (s === 1 ? 'بانتظار اكتمال جمع مبلغ الكراسة' : s === 3 ? 'بانتظار توقيع العقد واستلام الموقع' : '') + '</p></div></div><div class="card-b bf">' + steps(b) + fundBox(b, false) + contractBox(b, false) + '</div></div>'; }
    return (b.pipe || b.contractor ? '<div class="card"><div class="card-b bf">' + (b.pipe ? contractBox(b, false) : '') + payBox(b, false) + chgBox(b, false) + '</div></div>' : '') + _et.apply(this, arguments); }; }

  /* ================= العقد: طباعة من نموذج الجمعية ================= */
  function hijri(d){ try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {day: 'numeric', month: 'numeric', year: 'numeric'}).format(d).replace(/[\u200f\u200e]/g, '').replace(/\s*هـ\s*$/, ''); } catch(e){ return ''; } }
  function dayName(d){ try { return d.toLocaleDateString('ar-SA', {weekday: 'long'}); } catch(e){ return ''; } }
  function L(v, n){ v = v == null ? '' : String(v); return v ? '<b>' + esc(v) + '</b>' : '<span class="dots">' + '.'.repeat(n || 20) + '</span>'; }
  function contractHTML(b){
    var c = b.ct || {}, s = b.site || {}, rep = repById(b.contractor) || {}, d = c.date ? new Date(c.date) : new Date(), sd = s.date ? new Date(s.date) : null;
    var pays = (c.pays || []).map(function(p, i){ return '<li>' + (i === 0 && /مقدم/.test(p.cond || '') ? 'دفعة مقدمة' : 'دفعة') + ' مبلغ وقدره (' + M(p.amount) + ') ريال، تستحق ' + esc(p.cond || '') + '.</li>'; }).join('');
    var stamp = STAMP ? '<img class="stamp" src="' + STAMP + '" alt="ختم الجمعية">' : '';
    var party = function(){ return '<div class="sig"><div><b>الطرف الأول</b><div>جمعية المساجد بالزلفي</div><div>ممثلة بالأستاذ/ ' + esc(c.rep1 || REP1) + '</div><div class="slot">' + stamp + '</div></div><div><b>الطرف الثاني</b><div>' + esc(c.cName || rep.name || '') + '</div><div>ممثلة بالأستاذ/ ' + esc(c.cRep || '') + '</div><div class="slot"></div></div></div>'; };
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>عقد مقاولة ' + esc(c.no || '') + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap"><style>' +
      'body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;color:#17384C;margin:0;background:#eef1f4}.pg{background:#fff;width:210mm;min-height:297mm;margin:12px auto;padding:22mm 20mm;box-sizing:border-box;line-height:1.95;font-size:13.5px;page-break-after:always}' +
      'h1{text-align:center;color:#143C54;font-size:22px;margin:0 0 14px}h2{font-size:15px;color:#1D5271;margin:16px 0 4px;border-bottom:1px solid #D6DFE5;padding-bottom:3px}ol{margin:0;padding-right:22px}.dots{color:#8aa}' +
      '.sig{display:flex;justify-content:space-between;gap:30px;margin-top:30px;text-align:center}.sig>div{flex:1}.slot{height:120px;position:relative}.stamp{width:190px;position:absolute;left:50%;top:6px;transform:translateX(-50%) rotate(-8deg);opacity:.92}' +
      '.hd{display:flex;justify-content:space-between;font-size:12px;color:#5B7383;border-bottom:2px solid #C5A976;padding-bottom:6px;margin-bottom:14px}.bar{position:sticky;top:0;background:#143C54;color:#fff;padding:10px;text-align:center}.bar button{font:inherit;padding:6px 18px;border-radius:6px;border:0;background:#C5A976;color:#143C54;font-weight:700;cursor:pointer}' +
      '@media print{.bar{display:none}body{background:#fff}.pg{margin:0;box-shadow:none}}</style></head><body><div class="bar"><button onclick="print()">طباعة / حفظ PDF</button></div>' +
      '<div class="pg"><div class="hd"><span>جمعية المساجد بالزلفي · مسجلة بالمركز الوطني لتنمية القطاع غير الربحي برقم 5358</span><span>عقد رقم ' + esc(c.no || '') + ' · كراسة ' + esc(b.id) + '</span></div>' +
      '<h1>عقد مقاولة</h1><p>إنه في يوم ' + esc(dayName(d)) + ' بتاريخ ' + esc(hijri(d)) + 'هـ، الموافق ' + esc(d.toISOString().slice(0, 10).split('-').reverse().join('/')) + 'م، بمحافظة الزلفي تم الاتفاق والتراضي بين كل من:</p>' +
      '<p><b>أولاً:</b> جمعية المساجد بالزلفي بترخيص رقم (5358) من المركز الوطني لتنمية القطاع غير الربحي، وعنوانها الزلفي، جوال (' + esc(c.phone1 || (typeof ORG !== 'undefined' ? ORG.phone : '')) + ')، ممثلة بالأستاذ/ ' + esc(c.rep1 || REP1) + '، ويشار إليها فيما بعد (بالطرف الأول أو الجمعية).</p>' +
      '<p><b>ثانياً:</b> ' + L(c.cName || rep.name, 30) + '، الرقم الموحد (' + L(c.unified, 12) + ')، ويمثلها الأستاذ/ ' + L(c.cRep, 20) + ' بصفته ' + L(c.cTitle, 12) + '، وعنوانها ' + L(c.cAddr, 20) + '، جوال (' + L(c.cPhone || rep.phone, 12) + ')، وتحمل سجلاً تجارياً رقم (' + L(c.cr, 12) + ')، ويشار إليها فيما بعد (بالطرف الثاني).</p>' +
      '<p><b>تمهيد:</b> حيث إن الطرف الأول جمعية أهلية تقدم خدمات للجوامع والمساجد بالبناء والترميم والصيانة وتأمين الاحتياجات، وحيث إن الطرف الثاني متخصص في أعمال المقاولات، فقد اتفق الطرفان على ما يلي:</p>' +
      '<h2>البند الأول: مكملات العقد</h2><ol><li>التمهيد أعلاه جزء لا يتجزأ من هذا العقد.</li><li>عرض السعر رقم (' + L(c.offerNo, 8) + ') وتاريخ ' + L(c.offerDate, 10) + '، وكراسة الأعمال رقم ' + esc(b.id) + ' «' + esc(b.title) + '».</li><li>المخططات المعتمدة من الطرفين.</li></ol>' +
      '<h2>البند الثاني: موضوع العقد</h2><p>القيام بأعمال ' + esc(b.title) + ' بـ' + esc(b.mosque || '') + ' بمحافظة الزلفي.</p>' +
      '<h2>البند الثالث: مدة العقد</h2><p>يلتزم الطرف الثاني بإتمام جميع الأعمال المبينة في هذا العقد خلال مدة زمنية أقصاها (' + L(c.months, 3) + ') أشهر شاملة الاختبارات والتسليم، وتسري هذه المدة اعتباراً من تاريخ استلام الموقع، وعلى الطرف الثاني فور استلام الموقع أن يبادر بالبدء بالأعمال موضوع العقد وإنهاء جميع الأعمال الموكلة إليه.</p>' +
      '<h2>البند الرابع: قيمة العقد وجدول الدفعات</h2><p>اتفق الطرفان على أن القيمة الإجمالية لأعمال العقد قدرها (' + M(c.value || total(b)) + ') ريال سعودي شاملة ضريبة القيمة المضافة. وتكون الدفعات كالتالي:</p><ol>' + (pays || '<li>' + L('', 40) + '</li>') + '</ol>' +
      '<h2>البند الخامس: التزامات الطرف الأول</h2><ol><li>التنسيق مع وزارة الشؤون الإسلامية كلما دعت الحاجة لذلك.</li><li>تسهيل مهام الطرف الثاني لمزاولة أعماله.</li><li>سرعة الاستجابة مع الطرف الثاني لمتابعة استلام وتسليم الأعمال.</li><li>سداد مستحقات الطرف الثاني وفقاً لما ينص عليه البند الرابع من هذا العقد.</li></ol>' +
      '<h2>البند السادس: التزامات الطرف الثاني</h2><ol><li>يقر الطرف الثاني بأنه اطلع ودرس بنفسه جميع الاشتراطات الخاصة بهذا المشروع.</li><li>يلتزم بتنفيذ جميع الأعمال المشترطة بدون استثناء.</li><li>يلتزم باستخدام العدد الكافي من العمال المختصين لإنجاز الأعمال في المدة المحددة.</li><li>الطرف الثاني مسؤول وحده عن عماله وسلامتهم وعن أي أضرار تحدث للغير نتيجة أعمالهم.</li><li>يلتزم بالتقيد بجميع الأنظمة التي نصت عليها أنظمة العمل.</li><li>يلتزم بمباشرة العمل والإشراف عليه بنفسه، وليس له التنازل عنه أو عن جزء منه لمقاول من الباطن إلا بموافقة خطية من الطرف الأول، وإلا حق للطرف الأول فسخ العقد مباشرة.</li><li>يلتزم بالمعايير والاشتراطات الفنية والهندسية واشتراطات السلامة، ويتحمل ما ينتج عن مخالفتها.</li><li>جميع المواد التي يوردها الطرف الأول عهدة في ذمة الطرف الثاني بمجرد وضعها في مكان العمل.</li><li>يلتزم بتوفير كل ما يحتاج إليه لإنجاز الأعمال وبأعلى المعايير الفنية.</li><li>يلتزم بعمل الاختبارات اللازمة للأعمال محل العقد.</li><li>يلتزم باتباع إرشادات المهندس الاستشاري في حال تعيينه، ولا يخلي ذلك مسؤوليته عن الأعمال.</li><li>لا يحق له الانسحاب من المشروع إلا بموافقة الطرف الأول كتابياً، مع حفظ حق الطرف الأول في المطالبة بالمبالغ المصروفة والتعويض.</li></ol>' +
      '<h2>البند السابع: التأخر في التنفيذ وعدم تنفيذ الالتزامات</h2><p>في حال تأخر الطرف الثاني أو تقاعسه أو عدم التزامه بالمواصفات أو عدم البدء بالأعمال رغم جاهزية الموقع أو عدم تأمين الضمان البنكي مقابل الدفعة المقدمة، يوجه الطرف الأول إنذاراً لتدارك الوضع خلال (5) أيام عمل، فإن لم يتداركه حق للطرف الأول: تنفيذ العقد على حساب الطرف الثاني وخصماً من مستحقاته، أو فسخ العقد مع الرجوع عليه بالدفعات المستلمة والتعويضات. ويحق للطرف الأول إيقاف العمل إذا اقتضت الضرورة بما لا يتجاوز (10) أيام متصلة أو (20) يوماً منفصلة، مع تعويض الطرف الثاني بمدة إضافية.</p>' +
      '<h2>البند الثامن: غرامة التأخير</h2><p>يحق للطرف الأول حسم غرامة تأخير بمقدار 1% من قيمة العقد الإجمالية عن كل يوم تأخير، على ألا تتجاوز الغرامة (10%) من قيمة العقد.</p>' +
      '<h2>البند التاسع: الضمان</h2><ol><li>يضمن الطرف الثاني المواد الموردة والأعمال المنفذة وفق كود البناء السعودي.</li><li>مدد الضمان كحد أدنى: 10 سنوات للهيكل الإنشائي والعزل، وسنتان لأعمال السباكة والكهرباء والتشطيبات، تبدأ من تاريخ الاستلام النهائي.</li><li>يسلم الطرف الثاني شهادات الضمان لكافة المنتجات الموردة.</li><li>يباشر الإصلاح خلال (72) ساعة من إبلاغه بالعيب، وإلا حق للطرف الأول الإصلاح على حسابه.</li></ol>' +
      '<h2>البند العاشر: التعديلات والزيادة والتخفيض في الأعمال</h2><ol><li>يحق للطرف الأول زيادة أو تخفيض الأعمال بما لا يزيد عن 25% من قيمة العقد.</li><li>تسعر الأعمال الزائدة وفق جدول الكميات وعرض السعر دون مطالبة بتعويض.</li><li>تكون المحاسبة بمقتضى الكميات المنفذة فعلاً والفئات الواردة في قائمة الأسعار المرفقة.</li></ol>' +
      '<h2>البند الحادي عشر: شروط عامة</h2><ol><li>يلتزم الطرف الثاني باستخدام عمالة نظامية والتقيد بأنظمة العمل والإقامة.</li><li>يلتزم بتطبيق إجراءات الأمن والسلامة ويتحمل المسؤولية المدنية والجزائية عن الأضرار الناتجة عن عمله.</li><li>يلتزم بجلب العمالة الفنية ذات الكفاءة والخبرة الكافية.</li><li>يتخذ كل التدابير لمنع الأضرار بالموقع والمنطقة المحيطة.</li><li>لا يحق له التنازل عن العقد أو جزء منه إلا بموافقة خطية مسبقة، ويبقى مسؤولاً عن مقاوليه من الباطن.</li><li>يلتزم بنظافة مكان العمل، وإلا نُظف على حسابه.</li><li>أي تساهل في شروط العقد لا يشكل حقاً مكتسباً للطرف الثاني.</li></ol>' +
      '<h2>البند الثاني عشر: تسليم الأعمال</h2><ol><li>تقبل الأعمال أو ترفض بحسب مطابقتها للمخططات والمواصفات وكود البناء السعودي.</li><li>يخطر الطرف الثاني الطرف الأول عند انتهاء كل مرحلة قبل الانتقال للتالية، ولا يغطى أي عمل إلا بعد الفحص والموافقة الكتابية.</li><li>يحق للطرف الأول رفض الأعمال غير المطابقة، ويلتزم الطرف الثاني بإزالتها أو تصحيحها على نفقته.</li><li>عند انتهاء الأعمال يحرر محضر استلام ابتدائي، وتنهى الملاحظات خلال (15) يوماً كشرط للاستحقاق المالي النهائي.</li><li>يعتبر الاستلام نهائياً بعد فترة الاختبار وخلوه من الملاحظات، ومنه تبدأ مدد الضمان.</li></ol>' +
      '<h2>البند الثالث عشر: فسخ العقد</h2><ol><li>يحق للطرف الأول فسخ العقد على مسؤولية الطرف الثاني في حال عجزه عن التنفيذ، إلا بسبب قوة قاهرة مثبتة.</li><li>يلتزم الطرف الثاني عند الفسخ بإعادة الدفعات المسددة مع حفظ حق التعويض.</li><li>يتحمل من يفسخ العقد دون سبب مشروع كافة المصاريف الناتجة عن الفسخ.</li></ol>' +
      '<h2>البند الرابع عشر: النظام الحاكم والاختصاص القضائي</h2><p>يخضع هذا العقد لأنظمة المملكة العربية السعودية، وفي حال الخلاف وتعذر الحل ودياً يفض عن طريق المحكمة المختصة في محافظة الزلفي.</p>' +
      '<h2>البند الخامس عشر: نسخ العقد</h2><p>حرر هذا العقد من خمسة عشر بنداً، ومن نسختين أصليتين بيد كل طرف نسخة للعمل بموجبها.</p><p style="text-align:center">والله ولي التوفيق،،،</p>' + party() + '</div>' +
      '<div class="pg"><div class="hd"><span>جمعية المساجد بالزلفي</span><span>كراسة ' + esc(b.id) + '</span></div><h1>محضر استلام الموقع</h1><p>بين كل من:</p><p><b>أولاً:</b> جمعية المساجد بالزلفي (طرف أول - المسلِّم)</p><p><b>ثانياً:</b> ' + L(c.cName || rep.name, 30) + ' (طرف ثانٍ - المستلم)</p>' +
      '<p>حيث اجتمع الطرفان المشار إليهما أعلاه في موقع المشروع: ' + esc(b.mosque || '') + ' — ' + esc(b.title) + '، وبعد المعاينة فقد تم تسليم الطرف الثاني الموقع في تاريخ ' + (sd ? esc(hijri(sd)) + 'هـ، الموافق ' + esc(s.date.split('-').reverse().join('/')) + 'م' : L('', 14) + 'هـ، الموافق ' + L('', 14) + 'م') + '، وبموجبه فإن موقع العمل تحت مسؤولية الطرف الثاني لحين تسليم المشروع للطرف الأول.</p><p style="text-align:center">هذا وبالله التوفيق..</p>' + party() + '</div></body></html>';
  }
  function printContract(b){ var w = window.open('', '_blank'); if (!w) { toast('اسمح بالنوافذ المنبثقة لطباعة العقد', 'error'); return; } w.document.open(); w.document.write(contractHTML(b)); w.document.close(); }
  window.zulfiContractHTML = contractHTML;

  /* ================= الإجراءات ================= */
  function notify(t, go2){ try { S.notifs && S.notifs.unshift({t: t, at: 'الآن', go: go2 || 'exec'}); } catch(e){} }
  function fin(msg, icn){ try { logIt(msg); } catch(e){} save(); render(); toast(msg, icn || 'check_circle'); }
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-act^="bf"]'); if (!t) return; e.stopImmediatePropagation();
    var a = t.dataset.act, b = B(t.dataset.id); if (!b) return; var k = t.dataset.k;
    if (a === 'bfOn') { b.pipe = 1; fin('فُعّل مسار الجمع والعقد للكراسة ' + b.id, 'route'); }
    else if (a === 'bfUrl') { var f = F(b); modal({title: 'رابط الفرصة في موقع الجمعية', icon: 'link', ok: 'حفظ', body:
      '<p class="small muted">بعد نشر الفرصة في موقع الجمعية انسخ رابطها هنا. يظهر الرابط في الكراسة وبوابة المقاول حتى اكتمال المبلغ.</p><div class="field"><label for="bfU">رابط الفرصة</label><input class="inp" id="bfU" dir="ltr" placeholder="https://" value="' + esc(f.url || '') + '"></div>' +
      '<div class="field"><label for="bfT">المبلغ المستهدف (ر.س)</label><input class="inp num" id="bfT" type="number" min="0" value="' + fundTarget(b) + '"><div class="tiny muted">الافتراضي إجمالي الكراسة: ' + M(total(b)) + ' ر.س</div></div>',
      onOk: function(w){ var u = val(w, 'bfU'); if (u && !/^https?:\/\//.test(u)) { toast('الرابط يجب أن يبدأ بـ https://', 'error'); return false; } f.url = u; f.target = +val(w, 'bfT') || total(b); fin('حُفظ رابط فرصة الكراسة ' + b.id, 'link'); }}); }
    else if (a === 'bfRaise') { var f2 = F(b); modal({title: 'تحديث المبلغ المجموع', icon: 'savings', ok: 'تحديث', body:
      '<div class="field"><label for="bfR">إجمالي المبلغ المجموع حتى الآن (ر.س)</label><input class="inp num" id="bfR" type="number" min="0" value="' + (+f2.raised || 0) + '"><div class="tiny muted">المستهدف ' + M(fundTarget(b)) + ' ر.س. اكتب الإجمالي كما يظهر في صفحة الفرصة.</div></div><div class="field"><label for="bfRn">ملاحظة</label><input class="inp" id="bfRn"></div>',
      onOk: function(w){ var v = Math.max(0, +val(w, 'bfR') || 0); f2.raised = v; f2.log = f2.log || []; f2.log.push({at: nowS(), by: who(), raised: v, note: val(w, 'bfRn')});
        if (v >= fundTarget(b) && !f2.doneAt) { f2.doneAt = nowS(); notify('اكتمل جمع مبلغ الكراسة ' + b.title + ': ابدأ العقد واستلام الموقع'); fin('اكتمل جمع مبلغ الكراسة ' + b.id, 'celebration'); } else fin('حُدّث المبلغ المجموع للكراسة ' + b.id, 'savings'); }}); }
    else if (a === 'bfCt') { var c = b.ct || {}, rep = repById(b.contractor) || {}; var pays = (c.pays || [{amount: Math.round(total(b) * 0.3), cond: 'عند إبرام العقد مقابل ضمان بنكي (دفعة مقدمة)'}, {amount: Math.round(total(b) * 0.4), cond: 'عند إنجاز 50% من الأعمال'}, {amount: total(b) - Math.round(total(b) * 0.3) - Math.round(total(b) * 0.4), cond: 'عند الاستلام الابتدائي وإنهاء الملاحظات'}]);
      var fl = function(id, lb, v, x){ return '<div class="field"><label for="' + id + '">' + lb + '</label><input class="inp ' + (x || '') + '" id="' + id + '" value="' + esc(v == null ? '' : v) + '"></div>'; };
      modal({title: 'بيانات عقد المقاولة', icon: 'handshake', wide: 1, ok: 'حفظ العقد', body: '<div class="grid g3">' + fl('cNo', 'رقم العقد *', c.no || ('CT-' + b.id.replace(/\D/g, '').slice(-5) + '-' + new Date().getFullYear())) + '<div class="field"><label for="cDate">تاريخ العقد</label><input class="inp" type="date" id="cDate" value="' + esc(c.date || today()) + '"></div>' + fl('cMonths', 'مدة التنفيذ (أشهر)', c.months || 3, 'num') + '</div>' +
        '<div class="grid g3">' + fl('cValue', 'قيمة العقد شاملة الضريبة', c.value || total(b), 'num') + fl('cOffer', 'رقم عرض السعر', c.offerNo) + '<div class="field"><label for="cOfferD">تاريخ عرض السعر</label><input class="inp" type="date" id="cOfferD" value="' + esc(c.offerDate || '') + '"></div></div>' +
        '<div class="sec-t">' + ic('apartment') + 'الطرف الثاني (المقاول)</div><div class="grid g3">' + fl('cName', 'اسم المؤسسة/الشركة', c.cName || rep.name) + fl('cCr', 'السجل التجاري', c.cr) + fl('cUni', 'الرقم الموحد', c.unified) + fl('cRep', 'اسم الممثل', c.cRep) + fl('cTitle', 'صفته', c.cTitle || 'المالك') + fl('cPhone', 'الجوال', c.cPhone || rep.phone) + '</div>' + fl('cAddr', 'العنوان', c.cAddr) +
        '<div class="sec-t">' + ic('account_balance') + 'الطرف الأول</div>' + fl('cRep1', 'ممثل الجمعية', c.rep1 || REP1) +
        '<div class="field"><label for="cPays">جدول الدفعات (كل سطر: المبلغ | متى تستحق)</label><textarea class="inp" id="cPays" style="min-height:96px">' + esc(pays.map(function(p){ return p.amount + ' | ' + p.cond; }).join('\n')) + '</textarea></div>' +
        '<div class="field"><label for="cFile">العقد الموقّع (اختياري)</label><input type="file" id="cFile" accept="image/*,application/pdf" class="inp"></div>',
        onOk: function(w){ if (!val(w, 'cNo')) { toast('اكتب رقم العقد', 'error'); return false; }
          var P = String(w.querySelector('#cPays').value || '').split('\n').map(function(l){ var x = l.split('|'); return {amount: +String(x[0] || '').replace(/[^\d.]/g, '') || 0, cond: (x.slice(1).join('|') || '').trim()}; }).filter(function(p){ return p.amount; });
          var sum = P.reduce(function(s2, p){ return s2 + p.amount; }, 0), V = +val(w, 'cValue') || total(b);
          if (sum && Math.abs(sum - V) > 1) toast('تنبيه: مجموع الدفعات ' + M(sum) + ' لا يساوي قيمة العقد ' + M(V), 'warning');
          var nc = {no: val(w, 'cNo'), date: val(w, 'cDate'), months: val(w, 'cMonths'), value: V, offerNo: val(w, 'cOffer'), offerDate: val(w, 'cOfferD'), cName: val(w, 'cName'), cr: val(w, 'cCr'), unified: val(w, 'cUni'), cRep: val(w, 'cRep'), cTitle: val(w, 'cTitle'), cPhone: val(w, 'cPhone'), cAddr: val(w, 'cAddr'), rep1: val(w, 'cRep1'), pays: P, file: c.file || null, by: who(), at: nowS()};
          pickFile(w, 'cFile').then(function(fo){ if (fo) nc.file = fo; b.ct = nc; fin('حُفظ عقد الكراسة ' + b.id, 'handshake'); }); }}); }
    else if (a === 'bfPrint') printContract(b);
    else if (a === 'bfSite') { modal({title: 'استلام الموقع وبدء التنفيذ', icon: 'key', ok: 'تأكيد الاستلام', body:
      '<p class="small muted">بعد التأكيد يُفتح جدول التنفيذ للمقاول في البوابة، ويبدأ احتساب مدة العقد من تاريخ الاستلام.</p><div class="field"><label for="sDate">تاريخ استلام الموقع *</label><input class="inp" type="date" id="sDate" value="' + today() + '"></div>' +
      '<div class="field"><label for="sFile">محضر استلام الموقع الموقّع (صورة أو PDF)</label><input type="file" id="sFile" accept="image/*,application/pdf" class="inp"></div><div class="field"><label for="sNote">ملاحظات</label><input class="inp" id="sNote"></div>',
      onOk: function(w){ var d = val(w, 'sDate'); if (!d) { toast('حدد تاريخ الاستلام', 'error'); return false; }
        pickFile(w, 'sFile').then(function(fo){ b.site = {date: d, file: fo, note: val(w, 'sNote'), by: who(), at: nowS()}; fin('استُلم موقع الكراسة ' + b.id + ' وبدأ التنفيذ', 'key'); }); }}); }
    else if (a === 'bfPayReq') { var sch = ((b.ct || {}).pays) || [], P2 = payState(b);
      modal({title: 'طلب دفعة من الجمعية', icon: 'request_quote', ok: 'إرسال الطلب', body:
        '<div class="small muted">المتبقي من قيمة العقد: <b class="num">' + M(P2.rest) + '</b> ر.س</div>' + (sch.length ? '<div class="field"><label for="pSch">الدفعة حسب العقد</label><select class="inp" id="pSch"><option value="">دفعة أخرى</option>' + sch.map(function(x, i){ return '<option value="' + i + '" data-amt="' + x.amount + '">الدفعة ' + (i + 1) + ': ' + M(x.amount) + ' ر.س · ' + esc(x.cond) + '</option>'; }).join('') + '</select></div>' : '') +
        '<div class="field"><label for="pAmt">المبلغ المطلوب (ر.س) *</label><input class="inp num" id="pAmt" type="number" min="1"></div><div class="field"><label for="pNote">البيان *</label><textarea class="inp" id="pNote" placeholder="مثال: إنجاز 50% من أعمال الكهرباء"></textarea></div><div class="field"><label for="pFile">المستخلص أو الفاتورة</label><input type="file" id="pFile" class="inp" accept="image/*,application/pdf"></div>',
        onOk: function(w){ var amt = +val(w, 'pAmt'), note = val(w, 'pNote'); if (!amt || amt <= 0) { toast('اكتب المبلغ', 'error'); return false; } if (!note) { toast('اكتب البيان', 'error'); return false; }
          if (amt > P2.rest) { toast('المبلغ أكبر من المتبقي من قيمة العقد', 'error'); return false; }
          var si = w.querySelector('#pSch') ? w.querySelector('#pSch').value : '';
          pickFile(w, 'pFile').then(function(fo){ b.payReqs = b.payReqs || []; b.payReqs.push({id: 'PAY-' + Date.now().toString(36).slice(-5).toUpperCase(), amount: amt, sch: si === '' ? null : +si, note: note, file: fo, at: nowS(), by: who(), status: 'بانتظار'});
            notify('طلب دفعة ' + M(amt) + ' ر.س من ' + who() + ' · ' + b.title); fin('أُرسل طلب الدفعة للجمعية', 'request_quote'); }); }});
      setTimeout(function(){ var s2 = document.getElementById('pSch'); if (s2) s2.addEventListener('change', function(){ var o = s2.selectedOptions[0]; if (o && o.dataset.amt) document.getElementById('pAmt').value = o.dataset.amt; }); }, 0); }
    else if (a === 'bfPayOk' || a === 'bfPayNo' || a === 'bfPaid') { var p = (b.payReqs || []).filter(function(x){ return x.id === k; })[0]; if (!p) return;
      if (a === 'bfPayOk') { p.status = 'معتمدة'; p.decidedBy = who(); p.decidedAt = nowS(); fin('اعتُمد طلب الدفعة ' + p.id, 'task_alt'); }
      else if (a === 'bfPaid') { p.status = 'مدفوعة'; p.paidAt = nowS(); p.paidBy = who(); fin('سُجّل صرف الدفعة ' + p.id, 'paid'); }
      else modal({title: 'رفض طلب الدفعة', icon: 'block', ok: 'رفض', body: '<div class="field"><label for="rWhy">سبب الرفض *</label><textarea class="inp" id="rWhy"></textarea></div>', onOk: function(w){ var r = val(w, 'rWhy'); if (!r) { toast('اكتب السبب', 'error'); return false; } p.status = 'مرفوضة'; p.reason = r; p.decidedBy = who(); fin('رُفض طلب الدفعة ' + p.id, 'block'); }}); }
    else if (a === 'bfChg') {
      var chOpts = b.chapters.map(function(c2, ci){ return '<option value="' + ci + '">الباب ' + (ci + 1) + ': ' + esc(c2.title) + '</option>'; }).join('');
      var itOpts = function(ci){ return ((b.chapters[ci] || {}).items || []).map(function(it, ii){ return '<option value="' + ii + '">' + (ci + 1) + '.' + (ii + 1) + ' ' + esc(it.d) + '</option>'; }).join(''); };
      var w0 = modal({title: 'طلب تعديل أو إضافة بند في الكراسة', icon: 'edit_note', wide: 1, ok: 'إرسال للجمعية', body:
        '<p class="small muted">يُرسل طلبك للجمعية، ولا يتغير شيء في الكراسة حتى تعتمده.</p><div class="grid g3"><div class="field"><label for="gK">نوع الطلب</label><select class="inp" id="gK"><option value="edit">تعديل بند موجود</option><option value="add">إضافة بند جديد</option></select></div><div class="field"><label for="gC">الباب</label><select class="inp" id="gC">' + chOpts + '</select></div><div class="field" id="gIw"><label for="gI">البند</label><select class="inp" id="gI">' + itOpts(0) + '</select></div></div>' +
        '<div class="grid g4"><div class="field" style="grid-column:span 2"><label for="gD">وصف البند *</label><input class="inp" id="gD"></div><div class="field"><label for="gU">الوحدة</label><input class="inp" id="gU"></div><div class="field"><label for="gQ">الكمية *</label><input class="inp num" type="number" id="gQ" min="0"></div></div>' +
        '<div class="grid g2"><div class="field"><label for="gP">سعر الوحدة (ر.س) *</label><input class="inp num" type="number" id="gP" min="0"></div><div class="field"><label for="gN">سبب التعديل *</label><input class="inp" id="gN"></div></div>',
        onOk: function(w){ var kd = val(w, 'gK'), ci = +val(w, 'gC'), ii = kd === 'edit' ? +val(w, 'gI') : null, d = val(w, 'gD'), q = +val(w, 'gQ'), pr = +val(w, 'gP'), n = val(w, 'gN');
          if (!d || !(q >= 0) || !(pr >= 0) || !n) { toast('أكمل الوصف والكمية والسعر والسبب', 'error'); return false; }
          var old = kd === 'edit' ? b.chapters[ci].items[ii] : null, delta = q * pr - (old ? (+old.q || 0) * (+old.p || 0) : 0);
          b.changes = b.changes || []; b.changes.push({id: 'CHG-' + Date.now().toString(36).slice(-5).toUpperCase(), kind: kd, ci: ci, ii: ii, d: d, u: val(w, 'gU'), q: q, p: pr, note: n, delta: Math.round(delta), at: nowS(), by: who(), status: 'بانتظار'});
          notify('طلب ' + (kd === 'add' ? 'إضافة' : 'تعديل') + ' بند من ' + who() + ' · ' + b.title); fin('أُرسل طلب التعديل للجمعية', 'edit_note'); }});
      var fillIt = function(){ var kd = w0.querySelector('#gK').value, ci = +w0.querySelector('#gC').value; w0.querySelector('#gIw').style.display = kd === 'edit' ? '' : 'none';
        if (kd === 'edit') { var it = ((b.chapters[ci] || {}).items || [])[+w0.querySelector('#gI').value]; if (it) { w0.querySelector('#gD').value = it.d || ''; w0.querySelector('#gU').value = it.u || ''; w0.querySelector('#gQ').value = it.q || 0; w0.querySelector('#gP').value = it.p || 0; } }
        else ['gD', 'gU', 'gQ', 'gP'].forEach(function(x){ w0.querySelector('#' + x).value = ''; }); };
      w0.querySelector('#gC').addEventListener('change', function(){ w0.querySelector('#gI').innerHTML = itOpts(+this.value); fillIt(); });
      w0.querySelector('#gK').addEventListener('change', fillIt); w0.querySelector('#gI').addEventListener('change', fillIt); fillIt(); }
    else if (a === 'bfChgOk' || a === 'bfChgNo') { var c3 = (b.changes || []).filter(function(x){ return x.id === k; })[0]; if (!c3) return;
      if (a === 'bfChgOk') { var item = {d: c3.d, u: c3.u, q: c3.q, p: c3.p, n: c3.note};
        if (c3.kind === 'add') { b.chapters[c3.ci].items.push(item); } else { var it2 = b.chapters[c3.ci].items[c3.ii]; if (it2) { c3.prev = {d: it2.d, u: it2.u, q: it2.q, p: it2.p}; it2.d = c3.d; it2.u = c3.u; it2.q = c3.q; it2.p = c3.p; } }
        c3.status = 'معتمد'; c3.decidedBy = who(); c3.decidedAt = nowS(); fin('اعتُمد وطُبّق ' + c3.id + ' على الكراسة', 'task_alt'); }
      else modal({title: 'رفض طلب التعديل', icon: 'block', ok: 'رفض', body: '<div class="field"><label for="rWhy2">سبب الرفض *</label><textarea class="inp" id="rWhy2"></textarea></div>', onOk: function(w){ var r = val(w, 'rWhy2'); if (!r) { toast('اكتب السبب', 'error'); return false; } c3.status = 'مرفوض'; c3.reason = r; fin('رُفض طلب التعديل ' + c3.id, 'block'); }}); }
  }, true);

  var st = document.createElement('style');
  st.textContent = '.stamp.stamp-img{border:0;width:150px;height:auto;border-radius:0;padding:0;transform:rotate(-8deg);background:none}.stamp.stamp-img img{width:100%;display:block}' +
    ':root[data-theme="dark"] .stamp.stamp-img img{filter:brightness(1.9) saturate(.8)}' +
    '.bf{display:flex;flex-direction:column;gap:14px}.bf-sec{display:flex;flex-direction:column;gap:8px;border:1px solid var(--line,#D6DFE5);border-radius:10px;padding:12px 14px}.bf-sec.bf-off{opacity:.55}' +
    '.bf-steps{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.bf-step{display:flex;align-items:center;gap:6px;color:var(--muted,#5B7383)}.bf-step.cur{color:var(--navy,#143C54)}.bf-step.done{color:var(--ok,#1F6B45)}' +
    '.bf-dot{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--bg,#F5F7F9);border:1px solid var(--line,#D6DFE5)}.bf-step.cur .bf-dot{background:#F3ECDD;border-color:#C5A976;color:#8A6F3D}.bf-step.done .bf-dot{background:var(--ok-soft,#E3F3EA);border-color:transparent}' +
    '.bf-line{flex:1;min-width:14px;height:2px;background:var(--line,#D6DFE5)}.bf-k>div{display:flex;flex-direction:column;background:var(--bg,#F5F7F9);border-radius:8px;padding:8px 10px}.bf-chg{border-top:1px dashed var(--line,#D6DFE5);padding-top:8px;display:flex;flex-direction:column;gap:4px}' +
    '@media (max-width:700px){.bf-line{display:none}.bf-steps{gap:10px}}';
  document.head.appendChild(st);
  setInterval(function(){ if (window.__zulfiSyncReady) enroll(); }, 5000);
})();
