/* =====================================================================
   المسابقات والأسئلة ← تطبيق المساجد
   - كل مسابقة تُنشأ أو تُعدَّل في «المسابقات والأسئلة» تُحفظ في Firestore: competitions/{id}
   - مشاركات المستخدمين من التطبيق (competition_entries) تظهر في نتائج المسابقة في لوحة التحكم
   ===================================================================== */
(function(){
  'use strict';
  if (typeof S === 'undefined' || typeof VIEWS === 'undefined') return;
  var COL = 'competitions', ENT = 'competition_entries';
  var SENT = {}; try { SENT = JSON.parse(localStorage.getItem('zulfi-cmp-sent') || '{}') || {}; } catch(e){}
  function keep(){ try { localStorage.setItem('zulfi-cmp-sent', JSON.stringify(SENT)); } catch(e){} }
  var state = { ok: false, err: '', entries: 0, last: '' };
  function ready(){ return window.firebase && firebase.apps && firebase.apps.length && firebase.firestore && window.__zulfiSyncReady; }

  function docOf(c){
    var qs = (c.qs || []).map(function(q, i){ return {
      order: i + 1, text: q.t || '', type: q.type || 'اختيار من متعدد', options: (q.opts || []).slice(),
      correctIndex: (typeof q.ok === 'number') ? q.ok : null, points: +q.pts || 0, seconds: +q.sec || 0 }; });
    return { id: c.id, title: c.title || '', description: c.desc || '', target: c.target || '', prize: c.prize || '', period: c.period || '',
      status: c.status || 'مسودة', isPublished: c.status === 'منشورة', questionsCount: qs.length,
      totalPoints: qs.reduce(function(a, q){ return a + q.points; }, 0), questions: qs };
  }
  var busy = false;
  function push(){
    if (!ready() || busy || !Array.isArray(S.contests)) return;
    var db = firebase.firestore(), jobs = [], now = {};
    S.contests.forEach(function(c){
      if (!c || !c.id) return; var d = docOf(c), sig = JSON.stringify(d); now[c.id] = 1;
      if (SENT[c.id] === sig) return;
      d.updatedAt = firebase.firestore.FieldValue.serverTimestamp(); d.updatedBy = 'لوحة التحكم';
      jobs.push(db.collection(COL).doc(String(c.id)).set(d, { merge: true }).then(function(){ SENT[c.id] = sig; }));
    });
    Object.keys(SENT).forEach(function(id){ if (!now[id]) jobs.push(db.collection(COL).doc(id).delete().then(function(){ delete SENT[id]; })); });
    if (!jobs.length) return;
    busy = true;
    Promise.all(jobs).then(function(){ state.ok = true; state.err = ''; state.last = new Date().toLocaleTimeString('en-GB').slice(0,5); keep(); })
      .catch(function(e){ state.err = /permission/i.test(String(e && (e.code || e.message))) ? 'القاعدة ترفض حفظ المسابقات: راجع قواعد الأمان' : 'تعذر حفظ المسابقات في التطبيق'; console.warn('[contests]', e); try { toast(state.err, 'sync_problem'); } catch(x){} })
      .then(function(){ busy = false; if (UI.view === 'contests') try { render(); } catch(e){} });
  }

  /* مشاركات المستخدمين من التطبيق */
  var listening = false;
  function listen(){
    if (listening || !ready()) return; listening = true;
    firebase.firestore().collection(ENT).limit(2000).onSnapshot(function(qs){
      var byC = {}; qs.forEach(function(doc){ var d = doc.data() || {}; var cid = d.competitionId || d.contestId || d.competition_id; if (!cid) return;
        var t = d.submittedAt && d.submittedAt.toDate ? d.submittedAt.toDate() : (d.submittedAt ? new Date(d.submittedAt) : null);
        (byC[cid] = byC[cid] || []).push({ id: doc.id, name: d.name || d.userName || d.applicantName || 'مشارك', phone: d.phone || d.contactNumber || '', mosque: d.mosque || d.mosqueName || '',
          ans: Array.isArray(d.answers) ? d.answers : [], at: t && !isNaN(t) ? t.toISOString().slice(0,16).replace('T',' ') : '', fromApp: 1 }); });
      var changed = false; state.entries = qs.size || 0;
      (S.contests || []).forEach(function(c){ var L = byC[c.id]; if (!L) return; c.parts = c.parts || [];
        L.forEach(function(e){ var ex = c.parts.filter(function(p){ return p.id === e.id; })[0];
          if (!ex) { c.parts.push(e); changed = true; } else if (JSON.stringify(ex.ans) !== JSON.stringify(e.ans)) { ex.ans = e.ans; changed = true; } }); });
      if (changed) { try { save(); } catch(e){} if (UI.view === 'contests') try { render(); } catch(e){} }
    }, function(e){ console.warn('[contests] entries', e && e.code); });
  }

  /* شريط الحالة في صفحة المسابقات */
  if (VIEWS.contests) { var _v = VIEWS.contests; VIEWS.contests = function(){ var h = _v.apply(this, arguments);
    var bar = '<div class="card card-b row" style="justify-content:space-between;border-color:var(--gold-line,#C5A976);background:var(--gold-soft,#FBF8F1)"><span class="small">' + ic('smartphone') +
      ' <b>مربوطة بتطبيق المساجد:</b> أي إضافة أو تعديل على المسابقات وأسئلتها يُحفظ في التطبيق تلقائياً، والمسابقة «المنشورة» فقط تظهر للمستخدمين. ومشاركات المستخدمين تصل هنا.</span><span class="tiny ' + (state.err ? '' : 'muted') + '" style="' + (state.err ? 'color:var(--bad,#BA1A1A)' : '') + '">' +
      (state.err ? esc(state.err) : (ready() ? (state.last ? 'آخر حفظ ' + state.last : 'متصل') + ' · ' + state.entries + ' مشاركة' : 'غير متصل')) + '</span></div>';
    var i = h.indexOf('</div>', h.indexOf('class="page-head')); if (h.indexOf('class="page-head') > -1 && i > -1) { var j = h.indexOf('</div>', i + 6); return h.slice(0, j + 6) + bar + h.slice(j + 6); }
    return bar + h; }; }

  var _s = save, t = null;
  save = function(){ var r = _s.apply(this, arguments); clearTimeout(t); t = setTimeout(push, 800); return r; };
  var w = setInterval(function(){ if (!ready()) return; clearInterval(w); listen(); push(); }, 1000);
  setInterval(push, 30000);
})();
