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
  function sigsDone(b){ var g = b.sign || {}; return !!(g.eng && g.review && g.dir && g.stamp); }
  function ctSigned(b){ var c = b.ct || {}; return !!(c.no && (c.signed || c.file || (c.sig1 && c.sig2))); }
  /* مسار كراسة الصيانة والتحسينات (7 مراحل) */
  var STEPS = [['edit_document', 'إعداد الكراسة'], ['engineering', 'اعتماد المقاول'], ['draw', 'التوقيعات الداخلية'], ['how_to_vote', 'الاعتماد النهائي من المجلس'], ['campaign', 'جمع مبلغ الفرصة'], ['handshake', 'توقيع عقد المشروع'], ['construction', 'التنفيذ']];
  function S7(b){ var st = b.status, pr = 0; try { pr = bookProgress(b); } catch(e){}
    return [['واردة من المندوب', 'معادة للمندوب'].indexOf(st) < 0, !!b.contractor, sigsDone(b) || st === 'معتمدة', st === 'معتمدة', fundDone(b), ctSigned(b) && siteDone(b), pr >= 100]; }
  function stage(b){ if (b.status === 'معتمدة' && !b.pipe) return 7; var d = S7(b); for (var i = 0; i < 6; i++) if (!d[i]) return i + 1; return 7; }
  function gated(b){ return b.pipe && stage(b) < 7; }
  function stageName(b){ return STEPS[stage(b) - 1][1]; }
  function att(a){ return a ? (typeof thumbsHTML === 'function' ? thumbsHTML([a]) : '<a href="' + esc(a.data) + '" target="_blank">' + esc(a.name || 'ملف') + '</a>') : ''; }
  function pickFile(w, id){ return new Promise(function(res){ var i = w.querySelector('#' + id); if (!i || !i.files || !i.files.length) return res(null); readFile(i.files[0]).then(res, function(){ res(null); }); }); }
  function payState(b){ var L = b.payReqs || []; var paid = L.filter(function(p){ return p.status === 'مدفوعة'; }).reduce(function(a, p){ return a + (+p.amount || 0); }, 0);
    var appr = L.filter(function(p){ return p.status === 'معتمدة'; }).reduce(function(a, p){ return a + (+p.amount || 0); }, 0);
    var pend = L.filter(function(p){ return p.status === 'بانتظار'; }).reduce(function(a, p){ return a + (+p.amount || 0); }, 0);
    var val = +((b.ct || {}).value) || total(b); return {paid: paid, appr: appr, pend: pend, val: val, rest: val - paid}; }
  function tone(s){ return /مدفوعة|معتمد|مكتمل|تم/.test(s) ? 'ok' : /مرفوض/.test(s) ? 'bad' : 'warn'; }

  /* ================= بطاقة المسار ================= */
  function steps(b){ var d = S7(b), st = stage(b);
    return '<div class="bf-steps">' + STEPS.map(function(x, i){ var n = i + 1, ok = d[i] && (n < st || n === 7 && d[6]), c = ok ? 'done' : n === st ? 'cur' : '';
      return '<div class="bf-step ' + c + '"><span class="bf-dot">' + (ok ? ic('check', 1) : '<b class="num">' + n + '</b>') + '</span><b class="small">' + x[1] + '</b></div>'; }).join('<span class="bf-line"></span>') + '</div>'; }
  function ctrBox(b, admin){
    var r = repById(b.contractor);
    return '<div class="bf-sec"><div class="row" style="justify-content:space-between"><b>' + ic('engineering') + ' المقاول المعتمد</b>' + (r ? '<span class="pill ok">' + ic('check_circle', 1) + ' ' + esc(r.name) + '</span>' : '<span class="pill warn">لم يُعتمد مقاول بعد</span>') + '</div>' +
      (admin ? '<div class="row"><button class="btn sm" data-act="bfCtr" data-id="' + b.id + '">' + ic('engineering') + (r ? 'تغيير المقاول' : 'اعتماد المقاول') + '</button><span class="tiny muted">أو يُعتمد تلقائياً عند ترسية الفرصة على أحد عروض المقاولين</span></div>' : '') + '</div>';
  }
  function fundBox(b, admin){
    var f = F(b), tg = fundTarget(b), pct = tg ? Math.min(100, Math.round((+f.raised || 0) / tg * 100)) : 0, done = fundDone(b);
    var link = f.url && !done ? '<a class="btn sm gold" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + ic('open_in_new') + 'رابط الفرصة في موقع الجمعية</a>' : '';
    var h = '<div class="bf-sec"><div class="row" style="justify-content:space-between"><b>' + ic('campaign') + ' طرح فرصة لجمع مبلغ الكراسة</b>' +
      (done ? '<span class="pill ok">' + ic('check_circle', 1) + ' اكتمل المبلغ ' + esc(String(f.doneAt).slice(0, 10)) + '</span>' : '<span class="pill warn">جارٍ الجمع</span>') + '</div>' +
      '<div class="prog"><div class="bar"><i style="width:' + pct + '%;background:' + (done ? 'var(--ok)' : 'var(--gold)') + '"></i></div><b class="num">' + pct + '%</b></div>' +
      '<div class="small"><b class="num">' + M(f.raised || 0) + '</b> من <b class="num">' + M(tg) + '</b> ر.س' + (done ? '' : ' · المتبقي <b class="num">' + M(Math.max(0, tg - (+f.raised || 0))) + '</b> ر.س') + '</div>';
    if (!done) h += '<div class="row">' + (link || '<span class="tiny muted">' + (admin ? 'أضف رابط الفرصة بعد نشرها في موقع الجمعية.' : 'لم يُنشر رابط الفرصة بعد.') + '</span>') + '</div>';
    else if (f.url) h += '<div class="tiny muted">رابط الفرصة (مؤرشف): <a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url.slice(0, 60)) + '</a></div>';
    if (f.url && !done) h += '<div class="tiny ' + (f.autoErr ? '' : 'muted') + '" style="' + (f.autoErr ? 'color:var(--warn-strong,#8A6F3D)' : '') + '">' + ic(f.autoErr ? 'sync_problem' : 'autorenew') + ' ' +
      (f.autoErr ? 'تعذرت القراءة التلقائية للمبلغ من الرابط (' + esc(f.autoErr) + '). حدّث المبلغ يدوياً أو اضغط «اكتمل المبلغ».' : f.autoAt ? 'يتحدث تلقائياً من رابط الفرصة · آخر قراءة ' + esc(f.autoAt) : 'يحاول النظام قراءة المبلغ المحدّث من رابط الفرصة تلقائياً') + '</div>';
    if (admin && !done) h += '<div class="row"><button class="btn sm" data-act="bfUrl" data-id="' + b.id + '">' + ic('link') + (f.url ? 'تعديل رابط الفرصة' : 'إضافة رابط الفرصة') + '</button><button class="btn sm" data-act="bfRaise" data-id="' + b.id + '">' + ic('savings') + 'تحديث المبلغ يدوياً</button>' +
      '<label class="btn sm pri" style="cursor:pointer"><input type="checkbox" data-act="bfDoneChk" data-id="' + b.id + '" style="accent-color:#C5A976;width:16px;height:16px"> تم اكتمال المبلغ</label></div>';
    if (admin && done) h += '<div class="row"><label class="tiny muted" style="cursor:pointer"><input type="checkbox" checked data-act="bfDoneChk" data-id="' + b.id + '"> اكتمل المبلغ (ألغِ التحديد للتراجع)</label></div>';
    if (admin && (f.log || []).length) h += '<details><summary class="tiny muted">سجل التحديثات (' + f.log.length + ')</summary><div class="tiny">' + f.log.slice().reverse().map(function(x){ return '<div>' + esc(x.at) + ' · ' + esc(x.by) + ' · <b class="num">' + M(x.raised) + '</b> ر.س' + (x.note ? ' · ' + esc(x.note) : '') + '</div>'; }).join('') + '</div></details>';
    return h + '</div>';
  }
  function contractBox(b, admin){
    var ready = fundDone(b) && !!b.contractor, c = b.ct || {}, s = b.site || {}, sg = ctSigned(b);
    var h = '<div class="bf-sec ' + (ready || c.no ? '' : 'bf-off') + '"><div class="row" style="justify-content:space-between"><b>' + ic('handshake') + ' توقيع عقد المشروع واستلام الموقع</b>' +
      (sg && siteDone(b) ? '<span class="pill ok">' + ic('check_circle', 1) + ' العقد موقّع · استُلم الموقع ' + esc(s.date) + '</span>' : !ready ? '<span class="pill">' + (!fundDone(b) ? 'بعد اكتمال جمع المبلغ' : 'بعد اعتماد المقاول') + '</span>' : sg ? '<span class="pill warn">العقد موقّع · بانتظار استلام الموقع</span>' : '<span class="pill warn">بانتظار توقيع العقد</span>') + '</div>';
    if (!(ready || c.no)) return h + '<div class="row"><button class="btn sm" data-act="bfPrint" data-id="' + b.id + '">' + ic('description') + 'معاينة نموذج العقد</button></div></div>';
    h += '<div class="small">' + (c.no ? 'عقد رقم <b class="num">' + esc(c.no) + '</b> · ' + esc(c.cName || (repById(b.contractor) || {}).name || '') + ' · القيمة <b class="num">' + M(c.value || total(b)) + '</b> ر.س · المدة ' + esc(c.months || '—') + ' أشهر' + (sg ? ' · <b style="color:var(--ok)">موقّع' + (c.signedAt ? ' ' + esc(String(c.signedAt).slice(0, 10)) : '') + '</b>' : '') : '<span class="muted">لم تُعبأ بيانات العقد بعد.</span>') + '</div>' +
      '<div class="row">' + (c.file ? '<span class="small">العقد الموقّع:</span>' + att(c.file) : '') + (s.file ? '<span class="small">محضر الاستلام:</span>' + att(s.file) : '') + '</div>' +
      '<div class="row"><button class="btn sm" data-act="bfPrint" data-id="' + b.id + '">' + ic('print') + (c.no ? 'عرض وطباعة العقد ومحضر الاستلام' : 'معاينة نموذج العقد') + '</button>' +
      (admin ? '<button class="btn sm" data-act="bfCt" data-id="' + b.id + '">' + ic('edit_document') + (c.no ? 'تعديل بيانات العقد' : 'إنشاء العقد') + '</button>' +
        (c.no && !c.sig1 ? '<button class="btn sm pri" data-act="bfSign1" data-id="' + b.id + '">' + ic('draw') + 'توقيع الجمعية وإرساله للمقاول</button>' : '') +
        (c.no ? '<label class="btn sm" style="cursor:pointer"><input type="checkbox" data-act="bfSigned" data-id="' + b.id + '" ' + (sg ? 'checked' : '') + ' style="accent-color:#C5A976;width:16px;height:16px"> تم توقيع العقد من الطرفين</label>' : '') +
        (sg && !siteDone(b) ? '<button class="btn sm pri" data-act="bfSite" data-id="' + b.id + '">' + ic('key') + 'استلام الموقع وبدء التنفيذ</button>' : '') :
       (c.sig1 && !c.sig2 ? '<button class="btn sm pri" data-act="bfSign2" data-id="' + b.id + '">' + ic('draw') + 'توقيع العقد</button>' : '')) + '</div>' +
      (c.no ? '<div class="row tiny"><span class="pill ' + (c.sig1 ? 'ok' : '') + '">' + ic(c.sig1 ? 'check' : 'schedule') + ' توقيع الجمعية' + (c.sig1 ? ': ' + esc(c.sig1.name || '') : '') + '</span><span class="pill ' + (c.sig2 ? 'ok' : c.sig1 ? 'warn' : '') + '">' + ic(c.sig2 ? 'check' : 'schedule') + ' توقيع المقاول' + (c.sig2 ? ': ' + esc(c.sig2.name || '') : c.sig1 ? ' (بانتظاره)' : '') + '</span></div>' : '');
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
    if (!b) return '';
    if (b.status === 'معتمدة' && !b.pipe) return admin ? '<div class="card card-b row" style="justify-content:space-between"><span class="small muted">' + ic('info') + ' هذه الكراسة بدأ تنفيذها قبل تفعيل مسار جمع المبلغ والعقد.</span><button class="btn sm" data-act="bfOn" data-id="' + b.id + '">' + ic('route') + 'تفعيل المسار لها</button></div>' + (b.contractor ? '<div class="card"><div class="card-b bf">' + payBox(b, admin) + chgBox(b, admin) + '</div></div>' : '') : '';
    var appr = b.status === 'معتمدة', st = stage(b);
    return '<div class="card bf-card"><div class="card-h"><div><h2>' + ic('route') + ' مسار كراسة الصيانة والتحسينات</h2><p class="small muted">المرحلة الحالية: <b>' + esc(STEPS[st - 1][1]) + '</b> · لا يبدأ التنفيذ إلا بعد اكتمال المبلغ وتوقيع العقد واستلام الموقع</p></div></div><div class="card-b bf">' +
      steps(b) + ctrBox(b, admin) + (appr ? fundBox(b, admin) + contractBox(b, admin) + (st >= 7 ? payBox(b, admin) + chgBox(b, admin) : '') : '<div class="tiny muted">' + ic('info') + ' مراحل جمع المبلغ والعقد والتنفيذ تُفتح بعد الاعتماد النهائي من مجلس الإدارة.</div>') + '</div></div>';
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
      wait.map(function(b){ var s = stage(b); return '<div class="row" style="justify-content:space-between"><span class="small">' + esc(b.title) + ' · <span class="pill warn">' + (s === 5 ? 'جمع المبلغ ' + Math.min(100, Math.round((+F(b).raised || 0) / (fundTarget(b) || 1) * 100)) + '%' : 'بانتظار: ' + STEPS[s - 1][1]) + '</span></span><button class="btn sm" data-act="openBook" data-id="' + b.id + '">فتح</button></div>'; }).join('') + '</div></div>' : '';
    var i = h.indexOf('</div>', h.indexOf('class="page-head')); if (i > -1) { var j = h.indexOf('</div>', i + 6); return h.slice(0, j + 6) + bar + h.slice(j + 6); } return bar + h; }; }
  /* صفحة «عقود المشاريع» (اللوحة) و«عقودي» (البوابة): عقود الكراسات مع زر الطباعة */
  function ctList(admin){ enroll(); var L = (S.booklets || []).filter(function(b){ return b.status === 'معتمدة' && (admin || b.contractor === SESSION.id); });
    return '<div class="card"><div class="card-h"><div><h2>' + ic('contract') + ' عقود الكراسات</h2><p class="small muted">عقد المقاولة ومحضر استلام الموقع لكل كراسة، بنموذج الجمعية وختمها</p></div><button class="btn sm" data-act="bfTpl">' + ic('description') + 'معاينة نموذج العقد</button></div><div class="card-b" style="display:flex;flex-direction:column;gap:8px">' + (L.length ? '' : '<div class="tiny muted">لا توجد كراسات معتمدة بعد. يظهر هنا عقد كل كراسة بعد اعتمادها.</div>') +
      L.map(function(b){ var c = b.ct || {}; return '<div class="row" style="justify-content:space-between;border-bottom:1px dashed var(--line,#D6DFE5);padding-bottom:8px"><span class="small"><b>' + esc(b.title) + '</b> · ' + esc(b.mosque || '') + '<br><span class="tiny muted">' + (c.no ? 'عقد ' + esc(c.no) + ' · ' + esc(c.cName || (repById(b.contractor) || {}).name || '') + ' · ' + M(c.value || total(b)) + ' ر.س' : 'لم يُنشأ العقد بعد') + (siteDone(b) ? ' · استُلم الموقع ' + esc(b.site.date) : '') + '</span></span>' +
        '<span class="row"><button class="btn sm" data-act="bfPrint" data-id="' + b.id + '">' + ic('print') + (c.no ? 'طباعة العقد' : 'معاينة النموذج') + '</button>' + (!admin && c.sig1 && !c.sig2 ? '<button class="btn sm pri" data-act="bfSign2" data-id="' + b.id + '">' + ic('draw') + 'توقيع العقد</button>' : '') + (!admin && c.sig2 ? '<span class="pill ok">' + ic('check') + ' وقّعتَ العقد</span>' : '') + (admin ? '<button class="btn sm ghost" data-act="openBook" data-id="' + b.id + '">فتح الكراسة</button>' : '') + '</span></div>'; }).join('') + '</div></div>'; }
  ['contracts', 'p_contracts'].forEach(function(k){ if (!VIEWS[k]) return; var _o = VIEWS[k]; VIEWS[k] = function(){ var h = _o.apply(this, arguments); var x = ctList(!PORTAL); if (!x) return h;
    var i = h.indexOf('</div>', h.indexOf('class="page-head')); if (i > -1) { var j = h.indexOf('</div>', i + 6); return h.slice(0, j + 6) + x + h.slice(j + 6); } return x + h; }; });

  /* ================= الإدارة المكتبية ← العقود ================= */
  function ctStatus(b){ var c = b.ct || {}; if (!c.no) return fundDone(b) && b.contractor ? ['جاهز لإنشاء العقد', 'info'] : ['بانتظار ' + stageName(b), ''];
    if (ctSigned(b) && siteDone(b)) return [(function(){ try { return bookProgress(b) >= 100; } catch(e){ return false; } })() ? 'منتهي التنفيذ' : 'ساري · قيد التنفيذ', 'ok'];
    return ctSigned(b) ? ['موقّع · بانتظار استلام الموقع', 'gold'] : ['بانتظار التوقيع', 'warn']; }
  if (!PORTAL) {
    VIEWS.off_contracts = function(){ enroll();
      var L = (S.booklets || []).filter(function(b){ return b.status === 'معتمدة'; }), withCt = L.filter(function(b){ return b.ct && b.ct.no; }), P = S.contracts || [];
      var signed = withCt.filter(ctSigned).length, val = withCt.reduce(function(a, b){ return a + (+b.ct.value || total(b)); }, 0) + P.reduce(function(a, c){ return a + (+c.value || 0); }, 0);
      var q = (UI.ocQ || '').trim();
      var rows = L.filter(function(b){ return !q || JSON.stringify([b.title, b.mosque, b.id, b.ct || {}, (repById(b.contractor) || {}).name]).indexOf(q) > -1; }).map(function(b){ var c = b.ct || {}, st = ctStatus(b);
        return '<tr><td class="num"><b>' + esc(c.no || '—') + '</b><div class="tiny muted">' + esc(b.id) + '</div></td><td class="small"><b>' + esc(b.title) + '</b><div class="tiny muted">' + esc(b.mosque || '') + '</div></td><td class="small">' + esc(c.cName || (repById(b.contractor) || {}).name || '—') + '</td>' +
          '<td class="num">' + (c.no ? M(c.value || total(b)) : '<span class="muted">' + M(total(b)) + '</span>') + '</td><td class="num tiny">' + esc(c.date || '—') + '</td><td><span class="pill ' + st[1] + '">' + esc(st[0]) + '</span></td>' +
          '<td><div class="row"><button class="btn sm" data-act="bfPrint" data-id="' + b.id + '">' + ic('visibility') + (c.no ? 'عرض العقد' : 'النموذج') + '</button>' + ((fundDone(b) && b.contractor) || c.no ? '<button class="btn sm" data-act="bfCt" data-id="' + b.id + '">' + ic('edit_document') + (c.no ? 'تعديل' : 'إنشاء') + '</button>' : '') + '<button class="btn sm ghost" data-act="openBook" data-id="' + b.id + '">' + ic('description') + 'الكراسة</button></div></td></tr>'; }).join('');
      var prow = P.map(function(c){ var pl = (S.plan || []).filter(function(x){ return x.id === c.plan; })[0] || {}, r = repById(c.rep) || {};
        return '<tr><td class="num"><b>' + esc(c.id || '') + '</b></td><td class="small">' + esc(pl.name || '—') + '</td><td class="small">' + esc(r.name || '—') + '</td><td class="num">' + M(c.value || 0) + '</td><td class="num tiny">' + esc((c.from || '') + (c.to ? ' ← ' + c.to : '')) + '</td><td><span class="pill ' + (c.status === 'ساري' ? 'ok' : 'warn') + '">' + esc(c.status || '') + '</span></td><td><button class="btn sm" data-go="contracts">' + ic('open_in_new') + 'فتح</button></td></tr>'; }).join('');
      var th = '<thead><tr><th>رقم العقد</th><th>المشروع</th><th>المقاول</th><th>القيمة (ر.س)</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead>';
      return head('الإدارة المكتبية', 'العقود', 'جميع عقود الجمعية في مكان واحد، بكليشة الجمعية وختمها الرسمي: عقود كراسات الصيانة والتحسينات وعقود المشاريع.',
          '<button class="btn" data-act="bfTpl">' + ic('description') + 'معاينة نموذج العقد</button><button class="btn gold" data-act="bfNewCt">' + ic('add') + 'إنشاء عقد لكراسة</button>') +
        '<div class="grid g4">' + kpi('contract', 'إجمالي العقود', withCt.length + P.length, 'كراسات ومشاريع', 'info') + kpi('draw', 'عقود موقّعة', signed, 'من عقود الكراسات', 'ok') + kpi('pending_actions', 'بانتظار التوقيع', withCt.length - signed, 'عقد', 'warn') + kpi('payments', 'قيمة العقود', M(val), 'ر.س', 'gold') + '</div>' +
        '<div class="field"><input class="inp" id="ocQ" placeholder="ابحث برقم العقد أو المشروع أو المقاول…" value="' + esc(UI.ocQ || '') + '"></div>' +
        '<div class="card"><div class="card-h"><div><h2>' + ic('request_quote') + ' عقود كراسات الصيانة والتحسينات</h2><p class="small muted">يُنشأ عقد الكراسة بعد اكتمال جمع مبلغ الفرصة واعتماد المقاول</p></div></div>' + (rows ? '<div class="tbl-wrap"><table>' + th + '<tbody>' + rows + '</tbody></table></div>' : '<div class="card-b empty">لا توجد كراسات معتمدة بعد.</div>') + '</div>' +
        (P.length ? '<div class="card"><div class="card-h"><div><h2>' + ic('handshake') + ' عقود المشاريع (استلام مشروع كامل)</h2></div></div><div class="tbl-wrap"><table>' + th + '<tbody>' + prow + '</tbody></table></div></div>' : '');
    };
    document.addEventListener('input', function(e){ if (e.target.id !== 'ocQ') return; UI.ocQ = e.target.value; clearTimeout(window.__ocT); window.__ocT = setTimeout(function(){ render(); var i = document.getElementById('ocQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); });
    try { var ITEM = {k: 'off_contracts', t: 'العقود', i: 'contract'}, put = false;
      NAV_FULL.forEach(function(g){ if (!put && g.g === 'الإدارة المكتبية') { g.items.push(ITEM); put = true; } });
      if (!put) NAV_FULL.push({g: 'الإدارة المكتبية', items: [ITEM]});
      try { if (typeof NEED !== 'undefined' && NEED.off_letters != null && NEED.off_contracts == null) NEED.off_contracts = NEED.off_letters; } catch(e){}
      if (typeof applyNavPerms === 'function' && typeof STAFF !== 'undefined' && STAFF.user) applyNavPerms(); } catch(e){}
  }

  /* البوابة: جدول التنفيذ مقفل حتى استلام الموقع، وبعده الدفعات والتعديلات */
  if (PORTAL && typeof execTable === 'function') { var _et = execTable; execTable = function(b, editable){
    if (!editable) return _et.apply(this, arguments); enroll();
    if (gated(b)) { var s = stage(b); return '<div class="card bf-card"><div class="card-h"><div><h2>' + ic('lock_clock') + ' لم يبدأ التنفيذ بعد</h2><p class="small muted">' + 'المرحلة الحالية: ' + STEPS[s - 1][1] + '</p></div></div><div class="card-b bf">' + steps(b) + fundBox(b, false) + contractBox(b, false) + '</div></div>'; }
    return (b.pipe || b.contractor ? '<div class="card"><div class="card-b bf">' + (b.pipe ? contractBox(b, false) : '') + payBox(b, false) + chgBox(b, false) + '</div></div>' : '') + _et.apply(this, arguments); }; }

  /* ================= العقد: طباعة من نموذج الجمعية ================= */
  function hijri(d){ try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {day: 'numeric', month: 'numeric', year: 'numeric'}).format(d).replace(/[\u200f\u200e]/g, '').replace(/\s*هـ\s*$/, ''); } catch(e){ return ''; } }
  function dayName(d){ try { return d.toLocaleDateString('ar-SA', {weekday: 'long'}); } catch(e){ return ''; } }
  function L(v, n){ v = v == null ? '' : String(v); return v ? '<b>' + esc(v) + '</b>' : '<span class="dots">' + '.'.repeat(n || 20) + '</span>'; }
  var DEF_CLAUSES = [{"t": "البند الأول: مكملات العقد", "x": "- التمهيد أعلاه جزء لا يتجزأ من هذا العقد.\n- عرض السعر رقم ({عرض_السعر}) وتاريخ {تاريخ_العرض}، وكراسة الأعمال رقم {الكراسة} «{المشروع}».\n- المخططات المعتمدة من الطرفين."}, {"t": "البند الثاني: موضوع العقد", "x": "القيام بأعمال {المشروع} بـ{المسجد} بمحافظة الزلفي."}, {"t": "البند الثالث: مدة العقد", "x": "يلتزم الطرف الثاني بإتمام جميع الأعمال المبينة في هذا العقد خلال مدة زمنية أقصاها ({المدة}) أشهر شاملة الاختبارات والتسليم، وتسري هذه المدة اعتباراً من تاريخ استلام الموقع، وعلى الطرف الثاني فور استلام الموقع أن يبادر بالبدء بالأعمال موضوع العقد وإنهاء جميع الأعمال الموكلة إليه."}, {"t": "البند الرابع: قيمة العقد وجدول الدفعات", "x": "اتفق الطرفان على أن القيمة الإجمالية لأعمال العقد قدرها ({القيمة}) ريال سعودي شاملة ضريبة القيمة المضافة. وتكون الدفعات كالتالي:\n{الدفعات}"}, {"t": "البند الخامس: التزامات الطرف الأول", "x": "- التنسيق مع وزارة الشؤون الإسلامية كلما دعت الحاجة لذلك.\n- تسهيل مهام الطرف الثاني لمزاولة أعماله.\n- سرعة الاستجابة مع الطرف الثاني لمتابعة استلام وتسليم الأعمال.\n- سداد مستحقات الطرف الثاني وفقاً لما ينص عليه البند الرابع من هذا العقد."}, {"t": "البند السادس: التزامات الطرف الثاني", "x": "- يقر الطرف الثاني بأنه اطلع ودرس بنفسه جميع الاشتراطات الخاصة بهذا المشروع.\n- يلتزم بتنفيذ جميع الأعمال المشترطة بدون استثناء.\n- يلتزم باستخدام العدد الكافي من العمال المختصين لإنجاز الأعمال في المدة المحددة.\n- الطرف الثاني مسؤول وحده عن عماله وسلامتهم وعن أي أضرار تحدث للغير نتيجة أعمالهم.\n- يلتزم بالتقيد بجميع الأنظمة التي نصت عليها أنظمة العمل.\n- يلتزم بمباشرة العمل والإشراف عليه بنفسه، وليس له التنازل عنه أو عن جزء منه لمقاول من الباطن إلا بموافقة خطية من الطرف الأول، وإلا حق للطرف الأول فسخ العقد مباشرة.\n- يلتزم بالمعايير والاشتراطات الفنية والهندسية واشتراطات السلامة، ويتحمل ما ينتج عن مخالفتها.\n- جميع المواد التي يوردها الطرف الأول عهدة في ذمة الطرف الثاني بمجرد وضعها في مكان العمل.\n- يلتزم بتوفير كل ما يحتاج إليه لإنجاز الأعمال وبأعلى المعايير الفنية.\n- يلتزم بعمل الاختبارات اللازمة للأعمال محل العقد.\n- يلتزم باتباع إرشادات المهندس الاستشاري في حال تعيينه، ولا يخلي ذلك مسؤوليته عن الأعمال.\n- لا يحق له الانسحاب من المشروع إلا بموافقة الطرف الأول كتابياً، مع حفظ حق الطرف الأول في المطالبة بالمبالغ المصروفة والتعويض."}, {"t": "البند السابع: التأخر في التنفيذ وعدم تنفيذ الالتزامات", "x": "في حال تأخر الطرف الثاني أو تقاعسه أو عدم التزامه بالمواصفات أو عدم البدء بالأعمال رغم جاهزية الموقع أو عدم تأمين الضمان البنكي مقابل الدفعة المقدمة، يوجه الطرف الأول إنذاراً لتدارك الوضع خلال (5) أيام عمل، فإن لم يتداركه حق للطرف الأول: تنفيذ العقد على حساب الطرف الثاني وخصماً من مستحقاته، أو فسخ العقد مع الرجوع عليه بالدفعات المستلمة والتعويضات. ويحق للطرف الأول إيقاف العمل إذا اقتضت الضرورة بما لا يتجاوز (10) أيام متصلة أو (20) يوماً منفصلة، مع تعويض الطرف الثاني بمدة إضافية."}, {"t": "البند الثامن: غرامة التأخير", "x": "يحق للطرف الأول حسم غرامة تأخير بمقدار 1% من قيمة العقد الإجمالية عن كل يوم تأخير، على ألا تتجاوز الغرامة (10%) من قيمة العقد."}, {"t": "البند التاسع: الضمان", "x": "- يضمن الطرف الثاني المواد الموردة والأعمال المنفذة وفق كود البناء السعودي.\n- مدد الضمان كحد أدنى: 10 سنوات للهيكل الإنشائي والعزل، وسنتان لأعمال السباكة والكهرباء والتشطيبات، تبدأ من تاريخ الاستلام النهائي.\n- يسلم الطرف الثاني شهادات الضمان لكافة المنتجات الموردة.\n- يباشر الإصلاح خلال (72) ساعة من إبلاغه بالعيب، وإلا حق للطرف الأول الإصلاح على حسابه."}, {"t": "البند العاشر: التعديلات والزيادة والتخفيض في الأعمال", "x": "- يحق للطرف الأول زيادة أو تخفيض الأعمال بما لا يزيد عن 25% من قيمة العقد.\n- تسعر الأعمال الزائدة وفق جدول الكميات وعرض السعر دون مطالبة بتعويض.\n- تكون المحاسبة بمقتضى الكميات المنفذة فعلاً والفئات الواردة في قائمة الأسعار المرفقة."}, {"t": "البند الحادي عشر: شروط عامة", "x": "- يلتزم الطرف الثاني باستخدام عمالة نظامية والتقيد بأنظمة العمل والإقامة.\n- يلتزم بتطبيق إجراءات الأمن والسلامة ويتحمل المسؤولية المدنية والجزائية عن الأضرار الناتجة عن عمله.\n- يلتزم بجلب العمالة الفنية ذات الكفاءة والخبرة الكافية.\n- يتخذ كل التدابير لمنع الأضرار بالموقع والمنطقة المحيطة.\n- لا يحق له التنازل عن العقد أو جزء منه إلا بموافقة خطية مسبقة، ويبقى مسؤولاً عن مقاوليه من الباطن.\n- يلتزم بنظافة مكان العمل، وإلا نُظف على حسابه.\n- أي تساهل في شروط العقد لا يشكل حقاً مكتسباً للطرف الثاني."}, {"t": "البند الثاني عشر: تسليم الأعمال", "x": "- تقبل الأعمال أو ترفض بحسب مطابقتها للمخططات والمواصفات وكود البناء السعودي.\n- يخطر الطرف الثاني الطرف الأول عند انتهاء كل مرحلة قبل الانتقال للتالية، ولا يغطى أي عمل إلا بعد الفحص والموافقة الكتابية.\n- يحق للطرف الأول رفض الأعمال غير المطابقة، ويلتزم الطرف الثاني بإزالتها أو تصحيحها على نفقته.\n- عند انتهاء الأعمال يحرر محضر استلام ابتدائي، وتنهى الملاحظات خلال (15) يوماً كشرط للاستحقاق المالي النهائي.\n- يعتبر الاستلام نهائياً بعد فترة الاختبار وخلوه من الملاحظات، ومنه تبدأ مدد الضمان."}, {"t": "البند الثالث عشر: فسخ العقد", "x": "- يحق للطرف الأول فسخ العقد على مسؤولية الطرف الثاني في حال عجزه عن التنفيذ، إلا بسبب قوة قاهرة مثبتة.\n- يلتزم الطرف الثاني عند الفسخ بإعادة الدفعات المسددة مع حفظ حق التعويض.\n- يتحمل من يفسخ العقد دون سبب مشروع كافة المصاريف الناتجة عن الفسخ."}, {"t": "البند الرابع عشر: النظام الحاكم والاختصاص القضائي", "x": "يخضع هذا العقد لأنظمة المملكة العربية السعودية، وفي حال الخلاف وتعذر الحل ودياً يفض عن طريق المحكمة المختصة في محافظة الزلفي."}, {"t": "البند الخامس عشر: نسخ العقد", "x": "حرر هذا العقد من خمسة عشر بنداً، ومن نسختين أصليتين بيد كل طرف نسخة للعمل بموجبها."}];
  window.ZULFI_DEF_CLAUSES = DEF_CLAUSES;
  function clausesOf(b){ var c = b.ct || {}; return (c.clauses && c.clauses.length) ? c.clauses : DEF_CLAUSES; }
  function clausesHTML(b, pays){ var c = b.ct || {};
    var tok = {'عرض_السعر': L(c.offerNo, 8), 'تاريخ_العرض': L(c.offerDate, 10), 'الكراسة': esc(b.id || ''), 'المشروع': esc(b.title || ''), 'المسجد': esc(b.mosque || ''), 'المدة': L(c.months, 3),
      'القيمة': (c.value || total(b)) ? M(c.value || total(b)) : L('', 14), 'الدفعات': '<ol>' + (pays || '<li>' + L('', 40) + '</li>') + '</ol>'};
    var fmt = function(line){ return esc(line).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\{([^{}]+)\}/g, function(m, k){ return tok[k] != null ? tok[k] : m; }); };
    return clausesOf(b).map(function(x){ var out = '', list = []; String(x.x || '').split('\n').forEach(function(l){ if (/^\s*-\s+/.test(l)) list.push('<li>' + fmt(l.replace(/^\s*-\s+/, '')) + '</li>'); else { if (list.length) { out += '<ol>' + list.join('') + '</ol>'; list = []; } if (l.trim()) out += (/^\s*\{الدفعات\}\s*$/.test(l) ? fmt(l.trim()) : '<p>' + fmt(l) + '</p>'); } });
      if (list.length) out += '<ol>' + list.join('') + '</ol>'; return '<h2>' + esc(x.t || '') + '</h2>' + out; }).join(''); }

  /* تقسيم المستند إلى صفحات A4 منفصلة (كليشة أعلى وأسفل كل صفحة) */
  function paginateDoc(){
    function run(){
      var T = [].slice.call(document.querySelectorAll('table.lh')); if (!T.length) return;
      var h0 = T[0].querySelector('.lhh'), f0 = T[0].querySelector('.lhf'), hs = h0 ? h0.getAttribute('src') : '', fs = f0 ? f0.getAttribute('src') : '';
      var out = document.createElement('div'); out.className = 'pages'; document.body.appendChild(out);
      function page(){ var p = document.createElement('div'); p.className = 'pg';
        p.innerHTML = (hs ? '<img class="pgh" src="' + hs + '" alt="">' : '') + '<div class="pc"></div>' + (fs ? '<img class="pgf" src="' + fs + '" alt="">' : '') + '<span class="pgn"></span>';
        out.appendChild(p); return p.querySelector('.pc'); }
      function over(c){ return c.scrollHeight > c.clientHeight + 1; }
      T.forEach(function(t){ var bd = t.querySelector('td.bd'); if (!bd) return; var c = page(), list = [].slice.call(bd.children);
        list.forEach(function place(el){ c.appendChild(el); if (!over(c)) return; c.removeChild(el);
          var kids = [].slice.call(el.children), tag = el.tagName;
          if ((tag === 'OL' || tag === 'UL' || tag === 'TABLE') && kids.length) {
            var rows = tag === 'TABLE' ? [].slice.call(el.querySelectorAll('tr')) : kids, n0 = +(el.getAttribute('start') || 1), i = 0;
            var shell = function(){ var s = el.cloneNode(false); if (tag === 'OL') s.setAttribute('start', n0 + i); if (tag === 'TABLE') { var tb = document.createElement('tbody'); s.appendChild(tb); s._b = tb; } else s._b = s; return s; };
            var cur = shell(); c.appendChild(cur);
            while (i < rows.length) { cur._b.appendChild(rows[i]);
              if (over(c)) { cur._b.removeChild(rows[i]); if (!cur._b.children.length) c.removeChild(cur); c = page(); cur = shell(); c.appendChild(cur); cur._b.appendChild(rows[i]); }
              i++; }
            return; }
          c = page(); c.appendChild(el); });
      });
      T.forEach(function(t){ t.parentNode.removeChild(t); });
      var P = out.querySelectorAll('.pg'); [].forEach.call(P, function(p, k){ var n = p.querySelector('.pgn'); if (n) n.textContent = 'صفحة ' + (k + 1) + ' من ' + P.length; });
    }
    var go = function(){ try { run(); } catch(e){} };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ setTimeout(go, 50); }); else window.addEventListener('load', go);
  }
  var PAGE_CSS = '.pg{width:210mm;height:297mm;position:relative;background:#fff;margin:12px auto;box-shadow:0 2px 10px rgba(20,60,84,.14);overflow:hidden;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}' +
    '.pgh{position:absolute;top:0;left:0;width:210mm;height:29.6mm}.pgf{position:absolute;bottom:0;left:0;width:210mm;height:27mm}.pc{position:absolute;top:31mm;bottom:33mm;left:18mm;right:18mm;overflow:hidden;line-height:1.9;font-size:13.5px}' +
    '.pgn{position:absolute;bottom:28.5mm;left:18mm;font-size:10px;color:#5B7383}.pc>*:first-child{margin-top:0}' +
    '@media print{@page{size:A4;margin:0}html,body{margin:0;background:#fff;zoom:1!important}.bar{display:none}.pg{margin:0;box-shadow:none}}';
  window.ZULFI_PAGINATE = '<script>(' + paginateDoc.toString() + ')()<\/script>';
  window.ZULFI_PAGE_CSS = PAGE_CSS;
  function contractHTML(b){
    var c = b.ct || {}, s = b.site || {}, rep = repById(b.contractor) || {}, d = c.date ? new Date(c.date) : new Date(), sd = s.date ? new Date(s.date) : null;
    var pays = (c.pays || []).map(function(p, i){ return '<li>' + (i === 0 && /مقدم/.test(p.cond || '') ? 'دفعة مقدمة' : 'دفعة') + ' مبلغ وقدره (' + M(p.amount) + ') ريال، تستحق ' + esc(p.cond || '') + '.</li>'; }).join('');
    var stamp = STAMP ? '<img class="stamp" src="' + STAMP + '" alt="ختم الجمعية">' : '';
    var LH = window.ZULFI_LH || {};
    var PGO = function(){ return '<table class="lh"><thead><tr><td>' + (LH.hdr ? '<img class="lhh" src="' + LH.hdr + '" alt="">' : '') + '</td></tr></thead><tfoot><tr><td>' + (LH.ftr ? '<img class="lhf" src="' + LH.ftr + '" alt="">' : '') + '</td></tr></tfoot><tbody><tr><td class="bd">'; };
    var PGC = '</td></tr></tbody></table>';
    var party = function(){ return '<div class="sig"><div><b>الطرف الأول</b><div>جمعية المساجد بالزلفي</div><div>ممثلة بالأستاذ/ ' + esc(c.rep1 || REP1) + '</div><div class="slot">' + stamp + (c.sig1 ? '<img class="sgi" src="' + c.sig1.img + '" alt="توقيع الطرف الأول">' : '') + '</div>' + (c.sig1 ? '<div class="sgn">' + esc(c.sig1.name || '') + ' · ' + esc(String(c.sig1.at || '').slice(0, 10)) + '</div>' : '') + '</div><div><b>الطرف الثاني</b><div>' + esc(c.cName || rep.name || '') + '</div><div>ممثلة بالأستاذ/ ' + esc(c.cRep || '') + '</div><div class="slot">' + (c.sig2 ? '<img class="sgi" src="' + c.sig2.img + '" alt="توقيع الطرف الثاني">' : '') + '</div>' + (c.sig2 ? '<div class="sgn">' + esc(c.sig2.name || '') + ' · ' + esc(String(c.sig2.at || '').slice(0, 10)) + '</div>' : '') + '</div></div>'; };
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>عقد مقاولة ' + esc(c.no || '') + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap"><style>' +
      'body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;color:#17384C;margin:0;background:#eef1f4}table.lh{width:210mm;margin:12px auto;background:#fff;border-collapse:collapse;page-break-after:always;box-shadow:0 2px 10px rgba(20,60,84,.12)}table.lh>thead>tr>td,table.lh>tfoot>tr>td{padding:0}.lhh,.lhf{width:100%;display:block}td.bd{padding:4mm 18mm 8mm;line-height:1.95;font-size:13.5px;vertical-align:top}.ref{display:flex;justify-content:space-between;font-size:11.5px;color:#5B7383;margin-bottom:8px}' +
      'h1{text-align:center;color:#143C54;font-size:22px;margin:0 0 14px}h2{font-size:15px;color:#1D5271;margin:16px 0 4px;border-bottom:1px solid #D6DFE5;padding-bottom:3px}ol{margin:0;padding-right:22px}.dots{color:#8aa}' +
      '.sig{display:flex;justify-content:space-between;gap:30px;margin-top:30px;text-align:center}.sig>div{flex:1}.slot{height:120px;position:relative}.stamp{width:190px;position:absolute;left:50%;top:6px;transform:translateX(-50%) rotate(-8deg);opacity:.92}.sgi{position:absolute;left:50%;top:22px;transform:translateX(-50%);max-width:170px;max-height:80px}.sgn{font-size:11px;color:#5B7383}' +
      '.hd{display:flex;justify-content:space-between;font-size:12px;color:#5B7383;border-bottom:2px solid #C5A976;padding-bottom:6px;margin-bottom:14px}.bar{position:sticky;top:0;background:#143C54;color:#fff;padding:10px;text-align:center}.bar button{font:inherit;padding:6px 18px;border-radius:6px;border:0;background:#C5A976;color:#143C54;font-weight:700;cursor:pointer}' +
      PAGE_CSS + '</style></head><body><div class="bar"><button onclick="print()">طباعة / حفظ PDF</button></div>' +
      PGO() + '<div class="ref"><span>عقد رقم ' + esc(c.no || '…') + '</span><span>كراسة ' + esc(b.id) + '</span></div>' +
      '<h1>عقد مقاولة</h1><p>إنه في يوم ' + esc(dayName(d)) + ' بتاريخ ' + esc(hijri(d)) + 'هـ، الموافق ' + esc(d.toISOString().slice(0, 10).split('-').reverse().join('/')) + 'م، بمحافظة الزلفي تم الاتفاق والتراضي بين كل من:</p>' +
      '<p><b>أولاً:</b> جمعية المساجد بالزلفي بترخيص رقم (5358) من المركز الوطني لتنمية القطاع غير الربحي، وعنوانها الزلفي، جوال (' + esc(c.phone1 || (typeof ORG !== 'undefined' ? ORG.phone : '')) + ')، ممثلة بالأستاذ/ ' + esc(c.rep1 || REP1) + '، ويشار إليها فيما بعد (بالطرف الأول أو الجمعية).</p>' +
      '<p><b>ثانياً:</b> ' + L(c.cName || rep.name, 30) + '، الرقم الموحد (' + L(c.unified, 12) + ')، ويمثلها الأستاذ/ ' + L(c.cRep, 20) + ' بصفته ' + L(c.cTitle, 12) + '، وعنوانها ' + L(c.cAddr, 20) + '، جوال (' + L(c.cPhone || rep.phone, 12) + ')، وتحمل سجلاً تجارياً رقم (' + L(c.cr, 12) + ')، ويشار إليها فيما بعد (بالطرف الثاني).</p>' +
      '<p><b>تمهيد:</b> حيث إن الطرف الأول جمعية أهلية تقدم خدمات للجوامع والمساجد بالبناء والترميم والصيانة وتأمين الاحتياجات، وحيث إن الطرف الثاني متخصص في أعمال المقاولات، فقد اتفق الطرفان على ما يلي:</p>' +
      clausesHTML(b, pays) + '<p style="text-align:center">والله ولي التوفيق،،،</p>' + party() + PGC +
      PGO() + '<div class="ref"><span>محضر استلام موقع</span><span>كراسة ' + esc(b.id) + '</span></div><h1>محضر استلام الموقع</h1><p>بين كل من:</p><p><b>أولاً:</b> جمعية المساجد بالزلفي (طرف أول - المسلِّم)</p><p><b>ثانياً:</b> ' + L(c.cName || rep.name, 30) + ' (طرف ثانٍ - المستلم)</p>' +
      '<p>حيث اجتمع الطرفان المشار إليهما أعلاه في موقع المشروع: ' + esc(b.mosque || '') + ' — ' + esc(b.title) + '، وبعد المعاينة فقد تم تسليم الطرف الثاني الموقع في تاريخ ' + (sd ? esc(hijri(sd)) + 'هـ، الموافق ' + esc(s.date.split('-').reverse().join('/')) + 'م' : L('', 14) + 'هـ، الموافق ' + L('', 14) + 'م') + '، وبموجبه فإن موقع العمل تحت مسؤولية الطرف الثاني لحين تسليم المشروع للطرف الأول.</p><p style="text-align:center">هذا وبالله التوفيق..</p>' + party() + PGC + window.ZULFI_PAGINATE + '</body></html>';
  }
  function popContract(b){ var w = window.open('', '_blank'); if (!w) { toast('اسمح بالنوافذ المنبثقة لفتح العقد في نافذة', 'error'); return; } w.document.open(); w.document.write(contractHTML(b)); w.document.close(); }
  /* معاينة العقد داخل الصفحة نفسها */
  function printContract(b){ showDoc(contractHTML(b), 'عقد المقاولة ومحضر استلام الموقع · ' + (b.title || ''), b, 'contract'); }
  /* الختم اختياري لكل وثيقة: لا يظهر إلا إذا فُعّل لها */
  function stampOn(b, key){ return !!(b && key && b.docStamp && b.docStamp[key]); }
  function noStampCSS(){ return '<style>.stamp{display:none!important}</style>'; }
  window.zulfiStampOn = stampOn;
  function showDoc(full0, title, b, key){
    var on = stampOn(b, key), full = on || !key ? full0 : full0.replace('</head>', noStampCSS() + '</head>');
    var html = full.replace('<div class="bar"><button onclick="print()">طباعة / حفظ PDF</button></div>', '');
    var w = modal({title: title, icon: 'description', wide: 1, onOk: null, body:
      '<div class="row" style="margin-bottom:8px">' + (key && b && !PORTAL ? '<label class="btn sm ' + (on ? 'gold' : '') + '" style="cursor:pointer" id="stLbl"><input type="checkbox" id="stOn" ' + (on ? 'checked' : '') + ' style="accent-color:#C5A976;width:16px;height:16px"> إضافة ختم الجمعية</label>' : '') + '<button class="btn sm pri" id="ctPrint">' + ic('print') + 'طباعة / حفظ PDF</button><button class="btn sm" id="ctWin">' + ic('open_in_new') + 'فتح في نافذة مستقلة</button><span class="tiny muted">مرّر داخل المعاينة لقراءة العقد كاملاً</span></div>' +
      '<iframe id="ctFrame" title="معاينة العقد" style="width:100%;height:70vh;border:1px solid var(--line,#D6DFE5);border-radius:8px;background:#eef1f4"></iframe>'});
    var m = w.querySelector('.modal'); if (m) m.style.width = 'min(1000px,100%)';
    var f = w.querySelector('#ctFrame'); var z = Math.min(1, ((f.clientWidth || 800) - 24) / 820); f.srcdoc = html.replace('</head>', '<style>@media screen{html{zoom:' + z.toFixed(3) + '}}</style></head>');
    w.querySelector('#ctPrint').addEventListener('click', function(){ try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){ var x = window.open('', '_blank'); if (x) { x.document.write(full); x.document.close(); } } });
    var sw = w.querySelector('#stOn'); if (sw) sw.addEventListener('change', function(){ b.docStamp = b.docStamp || {}; b.docStamp[key] = sw.checked; try { save(); } catch(e){} w.remove(); showDoc(full0, title, b, key); toast(sw.checked ? 'أُضيف ختم الجمعية لهذه الوثيقة' : 'أُزيل الختم من هذه الوثيقة', 'approval'); });
    w.querySelector('#ctWin').addEventListener('click', function(){ var x = window.open('', '_blank'); if (!x) { toast('اسمح بالنوافذ المنبثقة', 'error'); return; } x.document.open(); x.document.write(full); x.document.close(); });
  }
  window.zulfiContractHTML = contractHTML;

  /* ================= قراءة المبلغ المحدّث تلقائياً من رابط الفرصة ================= */
  function nrm(t){ return String(t || '').replace(/[٠-٩]/g, function(d){ return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[٬،]/g, ',').replace(/٫/g, '.'); }
  function num(x){ var n = parseFloat(String(x).replace(/,/g, '')); return isFinite(n) ? n : null; }
  function parseAmount(txt){ txt = nrm(txt);
    try { var o = JSON.parse(txt), found = null; (function walk(v){ if (found != null || v == null) return; if (typeof v === 'object') Object.keys(v).forEach(function(k){ if (found != null) return; var x = v[k];
        if (/raised|collected|donat|paid|current|achieved|المجموع|المحصل|المتبرع/i.test(k) && (typeof x === 'number' || (typeof x === 'string' && num(x) != null))) found = num(x); else walk(x); }); })(o); if (found != null) return found; } catch(e){}
    var t = txt.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    var m = t.match(/(?:تم جمع|المبلغ المجموع|المبلغ المحصل|المحصل|تم التبرع ب|مجموع التبرعات|collected|raised)\s*[:：]?\s*(?:ر\.?س\.?|SAR|ريال)?\s*([\d][\d,\.]*)/i);
    return m ? num(m[1]) : null; }
  var autoBusy = false;
  function autoFund(){
    if (PORTAL || autoBusy || !window.fetch) return; var L = (S.booklets || []).filter(function(b){ return b.pipe && b.status === 'معتمدة' && b.fund && b.fund.url && !b.fund.doneAt; }); if (!L.length) return;
    autoBusy = true;
    Promise.all(L.map(function(b){ var f = b.fund, u = f.feed || f.url;
      return fetch(u, {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function(txt){ var n = parseAmount(txt);
          if (n == null) { if (f.autoErr !== 'لم يُعثر على المبلغ في الصفحة') { f.autoErr = 'لم يُعثر على المبلغ في الصفحة'; return 1; } return 0; }
          var ch = 0; if (f.autoErr) { delete f.autoErr; ch = 1; } f.autoAt = nowS();
          if (n !== +f.raised) { f.raised = n; f.log = f.log || []; f.log.push({at: nowS(), by: 'تحديث تلقائي', raised: n, note: 'من رابط الفرصة'}); ch = 1;
            if (n >= fundTarget(b)) { f.doneAt = nowS(); notify('اكتمل مبلغ الكراسة ' + b.title + ' (تحديث تلقائي)'); } }
          return ch; })
        .catch(function(e){ var m = /Failed to fetch|NetworkError|Load failed|TypeError/i.test(String(e && e.message || e)) ? 'موقع الفرصة لا يسمح بالقراءة من خارجه' : String(e && e.message || e); if (f.autoErr !== m) { f.autoErr = m; return 1; } return 0; }); }))
      .then(function(R2){ autoBusy = false; if (R2.some(Boolean)) { try { save(); } catch(e){} if (UI.view === 'book1' || UI.view === 'exec' || UI.view === 'off_contracts') try { render(); } catch(e){} } }, function(){ autoBusy = false; });
  }
  setInterval(autoFund, 120000); setTimeout(autoFund, 8000);

  /* جدول الدفعات: صف لكل دفعة (المبلغ، النسبة، الاستحقاق) */
  function prRow(p){ return '<div class="pr-row"><span class="pr-n num"></span><input class="inp num prA" type="number" min="0" step="0.01" value="' + (p && p.amount != null ? p.amount : '') + '" aria-label="المبلغ"><input class="inp num prP" type="number" min="0" max="100" step="0.1" aria-label="النسبة"><input class="inp prC" value="' + esc((p && p.cond) || '') + '" placeholder="مثال: عند إنجاز 50% من الأعمال" aria-label="متى تستحق"><button type="button" class="btn sm ghost prDel" aria-label="حذف الدفعة">' + ic('delete') + '</button></div>'; }
  function wirePays(w){
    var box = w.querySelector('#cPayRows'); if (!box) return;
    var tot = w.querySelector('#prTotal'), cv = w.querySelector('#cValue');
    var V = function(){ return +(tot && tot.value) || +((cv || {}).value) || 0; };
    var rows = function(){ return [].slice.call(box.querySelectorAll('.pr-row')); };
    var r2 = function(x){ return Math.round(x * 100) / 100; };
    /* النسبة هي الأساس: عند تغيير الإجمالي يُعاد حساب مبلغ كل دفعة من نسبتها */
    var keepP = function(){ var v = V(); rows().forEach(function(r){ r.dataset.p = v ? (+r.querySelector('.prA').value || 0) / v * 100 : 0; }); };
    var sync = function(){ var sum = 0, v = V();
      rows().forEach(function(r, i){ r.querySelector('.pr-n').textContent = i + 1; var a = +r.querySelector('.prA').value || 0; sum += a; var pp = r.querySelector('.prP'); if (document.activeElement !== pp) pp.value = v ? +(a / v * 100).toFixed(1) : ''; });
      var d = r2(v - sum), el = w.querySelector('#prSum');
      el.innerHTML = 'المجموع <b class="num">' + M(sum) + '</b> من الإجمالي <b class="num">' + M(v) + '</b> ر.س' + (Math.abs(d) > 0.5 ? ' · <b style="color:var(--bad,#BA1A1A)">' + (d > 0 ? 'متبقٍ ' + M(d) : 'زيادة ' + M(-d)) + '</b>' : ' · <b style="color:var(--ok,#1F6B45)">مطابق ✓</b>'); };
    var fromTotal = function(src){ var v = +src.value || 0; if (src === tot && cv) cv.value = src.value; if (src === cv && tot) tot.value = src.value;
      var R0 = rows(); R0.forEach(function(r, i){ var p = +r.dataset.p || 0; r.querySelector('.prA').value = r2(v * p / 100); });
      var sum = R0.reduce(function(a, r){ return a + (+r.querySelector('.prA').value || 0); }, 0); if (R0.length && Math.abs(v - sum) < 1 && Math.abs(v - sum) > 0) { var last = R0[R0.length - 1].querySelector('.prA'); last.value = r2(+last.value + v - sum); }
      sync(); };
    if (tot) tot.addEventListener('input', function(){ fromTotal(tot); });
    if (cv) cv.addEventListener('input', function(){ fromTotal(cv); });
    box.addEventListener('input', function(e){ var r = e.target.closest('.pr-row'); if (!r) return; if (e.target.classList.contains('prP')) { r.querySelector('.prA').value = r2(V() * (+e.target.value || 0) / 100); }
      var v = V(); r.dataset.p = v ? (+r.querySelector('.prA').value || 0) / v * 100 : 0; sync(); });
    box.addEventListener('click', function(e){ var d = e.target.closest('.prDel'); if (!d) return; d.closest('.pr-row').remove(); sync(); });
    w.querySelector('#prAdd').addEventListener('click', function(){ var tmp = document.createElement('div'); tmp.innerHTML = prRow(null); var sum = rows().reduce(function(a, r){ return a + (+r.querySelector('.prA').value || 0); }, 0);
      var row = tmp.firstChild; row.querySelector('.prA').value = Math.max(0, r2(V() - sum)) || ''; box.appendChild(row); keepP(); sync(); row.querySelector('.prC').focus(); });
    var ev = w.querySelector('#prEven'); if (ev) ev.addEventListener('click', function(){ var R0 = rows(); if (!R0.length) { w.querySelector('#prAdd').click(); R0 = rows(); } var v = V(), n = R0.length, each = Math.floor(v / n * 100) / 100;
      R0.forEach(function(r, i){ r.querySelector('.prA').value = i === n - 1 ? r2(v - each * (n - 1)) : each; }); keepP(); sync(); });
    keepP(); sync();
  }

  /* لوحة توقيع حي */
  function sigPad(title, cb){
    var w = modal({title: title, icon: 'draw', ok: 'اعتماد التوقيع', body: '<p class="small muted">وقّع داخل المربع بالإصبع أو الفأرة.</p><canvas id="sgC" width="560" height="220" style="width:100%;max-width:560px;height:auto;aspect-ratio:560/220;border:1px dashed var(--gold,#C5A976);border-radius:10px;background:#fff;touch-action:none;display:block;margin:auto"></canvas><div class="row" style="justify-content:center;margin-top:8px"><button type="button" class="btn sm" id="sgClr">' + ic('backspace') + 'مسح</button></div>',
      onOk: function(){ if (!drawn) { toast('ارسم توقيعك أولاً', 'error'); return false; } cb(cv.toDataURL('image/png')); }});
    var cv = w.querySelector('#sgC'), g = cv.getContext('2d'), down = false, drawn = false; g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = '#143C54';
    var pt = function(e){ var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * cv.width / r.width, (t.clientY - r.top) * cv.height / r.height]; };
    var st = function(e){ down = true; var p = pt(e); g.beginPath(); g.moveTo(p[0], p[1]); e.preventDefault(); }, mv = function(e){ if (!down) return; var p = pt(e); g.lineTo(p[0], p[1]); g.stroke(); drawn = true; e.preventDefault(); }, en = function(){ down = false; };
    cv.addEventListener('mousedown', st); cv.addEventListener('mousemove', mv); window.addEventListener('mouseup', en); cv.addEventListener('touchstart', st, {passive: false}); cv.addEventListener('touchmove', mv, {passive: false}); cv.addEventListener('touchend', en);
    w.querySelector('#sgClr').addEventListener('click', function(){ g.clearRect(0, 0, cv.width, cv.height); drawn = false; });
  }
  window.ZBF = {B: B, total: total, M: M, nowS: nowS, who: who, F: F, fundDone: fundDone, siteDone: siteDone, ctSigned: ctSigned, stage: stage, STEPS: STEPS, stageName: stageName, payState: payState,
    contractHTML: function(b){ return contractHTML(b); }, clausesOf: function(b){ return clausesOf(b); }, sigPad: sigPad, notify: function(t, g, k, id){ notify(t, g, k, id); }, att: att, pickFile: pickFile, show: function(html, title, b, key){ showDoc(html, title, b, key); }};

  /* ================= الإجراءات ================= */
  function notify(t, go2, kind, bid){ try { S.notifs && S.notifs.unshift({t: t, at: nowS(), go: go2 || 'exec', kind: kind || '', bid: bid || ''}); } catch(e){} }
  function fin(msg, icn){ try { logIt(msg); } catch(e){} save(); render(); toast(msg, icn || 'check_circle'); }
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-act^="bf"]'); if (!t) return; e.stopImmediatePropagation();
    if (t.dataset.act === 'bfNewCt') { var R3 = (S.booklets || []).filter(function(x){ return x.status === 'معتمدة' && !(x.ct && x.ct.no); });
      if (!R3.length) { toast('لا توجد كراسات معتمدة بدون عقد', 'info'); return; }
      modal({title: 'إنشاء عقد لكراسة', icon: 'contract', ok: 'متابعة', body: '<div class="field"><label for="ncB">الكراسة</label><select class="inp" id="ncB">' + R3.map(function(x){ return '<option value="' + x.id + '">' + esc(x.title) + ' · ' + esc(x.mosque || '') + ' · ' + esc(stageName(x)) + '</option>'; }).join('') + '</select></div><p class="tiny muted">يُنصح بإنشاء العقد بعد اكتمال جمع المبلغ واعتماد المقاول.</p>',
        onOk: function(w){ var id = val(w, 'ncB'); setTimeout(function(){ var x = document.createElement('button'); x.dataset.act = 'bfCt'; x.dataset.id = id; x.style.display = 'none'; document.body.appendChild(x); x.click(); x.remove(); }, 50); }}); return; }
    if (t.dataset.act === 'bfTpl') { printContract({id: '—', title: 'نموذج', mosque: '', chapters: [], ct: {}}); return; }
    var a = t.dataset.act, b = B(t.dataset.id); if (!b) return; var k = t.dataset.k;
    if (a === 'bfDoneChk') { var fd = F(b); if (t.checked) { fd.doneAt = nowS(); fd.raised = Math.max(+fd.raised || 0, fundTarget(b)); fd.log = fd.log || []; fd.log.push({at: nowS(), by: who(), raised: fd.raised, note: 'تأكيد: اكتمل المبلغ'}); notify('اكتمل مبلغ الكراسة ' + b.title + ': التالي توقيع العقد'); fin('اكتمل مبلغ الكراسة ' + b.id, 'celebration'); }
      else { delete fd.doneAt; fin('أُلغي تأكيد اكتمال المبلغ للكراسة ' + b.id, 'undo'); } return; }
    if (a === 'bfSigned') { b.ct = b.ct || {}; if (t.checked) { b.ct.signed = true; b.ct.signedAt = nowS(); b.ct.signedBy = who(); fin('سُجّل توقيع عقد الكراسة ' + b.id, 'draw'); } else { b.ct.signed = false; delete b.ct.signedAt; fin('أُلغي تسجيل توقيع العقد', 'undo'); } return; }
    if (a === 'bfSign1' || a === 'bfSign2') { var c4 = b.ct || {};
      sigPad(a === 'bfSign1' ? 'توقيع الجمعية على العقد ' + (c4.no || '') : 'توقيعك على العقد ' + (c4.no || ''), function(img){
        var rec = {img: img, name: who(), at: nowS()};
        if (a === 'bfSign1') { c4.sig1 = rec; notify('العقد ' + (c4.no || '') + ' بانتظار توقيع المقاول', 'p_exec'); fin('وُقّع العقد من الجمعية وأُرسل للمقاول لتوقيعه', 'draw'); }
        else { c4.sig2 = rec; if (c4.sig1) { c4.signed = true; c4.signedAt = nowS(); } notify('وقّع المقاول ' + who() + ' عقد ' + b.title + ': التالي استلام الموقع', 'proj_files', 'ct', b.id); fin('تم توقيع العقد', 'draw'); } }); return; }
    if (a === 'bfCtr') { var cons = (S.reps || []).filter(function(r){ return r.kind === 'مقاول' && r.active !== false; });
      modal({title: 'اعتماد المقاول للكراسة', icon: 'engineering', ok: 'اعتماد', body: cons.length ? '<div class="field"><label for="ctrSel">المقاول</label><select class="inp" id="ctrSel">' + cons.map(function(r){ return '<option value="' + r.id + '" ' + (b.contractor === r.id ? 'selected' : '') + '>' + esc(r.name) + (r.phone ? ' · ' + esc(r.phone) : '') + '</option>'; }).join('') + '</select></div>' : '<p class="small">لا يوجد مقاولون مسجلون. أضف مقاولاً من «المناديب والمقاولين».</p>',
        onOk: function(w){ var v = val(w, 'ctrSel'); if (!v) return false; b.contractor = v; fin('اعتُمد المقاول ' + ((repById(v) || {}).name || '') + ' للكراسة ' + b.id, 'engineering'); }}); return; }
    if (a === 'bfOn') { b.pipe = 1; fin('فُعّل مسار الجمع والعقد للكراسة ' + b.id, 'route'); }
    else if (a === 'bfUrl') { var f = F(b); modal({title: 'رابط الفرصة في موقع الجمعية', icon: 'link', ok: 'حفظ', body:
      '<p class="small muted">بعد نشر الفرصة في موقع الجمعية انسخ رابطها هنا. يظهر الرابط في الكراسة وبوابة المقاول حتى اكتمال المبلغ.</p><div class="field"><label for="bfU">رابط الفرصة</label><input class="inp" id="bfU" dir="ltr" placeholder="https://" value="' + esc(f.url || '') + '"></div>' +
      '<div class="field"><label for="bfF">رابط بيانات المبلغ (اختياري)</label><input class="inp" id="bfF" dir="ltr" placeholder="https://… (إن كان الموقع يوفر رابطاً يعرض المبلغ المجموع)" value="' + esc(f.feed || '') + '"><div class="tiny muted">يقرأ النظام المبلغ المحدث من هذا الرابط أو من رابط الفرصة تلقائياً كل دقيقتين.</div></div>' +
      '<div class="field"><label for="bfT">المبلغ المستهدف (ر.س)</label><input class="inp num" id="bfT" type="number" min="0" value="' + fundTarget(b) + '"><div class="tiny muted">الافتراضي إجمالي الكراسة: ' + M(total(b)) + ' ر.س</div></div>',
      onOk: function(w){ var u = val(w, 'bfU'); if (u && !/^https?:\/\//.test(u)) { toast('الرابط يجب أن يبدأ بـ https://', 'error'); return false; } f.url = u; f.feed = val(w, 'bfF'); delete f.autoErr; f.target = +val(w, 'bfT') || total(b); setTimeout(autoFund, 500); fin('حُفظ رابط فرصة الكراسة ' + b.id, 'link'); }}); }
    else if (a === 'bfRaise') { var f2 = F(b); modal({title: 'تحديث المبلغ المجموع', icon: 'savings', ok: 'تحديث', body:
      '<div class="field"><label for="bfR">إجمالي المبلغ المجموع حتى الآن (ر.س)</label><input class="inp num" id="bfR" type="number" min="0" value="' + (+f2.raised || 0) + '"><div class="tiny muted">المستهدف ' + M(fundTarget(b)) + ' ر.س. اكتب الإجمالي كما يظهر في صفحة الفرصة.</div></div><div class="field"><label for="bfRn">ملاحظة</label><input class="inp" id="bfRn"></div>',
      onOk: function(w){ var v = Math.max(0, +val(w, 'bfR') || 0); f2.raised = v; f2.log = f2.log || []; f2.log.push({at: nowS(), by: who(), raised: v, note: val(w, 'bfRn')});
        if (v >= fundTarget(b) && !f2.doneAt) { f2.doneAt = nowS(); notify('اكتمل جمع مبلغ الكراسة ' + b.title + ': ابدأ العقد واستلام الموقع'); fin('اكتمل جمع مبلغ الكراسة ' + b.id, 'celebration'); } else fin('حُدّث المبلغ المجموع للكراسة ' + b.id, 'savings'); }}); }
    else if (a === 'bfCt') { var c = b.ct || {}, rep = repById(b.contractor) || {}; var pays = (c.pays || [{amount: Math.round(total(b) * 0.3), cond: 'عند إبرام العقد مقابل ضمان بنكي (دفعة مقدمة)'}, {amount: Math.round(total(b) * 0.4), cond: 'عند إنجاز 50% من الأعمال'}, {amount: total(b) - Math.round(total(b) * 0.3) - Math.round(total(b) * 0.4), cond: 'عند الاستلام الابتدائي وإنهاء الملاحظات'}]);
      var fl = function(id, lb, v, x){ return '<div class="field"><label for="' + id + '">' + lb + '</label><input class="inp ' + (x || '') + '" id="' + id + '" value="' + esc(v == null ? '' : v) + '"></div>'; };
      var wct = (modal({title: 'بيانات عقد المقاولة', icon: 'handshake', wide: 1, ok: 'حفظ العقد', body: '<div class="grid g3">' + fl('cNo', 'رقم العقد *', c.no || ('CT-' + b.id.replace(/\D/g, '').slice(-5) + '-' + new Date().getFullYear())) + '<div class="field"><label for="cDate">تاريخ العقد</label><input class="inp" type="date" id="cDate" value="' + esc(c.date || today()) + '"></div>' + fl('cMonths', 'مدة التنفيذ (أشهر)', c.months || 3, 'num') + '</div>' +
        '<div class="grid g3">' + fl('cValue', 'قيمة العقد شاملة الضريبة', c.value || total(b), 'num') + fl('cOffer', 'رقم عرض السعر', c.offerNo) + '<div class="field"><label for="cOfferD">تاريخ عرض السعر</label><input class="inp" type="date" id="cOfferD" value="' + esc(c.offerDate || '') + '"></div></div>' +
        '<div class="sec-t">' + ic('apartment') + 'الطرف الثاني (المقاول)</div><div class="grid g3">' + fl('cName', 'اسم المؤسسة/الشركة', c.cName || rep.name) + fl('cCr', 'السجل التجاري', c.cr) + fl('cUni', 'الرقم الموحد', c.unified) + fl('cRep', 'اسم الممثل', c.cRep) + fl('cTitle', 'صفته', c.cTitle || 'المالك') + fl('cPhone', 'الجوال', c.cPhone || rep.phone) + '</div>' + fl('cAddr', 'العنوان', c.cAddr) +
        '<div class="sec-t">' + ic('account_balance') + 'الطرف الأول</div>' + fl('cRep1', 'ممثل الجمعية', c.rep1 || REP1) +
        '<div class="sec-t">' + ic('payments') + 'جدول الدفعات</div><div class="pr-total"><div class="field" style="margin:0"><label for="prTotal">المبلغ الإجمالي للعقد (ر.س) — تُقسّم منه الدفعات</label><input class="inp num" id="prTotal" type="number" min="0" step="0.01" value="' + (c.value || total(b)) + '"></div><button type="button" class="btn sm" id="prEven">' + ic('splitscreen') + 'تقسيم بالتساوي</button></div><div class="pr-head tiny muted"><span>#</span><span>المبلغ (ر.س)</span><span>النسبة %</span><span>متى تستحق</span><span></span></div><div id="cPayRows">' + pays.map(prRow).join('') + '</div>' +
        '<div class="row" style="justify-content:space-between"><button type="button" class="btn sm" id="prAdd">' + ic('add') + 'إضافة دفعة</button><span class="small" id="prSum"></span></div>' +
        '<div class="field"><label for="cFile">العقد الموقّع (اختياري)</label><input type="file" id="cFile" accept="image/*,application/pdf" class="inp"></div>',
        onOk: function(w){ if (!val(w, 'cNo')) { toast('اكتب رقم العقد', 'error'); return false; }
          var P = [].slice.call(w.querySelectorAll('.pr-row')).map(function(r){ return {amount: +r.querySelector('.prA').value || 0, cond: r.querySelector('.prC').value.trim()}; }).filter(function(p){ return p.amount; });
          if (!P.length) { toast('أضف دفعة واحدة على الأقل', 'error'); return false; }
          var sum = P.reduce(function(s2, p){ return s2 + p.amount; }, 0), V = +val(w, 'cValue') || total(b);
          if (sum && Math.abs(sum - V) > 1) toast('تنبيه: مجموع الدفعات ' + M(sum) + ' لا يساوي قيمة العقد ' + M(V), 'warning');
          var nc = {no: val(w, 'cNo'), date: val(w, 'cDate'), months: val(w, 'cMonths'), value: V, offerNo: val(w, 'cOffer'), offerDate: val(w, 'cOfferD'), cName: val(w, 'cName'), cr: val(w, 'cCr'), unified: val(w, 'cUni'), cRep: val(w, 'cRep'), cTitle: val(w, 'cTitle'), cPhone: val(w, 'cPhone'), cAddr: val(w, 'cAddr'), rep1: val(w, 'cRep1'), pays: P, file: c.file || null, by: who(), at: nowS()};
          pickFile(w, 'cFile').then(function(fo){ if (fo) nc.file = fo; b.ct = Object.assign({}, c, nc); fin('حُفظ عقد الكراسة ' + b.id, 'handshake'); }); }}));
      wirePays(wct); }
    else if (a === 'bfPrint') printContract(b);
    else if (a === 'bfSite') { modal({title: 'استلام الموقع وبدء التنفيذ', icon: 'key', ok: 'تأكيد الاستلام', body:
      '<p class="small muted">بعد التأكيد يُفتح جدول التنفيذ للمقاول في البوابة، ويبدأ احتساب مدة العقد من تاريخ الاستلام.</p><div class="field"><label for="sDate">تاريخ استلام الموقع *</label><input class="inp" type="date" id="sDate" value="' + today() + '"></div>' +
      '<div class="field"><label for="sFile">محضر استلام الموقع الموقّع (صورة أو PDF)</label><input type="file" id="sFile" accept="image/*,application/pdf" class="inp"></div><div class="field"><label for="sNote">ملاحظات</label><input class="inp" id="sNote"></div>',
      onOk: function(w){ var d = val(w, 'sDate'); if (!d) { toast('حدد تاريخ الاستلام', 'error'); return false; }
        pickFile(w, 'sFile').then(function(fo){ b.site = {date: d, file: fo, note: val(w, 'sNote'), by: who(), at: nowS()}; fin('استُلم موقع الكراسة ' + b.id + ' وبدأ التنفيذ', 'key'); }); }}); }
    else if (a === 'bfPayReq') { var P2 = payState(b), pr = 0; try { pr = bookProgress(b); } catch(e){}
      var asked = (b.payReqs || []).filter(function(x){ return x.status !== 'مرفوضة'; }).reduce(function(s3, x){ return s3 + (+x.amount || 0); }, 0);
      var due = Math.round(P2.val * pr / 100), avail = Math.max(0, Math.min(P2.rest, due - asked));
      modal({title: 'طلب دفعة حسب نسبة الإنجاز', icon: 'request_quote', ok: 'إرسال الطلب', body:
        '<div class="grid g2 bf-k"><div><span class="tiny muted">نسبة إنجازك في المشروع</span><b class="num">' + pr + '%</b></div><div><span class="tiny muted">قيمة العقد</span><b class="num">' + M(P2.val) + '</b></div>' +
        '<div><span class="tiny muted">المستحق حسب الإنجاز</span><b class="num">' + M(due) + '</b></div><div><span class="tiny muted">طُلب سابقاً</span><b class="num">' + M(asked) + '</b></div></div>' +
        '<p class="small">المتاح طلبه الآن: <b class="num">' + M(avail) + '</b> ر.س</p>' + (avail <= 0 ? '<p class="tiny" style="color:var(--bad,#BA1A1A)">لا يوجد مبلغ متاح: حدّث نسبة إنجاز البنود أولاً.</p>' : '') +
        '<div class="field"><label for="pAmt">المبلغ المطلوب (ر.س) *</label><input class="inp num" id="pAmt" type="number" min="1" max="' + avail + '" value="' + avail + '"></div>' +
        '<div class="field"><label for="pNote">البيان *</label><textarea class="inp" id="pNote">دفعة مقابل إنجاز ' + pr + '% من أعمال المشروع</textarea></div><div class="field"><label for="pFile">المستخلص أو الفاتورة</label><input type="file" id="pFile" class="inp" accept="image/*,application/pdf"></div>',
        onOk: function(w){ var amt = +val(w, 'pAmt'), note = val(w, 'pNote'); if (!amt || amt <= 0) { toast('اكتب المبلغ', 'error'); return false; } if (!note) { toast('اكتب البيان', 'error'); return false; }
          if (amt > avail) { toast('المبلغ أكبر من المتاح حسب نسبة الإنجاز (' + M(avail) + ')', 'error'); return false; }
          pickFile(w, 'pFile').then(function(fo){ b.payReqs = b.payReqs || []; var id = 'PAY-' + Date.now().toString(36).slice(-5).toUpperCase();
            b.payReqs.push({id: id, amount: amt, pct: pr, due: due, note: note, file: fo, at: nowS(), by: who(), status: 'بانتظار'});
            notify('طلب دفعة ' + M(amt) + ' ر.س (إنجاز ' + pr + '%) من ' + who() + ' · ' + b.title, 'proj_files', 'pay', b.id); fin('أُرسل طلب الدفعة للجمعية', 'request_quote'); }); }}); }
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
    '.pr-total{display:flex;align-items:flex-end;gap:10px;margin-bottom:10px;padding:10px;border-radius:10px;background:var(--gold-soft,#FBF8F1);border:1px solid #D9C8A4}.pr-total .field{flex:1}:root[data-theme="dark"] .pr-total{background:transparent}.pr-head,.pr-row{display:grid;grid-template-columns:28px 1.1fr .7fr 2.4fr 40px;gap:8px;align-items:center}.pr-row{margin-bottom:6px}.pr-n{text-align:center;font-weight:700;color:#8A6F3D}' +
    '@media (max-width:700px){.bf-line{display:none}.bf-steps{gap:10px}.pr-head{display:none}.pr-row{grid-template-columns:24px 1fr 70px 40px}.pr-row .prC{grid-column:2/5}}';
  document.head.appendChild(st);
  setInterval(function(){ if (window.__zulfiSyncReady) enroll(); }, 5000);
})();
