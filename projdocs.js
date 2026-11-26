/* =====================================================================
   ١) الإدارة المكتبية ← العقود: محرر مثل الخطابات (تعديل كل بند) + معاينة A4 بالكليشة
   ٢) ملفات المشاريع: ملف كامل لكل مشروع صيانة وتحسينات من الألف إلى الياء
   ٣) نماذج A4 بكليشة الجمعية: طلب صرف دفعة، محضر استلام الموقع، محضر التسليم،
      محضر استلام الرجيع، موافقة مالك/ناظر المسجد، فهرس ملف المشروع
   ٤) تنبيهات طلبات الدفعات بلون مميز
   يعمل بعد bookflow.js
   ===================================================================== */
(function(){
  'use strict';
  if (typeof S === 'undefined' || typeof VIEWS === 'undefined' || !window.ZBF) return;
  var Z = window.ZBF, PORTAL = typeof IS_PORTAL !== 'undefined' && IS_PORTAL, M = Z.M;
  function B(id){ return Z.B(id); }
  function rep(b){ return (typeof repById === 'function' && repById(b.contractor)) || {}; }
  function PF(b){ b.pf = b.pf || {}; return b.pf; }
  function d10(x){ return String(x || '').slice(0, 10); }
  function hijri(s){ try { var d = s ? new Date(String(s).slice(0, 10)) : new Date(); return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {day: 'numeric', month: 'numeric', year: 'numeric'}).format(d).replace(/[‏‎]/g, '').replace(/\s*هـ\s*$/, '') + 'هـ'; } catch(e){ return ''; } }
  function gd(s){ return s ? d10(s).split('-').reverse().join('/') + 'م' : ''; }
  function dots(n){ return '<span class="dots">' + '.'.repeat(n || 24) + '</span>'; }
  function v(x, n){ return x ? '<b>' + esc(String(x)) + '</b>' : dots(n); }

  /* ================= مولّد مستند A4 بكليشة الجمعية ================= */
  function docA4(title, ref, body, sigs){
    var LH = window.ZULFI_LH || {}, ST = window.ZULFI_STAMP || '';
    var sg = (sigs || []).map(function(x){ return '<div><b>' + esc(x.t) + '</b>' + (x.n ? '<div>' + esc(x.n) + '</div>' : '<div>' + dots(22) + '</div>') + '<div class="slot">' + (x.stamp && ST ? '<img class="stamp" src="' + ST + '" alt="ختم">' : '') + (x.img ? '<img class="sgi" src="' + x.img + '" alt="توقيع">' : '') + '</div><div class="tiny">التوقيع: ' + (x.img ? '' : dots(14)) + '</div></div>'; }).join('');
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(title) + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap"><style>' +
      'body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;color:#17384C;margin:0;background:#eef1f4}table.lh{width:210mm;margin:12px auto;background:#fff;border-collapse:collapse;box-shadow:0 2px 10px rgba(20,60,84,.12);page-break-after:always}' +
      'table.lh>thead>tr>td,table.lh>tfoot>tr>td{padding:0}.lhh,.lhf{width:100%;display:block}td.bd{padding:4mm 18mm 8mm;line-height:1.9;font-size:13.5px;vertical-align:top;height:230mm}' +
      'h1{text-align:center;color:#143C54;font-size:21px;margin:4px 0 14px}.ref{display:flex;justify-content:space-between;font-size:11.5px;color:#5B7383;margin-bottom:8px}.dots{color:#8aa}' +
      'table.t{width:100%;border-collapse:collapse;margin:8px 0}table.t th,table.t td{border:1px solid #C9D3DA;padding:6px 8px;text-align:right;font-size:12.5px}table.t th{background:#F3ECDD;color:#143C54;width:32%}table.g th{width:auto}' +
      '.sig{display:flex;justify-content:space-between;gap:20px;margin-top:26px;text-align:center}.sig>div{flex:1}.slot{height:110px;position:relative}.stamp{width:170px;position:absolute;left:50%;top:4px;transform:translateX(-50%) rotate(-8deg);opacity:.92}.sgi{position:absolute;left:50%;top:20px;transform:translateX(-50%);max-width:160px;max-height:75px}.tiny{font-size:11px;color:#5B7383}' +
      '.bar{position:sticky;top:0;background:#143C54;color:#fff;padding:10px;text-align:center}.bar button{font:inherit;padding:6px 18px;border-radius:6px;border:0;background:#C5A976;color:#143C54;font-weight:700;cursor:pointer}' +
      (window.ZULFI_PAGE_CSS || '') + '</style></head><body><div class="bar"><button onclick="print()">طباعة / حفظ PDF</button></div>' +
      '<table class="lh"><thead><tr><td>' + (LH.hdr ? '<img class="lhh" src="' + LH.hdr + '" alt="">' : '') + '</td></tr></thead><tfoot><tr><td>' + (LH.ftr ? '<img class="lhf" src="' + LH.ftr + '" alt="">' : '') + '</td></tr></tfoot><tbody><tr><td class="bd">' +
      '<div class="ref"><span>' + esc(ref[0] || '') + '</span><span>' + esc(ref[1] || '') + '</span></div><h1>' + esc(title) + '</h1>' + body + (sg ? '<div class="sig">' + sg + '</div>' : '') + '</td></tr></tbody></table>' + (window.ZULFI_PAGINATE || '') + '</body></html>';
  }
  function info(b){ var c = b.ct || {};
    return '<table class="t"><tr><th>المشروع</th><td>' + esc(b.title || '') + '</td></tr><tr><th>المسجد</th><td>' + esc(b.mosque || '') + (b.district ? ' · ' + esc(b.district) : '') + '</td></tr><tr><th>رقم الكراسة</th><td>' + esc(b.id) + '</td></tr>' +
      '<tr><th>المقاول</th><td>' + esc(c.cName || rep(b).name || '—') + '</td></tr><tr><th>رقم العقد</th><td>' + esc(c.no || '—') + '</td></tr></table>'; }
  var ASSOC = function(stamp, img, n){ return {t: 'الطرف الأول: جمعية المساجد بالزلفي', n: n || ((b0 && b0.ct && b0.ct.rep1) || 'معاذ بن سعد الجبر'), stamp: stamp, img: img}; }, b0 = null;
  var DOCS = {
    pay: function(b, id){ var p = (b.payReqs || []).filter(function(x){ return x.id === id; })[0]; if (!p) return ''; var P = Z.payState(b), c = b.ct || {};
      var prev = (b.payReqs || []).filter(function(x){ return x.id !== id && x.status === 'مدفوعة'; }).reduce(function(a, x){ return a + (+x.amount || 0); }, 0);
      return docA4('طلب صرف دفعة (حوالة) للمقاول', ['رقم الطلب ' + p.id, 'التاريخ ' + d10(p.at) + ' · ' + hijri(p.at)], info(b) +
        '<table class="t"><tr><th>قيمة العقد</th><td>' + M(P.val) + ' ر.س</td></tr><tr><th>نسبة الإنجاز عند الطلب</th><td>' + (p.pct != null ? p.pct + '%' : '—') + '</td></tr><tr><th>المستحق حسب الإنجاز</th><td>' + (p.due != null ? M(p.due) + ' ر.س' : '—') + '</td></tr>' +
        '<tr><th>المدفوع سابقاً</th><td>' + M(prev) + ' ر.س</td></tr><tr><th>المبلغ المطلوب</th><td><b>' + M(p.amount) + ' ر.س</b></td></tr><tr><th>البيان</th><td>' + esc(p.note || '') + '</td></tr><tr><th>حالة الطلب</th><td>' + esc(p.status) + (p.paidAt ? ' · صُرفت بتاريخ ' + d10(p.paidAt) : '') + (p.ref ? ' · حوالة رقم ' + esc(p.ref) : '') + (p.bank ? ' · ' + esc(p.bank) : '') + (p.reason ? ' · ' + esc(p.reason) : '') + '</td></tr></table>',
        [{t: 'مقدم الطلب (المقاول)', n: p.by}, {t: 'مدير المشاريع', n: p.decidedBy || ''}, {t: 'المدير التنفيذي', n: (c.rep1 || ''), stamp: p.status === 'معتمدة' || p.status === 'مدفوعة'}]); },
    site: function(b){ var s = b.site || {}, c = b.ct || {}; b0 = b;
      return docA4('محضر استلام الموقع', ['كراسة ' + b.id, s.date ? 'التاريخ ' + gd(s.date) : ''], info(b) +
        '<p>حيث اجتمع الطرفان: جمعية المساجد بالزلفي (طرف أول - المسلِّم)، و' + v(c.cName || rep(b).name, 30) + ' (طرف ثانٍ - المستلم)، في موقع المشروع: ' + esc(b.mosque || '') + '، وبعد المعاينة فقد تم تسليم الطرف الثاني الموقع في تاريخ ' + (s.date ? '<b>' + hijri(s.date) + '، الموافق ' + gd(s.date) + '</b>' : dots(14)) + '، وبموجبه فإن موقع العمل تحت مسؤولية الطرف الثاني لحين تسليم المشروع للطرف الأول.</p>' + (s.note ? '<p>ملاحظات: ' + esc(s.note) + '</p>' : '') + '<p style="text-align:center">هذا وبالله التوفيق..</p>',
        [ASSOC(true), {t: 'الطرف الثاني: المقاول (المستلم)', n: c.cRep || c.cName || rep(b).name}]); },
    deliv: function(b){ var d = PF(b).deliv || {}, c = b.ct || {}; b0 = b;
      return docA4('محضر تسليم المشروع (الاستلام ' + (d.kind || 'الابتدائي') + ')', ['كراسة ' + b.id, d.date ? 'التاريخ ' + gd(d.date) : ''], info(b) +
        '<p>إنه في تاريخ ' + (d.date ? '<b>' + hijri(d.date) + '، الموافق ' + gd(d.date) + '</b>' : dots(14)) + ' تم الوقوف على الأعمال المنفذة في المشروع أعلاه، وتبيّن ' + (d.ok === false ? 'وجود الملاحظات الموضحة أدناه، ويلتزم الطرف الثاني بإنهائها خلال (15) يوماً.' : 'أن الأعمال نُفذت وفق الكراسة والمواصفات المعتمدة، وتم تسليمها للطرف الأول.') + '</p>' +
        '<p><b>الملاحظات:</b> ' + (d.notes ? esc(d.notes) : dots(60)) + '</p><p>وتبدأ مدد الضمان المنصوص عليها في العقد من تاريخ الاستلام النهائي.</p>',
        [ASSOC(true), {t: 'الطرف الثاني: المقاول (المسلِّم)', n: c.cRep || c.cName || rep(b).name}, {t: 'ممثل المسجد', n: d.mosqueRep || ''}]); },
    waste: function(b){ var w = PF(b).waste || {}, c = b.ct || {}, L = w.items || []; b0 = b;
      return docA4('محضر استلام الرجيع', ['كراسة ' + b.id, w.date ? 'التاريخ ' + gd(w.date) : ''], info(b) +
        '<p>تم استلام المواد والأجهزة المستبدلة (الرجيع) من أعمال المشروع أعلاه، وبيانها كالتالي:</p><table class="t g"><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>الحالة</th><th>ملاحظات</th></tr>' +
        (L.length ? L.map(function(x, i){ return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.d || '') + '</td><td>' + esc(x.q || '') + '</td><td>' + esc(x.s || '') + '</td><td>' + esc(x.n || '') + '</td></tr>'; }).join('') : [1, 2, 3, 4, 5].map(function(i){ return '<tr><td>' + i + '</td><td>&nbsp;</td><td></td><td></td><td></td></tr>'; }).join('')) + '</table>' +
        '<p>وقد سُلّم الرجيع إلى: ' + v(w.receiver, 26) + (w.place ? ' · مكان الحفظ: ' + esc(w.place) : '') + '.</p>',
        [{t: 'المسلِّم (المقاول)', n: c.cRep || c.cName || rep(b).name}, {t: 'المستلم', n: w.receiver || ''}, ASSOC(true)]); },
    owner: function(b){ var o = PF(b).owner || {}; b0 = b;
      return docA4('موافقة ' + (o.role || 'مالك / ناظر المسجد') + ' على تنفيذ أعمال الصيانة والتحسينات', ['كراسة ' + b.id, 'التاريخ ' + (o.date ? gd(o.date) : dots(10))], info(b) +
        '<p>أقر أنا / ' + v(o.name, 30) + '، هوية رقم ' + v(o.idNo, 14) + '، بصفتي ' + v(o.role || 'مالك / ناظر المسجد', 16) + '، وجوال رقم ' + v(o.phone, 12) + '،</p>' +
        '<p>بالموافقة على قيام <b>جمعية المساجد بالزلفي</b> بتنفيذ أعمال «' + esc(b.title || '') + '» في ' + esc(b.mosque || '') + ' وفق الكراسة المعتمدة، وتمكين المقاول المكلف من الجمعية من دخول الموقع وتنفيذ الأعمال، وعلى ذلك جرى التوقيع.</p>',
        [{t: o.role || 'مالك / ناظر المسجد', n: o.name || ''}, ASSOC(true)]); },
    book: function(b){ var T = {items: 0, total: 0}; try { T = bookTotals(b); } catch(e){}
      return docA4('كراسة الأعمال وجدول الكميات', ['كراسة ' + b.id, b.sign && b.sign.boardDate ? 'اعتماد المجلس ' + b.sign.boardDate : ''], info(b) +
        (b.chapters || []).map(function(c, ci){ return '<h2 style="font-size:15px;color:#1D5271;margin:12px 0 4px">الباب ' + (ci + 1) + ': ' + esc(c.title || '') + '</h2><table class="t g"><tr><th>#</th><th>البند</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>' +
          (c.items || []).map(function(it, ii){ return '<tr><td>' + (ci + 1) + '.' + (ii + 1) + '</td><td>' + esc(it.d || '') + (it.n ? '<div class="tiny">' + esc(it.n) + '</div>' : '') + '</td><td>' + esc(it.u || '') + '</td><td>' + esc(it.q || 0) + '</td><td>' + M(it.p || 0) + '</td><td>' + M((+it.q || 0) * (+it.p || 0)) + '</td></tr>'; }).join('') + '</table>'; }).join('') +
        '<table class="t"><tr><th>إجمالي البنود</th><td>' + M(T.items) + ' ر.س</td></tr>' + (T.opex ? '<tr><th>المصاريف التشغيلية (' + T.op + '%)</th><td>' + M(T.opex) + ' ر.س</td></tr>' : '') + (T.vat ? '<tr><th>ضريبة القيمة المضافة</th><td>' + M(T.vat) + ' ر.س</td></tr>' : '') + '<tr><th>الإجمالي</th><td><b>' + M(T.total) + ' ر.س</b></td></tr></table>'); },
    index: function(b){ var R = checklist(b); b0 = b;
      return docA4('فهرس ملف المشروع', ['كراسة ' + b.id, 'التاريخ ' + gd(today())], info(b) +
        '<table class="t g"><tr><th>#</th><th>المستند</th><th>الحالة</th><th>التاريخ</th></tr>' + R.map(function(x, i){ return '<tr><td>' + (i + 1) + '</td><td>' + esc(x[1]) + '</td><td>' + (x[2] ? '✓ مكتمل' : '— ناقص') + '</td><td>' + esc(x[3] || '') + '</td></tr>'; }).join('') + '</table>'); }
  };
  window.zulfiDocA4 = docA4;

  /* ================= دمج ملف المشروع كاملاً في مستند واحد ================= */
  function lhTables(html){ var d = new DOMParser().parseFromString(html, 'text/html'); return {css: [].map.call(d.querySelectorAll('style'), function(x){ return x.textContent; }).join('\n'), t: [].filter.call(d.querySelectorAll('table.lh'), function(x){ return !x.parentElement.closest('table.lh'); }).map(function(x){ return x.outerHTML; })}; }
  function attPage(b, title, src){ var LH = window.ZULFI_LH || {};
    return '<table class="lh"><thead><tr><td>' + (LH.hdr ? '<img class="lhh" src="' + LH.hdr + '" alt="">' : '') + '</td></tr></thead><tfoot><tr><td>' + (LH.ftr ? '<img class="lhf" src="' + LH.ftr + '" alt="">' : '') + '</td></tr></tfoot><tbody><tr><td class="bd"><div class="ref"><span>' + esc(title) + '</span><span>كراسة ' + esc(b.id) + '</span></div>' +
      '<div style="height:200mm;display:flex;align-items:center;justify-content:center"><img src="' + src + '" alt="' + esc(title) + '" style="max-width:100%;max-height:100%;object-fit:contain"></div></td></tr></tbody></table>'; }
  function notePage(b, title){ return attPage(b, title, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#F5F7F9" stroke="#C5A976"/><text x="300" y="90" font-family="Tahoma" font-size="20" text-anchor="middle" fill="#143C54">' + String(title).replace(/[<&]/g, '') + '</text><text x="300" y="130" font-family="Tahoma" font-size="13" text-anchor="middle" fill="#5B7383">مرفق في ملف المشروع (لم يمكن دمجه كصورة)</text></svg>')); }
  function pdfPages(src){ if (!window.pdfjsLib) return Promise.reject(new Error('pdf'));
    return (/^data:/.test(src) ? Promise.resolve(Uint8Array.from(atob(src.split(',')[1]), function(ch){ return ch.charCodeAt(0); })) : fetch(src).then(function(r){ return r.arrayBuffer(); }).then(function(ab){ return new Uint8Array(ab); }))
      .then(function(data){ return pdfjsLib.getDocument({data: data}).promise; })
      .then(function(pdf){ var out = [], ch = Promise.resolve(); for (var i = 1; i <= Math.min(pdf.numPages, 30); i++) (function(n){ ch = ch.then(function(){ return pdf.getPage(n).then(function(pg){ var vp = pg.getViewport({scale: 1.6}), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
          return pg.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise.then(function(){ out.push(cv.toDataURL('image/jpeg', 0.82)); }); }); }); })(i); return ch.then(function(){ return out; }); }); }
  function attPages(b, title, a){ if (!a || !a.data) return Promise.resolve([]);
    if (a.type === 'image' || /^data:image|\.(jpe?g|png|gif|webp)(\?|$)/i.test(a.data)) return Promise.resolve([attPage(b, title, a.data)]);
    if (a.type === 'pdf' || /^data:application\/pdf|\.pdf(\?|$)/i.test(a.data)) return pdfPages(a.data).then(function(L){ return L.map(function(src, i){ return attPage(b, title + (L.length > 1 ? ' (' + (i + 1) + '/' + L.length + ')' : ''), src); }); }, function(){ return [notePage(b, title)]; });
    return Promise.resolve([notePage(b, title + ' · ' + (a.name || 'ملف'))]); }
  function mergeAll(b){
    var c = b.ct || {}, f = PF(b), parts = [], css = {};
    var addDoc = function(html, key){ if (!html) return; if (!(window.zulfiStampOn && zulfiStampOn(b, key))) html = html.replace(/<img class="stamp"[^>]*>/g, ''); var x = lhTables(html); css[x.css] = 1; parts.push(Promise.resolve(x.t)); };
    var addAtt = function(title, a){ parts.push(attPages(b, title, a)); };
    addDoc(DOCS.index(b), 'index'); addDoc(DOCS.book(b), 'book');
    if (f.ministry && f.ministry.file) addAtt('موافقة الوزارة على تنفيذ الأعمال', f.ministry.file);
    if (f.owner && f.owner.file) addAtt('موافقة مالك / ناظر المسجد (الموقّعة)', f.owner.file); else addDoc(DOCS.owner(b), 'owner');
    addDoc(Z.contractHTML(b), 'contract'); if (c.file) addAtt('عقد المشروع (النسخة الموقّعة)', c.file);
    if (b.site && b.site.file) addAtt('محضر استلام الموقع (الموقّع)', b.site.file); else if (b.site && b.site.date) addDoc(DOCS.site(b), 'site');
    (b.payReqs || []).forEach(function(p){ addDoc(DOCS.pay(b, p.id), 'pay:' + p.id); if (p.file) addAtt('مستخلص طلب ' + p.id, p.file); if (p.receipt) addAtt('إيصال حوالة ' + p.id, p.receipt); });
    if (f.deliv && f.deliv.file) addAtt('محضر تسليم المشروع (الموقّع)', f.deliv.file); else if (f.deliv && f.deliv.date) addDoc(DOCS.deliv(b), 'deliv');
    if (f.waste && f.waste.file) addAtt('محضر استلام الرجيع (الموقّع)', f.waste.file); else if (f.waste && (f.waste.items || []).length) addDoc(DOCS.waste(b), 'waste');
    (f.other || []).forEach(function(a, i){ addAtt('مرفق ' + (i + 1) + ': ' + (a.name || ''), a); });
    return Promise.all(parts).then(function(L){ var tables = [].concat.apply([], L);
      return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ملف المشروع ' + esc(b.id) + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap"><style>' + Object.keys(css).join('\n') + '</style></head><body><div class="bar"><button onclick="print()">طباعة / حفظ PDF</button></div>' + tables.join('') + (window.ZULFI_PAGINATE || '') + '</body></html>'; });
  }
  window.zulfiMergeProject = mergeAll;

  /* ================= قائمة مستندات ملف المشروع ================= */
  function checklist(b){ var c = b.ct || {}, f = PF(b), pays = b.payReqs || [], paid = pays.filter(function(p){ return p.status === 'مدفوعة'; });
    return [['book', 'كراسة المشروع المعتمدة', b.status === 'معتمدة', b.sign && b.sign.boardDate],
      ['ministry', 'موافقة الوزارة على تنفيذ أعمال الصيانة والتحسينات', !!(f.ministry && f.ministry.file), f.ministry && f.ministry.date],
      ['owner', 'موافقة مالك / ناظر المسجد', !!(f.owner && f.owner.file), f.owner && f.owner.date],
      ['ct', 'عقد المشروع الموقّع', Z.ctSigned(b), c.signedAt ? d10(c.signedAt) : c.date],
      ['site', 'محضر استلام الموقع', !!(b.site && b.site.date && b.site.file), b.site && b.site.date],
      ['pays', 'طلبات الحوالة (الدفعات)', pays.length > 0, pays.length ? pays.length + ' طلب' : ''],
      ['rcpt', 'إيصالات الحوالة', paid.length > 0 && paid.every(function(p){ return p.receipt; }), paid.length ? paid.filter(function(p){ return p.receipt; }).length + ' / ' + paid.length : ''],
      ['deliv', 'محضر تسليم المشروع', !!(f.deliv && f.deliv.file), f.deliv && f.deliv.date],
      ['waste', 'محضر استلام الرجيع', !!(f.waste && f.waste.file), f.waste && f.waste.date]]; }
  function projects(){ return (S.booklets || []).filter(function(b){ return b.status === 'معتمدة' || b.contractor || (b.ct && b.ct.no); }); }

  if (!PORTAL) {
    /* ================= ملفات المشاريع ================= */
    var up = function(key, b, label, accept){ return '<label class="btn sm" style="cursor:pointer">' + ic('upload_file') + (label || 'إرفاق') + '<input type="file" hidden data-pfu="' + key + '" data-id="' + b.id + '" accept="' + (accept || 'image/*,application/pdf') + '"></label>'; };
    var prt = function(key, b, label){ return '<button class="btn sm" data-pfdoc="' + key + '" data-id="' + b.id + '">' + ic('print') + (label || 'نموذج A4') + '</button>'; };
    var fld = function(path, b, label, val, type){ return '<div class="field"><label>' + label + '</label><input class="inp" ' + (type ? 'type="' + type + '"' : '') + ' data-pff="' + path + '" data-id="' + b.id + '" value="' + esc(val || '') + '"></div>'; };
    var sec = function(n, icon, title, ok, inner){ return '<div class="card pf-sec ' + (ok ? 'ok' : '') + '"><div class="card-h"><div class="row" style="gap:10px"><span class="pf-n">' + (ok ? ic('check', 1) : n) + '</span><h2>' + ic(icon) + ' ' + title + '</h2></div><span class="pill ' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'مكتمل' : 'ناقص') + '</span></div><div class="card-b pf-b">' + inner + '</div></div>'; };
    function payPart(b, pays){
      var P = Z.payState(b), pr = 0; try { pr = bookProgress(b); } catch(e){}
      var due = Math.round(P.val * pr / 100), open = (b.payReqs || []).filter(function(p){ return p.status === 'بانتظار' || p.status === 'معتمدة'; });
      var k = function(l, v2, t){ return '<div class="pf-k ' + (t || '') + '"><span class="tiny muted">' + l + '</span><b class="num">' + v2 + '</b></div>'; };
      var sum = '<div class="pf-ks">' + k('قيمة العقد', M(P.val)) + k('نسبة الإنجاز', pr + '%') + k('المستحق حسب الإنجاز', M(due)) + k('المدفوع (حوالات)', M(P.paid), 'ok') + k('معتمد لم يُصرف', M(P.appr), 'warn') + k('بانتظار الاعتماد', M(P.pend)) + k('المتبقي من العقد', M(P.rest), 'gold') + '</div>';
      var tbl = pays.length ? '<div class="tbl-wrap"><table><thead><tr><th>الطلب</th><th>المبلغ</th><th>الإنجاز</th><th>الحالة</th><th>الحوالة</th><th>إيصال الحوالة</th><th></th></tr></thead><tbody>' + pays.map(function(p){
          return '<tr class="' + (p.status === 'بانتظار' ? 'pf-new' : '') + '"><td class="num tiny">' + esc(p.id) + '<div>' + esc(d10(p.at)) + '</div>' + (p.manual ? '<div class="muted">مُسجّلة من الإدارة</div>' : '') + '</td><td class="num"><b>' + M(p.amount) + '</b></td><td class="num">' + (p.pct != null ? p.pct + '%' : '—') + '</td><td><span class="pill ' + (p.status === 'مدفوعة' ? 'ok' : p.status === 'مرفوضة' ? 'bad' : 'warn') + '">' + esc(p.status) + '</span></td>' +
            '<td class="tiny">' + (p.ref ? 'رقم ' + esc(p.ref) : '') + (p.bank ? '<div>' + esc(p.bank) + '</div>' : '') + (p.paidAt ? '<div class="num">' + esc(d10(p.paidAt)) + '</div>' : '') + '</td>' +
            '<td>' + (p.receipt ? Z.att(p.receipt) : (p.status === 'مدفوعة' || p.status === 'معتمدة') ? up('rcpt:' + p.id, b, 'إرفاق') : '<span class="tiny muted">—</span>') + '</td><td>' + prt('pay:' + p.id, b, 'A4') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="tiny muted">لا توجد دفعات بعد. يقدّم المقاول طلباته من البوابة حسب نسبة إنجازه، أو سجّل الحوالة من النموذج أدناه.</div>';
      var form = '<div class="pf-form"><b class="small">' + ic('edit_note') + ' تسجيل حوالة / دفعة</b><div class="grid g3">' +
        '<div class="field"><label for="pyLink">مقابل</label><select class="inp" id="pyLink"><option value="">حوالة جديدة (بدون طلب)</option>' + open.map(function(p){ return '<option value="' + p.id + '" data-amt="' + p.amount + '">طلب ' + esc(p.id) + ' · ' + M(p.amount) + ' ر.س · ' + esc(p.status) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="pyAmt">المبلغ (ر.س) *</label><input class="inp num" id="pyAmt" type="number" min="1"></div><div class="field"><label for="pyDate">تاريخ الحوالة *</label><input class="inp" id="pyDate" type="date" value="' + today() + '"></div>' +
        '<div class="field"><label for="pyRef">رقم الحوالة / المرجع</label><input class="inp" id="pyRef"></div><div class="field"><label for="pyBank">البنك</label><input class="inp" id="pyBank"></div><div class="field"><label for="pyFile">إيصال الحوالة</label><input class="inp" id="pyFile" type="file" accept="image/*,application/pdf"></div></div>' +
        '<div class="field"><label for="pyNote">البيان</label><input class="inp" id="pyNote" placeholder="مثال: الدفعة الثانية مقابل إنجاز 50%"></div><div class="row"><button class="btn pri" data-pf="paySave" data-id="' + b.id + '">' + ic('save') + 'حفظ الحوالة في ملف المشروع</button></div></div>';
      return sum + tbl + form;
    }
    function detail(b){
      var c = b.ct || {}, f = PF(b), R = checklist(b), done = R.filter(function(x){ return x[2]; }).length, s = b.site || {}, own = f.owner || {}, mn = f.ministry || {}, dl = f.deliv || {}, ws = f.waste || {};
      var pays = (b.payReqs || []).slice().reverse();
      return head('ملفات المشاريع', esc(b.title), esc(b.mosque || '') + ' · كراسة ' + esc(b.id) + ' · المرحلة: ' + esc(Z.stageName(b)),
          '<button class="btn" data-pf="back">' + ic('arrow_forward') + 'كل المشاريع</button><button class="btn" data-pfdoc="index" data-id="' + b.id + '">' + ic('print') + 'فهرس الملف A4</button><button class="btn gold" data-pfdoc="all" data-id="' + b.id + '">' + ic('merge') + 'دمج الملف كاملاً في مستند واحد</button>') +
        '<div class="card card-b"><div class="row" style="justify-content:space-between"><b>اكتمال ملف المشروع</b><b class="num">' + done + ' / ' + R.length + '</b></div><div class="prog"><div class="bar"><i style="width:' + Math.round(done / R.length * 100) + '%;background:var(--ok)"></i></div></div>' +
          '<div class="pf-chips">' + R.map(function(x){ return '<span class="pill ' + (x[2] ? 'ok' : '') + '">' + ic(x[2] ? 'check' : 'radio_button_unchecked') + ' ' + esc(x[1]) + '</span>'; }).join('') + '</div></div>' +
        sec(1, 'request_quote', 'كراسة المشروع', R[0][2], '<div class="row"><span class="small">' + esc(b.status) + (b.sign && b.sign.boardDate ? ' · اعتماد المجلس ' + esc(b.sign.boardDate) : '') + '</span><button class="btn sm" data-act="openBook" data-id="' + b.id + '">' + ic('description') + 'فتح الكراسة</button></div>') +
        sec(2, 'account_balance', 'موافقة الوزارة على تنفيذ الأعمال', R[1][2], '<div class="grid g3">' + fld('ministry.no', b, 'رقم الخطاب / الموافقة', mn.no) + fld('ministry.date', b, 'التاريخ', mn.date, 'date') + fld('ministry.note', b, 'ملاحظة', mn.note) + '</div><div class="row">' + up('ministry', b, mn.file ? 'استبدال الموافقة' : 'إرفاق الموافقة') + (mn.file ? Z.att(mn.file) : '') + '</div>') +
        sec(3, 'person_check', 'موافقة مالك / ناظر المسجد', R[2][2], '<div class="grid g3">' + fld('owner.name', b, 'الاسم', own.name) + fld('owner.role', b, 'الصفة', own.role || 'ناظر المسجد') + fld('owner.idNo', b, 'رقم الهوية', own.idNo) + fld('owner.phone', b, 'الجوال', own.phone) + fld('owner.date', b, 'التاريخ', own.date, 'date') + '</div><div class="row">' + prt('owner', b, 'نموذج الموافقة A4') + up('owner', b, own.file ? 'استبدال الموقّع' : 'إرفاق النموذج الموقّع') + (own.file ? Z.att(own.file) : '') + '</div>') +
        sec(4, 'contract', 'عقد المشروع', R[3][2], '<div class="small">' + (c.no ? 'عقد ' + esc(c.no) + ' · ' + esc(c.cName || rep(b).name || '') + ' · ' + M(c.value || Z.total(b)) + ' ر.س · توقيع الجمعية: ' + (c.sig1 ? '✓' : '—') + ' · توقيع المقاول: ' + (c.sig2 ? '✓' : '—') : 'لم يُنشأ العقد بعد') + '</div><div class="row"><button class="btn sm" data-act="bfPrint" data-id="' + b.id + '">' + ic('visibility') + 'عرض العقد A4</button><button class="btn sm" data-oc="' + b.id + '">' + ic('edit_document') + 'تحرير البنود</button>' + up('ct', b, c.file ? 'استبدال النسخة الموقّعة' : 'إرفاق النسخة الموقّعة') + (c.file ? Z.att(c.file) : '') + '</div>') +
        sec(5, 'key', 'محضر استلام الموقع', R[4][2], '<div class="small">' + (s.date ? 'تاريخ الاستلام ' + esc(s.date) : 'لم يُسجّل استلام الموقع بعد') + '</div><div class="row">' + prt('site', b) + up('site', b, s.file ? 'استبدال الموقّع' : 'إرفاق المحضر الموقّع') + (s.file ? Z.att(s.file) : '') + '</div>') +
        sec(6, 'payments', 'الدفعات وطلبات الحوالة وإيصالاتها', R[5][2] && R[6][2], payPart(b, pays)) +
        sec(7, 'assignment_turned_in', 'محضر تسليم المشروع', R[7][2], '<div class="grid g3">' + fld('deliv.date', b, 'تاريخ التسليم', dl.date, 'date') + '<div class="field"><label>نوع الاستلام</label><select class="inp" data-pff="deliv.kind" data-id="' + b.id + '"><option ' + (dl.kind !== 'النهائي' ? 'selected' : '') + '>الابتدائي</option><option ' + (dl.kind === 'النهائي' ? 'selected' : '') + '>النهائي</option></select></div>' + fld('deliv.mosqueRep', b, 'ممثل المسجد', dl.mosqueRep) + '</div>' + fld('deliv.notes', b, 'الملاحظات', dl.notes) + '<div class="row">' + prt('deliv', b) + up('deliv', b, dl.file ? 'استبدال الموقّع' : 'إرفاق المحضر الموقّع') + (dl.file ? Z.att(dl.file) : '') + '</div>') +
        sec(8, 'recycling', 'محضر استلام الرجيع', R[8][2], '<div class="tbl-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead><tbody>' + (ws.items || []).map(function(x, i){
            return '<tr><td><input class="inp" data-pfw="d" data-i="' + i + '" data-id="' + b.id + '" value="' + esc(x.d || '') + '"></td><td><input class="inp num" style="width:80px" data-pfw="q" data-i="' + i + '" data-id="' + b.id + '" value="' + esc(x.q || '') + '"></td><td><input class="inp" style="width:110px" data-pfw="s" data-i="' + i + '" data-id="' + b.id + '" value="' + esc(x.s || '') + '" placeholder="صالح / تالف"></td><td><input class="inp" data-pfw="n" data-i="' + i + '" data-id="' + b.id + '" value="' + esc(x.n || '') + '"></td><td><button class="btn sm ghost" data-pf="wdel" data-i="' + i + '" data-id="' + b.id + '" aria-label="حذف">' + ic('delete') + '</button></td></tr>'; }).join('') + '</tbody></table></div>' +
          '<div class="row"><button class="btn sm" data-pf="wadd" data-id="' + b.id + '">' + ic('add') + 'إضافة صنف</button></div><div class="grid g3">' + fld('waste.receiver', b, 'المستلم', ws.receiver) + fld('waste.place', b, 'مكان الحفظ', ws.place) + fld('waste.date', b, 'التاريخ', ws.date, 'date') + '</div><div class="row">' + prt('waste', b) + up('waste', b, ws.file ? 'استبدال الموقّع' : 'إرفاق المحضر الموقّع') + (ws.file ? Z.att(ws.file) : '') + '</div>') +
        sec(9, 'folder', 'مرفقات أخرى للمشروع', (f.other || []).length > 0, '<div class="row">' + up('other', b, 'إرفاق ملف', 'image/*,application/pdf,.doc,.docx,.xls,.xlsx') + '</div>' + ((f.other || []).length ? (typeof thumbsHTML === 'function' ? thumbsHTML(f.other) : '') : '<div class="tiny muted">صور، مخططات، فواتير، أي مستند آخر.</div>'));
    }
    VIEWS.proj_files = function(){
      var b = UI.pfB && B(UI.pfB); if (b) return detail(b);
      var q = (UI.pfQ || '').trim(), L = projects().filter(function(x){ return !q || JSON.stringify([x.title, x.mosque, x.id, (x.ct || {}).no, rep(x).name]).indexOf(q) > -1; });
      return head('الصيانة والتحسينات', 'ملفات المشاريع', 'ملف كامل لكل مشروع صيانة وتحسينات من الألف إلى الياء: الكراسة، الموافقات، العقد، استلام الموقع، طلبات الحوالة وإيصالاتها، التسليم، والرجيع.') +

        (L.length ? '<div class="grid g3">' + L.map(function(x){ var R = checklist(x), d = R.filter(function(y){ return y[2]; }).length, np = (x.payReqs || []).filter(function(p){ return p.status === 'بانتظار'; }).length;
          return '<button class="card card-b pf-card" data-pf="open" data-id="' + x.id + '"><div class="row" style="justify-content:space-between;width:100%"><span class="svc-ic">' + ic('folder_open') + '</span>' + (np ? '<span class="pill pf-pay">' + ic('payments') + ' ' + np + ' طلب دفعة</span>' : '') + '</div><b>' + esc(x.title) + '</b><span class="small muted">' + esc(x.mosque || '') + ' · ' + esc(rep(x).name || 'بدون مقاول') + '</span>' +
            '<span class="tiny">المرحلة: <b>' + esc(Z.stageName(x)) + '</b></span><div class="prog" style="width:100%"><div class="bar"><i style="width:' + Math.round(d / R.length * 100) + '%;background:var(--ok)"></i></div><b class="num">' + d + '/' + R.length + '</b></div></button>'; }).join('') + '</div>' : '<div class="card empty">لا توجد مشاريع بعد. يظهر المشروع هنا بعد اعتماد كراسته أو اعتماد مقاول لها.</div>');
    };
    try { var IT = {k: 'proj_files', t: 'ملفات المشاريع', i: 'folder_open', b: function(){ return projects().reduce(function(a, x){ return a + (x.payReqs || []).filter(function(p){ return p.status === 'بانتظار'; }).length; }, 0); }}, put = false;
      NAV_FULL.forEach(function(g){ if (put) return; var i = (g.items || []).findIndex(function(x){ return x.k === 'boq'; }); if (i > -1) { g.items.splice(i + 1, 0, IT); put = true; } });
      if (!put) NAV_FULL.push({g: 'الصيانة والتحسينات', items: [IT]});
      if (typeof NEED !== 'undefined' && NEED.boq != null && NEED.proj_files == null) NEED.proj_files = NEED.boq;
      if (typeof applyNavPerms === 'function' && typeof STAFF !== 'undefined' && STAFF.user) applyNavPerms(); } catch(e){}

    /* ================= الإدارة المكتبية ← العقود (مثل الخطابات) ================= */
    var _oc = VIEWS.off_contracts;
    VIEWS.off_contracts = function(){
      var base = _oc ? _oc.apply(this, arguments) : '', L = (S.booklets || []).filter(function(b){ return b.status === 'معتمدة'; });
      var b = (UI.ocB && B(UI.ocB)) || L.filter(function(x){ return x.ct && x.ct.no; })[0] || L[0];
      var i = base.indexOf('<div class="card"><div class="card-h"><div><h2>'), heads = i > -1 ? base.slice(0, i) : base, rest = i > -1 ? base.slice(i) : '';
      if (!b) return heads + rest;
      if (!UI.ocOpen || !B(UI.ocOpen)) {
        heads = heads.replace(/<div class="field"><input class="inp" id="ocQ"[^>]*><\/div>/, '');
        var cards = L.map(function(x){ var c2 = x.ct || {}, R2 = checklist(x);
          var stt = !c2.no ? ['لم يُنشأ العقد', ''] : Z.ctSigned(x) ? (x.site && x.site.date ? ['ساري · قيد التنفيذ', 'ok'] : ['موقّع', 'ok']) : c2.sig1 ? ['بانتظار توقيع المقاول', 'warn'] : ['بانتظار التوقيع', 'warn'];
          return '<button class="card card-b pf-card" data-oco="' + x.id + '"><div class="row" style="justify-content:space-between;width:100%"><span class="svc-ic">' + ic('contract') + '</span><span class="pill ' + stt[1] + '">' + stt[0] + '</span></div>' +
            '<b>' + esc(c2.no ? 'عقد ' + c2.no : 'عقد غير منشأ') + '</b><span class="small">' + esc(x.title) + '</span><span class="small muted">' + esc(x.mosque || '') + ' · ' + esc(c2.cName || rep(x).name || 'بدون مقاول') + '</span>' +
            '<span class="tiny">القيمة: <b class="num">' + M(c2.value || Z.total(x)) + '</b> ر.س · توقيع الجمعية ' + (c2.sig1 ? '✓' : '—') + ' · المقاول ' + (c2.sig2 ? '✓' : '—') + '</span></button>'; }).join('');
        var P = S.contracts || [], pc = P.map(function(c3){ var pl = (S.plan || []).filter(function(y){ return y.id === c3.plan; })[0] || {}, r3 = (typeof repById === 'function' && repById(c3.rep)) || {};
          return '<button class="card card-b pf-card" data-go="contracts"><div class="row" style="justify-content:space-between;width:100%"><span class="svc-ic">' + ic('handshake') + '</span><span class="pill ' + (c3.status === 'ساري' ? 'ok' : 'warn') + '">' + esc(c3.status || '') + '</span></div><b>عقد مشروع ' + esc(c3.id || '') + '</b><span class="small">' + esc(pl.name || '') + '</span><span class="small muted">' + esc(r3.name || '') + '</span><span class="tiny">القيمة: <b class="num">' + M(c3.value || 0) + '</b> ر.س</span></button>'; }).join('');
        return heads + '<div class="sec-t">' + ic('request_quote') + ' عقود كراسات الصيانة والتحسينات (' + L.length + ')</div>' + (cards ? '<div class="grid g3">' + cards + '</div>' : '<div class="card empty">لا توجد كراسات معتمدة بعد.</div>') +
          (pc ? '<div class="sec-t">' + ic('handshake') + ' عقود المشاريع (' + P.length + ')</div><div class="grid g3">' + pc + '</div>' : '');
      }
      b = B(UI.ocOpen); heads = head('الإدارة المكتبية', (b.ct && b.ct.no ? 'عقد ' + esc(b.ct.no) : 'عقد جديد'), esc(b.title) + ' · ' + esc(b.mosque || ''), '<button class="btn" data-oca="back">' + ic('arrow_forward') + 'كل العقود</button><button class="btn" data-pf="open" data-id="' + b.id + '" data-go2="pf">' + ic('folder_open') + 'ملف المشروع</button>'); rest = '';
      UI.ocB = b.id; var c = b.ct || {}, CL = Z.clausesOf(b);
      var form = '<div class="lt-layout"><div class="card lt-form"><div class="card-h"><div><h2>' + ic('edit_note') + ' تحرير العقد</h2><p>عدّل أي بند، والمعاينة على كليشة الجمعية تتحدث مباشرة</p></div></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">' +
        '<div class="field"><label for="ocSel">العقد / الكراسة</label><select class="inp" id="ocSel">' + L.map(function(x){ return '<option value="' + x.id + '" ' + (x.id === b.id ? 'selected' : '') + '>' + esc((x.ct && x.ct.no ? x.ct.no + ' · ' : '') + x.title + ' · ' + (x.mosque || '')) + '</option>'; }).join('') + '</select></div>' +
        '<div class="row"><button class="btn sm" data-act="bfCt" data-id="' + b.id + '">' + ic('badge') + (c.no ? 'بيانات الأطراف والقيمة والدفعات' : 'إنشاء بيانات العقد') + '</button>' + (c.no && !c.sig1 ? '<button class="btn sm pri" data-act="bfSign1" data-id="' + b.id + '">' + ic('draw') + 'توقيع الجمعية وإرساله للمقاول</button>' : '') + '</div>' +
        '<div class="row tiny"><span class="pill ' + (c.sig1 ? 'ok' : '') + '">توقيع الجمعية ' + (c.sig1 ? '✓' : '—') + '</span><span class="pill ' + (c.sig2 ? 'ok' : c.sig1 ? 'warn' : '') + '">توقيع المقاول ' + (c.sig2 ? '✓' : c.sig1 ? '(بانتظاره في بوابته)' : '—') + '</span>' + (c.clauses ? '<span class="pill gold">بنود معدّلة</span>' : '') + '<label class="pill" style="cursor:pointer"><input type="checkbox" id="ocStamp" ' + (b.docStamp && b.docStamp.contract ? 'checked' : '') + ' style="accent-color:#C5A976"> إضافة ختم الجمعية على العقد</label></div>' +
        '<div class="tiny muted">رموز تُعبأ تلقائياً داخل النص: {المشروع} {المسجد} {الكراسة} {المدة} {القيمة} {الدفعات} {عرض_السعر} {تاريخ_العرض} · السطر الذي يبدأ بـ «- » يصبح نقطة مرقمة · **نص** للتعريض</div>' +
        CL.map(function(x, k){ return '<div class="oc-cl"><div class="row" style="flex-wrap:nowrap;gap:6px"><input class="inp" data-clt="' + k + '" value="' + esc(x.t || '') + '" style="font-weight:700"><button class="btn sm ghost" data-oca="up" data-i="' + k + '" aria-label="رفع البند">' + ic('arrow_upward') + '</button><button class="btn sm ghost" data-oca="del" data-i="' + k + '" aria-label="حذف البند">' + ic('delete') + '</button></div><textarea class="inp" data-clx="' + k + '" rows="' + Math.min(9, Math.max(3, String(x.x || '').split('\n').length + 1)) + '">' + esc(x.x || '') + '</textarea></div>'; }).join('') +
        '<div class="row"><button class="btn sm" data-oca="add">' + ic('add') + 'إضافة بند</button>' + (c.clauses ? '<button class="btn sm ghost" data-oca="reset">' + ic('restart_alt') + 'استعادة نص النموذج الأصلي</button>' : '') + '</div></div></div>' +
        '<div class="lt-prev"><div class="lt-prev-h"><b class="small">' + ic('description') + ' معاينة A4</b><div class="row"><button class="btn sm pri" data-act="bfPrint" data-id="' + b.id + '">' + ic('print') + 'طباعة / PDF</button></div></div><iframe id="ocFrame" title="معاينة العقد" style="width:100%;height:82vh;border:1px solid var(--line,#D6DFE5);border-radius:8px;background:#eef1f4"></iframe></div></div>';
      setTimeout(paint, 0);
      return heads + form + rest;
    };
    var pT = null;
    function paint(){ var f = document.getElementById('ocFrame'), b = UI.ocB && B(UI.ocB); if (!f || !b) return; var y = 0; try { y = f.contentWindow.scrollY; } catch(e){}
      f.onload = function(){ try { f.contentWindow.scrollTo(0, y); } catch(e){} }; var z = Math.min(1, ((f.clientWidth || 800) - 24) / 820); f.srcdoc = Z.contractHTML(b).replace('<div class="bar"><button onclick="print()">طباعة / حفظ PDF</button></div>', '').replace('</head>', '<style>@media screen{html{zoom:' + z.toFixed(3) + '}}</style>' + (window.zulfiStampOn && zulfiStampOn(b, 'contract') ? '' : '<style>.stamp{display:none!important}</style>') + '</head>'); }
    function clauses(b){ b.ct = b.ct || {}; if (!b.ct.clauses) b.ct.clauses = JSON.parse(JSON.stringify(Z.clausesOf(b))); return b.ct.clauses; }
    document.addEventListener('input', function(e){ var t = e.target, b = UI.ocB && B(UI.ocB);
      if (t.id === 'pfQ') { UI.pfQ = t.value; clearTimeout(pT); pT = setTimeout(function(){ render(); var i = document.getElementById('pfQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); return; }
      if (!b || !(t.dataset.clt || t.dataset.clx)) return; var C = clauses(b);
      if (t.dataset.clt) C[+t.dataset.clt].t = t.value; else C[+t.dataset.clx].x = t.value;
      clearTimeout(pT); pT = setTimeout(function(){ try { save(); } catch(x){} paint(); }, 450); });
    document.addEventListener('change', function(e){ var t = e.target;
      if (t.id === 'pyLink') { var o = t.selectedOptions[0], am = document.getElementById('pyAmt'); if (o && o.dataset.amt && am) am.value = o.dataset.amt; return; }
      if (t.id === 'ocStamp') { var bs = UI.ocB && B(UI.ocB); if (!bs) return; bs.docStamp = bs.docStamp || {}; bs.docStamp.contract = t.checked; save(); paint(); toast(t.checked ? 'أُضيف الختم على العقد' : 'أُزيل الختم من العقد', 'approval'); return; }
      if (t.id === 'ocSel') { UI.ocB = UI.ocOpen = t.value; render(); return; }
      if (t.dataset.pff) { var b = B(t.dataset.id); if (!b) return; var p = t.dataset.pff.split('.'), o = PF(b); o[p[0]] = o[p[0]] || {}; o[p[0]][p[1]] = t.value; save(); return; }
      if (t.dataset.pfw) { var b2 = B(t.dataset.id); if (!b2) return; var w = PF(b2).waste = PF(b2).waste || {}; w.items = w.items || []; (w.items[+t.dataset.i] = w.items[+t.dataset.i] || {})[t.dataset.pfw] = t.value; save(); return; }
      if (t.dataset.pfu) { var b3 = B(t.dataset.id); if (!b3 || !t.files || !t.files.length) return; var key = t.dataset.pfu, files = [].slice.call(t.files);
        toast('جاري إرفاق الملف…', 'upload_file');
        Promise.all(files.map(function(x){ return readFile(x); })).then(function(L2){ var fo = L2[0], f = PF(b3), now = Z.nowS();
          if (key === 'other') { f.other = (f.other || []).concat(L2); }
          else if (key === 'ct') { b3.ct = b3.ct || {}; b3.ct.file = fo; }
          else if (key === 'site') { b3.site = b3.site || {}; b3.site.file = fo; }
          else if (key.indexOf('rcpt:') === 0) { var p2 = (b3.payReqs || []).filter(function(x){ return x.id === key.slice(5); })[0]; if (p2) { p2.receipt = fo; p2.receiptAt = now; } }
          else { f[key] = f[key] || {}; f[key].file = fo; f[key].at = now; if (!f[key].date) f[key].date = today(); }
          try { logIt('إرفاق مستند في ملف المشروع ' + b3.id); } catch(x){} save(); render(); toast('أُرفق الملف في ملف المشروع', 'check_circle'); }); } }, true);
    document.addEventListener('click', function(e){
      var t = e.target.closest('[data-oca],[data-pf],[data-pfdoc],[data-oc],[data-oco]'); if (!t) return;
      if (t.dataset.oco) { e.stopImmediatePropagation(); UI.ocB = UI.ocOpen = t.dataset.oco; render(); window.scrollTo(0, 0); return; }
      if (t.dataset.oc) { e.stopImmediatePropagation(); UI.ocB = UI.ocOpen = t.dataset.oc; window.__keepSub = 1; go('off_contracts'); return; }
      if (t.dataset.go2 === 'pf') { e.stopImmediatePropagation(); UI.pfB = t.dataset.id; window.__keepSub = 1; go('proj_files'); return; }
      if (t.dataset.pfdoc === 'all') { e.stopImmediatePropagation(); var bm = B(t.dataset.id); if (!bm) return; toast('جاري دمج مستندات المشروع في ملف واحد…', 'merge');
        mergeAll(bm).then(function(html){ Z.show(html, 'ملف المشروع كاملاً · ' + bm.title, bm); }, function(err){ console.warn(err); toast('تعذر دمج الملف', 'error'); }); return; }
      if (t.dataset.pfdoc) { e.stopImmediatePropagation(); var b = B(t.dataset.id); if (!b) return; var k = t.dataset.pfdoc, html = k.indexOf('pay:') === 0 ? DOCS.pay(b, k.slice(4)) : DOCS[k] && DOCS[k](b);
        if (html) Z.show(html, ({owner: 'نموذج موافقة مالك المسجد', site: 'محضر استلام الموقع', deliv: 'محضر تسليم المشروع', waste: 'محضر استلام الرجيع', index: 'فهرس ملف المشروع'})[k] || 'طلب صرف دفعة', b, k); return; }
      if (t.dataset.pf) { e.stopImmediatePropagation(); var a = t.dataset.pf, b2 = t.dataset.id && B(t.dataset.id);
        if (a === 'open') { UI.pfB = t.dataset.id; render(); window.scrollTo(0, 0); }
        else if (a === 'back') { UI.pfB = null; render(); }
        else if (a === 'paySave' && b2) { var amt = +document.getElementById('pyAmt').value, dt = document.getElementById('pyDate').value, lk = document.getElementById('pyLink').value;
          if (!amt || amt <= 0) { toast('اكتب مبلغ الحوالة', 'error'); return; } if (!dt) { toast('حدد تاريخ الحوالة', 'error'); return; }
          var fi = document.getElementById('pyFile'), ref = document.getElementById('pyRef').value.trim(), bank = document.getElementById('pyBank').value.trim(), note = document.getElementById('pyNote').value.trim();
          (fi.files && fi.files.length ? readFile(fi.files[0]) : Promise.resolve(null)).then(function(fo){
            b2.payReqs = b2.payReqs || []; var p3 = lk ? b2.payReqs.filter(function(x){ return x.id === lk; })[0] : null;
            if (!p3) { p3 = {id: 'PAY-' + Date.now().toString(36).slice(-5).toUpperCase(), amount: amt, note: note || 'حوالة مسجلة من الإدارة', at: Z.nowS(), by: Z.who(), manual: 1}; b2.payReqs.push(p3); }
            p3.status = 'مدفوعة'; p3.paidAt = dt; p3.paidBy = Z.who(); p3.amount = amt; if (ref) p3.ref = ref; if (bank) p3.bank = bank; if (note && lk) p3.payNote = note; if (fo) { p3.receipt = fo; p3.receiptAt = Z.nowS(); }
            try { logIt('تسجيل حوالة ' + p3.id + ' في ملف المشروع ' + b2.id); } catch(x){} save(); render(); toast('حُفظت الحوالة في ملف المشروع', 'paid'); }); }
        else if (a === 'wadd' && b2) { var w = PF(b2).waste = PF(b2).waste || {}; (w.items = w.items || []).push({d: '', q: '', s: '', n: ''}); save(); render(); }
        else if (a === 'wdel' && b2) { var w2 = PF(b2).waste || {}; (w2.items || []).splice(+t.dataset.i, 1); save(); render(); }
        return; }
      if (t.dataset.oca === 'back') { e.stopImmediatePropagation(); UI.ocOpen = null; render(); return; }
      if (t.dataset.oca) { e.stopImmediatePropagation(); var b3 = UI.ocB && B(UI.ocB); if (!b3) return; var C = clauses(b3), i = +t.dataset.i;
        if (t.dataset.oca === 'add') C.push({t: 'البند ' + (C.length + 1) + ': ', x: ''});
        else if (t.dataset.oca === 'del') { if (!confirm('حذف «' + (C[i].t || 'البند') + '»؟')) return; C.splice(i, 1); }
        else if (t.dataset.oca === 'up' && i > 0) { var x = C[i]; C[i] = C[i - 1]; C[i - 1] = x; }
        else if (t.dataset.oca === 'reset') { if (!confirm('استعادة نص النموذج الأصلي وحذف تعديلات البنود؟')) return; delete b3.ct.clauses; }
        save(); render(); }
    }, true);
    /* الانتقال من التنبيه إلى ملف المشروع */
    document.addEventListener('click', function(e){ var n = e.target.closest('[data-n]'); if (!n) return; var x = (S.notifs || [])[+n.dataset.n]; if (x && x.bid && x.go === 'proj_files') { UI.pfB = x.bid; window.__keepSub = 1; } }, true);
    /* الضغط على «ملفات المشاريع» أو «العقود» من القائمة يفتح صفحة القائمة */
    if (typeof go === 'function') { var _go = go; go = function(v){ if (!window.__keepSub) { if (v === 'proj_files') UI.pfB = null; if (v === 'off_contracts') UI.ocOpen = null; } window.__keepSub = 0; return _go.apply(this, arguments); }; }
    document.addEventListener('click', function(e){ var g = e.target.closest('[data-go]'); if (!g || window.__keepSub) return; if (g.dataset.go === 'proj_files') UI.pfB = null; if (g.dataset.go === 'off_contracts') UI.ocOpen = null; }, true);
  }

  /* ================= تنبيهات طلبات الدفعات بلون مميز ================= */
  function paintNotifs(){ document.querySelectorAll('[data-n]:not([data-nk])').forEach(function(el){ var x = (S.notifs || [])[+el.dataset.n]; el.setAttribute('data-nk', x && x.kind || '-');
    if (x && x.kind === 'pay') { el.classList.add('nt-pay'); var ms = el.querySelector('.ms'); if (ms) ms.textContent = 'payments'; }
    else if (x && x.kind === 'ct') el.classList.add('nt-ct'); }); }
  new MutationObserver(function(){ paintNotifs(); }).observe(document.body, {childList: true, subtree: true});

  var st = document.createElement('style');
  st.textContent = '.nt-pay{background:#EAF2F8!important;border-right:4px solid #1D5271!important;border-radius:8px}.nt-pay .ms{color:#1D5271!important}.nt-ct{background:#F3ECDD!important;border-right:4px solid #C5A976!important;border-radius:8px}' +
    ':root[data-theme="dark"] .nt-pay{background:#16324A!important}:root[data-theme="dark"] .nt-ct{background:#3A3222!important}' +
    '.pf-sec .card-h{align-items:center}.pf-sec.ok{border-color:var(--ok,#1F6B45)}.pf-n{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#F3ECDD;color:#8A6F3D;font-weight:700}.pf-sec.ok .pf-n{background:var(--ok-soft,#E3F3EA);color:var(--ok,#1F6B45)}' +
    '.pf-b{display:flex;flex-direction:column;gap:10px}.pf-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.pf-card{display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:right;cursor:pointer;font:inherit;color:inherit}.pf-card:hover{border-color:var(--gold,#C5A976)}' +
    '.pf-ks{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.pf-k{display:flex;flex-direction:column;gap:2px;background:var(--bg,#F5F7F9);border-radius:8px;padding:8px 10px;border-right:3px solid var(--line,#D6DFE5)}.pf-k.ok{border-color:var(--ok,#1F6B45)}.pf-k.warn{border-color:#C5A976}.pf-k.gold{border-color:#1D5271}' +
    '.pf-form{display:flex;flex-direction:column;gap:8px;border:1px dashed #C5A976;border-radius:10px;padding:12px;background:var(--gold-soft,#FBF8F1)}:root[data-theme="dark"] .pf-form{background:transparent}' +
    '.pf-pay{background:#EAF2F8;color:#1D5271}tr.pf-new td{background:#EAF2F8}:root[data-theme="dark"] tr.pf-new td{background:#16324A}.oc-cl{display:flex;flex-direction:column;gap:6px;border:1px solid var(--line,#D6DFE5);border-radius:10px;padding:10px}';
  document.head.appendChild(st);
})();
