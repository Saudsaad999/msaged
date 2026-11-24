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

  /* العرض: «جمعية المساجد بالزلفي · الاسم (الصلاحية)» تحت كل رسالة من الإدارة */
  function decorate(){
    var box = document.getElementById('msgs'); if (!box || typeof UI === 'undefined') return;
    var t = (S.chats || []).filter(function(c){ return c && c.id === UI.chat; })[0];
    if (!t) { try { t = visibleChats()[0]; } catch(e){} }
    if (!t || !Array.isArray(t.msgs)) return;
    var els = box.querySelectorAll('.msg'); if (els.length !== t.msgs.length) return;
    for (var i = 0; i < els.length; i++) { var m = t.msgs[i];
      if (m && m.label) { var sm0 = els[i].querySelector('small'); if (sm0 && !sm0.getAttribute('data-by')) { sm0.setAttribute('data-by', '1'); sm0.textContent = (m.at ? m.at + ' · ' : '') + m.label; } continue; }
      var L = m && m.me ? label(m) : ''; if (!L) continue;
      var sm = els[i].querySelector('small'); if (!sm || sm.getAttribute('data-by')) continue;
      sm.setAttribute('data-by', '1'); var b = document.createElement('b'); b.style.fontWeight = '600'; b.textContent = ' · ' + L; sm.appendChild(b); }
  }
  if (typeof render === 'function') { var _r = render; render = function(){ var x = _r.apply(this, arguments); try { decorate(); } catch(e){} return x; }; }
  new MutationObserver(function(){ try { decorate(); } catch(e){} }).observe(document.body, {childList: true, subtree: true});
})();
