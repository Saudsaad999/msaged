/* =====================================================================
   محادثات تطبيق المساجد ← لوحة التحكم (قراءة لحظية + الرد من اللوحة)
   - conversations      : محادثات المستخدمين (الأئمة والمؤذنين) مع الإدارة
   - driverAdminChats   : محادثات المناديب والسائقين مع الإدارة
   يتعرّف تلقائياً على شكل الرسائل في القاعدة (حقل مصفوفة أو مجموعة فرعية)
   ويكتب الرد بنفس شكل رسائل الإدارة الموجودة حتى يقرأه التطبيق كما هو.
   ===================================================================== */
(function(){
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof NAV_FULL === 'undefined') return;

  var CH = [
    {k: 'conversations', t: 'المستخدمون', i: 'forum'},
    {k: 'driverAdminChats', t: 'المناديب والسائقون', i: 'local_shipping'}
  ];
  var ARR = ['messages', 'msgs', 'chat', 'chats', 'messageList', 'conversation'];
  var SUBS = ['messages', 'chats', 'msgs', 'chat'];
  var F = {
    text: ['text', 'message', 'content', 'body', 'msg', 'messageText', 'lastMessageText'],
    time: ['timestamp', 'createdAt', 'time', 'sentAt', 'date', 'created_at', 'sendTime', 'messageTime'],
    file: ['imageUrl', 'image', 'imageURL', 'fileUrl', 'url', 'attachment', 'mediaUrl', 'photoUrl'],
    name: ['userName', 'name', 'driverName', 'agentName', 'applicantName', 'displayName', 'fullName', 'senderName', 'imamName', 'mosqueName', 'user'],
    phone: ['phone', 'phoneNumber', 'contactNumber', 'mobile', 'userPhone', 'driverPhone'],
    mosque: ['mosqueName', 'mosque', 'neighborhoodName'],
    uid: ['userId', 'uid', 'driverId', 'userUid', 'agentId', 'ownerId', 'customerId'],
    last: ['lastMessage', 'lastMsg', 'last_message', 'lastMessageText'],
    lastT: ['lastMessageTime', 'lastMessageAt', 'lastTime', 'updatedAt', 'lastUpdated', 'lastMessageTimestamp', 'timestamp', 'createdAt'],
    adminUnread: ['adminUnread', 'unreadByAdmin', 'unreadForAdmin', 'adminUnreadCount', 'unreadAdmin'],
    userUnread: ['userUnread', 'unreadByUser', 'unreadForUser', 'userUnreadCount', 'driverUnread', 'unreadByDriver', 'unreadForDriver']
  };
  var DATA = {}, STATE = {}, MSGS = {}, MODE = {}, started = false, subOff = null, subKey = '';
  var SEEN = {}; try { SEEN = JSON.parse(localStorage.getItem('zulfi-appchat-seen') || '{}') || {}; } catch(e){}
  function keepSeen(){ try { localStorage.setItem('zulfi-appchat-seen', JSON.stringify(SEEN)); } catch(e){} }

  /* ---------- أدوات ---------- */
  function pick(o, ks){ if (!o) return null; for (var i = 0; i < ks.length; i++) { var v = o[ks[i]]; if (v !== undefined && v !== null && v !== '') return v; } return null; }
  function keyOf(o, ks){ if (!o) return null; for (var i = 0; i < ks.length; i++) if (o[ks[i]] !== undefined) return ks[i]; return null; }
  function toDate(v){ if (!v) return null; if (typeof v.toDate === 'function') return v.toDate(); if (typeof v === 'object' && typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v); var d = new Date(v); return isNaN(d) ? null : d; }
  function ms(v){ var d = toDate(v); return d ? d.getTime() : 0; }
  function txt(v){ if (v == null) return ''; if (typeof v === 'string') return v; if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v.toDate === 'function') return fmtT(v); if (typeof v === 'object' && (v.text || v.message)) return String(v.text || v.message); return ''; }
  function fmtT(v){ var d = toDate(v); if (!d) return ''; var now = new Date(), same = d.toDateString() === now.toDateString();
    var t = String(d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (d.getHours() < 12 ? ' ص' : ' م');
    return same ? t : d.toISOString().slice(0, 10) + ' ' + t; }
  function url(v){ if (!v) return ''; if (typeof v === 'string') { if (/^https?:\/\//.test(v)) return v; try { var o = JSON.parse(v); return url(o); } catch(e){ return ''; } }
    if (Array.isArray(v)) return url(v[0]); if (typeof v === 'object') return url(v.secure_url || v.url || v.imageUrl || ''); return ''; }

  /* هل الرسالة من الإدارة؟ */
  function isAdminMsg(m, conv){
    if (!m || typeof m !== 'object') return false;
    var b = ['isAdmin', 'fromAdmin', 'isFromAdmin', 'sentByAdmin', 'byAdmin', 'admin'];
    for (var i = 0; i < b.length; i++) if (typeof m[b[i]] === 'boolean') return m[b[i]];
    var nb = ['isUser', 'fromUser', 'isDriver', 'fromDriver', 'isMe', 'isCustomer'];
    for (var j = 0; j < nb.length; j++) if (typeof m[nb[j]] === 'boolean') return !m[nb[j]];
    var s = String(pick(m, ['senderType', 'sender', 'role', 'from', 'type', 'senderRole', 'by', 'author']) || '');
    if (/admin|support|panel|staff|manager|ادار|مشرف|الجمعية/i.test(s)) return true;
    if (/user|driver|agent|client|customer|imam|مستخدم|مندوب|سائق/i.test(s)) return false;
    var sid = pick(m, ['senderId', 'senderUid', 'fromId', 'uid', 'userId']), cu = conv && pick(conv.d, F.uid);
    if (sid && cu) return String(sid) !== String(cu);
    if (sid && /admin/i.test(String(sid))) return true;
    return false;
  }
  function norm(m, conv, i){ var raw = (m && typeof m === 'object') ? m : {text: String(m)};
    return {raw: raw, i: i, text: txt(pick(raw, F.text)), file: url(pick(raw, F.file)), t: pick(raw, F.time), admin: isAdminMsg(raw, conv)}; }

  /* ---------- الاتصال والقراءة ---------- */
  function ready(){ return window.firebase && firebase.apps && firebase.apps.length && firebase.firestore && window.__zulfiSyncReady; }
  function start(){
    if (started) return; if (!ready()) { setTimeout(start, 1000); return; }
    started = true; var db = firebase.firestore();
    CH.forEach(function(c){
      STATE[c.k] = 'loading';
      db.collection(c.k).limit(500).onSnapshot(function(qs){
        var L = []; qs.forEach(function(doc){ L.push({id: doc.id, col: c.k, ref: doc.ref, d: doc.data() || {}}); });
        L.forEach(function(r){ var ak = null; for (var i = 0; i < ARR.length; i++) if (Array.isArray(r.d[ARR[i]])) { ak = ARR[i]; break; }
          if (ak) { MODE[c.k + '/' + r.id] = {kind: 'array', key: ak}; MSGS[c.k + '/' + r.id] = r.d[ak].map(function(m, i){ return norm(m, r, i); }).sort(byTime); }
          else if (!MODE[c.k + '/' + r.id]) MODE[c.k + '/' + r.id] = {kind: 'sub', key: null}; });
        L.sort(function(a, b){ return lastMs(b) - lastMs(a); });
        if (!SEEN['__init_' + c.k]) { var t0 = Date.now(); L.forEach(function(r){ SEEN[c.k + '/' + r.id] = t0; }); SEEN['__init_' + c.k] = t0; keepSeen(); }
        DATA[c.k] = L; STATE[c.k] = 'ok'; refresh(); nav();
      }, function(err){ STATE[c.k] = /permission/i.test(String(err && (err.code || err.message))) ? 'denied' : 'error'; console.warn('[app-chats]', c.k, err && err.code); refresh(); });
    });
  }
  function byTime(a, b){ var x = ms(a.t), y = ms(b.t); return (x && y) ? x - y : a.i - b.i; }
  function lastMs(r){ var L = MSGS[r.col + '/' + r.id]; var t = ms(pick(r.d, F.lastT)); if (L && L.length) t = Math.max(t, ms(L[L.length - 1].t)); return t; }
  function lastText(r){ var L = MSGS[r.col + '/' + r.id]; if (L && L.length) { var m = L[L.length - 1]; return (m.admin ? 'أنت: ' : '') + (m.text || (m.file ? 'صورة' : '')); } return txt(pick(r.d, F.last)); }
  function unread(r){ var n = pick(r.d, F.adminUnread); if (typeof n === 'number') return n;
    if (r.d.isReadByAdmin === false || r.d.readByAdmin === false || r.d.adminRead === false) return 1;
    var L = MSGS[r.col + '/' + r.id]; var last = L && L.length ? L[L.length - 1] : null; if (last && last.admin) return 0;
    var t = lastMs(r); return t && t > (SEEN[r.col + '/' + r.id] || 0) ? 1 : 0; }
  function unreadAll(){ var n = 0; CH.forEach(function(c){ (DATA[c.k] || []).forEach(function(r){ if (unread(r)) n++; }); }); return n; }

  /* الرسائل في مجموعة فرعية: تُقرأ للمحادثة المفتوحة فقط */
  function openSub(r){
    var key = r.col + '/' + r.id, M = MODE[key]; if (!M || M.kind !== 'sub') return; if (subKey === key) return;
    if (subOff) { try { subOff(); } catch(e){} subOff = null; } subKey = key;
    var tryName = function(idx){
      var name = M.key || SUBS[idx]; if (!name) { MSGS[key] = MSGS[key] || []; refresh(); return; }
      var off = r.ref.collection(name).limit(500).onSnapshot(function(qs){
        if (qs.empty && !M.key && idx < SUBS.length - 1) { off(); tryName(idx + 1); return; }
        M.key = name; var L = [], i = 0; qs.forEach(function(doc){ var n = norm(doc.data(), r, i++); n.id = doc.id; L.push(n); }); L.sort(byTime);
        MSGS[key] = L; refresh(); nav();
      }, function(err){ console.warn('[app-chats] sub', name, err && err.code); MSGS[key] = MSGS[key] || []; refresh(); });
      subOff = off;
    };
    tryName(0);
  }

  /* ---------- الرد بنفس شكل رسائل الإدارة ---------- */
  function template(r){
    var L = MSGS[r.col + '/' + r.id] || [], i, m;
    for (i = L.length - 1; i >= 0; i--) if (L[i].admin) return {raw: L[i].raw, guessed: false};
    /* بحث في محادثات أخرى من نفس النوع */
    var all = DATA[r.col] || [];
    for (var j = 0; j < all.length; j++) { var X = MSGS[r.col + '/' + all[j].id] || []; for (i = X.length - 1; i >= 0; i--) if (X[i].admin) return {raw: X[i].raw, guessed: false}; }
    m = L.length ? L[L.length - 1].raw : null;
    if (!m) return {raw: {text: '', timestamp: null, senderId: 'admin', senderName: 'الإدارة', isAdmin: true}, guessed: true};
    var o = {}; Object.keys(m).forEach(function(k){ o[k] = m[k]; });
    ['isAdmin', 'fromAdmin', 'isFromAdmin', 'sentByAdmin', 'byAdmin'].forEach(function(k){ if (k in o) o[k] = true; });
    ['isUser', 'fromUser', 'isDriver', 'fromDriver', 'isMe', 'isCustomer'].forEach(function(k){ if (k in o) o[k] = false; });
    ['senderType', 'role', 'senderRole', 'from', 'sender', 'by', 'author'].forEach(function(k){ if (typeof o[k] === 'string') o[k] = 'admin'; });
    ['senderId', 'senderUid', 'fromId'].forEach(function(k){ if (k in o) o[k] = 'admin'; });
    ['senderName', 'name', 'userName'].forEach(function(k){ if (k in o) o[k] = 'الإدارة'; });
    if (!keyOf(o, ['isAdmin', 'senderType', 'role', 'senderId', 'sender', 'from'])) o.isAdmin = true;
    return {raw: o, guessed: true};
  }
  function buildMsg(r, text, inArray){
    var T = template(r), o = {}, FV = firebase.firestore.FieldValue, now = inArray ? firebase.firestore.Timestamp.now() : FV.serverTimestamp();
    var hasText = false, hasTime = false;
    Object.keys(T.raw).forEach(function(k){ var v = T.raw[k];
      if (F.text.indexOf(k) > -1) { o[k] = text; hasText = true; }
      else if (F.time.indexOf(k) > -1) { o[k] = typeof v === 'number' ? Date.now() : typeof v === 'string' ? new Date().toISOString() : now; hasTime = true; }
      else if (F.file.indexOf(k) > -1 || /^(attachments?|images?|files?)$/i.test(k)) o[k] = Array.isArray(v) ? [] : null;
      else if (/^(is)?(read|seen)$|^isRead|^read(By)?User|^seenBy/i.test(k)) o[k] = typeof v === 'boolean' ? false : Array.isArray(v) ? [] : v;
      else if (k === 'id' || k === 'messageId') o[k] = 'admin_' + Date.now().toString(36);
      else o[k] = v; });
    if (!hasText) o.text = text; if (!hasTime) o.timestamp = now;
    o.sentFrom = 'لوحة التحكم';
    var u = window.zulfiWho ? window.zulfiWho() : null;
    if (u) { o.sentByName = u.n || ''; o.sentByRole = u.r || ''; if (typeof o.senderName === 'string' && u.n) o.senderName = u.n; }
    return {msg: o, guessed: T.guessed};
  }
  function send(r, text){
    var key = r.col + '/' + r.id, M = MODE[key] || {}, FV = firebase.firestore.FieldValue, b = buildMsg(r, text, M.kind === 'array'), p;
    if (M.kind === 'array') { var u = {}; u[M.key] = FV.arrayUnion(b.msg); p = r.ref.update(u); }
    else p = r.ref.collection(M.key || 'messages').add(b.msg);
    var up = {}, k;
    k = keyOf(r.d, F.last); if (k && typeof r.d[k] === 'string') up[k] = text;
    ['lastMessageTime', 'lastMessageAt', 'lastTime', 'updatedAt', 'lastUpdated', 'lastMessageTimestamp'].forEach(function(x){ if (x in r.d) up[x] = typeof r.d[x] === 'number' ? Date.now() : FV.serverTimestamp(); });
    ['lastSender', 'lastSenderId', 'lastSenderType', 'lastMessageSender'].forEach(function(x){ if (typeof r.d[x] === 'string') up[x] = 'admin'; });
    F.userUnread.forEach(function(x){ if (typeof r.d[x] === 'number') up[x] = FV.increment(1); });
    ['isReadByUser', 'readByUser', 'userRead', 'isReadByDriver', 'driverRead'].forEach(function(x){ if (typeof r.d[x] === 'boolean') up[x] = false; });
    return p.then(function(){ if (Object.keys(up).length) return r.ref.update(up).catch(function(){}); }).then(function(){ return b.guessed; });
  }
  function markRead(r){
    var key = r.col + '/' + r.id; SEEN[key] = Date.now(); keepSeen();
    var up = {}; F.adminUnread.forEach(function(x){ if (typeof r.d[x] === 'number' && r.d[x] > 0) up[x] = 0; });
    ['isReadByAdmin', 'readByAdmin', 'adminRead'].forEach(function(x){ if (r.d[x] === false) up[x] = true; });
    if (Object.keys(up).length) r.ref.update(up).catch(function(e){ console.warn('[app-chats] read', e && e.code); });
  }

  /* ---------- دمج محادثات التطبيق داخل «مركز المحادثات» ---------- */
  var PFX = 'AP~';
  function tid(r){ return PFX + r.col + '~' + r.id; }
  function byTid(id){ if (!id || id.indexOf(PFX) !== 0) return null; var p = id.slice(PFX.length).split('~'); var col = p[0], did = p.slice(1).join('~');
    return (DATA[col] || []).filter(function(r){ return r.id === did; })[0] || null; }
  function title(r){ return txt(pick(r.d, F.name)) || txt(pick(r.d, F.phone)) || ('مستخدم التطبيق ' + r.id.slice(0, 5)); }
  function atT(v){ var d = toDate(v); if (!d) return ''; var now = new Date(); var t = (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (d.getHours() < 12 ? 'ص' : 'م');
    return d.toDateString() === now.toDateString() ? t : d.toISOString().slice(5, 10).replace('-', '/') + ' ' + t; }
  function thread(r){
    var L = MSGS[r.col + '/' + r.id], msgs;
    if (L) msgs = L.map(function(m){ return {me: m.admin ? 1 : 0, byName: m.admin ? (m.raw.sentByName || '') : '', byRole: m.admin ? (m.raw.sentByRole || '') : '', t: m.text, at: atT(m.t), atts: m.file ? [{id: 'A' + m.i, name: 'صورة من التطبيق', type: 'image', data: m.file}] : []}; });
    else { var lt = txt(pick(r.d, F.last)); msgs = lt ? [{me: 0, t: lt, at: atT(pick(r.d, F.lastT)), atts: []}] : []; }
    var info = [txt(pick(r.d, F.phone)), txt(pick(r.d, F.mosque))].filter(Boolean).join(' · ');
    return {id: tid(r), _app: 1, req: '', with: title(r), kind: (r.col === 'driverAdminChats' ? 'مندوب (من التطبيق)' : 'مستخدم التطبيق') + (info ? ' · ' + info : ''), unread: unread(r) ? (typeof pick(r.d, F.adminUnread) === 'number' ? pick(r.d, F.adminUnread) : 1) : 0, msgs: msgs};
  }
  var lastSig = '';
  function inject(force){
    if (!Array.isArray(S.chats)) return false;
    var A = []; CH.forEach(function(c){ (DATA[c.k] || []).forEach(function(r){ A.push(r); }); });
    A.sort(function(a, b){ return lastMs(b) - lastMs(a); });
    var T = A.map(thread), sig = JSON.stringify(T);
    var has = S.chats.some(function(c){ return c && c._app; });
    if (!force && sig === lastSig && has === (T.length > 0) && S.chats.filter(function(c){ return c && c._app; }).length === T.length) return false;
    lastSig = sig;
    var keep = S.chats.filter(function(c){ return !(c && c._app); });
    S.chats.length = 0; Array.prototype.push.apply(S.chats, T.concat(keep));
    return true;
  }
  function openCur(){ var r = byTid(UI.chat); if (r) { openSub(r); if (UI.view === 'chats' && document.visibilityState !== 'hidden') markRead(r); } }

  var rT = null;
  function refresh(){
    clearTimeout(rT);
    rT = setTimeout(function(){
      var changed = inject(); openCur(); nav();
      if (!changed || UI.view !== 'chats') return;
      var a = document.activeElement;
      if (a && a.id === 'msgIn') { var v = a.value; try { render(); } catch(e){} var j = document.getElementById('msgIn'); if (j) { j.value = v; j.focus(); } }
      else if (!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest && a.closest('#view'))) { try { render(); } catch(e){} }
      try { scrollMsgs(); } catch(e){}
    }, 150);
  }
  function nav(){ try { renderNav(); } catch(e){} }
  /* إذا استُبدلت قائمة المحادثات من المزامنة تُعاد محادثات التطبيق إليها */
  setInterval(function(){ if (!started || !Array.isArray(S.chats)) return; var n = 0; CH.forEach(function(c){ n += (DATA[c.k] || []).length; });
    if (S.chats.filter(function(c){ return c && c._app; }).length !== n) { lastSig = ''; refresh(); } }, 1500);

  /* فتح محادثة من التطبيق */
  document.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('[data-act="chat"]'); if (!b || !b.dataset.id || b.dataset.id.indexOf(PFX) !== 0) return;
    setTimeout(function(){ openCur(); }, 0); }, true);
  /* الرد من «مركز المحادثات» يُرسل إلى التطبيق */
  document.addEventListener('submit', function(e){
    if (!e.target || e.target.id !== 'composer' || !UI.chat || String(UI.chat).indexOf(PFX) !== 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var r = byTid(UI.chat), i = document.getElementById('msgIn'), v = (i && i.value || '').trim();
    if (!r) { toast('المحادثة غير موجودة في التطبيق', 'error'); return; }
    var atts = (TMP.chat || []).filter(function(a){ return a && /^https:\/\//.test(a.data || ''); });
    if (atts.length) v = (v ? v + '\n' : '') + atts.map(function(a){ return a.data; }).join('\n');
    TMP.chat = [];
    if (!v) return;
    var M = MODE[r.col + '/' + r.id] || {}; if (M.kind === 'sub' && !MSGS[r.col + '/' + r.id]) { openSub(r); toast('انتظر تحميل الرسائل ثم أعد الإرسال', 'hourglass_top'); return; }
    i.value = ''; i.disabled = true;
    send(r, v).then(function(guessed){ i.disabled = false; try { i.focus(); } catch(x){} if (guessed) toast('أُرسل الرد. هذه أول رسالة من الإدارة في هذه المحادثات: تأكد من ظهورها في التطبيق', 'info'); })
      .catch(function(err){ i.disabled = false; i.value = v; console.warn('[app-chats] send', err);
        toast(/permission/i.test(String(err && (err.code || err.message))) ? 'القاعدة ترفض إرسال الرد: راجع قواعد الأمان' : 'تعذر إرسال الرد إلى التطبيق', 'error'); });
  }, true);

  /* نسخ هيكل المحادثات (للمطور) */
  window.zulfiChatSchema = function(){
    var out = {};
    CH.forEach(function(c){ var L = DATA[c.k] || []; if (!L.length) { out[c.k] = STATE[c.k] || 'لم يُحمّل'; return; }
      var s = {}; L.slice(0, 5).forEach(function(r){ Object.keys(r.d).forEach(function(k){ var v = r.d[k]; if (!s[k]) s[k] = v == null ? 'null' : typeof v.toDate === 'function' ? 'Timestamp' : Array.isArray(v) ? 'Array(' + v.length + ')' : typeof v === 'object' ? 'Object{' + Object.keys(v).slice(0, 8).join(',') + '}' : typeof v; }); });
      var ms2 = {}, mode = null;
      L.slice(0, 20).forEach(function(r){ var K = MODE[c.k + '/' + r.id]; if (K && !mode) mode = K; (MSGS[c.k + '/' + r.id] || []).slice(-3).forEach(function(m){ Object.keys(m.raw).forEach(function(k){ var v = m.raw[k]; if (!ms2[k]) ms2[k] = v == null ? 'null' : typeof v.toDate === 'function' ? 'Timestamp' : typeof v === 'object' ? 'Object' : typeof v + (typeof v === 'boolean' || (typeof v === 'string' && v.length < 25) ? '=' + v : ''); }); }); });
      out[c.k] = {count: L.length, fields: s, messages: mode, messageFields: ms2}; });
    var str = JSON.stringify(out, null, 1);
    modal({title: 'هيكل محادثات التطبيق', icon: 'data_object', wide: 1, ok: 'إغلاق', onOk: function(){}, body: '<p class="small muted">انسخ النص وأرسله للمطور.</p><textarea class="inp" style="height:50vh;direction:ltr" readonly>' + esc(str) + '</textarea>'});
  };
  /* زر نصي في صفحة «بيانات التطبيق (مباشر)» بدل مركز المحادثات */
  if (VIEWS.app_live) { var _vl = VIEWS.app_live; VIEWS.app_live = function(){ var h = _vl.apply(this, arguments);
    return h.replace('<button class="btn" data-act="appSchema">', '<button class="btn" onclick="zulfiChatSchema()">' + ic('forum') + 'هيكل المحادثات</button><button class="btn" data-act="appSchema">'); }; }

  var w = setInterval(function(){ if (!ready()) return; clearInterval(w); start(); }, 1000);
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') openCur(); });
})();
