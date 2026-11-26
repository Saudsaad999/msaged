/* =====================================================================
   صفحة الجهة الداعمة:
   ١) بطاقة الترحيب بالجهة في أعلى الصفحة ثم الخطط
   ٢) خانة «المحادثة مع إدارة الجمعية» (بين الجهة والإدارة فقط)
      تظهر للإدارة في «مركز المحادثات» باسم الجهة
   ===================================================================== */
(function(){
  'use strict';
  if (typeof VIEWS === 'undefined' || !VIEWS.dn_home) return;
  var TMPA = [];
  function donor(){ try { var u = (typeof me === 'function') ? me() : null; if (!u || !u.donor) return null; return (S.donors || []).filter(function(d){ return d.id === u.donor; })[0] || null; } catch(e){ return null; } }
  function thId(d){ return 'DN-' + d.id; }
  function thread(d){ return (S.chats || []).filter(function(c){ return c && c.id === thId(d); })[0] || null; }
  function ensure(d){ var t = thread(d); if (!t) { t = {id: thId(d), req: '', with: d.name, kind: 'جهة مانحة', unread: 0, msgs: []}; S.chats.unshift(t); } return t; }

  function bubbles(t){
    if (!t || !t.msgs.length) return '<div class="empty small" style="margin:auto">' + ic('forum') + ' اكتب رسالتك لإدارة الجمعية، وسيصلكم الرد هنا.</div>';
    return t.msgs.map(function(m){ var mine = !m.me;
      var who = mine ? 'أنتم' : 'إدارة الجمعية' + (m.byName ? ' · ' + m.byName : '');
      return '<div class="dnc-msg ' + (mine ? 'me' : 'them') + '"><div class="dnc-by">' + esc(who) + '</div>' + (m.t ? '<div>' + esc(m.t) + '</div>' : '') +
        (typeof thumbsHTML === 'function' ? thumbsHTML(m.atts || []) : '') + '<small>' + esc(m.at || '') + '</small></div>'; }).join('');
  }
  function card(d){
    var t = thread(d);
    return '<div class="card dn-chat"><div class="card-h"><div><h2>' + ic('support_agent') + ' المحادثة مع إدارة الجمعية</h2><p class="small muted">تواصل مباشر بينكم وبين إدارة الجمعية فقط</p></div></div>' +
      '<div class="dnc-msgs" id="dnMsgs">' + bubbles(t) + '</div>' +
      '<div id="dnPend" class="dnc-pend">' + (TMPA.length && typeof thumbsHTML === 'function' ? thumbsHTML(TMPA) : '') + '</div>' +
      '<form class="dnc-form" id="dnChatForm"><label class="btn ghost" title="إرفاق صورة أو ملف" style="cursor:pointer">' + ic('attach_file') + '<input type="file" id="dnFile" multiple hidden accept="image/*,application/pdf"></label>' +
      '<input class="inp" id="msgIn" placeholder="اكتب رسالتك لإدارة الجمعية…" autocomplete="off"><button class="btn pri">' + ic('send') + 'إرسال</button></form></div>';
  }

  var _v = VIEWS.dn_home;
  VIEWS.dn_home = function(){
    var h = _v.apply(this, arguments), d = donor(); if (!d) return h;
    try {
      var tp = document.createElement('template'); tp.innerHTML = h; var root = tp.content;
      var kids = [].slice.call(root.children);
      var anchor = kids.filter(function(e){ return !e.classList.contains('page-head') && !e.classList.contains('psearch'); })[0];
      var hero = root.querySelector('.dn-hero');
      if (hero && anchor && hero !== anchor) { root.insertBefore(hero, anchor); }
      /* المحادثة بعد خطط الجمعية والمشاريع المدعومة */
      var plans = [].slice.call(root.querySelectorAll('.dn-plan-top')), last = plans[plans.length - 1] || hero;
      var box = document.createElement('div'); box.innerHTML = card(d); var c = box.firstChild;
      if (last && last.parentNode) last.parentNode.insertBefore(c, last.nextSibling); else root.appendChild(c);
      h = tp.innerHTML;
    } catch(e){ console.warn('[donor]', e); }
    setTimeout(function(){ var m = document.getElementById('dnMsgs'); if (m) m.scrollTop = m.scrollHeight; }, 0);
    return h;
  };

  document.addEventListener('submit', function(e){
    if (!e.target || e.target.id !== 'dnChatForm') return; e.preventDefault(); e.stopImmediatePropagation();
    var d = donor(); if (!d) return; var i = document.getElementById('msgIn'), v = (i && i.value || '').trim();
    if (!v && !TMPA.length) return;
    var t = ensure(d), u = (typeof me === 'function' && me()) || {};
    t.with = d.name; t.msgs.push({me: 0, t: v, at: nowT(), atts: TMPA.slice(), byName: u.name || d.name}); t.unread = (t.unread || 0) + 1;
    TMPA = []; if (i) i.value = '';
    try { S.notifs && S.notifs.unshift({t: 'رسالة جديدة من الجهة الداعمة ' + d.name, at: 'الآن', go: 'chats'}); } catch(x){}
    save(); render(); toast('أُرسلت رسالتكم لإدارة الجمعية', 'send');
    setTimeout(function(){ var j = document.getElementById('msgIn'); if (j) j.focus(); }, 0);
  }, true);
  document.addEventListener('change', function(e){
    if (!e.target || e.target.id !== 'dnFile') return; var files = [].slice.call(e.target.files || []); if (!files.length) return;
    Promise.all(files.map(function(f){ return readFile(f); })).then(function(L){ TMPA = TMPA.concat(L); var p = document.getElementById('dnPend'); if (p && typeof thumbsHTML === 'function') p.innerHTML = thumbsHTML(TMPA); toast('أُرفق ' + L.length + ' ملف', 'attach_file'); });
  }, true);

  var st = document.createElement('style');
  st.textContent = '.dn-chat .dnc-msgs{display:flex;flex-direction:column;gap:8px;max-height:380px;min-height:160px;overflow:auto;padding:14px;background:var(--bg,#F5F7F9)}' +
    '.dnc-msg{max-width:78%;padding:8px 12px;border-radius:10px;font-size:.88rem;line-height:1.6;display:flex;flex-direction:column;gap:3px;white-space:pre-wrap;word-break:break-word}' +
    '.dnc-msg.me{align-self:flex-start;background:#F3ECDD;color:#17384C}.dnc-msg.them{align-self:flex-end;background:var(--surface,#fff);border:1px solid var(--line,#D6DFE5)}' +
    '.dnc-by{font-size:.72rem;font-weight:700;color:#8A6F3D}.dnc-msg small{font-size:.66rem;opacity:.75}' +
    '.dnc-pend{padding:0 12px}.dnc-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line,#D6DFE5)}.dnc-form .inp{flex:1;min-width:0}' +
    ':root[data-theme="dark"] .dnc-msg.me{background:#3A3222;color:#F3ECDD}:root[data-theme="dark"] .dnc-by{color:#C5A976}' +
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .dnc-msg.me{background:#3A3222;color:#F3ECDD}:root:not([data-theme="light"]) .dnc-by{color:#C5A976}}';
  document.head.appendChild(st);
})();
