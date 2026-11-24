/* =====================================================================
   توضيح مُرسِل رسائل الإدارة في المحادثات: اسم المستخدم وصلاحيته
   (مدير النظام، متابع، موظف…) — يعمل في لوحة التحكم وبوابة المناديب
   ===================================================================== */
(function(){
  'use strict';
  if (typeof S === 'undefined' || typeof save !== 'function') return;

  function who(){
    try {
      if (typeof STAFF !== 'undefined' && STAFF.user) return {n: STAFF.user.name || '', r: STAFF.user.role || ''};
      if (typeof SESSION !== 'undefined' && SESSION.id && typeof repById === 'function') { var p = repById(SESSION.id); if (p) return {n: p.name || '', r: p.role || p.kind || ''}; }
    } catch(e){}
    return null;
  }
  window.zulfiWho = who;
  function label(m){ var n = m.byName || (typeof m.by === 'string' ? m.by : ''), r = m.byRole || '';
    if (!n && !r) return ''; return n && r && n !== r ? n + ' (' + r + ')' : (n || r); }
  window.zulfiByLabel = label;

  /* الرسائل الجديدة فقط تُنسب للمستخدم الحالي */
  var known = {};
  function snap(){ (S.chats || []).forEach(function(c){ if (c && !c._app && Array.isArray(c.msgs)) known[c.id] = c.msgs.length; }); }
  snap(); setInterval(snap, 1000);
  var _s = save;
  save = function(){
    var u = who();
    if (u && (u.n || u.r)) (S.chats || []).forEach(function(c){ if (!c || c._app || !Array.isArray(c.msgs)) return; var k = known[c.id] || 0;
      for (var i = k; i < c.msgs.length; i++) { var m = c.msgs[i]; if (m && m.me && !m.ts && !m.byName && !m.byRole) { m.byName = u.n; m.byRole = u.r; } }
      known[c.id] = c.msgs.length; });
    return _s.apply(this, arguments);
  };

  /* العرض: اسم المرسل وصلاحيته في سطر مستقل أعلى الرسالة حتى لا تتداخل النصوص */
  function decorate(){
    var box = document.getElementById('msgs'); if (!box || typeof UI === 'undefined') return;
    var t = (S.chats || []).filter(function(c){ return c && c.id === UI.chat; })[0];
    if (!t) { try { t = visibleChats()[0]; } catch(e){} }
    if (!t || !Array.isArray(t.msgs)) return;
    var els = box.querySelectorAll('.msg'); if (els.length !== t.msgs.length) return;
    for (var i = 0; i < els.length; i++) { var m = t.msgs[i], el = els[i]; if (!m || el.getAttribute('data-by')) continue;
      var L = m.label || (m.me ? label(m) : ''); if (!L) continue;
      el.setAttribute('data-by', '1');
      if (m.label) { var sm = el.querySelector('small'); if (sm) sm.textContent = m.at || ''; }
      var d = document.createElement('div'); d.className = 'msg-by'; d.textContent = L; el.insertBefore(d, el.firstChild); }
  }
  if (typeof render === 'function') { var _r = render; render = function(){ var x = _r.apply(this, arguments); try { decorate(); } catch(e){} return x; }; }
  new MutationObserver(function(){ try { decorate(); } catch(e){} }).observe(document.body, {childList: true, subtree: true});

  /* ترتيب المحادثات: غير المقروءة أولاً ثم الأحدث */
  function lastT(c){ var t = +c._t || 0; (c.msgs || []).forEach(function(m){ if (m && +m.ts > t) t = +m.ts; }); return t; }
  if (typeof visibleChats === 'function') { var _vc = visibleChats; visibleChats = function(){ var L = _vc.apply(this, arguments); if (!Array.isArray(L)) return L;
    var adm = typeof SESSION !== 'undefined' && SESSION.type === 'admin';
    return L.map(function(c, i){ return {c: c, i: i, u: adm && c.unread ? 1 : 0, t: lastT(c)}; })
      .sort(function(a, b){ return (b.u - a.u) || (b.t - a.t) || (a.i - b.i); }).map(function(x){ return x.c; }); }; }

  var st = document.createElement('style');
  st.textContent = '.chat.wa .msg{padding-bottom:7px;display:flex;flex-direction:column;align-items:stretch}.chat.wa .msg small{position:static;display:block;white-space:normal;margin-top:4px;text-align:left}' +
    '.msg-by{font-size:.72rem;font-weight:700;color:#8A6F3D;margin-bottom:3px;line-height:1.4}' +
    ':root[data-theme="dark"] .msg-by{color:#C5A976}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .msg-by{color:#C5A976}}';
  document.head.appendChild(st);
})();
