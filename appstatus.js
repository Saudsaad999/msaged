/* =====================================================================
   إرسال تقدّم الطلب من النظام إلى تطبيق المساجد عند كل مرحلة
   يعمل في لوحة التحكم وبوابة المناديب معاً (بعد sync.js)
   ===================================================================== */
(function(){
  'use strict';
  if (typeof S === 'undefined') return;
  var STAGES = {1: 'الاستقبال والفرز', 2: 'المعاينة الميدانية', 3: 'الصيانة والتنفيذ', 4: 'التوثيق والتقييم', 5: 'الإغلاق'};
  /* مفاتيح الحالة في النظام: جديدة، S1..S4 حسب المرحلة، منتهي، مرفوض، معاد لمقدم الطلب */
  var KEYS = [
    ['جديدة', 'بانتظار المراجعة والإسناد', /انتظار|جديد|pending|new/i, 'في الانتظار', /لم تبدأ|not/i, 'لم تبدأ'],
    ['S1', 'المرحلة 1: قُبل وأُسند لمنفذ', /قبول|مقبول|accept|assigned/i, 'تم القبول', /لم تبدأ|not/i, 'لم تبدأ'],
    ['S2', 'المرحلة 2: المعاينة الميدانية', /معاين|تنفيذ|جاري|قيد|progress/i, 'قيد التنفيذ', /معاين|جاري|قيد|progress/i, 'جاري العمل'],
    ['S3', 'المرحلة 3: الصيانة والتنفيذ', /تنفيذ|جاري|قيد|progress/i, 'قيد التنفيذ', /جاري|قيد|progress/i, 'جاري العمل'],
    ['S4', 'المرحلة 4: التوثيق والتقييم', /توثيق|تقييم|تنفيذ|جاري|قيد/i, 'قيد التنفيذ', /جاري|قيد|توثيق/i, 'جاري العمل'],
    ['منتهي', 'المرحلة 5: أُغلق وسُلّم', /الانتهاء|انتهى|منته|مكتمل|complet|done/i, 'تم الانتهاء', /الانتهاء|انتهى|منته|مكتمل|done/i, 'تم الانتهاء'],
    ['مرفوض', 'مرفوض', /رفض|مرفوض|ملغ|reject|cancel/i, 'مرفوض', /رفض|ملغ/i, 'مرفوض'],
    ['معاد لمقدم الطلب', 'بحاجة لاستكمال المرفقات', /استكمال|نواقص|معاد|return/i, 'بحاجة لاستكمال', /لم تبدأ/i, 'لم تبدأ']
  ];
  var OBS = { status: [], agentStatus: [] };   /* القيم الموجودة فعلاً في التطبيق (تملؤها لوحة التحكم) */

  function sysKey(r){
    if (r.closed || r.status === 'منتهي') return 'منتهي';
    if (r.status === 'مرفوض') return 'مرفوض';
    if (r.status === 'معاد لمقدم الطلب') return 'معاد لمقدم الطلب';
    if (r.status === 'جديدة' && !r.rep && !r.execBy) return 'جديدة';
    var st = +r.stage || (r.status === 'جاري العمل' ? 3 : 1);
    if (st >= 5) return 'منتهي';
    return 'S' + Math.max(1, Math.min(4, st));
  }
  function maps(){
    var M = S.appStatusMap || {}, A = S.appAgentMap || {}, out = { status: {}, agent: {} };
    KEYS.forEach(function(k){
      var hit = OBS.status.filter(function(v){ return k[2].test(v); })[0];
      out.status[k[0]] = M[k[0]] || hit || k[3];
      var hitA = OBS.agentStatus.filter(function(v){ return k[4].test(v); })[0];
      out.agent[k[0]] = A[k[0]] || hitA || k[5];
    });
    return out;
  }
  function lastUpdate(r){
    if (r.report && ((+r.stage || 0) >= 4 || r.closed || r.status === 'منتهي')) return r.report;
    var L = (r.exe && r.exe.log) || []; var u = L[L.length - 1];
    if (u && u.t) return u.t;
    if (r.report) return r.report;
    if (r.insp && r.insp.diag) return 'التشخيص: ' + r.insp.diag;
    return '';
  }
  function httpsImgs(r, after){
    return (r.atts || []).filter(function(a){ return a && typeof a.data === 'string' && /^https:\/\//.test(a.data) && (!after || +a.stage >= 3 || /بعد|التسليم|توثيق/.test((a.kind || '') + (a.name || ''))); })
      .map(function(a){ return a.data; }).slice(0, 20);
  }
  function fbOk(){ return window.firebase && firebase.apps && firebase.apps.length && firebase.firestore && window.__zulfiSyncReady; }
  var pushing = {}, lastErr = '', SENT = {};
  try { SENT = JSON.parse(localStorage.getItem('zulfi-app-sent') || '{}') || {}; } catch(e){}
  function keepSent(){ try { localStorage.setItem('zulfi-app-sent', JSON.stringify(SENT)); } catch(e){} }
  function push(){
    if (!fbOk() || !Array.isArray(S.requests)) return;
    var db = firebase.firestore(), MP = maps(), any = false;
    S.requests.forEach(function(r){
      if (!r.appRef || !r.appRef.col || !r.appRef.id) return;
      var k = sysKey(r), pct = (r.exe && +r.exe.pct) || (k === 'منتهي' ? 100 : 0);
      var sig = k + '|' + pct + '|' + ((r.exe && r.exe.log) || []).length + '|' + (r.report ? 1 : 0);
      var was = SENT[r.id] || r.appSig;
      if (!was && k === 'جديدة') { SENT[r.id] = sig; keepSent(); return; }
      if (sig === was || pushing[r.id] === sig) return;
      pushing[r.id] = sig;
      var st = k === 'منتهي' ? 5 : (/^S\d$/.test(k) ? +k.slice(1) : (k === 'جديدة' ? 0 : (+r.stage || 0)));
      var upd = {
        status: MP.status[k], agentStatus: MP.agent[k], isReadByAdmin: true,
        stage: st, stageName: STAGES[st] || (k === 'جديدة' ? 'بانتظار المراجعة' : k), progress: pct,
        lastUpdate: lastUpdate(r).slice(0, 1000), systemRequestId: r.id,
        statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(), statusUpdatedBy: (typeof IS_PORTAL !== 'undefined' && IS_PORTAL) ? 'بوابة المنفذ' : 'لوحة التحكم'
      };
      if (k === 'مرفوض' && r.reason) upd.rejectionReason = String(r.reason);
      if (k === 'معاد لمقدم الطلب') { var lg = (r.returnedLog || []).slice(-1)[0] || r.returned || {}; upd.adminNote = [].concat(lg.needs || []).join('، ') + (lg.note ? ' · ' + lg.note : ''); }
      if (r.insp && r.insp.diag) upd.inspection = String(r.insp.diag).slice(0, 1000);
      if (r.report) upd.completionReport = String(r.report).slice(0, 2000);
      var im = httpsImgs(r, true); if (im.length) upd.completionImages = im;
      any = true;
      db.collection(r.appRef.col).doc(r.appRef.id).update(upd).then(function(){
        SENT[r.id] = sig; keepSent(); delete pushing[r.id]; lastErr = '';
      }).catch(function(err){
        delete pushing[r.id];
        var msg = /permission/i.test(String(err && (err.code || err.message))) ? 'القاعدة ترفض تحديث الطلب في التطبيق: راجع قواعد الأمان' : 'تعذر تحديث الطلب في التطبيق';
        console.warn('[app-status]', r.appRef, err && (err.code || err.message));
        if (msg !== lastErr) { lastErr = msg; try { toast(msg, 'sync_problem'); } catch(e){} }
      });
    });
    return any;
  }
  var _save = save, t = null;
  save = function(){ var x = _save.apply(this, arguments); clearTimeout(t); t = setTimeout(push, 700); return x; };
  setInterval(push, 20000);
  window.ZAPP = { keys: KEYS, maps: maps, obs: OBS, push: push, sysKey: sysKey, lastError: function(){ return lastErr; } };
})();
