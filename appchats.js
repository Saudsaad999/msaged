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

  /* ---------- الصفحة ---------- */
  function title(r){ return txt(pick(r.d, F.name)) || txt(pick(r.d, F.phone)) || ('محادثة ' + r.id.slice(0, 6)); }
  function cur(){ var L = DATA[UI.acCol || 'conversations'] || []; return L.filter(function(r){ return r.id === UI.acId; })[0]; }
  function listHTML(){
    var col = UI.acCol || 'conversations', L = DATA[col] || [], q = (UI.acQ || '').trim();
    if (q) L = L.filter(function(r){ return (title(r) + JSON.stringify(r.d)).indexOf(q) > -1; });
    if (STATE[col] === 'denied') return '<div class="empty small">' + ic('lock') + ' القاعدة ترفض قراءة «' + esc(col) + '»</div>';
    if (STATE[col] !== 'ok') return '<div class="empty small">' + ic('hourglass_top') + ' جاري التحميل…</div>';
    if (!L.length) return '<div class="empty small">لا توجد محادثات.</div>';
    return L.map(function(r){ var u = unread(r), on = r.id === UI.acId;
      return '<button class="ac-item' + (on ? ' on' : '') + '" data-act="acOpen" data-id="' + esc(r.id) + '"><span class="ac-av">' + ic('person') + '</span><span class="ac-tx"><b>' + esc(title(r)) + '</b>' +
        '<span class="tiny muted">' + esc(lastText(r).slice(0, 60)) + '</span></span><span class="ac-meta"><span class="tiny muted num">' + esc(fmtT(lastMs(r))) + '</span>' + (u ? '<span class="badge num">' + (u > 1 ? u : '•') + '</span>' : '') + '</span></button>'; }).join('');
  }
  function msgsHTML(r){
    if (!r) return '<div class="empty small">' + ic('forum') + ' اختر محادثة من القائمة</div>';
    var L = MSGS[r.col + '/' + r.id];
    if (!L) return '<div class="empty small">' + ic('hourglass_top') + ' جاري تحميل الرسائل…</div>';
    if (!L.length) return '<div class="empty small">لا توجد رسائل في هذه المحادثة بعد.</div>';
    return L.map(function(m){ return '<div class="ac-msg ' + (m.admin ? 'me' : 'them') + '">' +
      (m.file ? '<a href="' + esc(m.file) + '" target="_blank" rel="noopener"><img src="' + esc(m.file) + '" alt="مرفق" loading="lazy"></a>' : '') +
      (m.text ? '<div>' + esc(m.text) + '</div>' : '') + '<span class="tiny">' + esc(fmtT(m.t)) + '</span></div>'; }).join('');
  }
  VIEWS.app_chats = function(){
    start(); var col = UI.acCol || 'conversations', r = cur();
    if (r) { openSub(r); }
    var tabs = CH.map(function(c){ var n = (DATA[c.k] || []).filter(unread).length;
      return '<button class="chip ' + (c.k === col ? 'on' : '') + '" data-act="acCol" data-id="' + c.k + '">' + ic(c.i) + ' ' + esc(c.t) + ' (' + (STATE[c.k] === 'ok' ? (DATA[c.k] || []).length : '…') + ')' + (n ? ' <span class="badge num">' + n + '</span>' : '') + '</button>'; }).join('');
    var headH = head('تطبيق المساجد', 'محادثات التطبيق', 'رسائل المستخدمين والمناديب من التطبيق تصل هنا لحظياً، وردّك يصلهم في التطبيق مباشرة.', '<button class="btn" data-act="acSchema">' + ic('data_object') + 'نسخ هيكل المحادثات</button>');
    if (!window.firebase || !firebase.apps || !firebase.apps.length) return headH + '<div class="card empty">' + ic('cloud_off') + ' النظام غير متصل بقاعدة البيانات.</div>';
    var pane = r ? '<div class="ac-top"><button class="btn sm ghost ac-back" data-act="acBack">' + ic('arrow_forward') + '</button><div><b>' + esc(title(r)) + '</b><div class="tiny muted num">' +
        esc([txt(pick(r.d, F.phone)), txt(pick(r.d, F.mosque))].filter(Boolean).join(' · ')) + '</div></div></div>' +
        '<div class="ac-msgs" id="acMsgs">' + msgsHTML(r) + '</div>' +
        '<form class="ac-form" id="acForm"><input class="inp" id="acIn" placeholder="اكتب ردك…" autocomplete="off"><button class="btn pri">' + ic('send') + 'إرسال</button></form>'
      : '<div class="ac-msgs" id="acMsgs">' + msgsHTML(null) + '</div>';
    return headH + '<div class="chips">' + tabs + '</div>' +
      '<div class="ac-wrap card' + (r ? ' has-open' : '') + '"><div class="ac-side"><input class="inp" id="acQ" placeholder="ابحث بالاسم أو الرقم…" value="' + esc(UI.acQ || '') + '"><div class="ac-list" id="acList">' + listHTML() + '</div></div>' +
      '<div class="ac-pane">' + pane + '</div></div>';
  };
  function scrollEnd(){ var m = document.getElementById('acMsgs'); if (m) m.scrollTop = m.scrollHeight; }
  var rT = null;
  function refresh(){
    if (UI.view !== 'app_chats') return; clearTimeout(rT);
    rT = setTimeout(function(){
      var a = document.activeElement, r = cur();
      if (a && (a.id === 'acIn' || a.id === 'acQ')) {
        var l = document.getElementById('acList'); if (l) l.innerHTML = listHTML();
        var m = document.getElementById('acMsgs'); if (m && r) { var end = m.scrollHeight - m.scrollTop - m.clientHeight < 80; m.innerHTML = msgsHTML(r); if (end) scrollEnd(); }
      } else { render(); scrollEnd(); }
      if (r && document.visibilityState !== 'hidden') markRead(r);
    }, 200);
  }
  function nav(){ try { renderNav(); } catch(e){} }

  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-act="acCol"],[data-act="acOpen"],[data-act="acBack"],[data-act="acSchema"],[data-act="acGo"]'); if (!t) return;
    e.stopImmediatePropagation(); var a = t.dataset.act;
    if (a === 'acGo') { go('app_chats'); return; }
    if (a === 'acCol') { UI.acCol = t.dataset.id; UI.acId = null; render(); }
    else if (a === 'acOpen') { UI.acId = t.dataset.id; var r = cur(); if (r) markRead(r); render(); scrollEnd(); var i = document.getElementById('acIn'); if (i && window.innerWidth > 900) i.focus(); nav(); }
    else if (a === 'acBack') { UI.acId = null; render(); }
    else if (a === 'acSchema') {
      var out = {};
      CH.forEach(function(c){ var L = DATA[c.k] || []; if (!L.length) { out[c.k] = STATE[c.k] || 'لم يُحمّل'; return; }
        var s = {}; L.slice(0, 5).forEach(function(r){ Object.keys(r.d).forEach(function(k){ var v = r.d[k]; if (!s[k]) s[k] = v == null ? 'null' : typeof v.toDate === 'function' ? 'Timestamp' : Array.isArray(v) ? 'Array(' + v.length + ')' : typeof v === 'object' ? 'Object{' + Object.keys(v).slice(0, 8).join(',') + '}' : typeof v; }); });
        var ms2 = {}, mode = null, ex = [];
        L.slice(0, 20).forEach(function(r){ var K = MODE[c.k + '/' + r.id]; if (K && !mode) mode = K; (MSGS[c.k + '/' + r.id] || []).slice(-3).forEach(function(m){ Object.keys(m.raw).forEach(function(k){ var v = m.raw[k]; if (!ms2[k]) ms2[k] = v == null ? 'null' : typeof v.toDate === 'function' ? 'Timestamp' : typeof v === 'object' ? 'Object' : typeof v + (typeof v === 'boolean' || (typeof v === 'string' && v.length < 25) ? '=' + v : ''); }); if (ex.length < 4) ex.push(m.admin ? 'admin' : 'user'); }); });
        out[c.k] = {count: L.length, fields: s, messages: mode, messageFields: ms2, detected: ex}; });
      var str = JSON.stringify(out, null, 1);
      (navigator.clipboard ? navigator.clipboard.writeText(str) : Promise.reject()).then(function(){ toast('نُسخ هيكل المحادثات، الصقه في المحادثة', 'content_copy'); })
        .catch(function(){ modal({title: 'هيكل المحادثات', icon: 'data_object', wide: 1, ok: 'إغلاق', onOk: function(){}, body: '<textarea class="inp" style="height:50vh;direction:ltr" readonly>' + esc(str) + '</textarea>'}); });
    }
  }, true);
  document.addEventListener('submit', function(e){
    if (!e.target || e.target.id !== 'acForm') return; e.preventDefault(); e.stopImmediatePropagation();
    var i = document.getElementById('acIn'), v = (i && i.value || '').trim(), r = cur(); if (!v || !r) return;
    var M = MODE[r.col + '/' + r.id] || {}; if (M.kind === 'sub' && !MSGS[r.col + '/' + r.id]) { toast('انتظر تحميل الرسائل', 'hourglass_top'); return; }
    i.value = ''; i.disabled = true;
    send(r, v).then(function(guessed){ i.disabled = false; i.focus(); if (guessed) toast('أُرسل الرد. هذه أول رسالة من الإدارة: تأكد من ظهورها في التطبيق', 'info'); })
      .catch(function(err){ i.disabled = false; i.value = v; console.warn('[app-chats] send', err);
        toast(/permission/i.test(String(err && (err.code || err.message))) ? 'القاعدة ترفض إرسال الرد: راجع قواعد الأمان' : 'تعذر إرسال الرد', 'error'); });
  }, true);
  document.addEventListener('input', function(e){ if (e.target.id === 'acQ') { UI.acQ = e.target.value; var l = document.getElementById('acList'); if (l) l.innerHTML = listHTML(); } });

  /* زر في صفحة محادثات النظام */
  if (VIEWS.chats) { var _vc = VIEWS.chats; VIEWS.chats = function(){ var h = _vc.apply(this, arguments); if (typeof STAFF !== 'undefined' && STAFF.user && typeof isBoard === 'function' && isBoard()) return h;
    var n = unreadAll();
    var bar = '<div class="card card-b row" style="justify-content:space-between;border-color:var(--gold-line,#C5A976);background:var(--gold-soft,#FBF8F1)"><span class="small">' + ic('smartphone') + ' <b>محادثات تطبيق المساجد</b> (المستخدمون والمناديب) في صفحة مستقلة' + (n ? ': <b class="num">' + n + '</b> محادثة جديدة' : '') + '</span><button class="btn sm pri" data-act="acGo">' + ic('forum') + 'فتح محادثات التطبيق</button></div>';
    var i = h.indexOf('</div>', h.indexOf('class="page-head')); if (h.indexOf('class="page-head') > -1 && i > -1) { var j = h.indexOf('</div>', i + 6); return h.slice(0, j + 6) + bar + h.slice(j + 6); } return bar + h; }; }

  /* القائمة الجانبية */
  var item = {k: 'app_chats', t: 'محادثات التطبيق', i: 'mark_unread_chat_alt', b: function(){ return unreadAll(); }};
  var placed = false;
  NAV_FULL.forEach(function(g){ if (placed) return; var ix = (g.items || []).findIndex(function(x){ return x.k === 'chats'; }); if (ix > -1) { g.items.splice(ix + 1, 0, item); placed = true; } });
  if (!placed) { var gi = NAV_FULL.findIndex(function(g){ return g.g === 'الطلبات والميدان'; }); if (gi > -1) NAV_FULL[gi].items.push(item); else NAV_FULL.splice(1, 0, {g: 'تطبيق المساجد', items: [item]}); }
  try { if (typeof applyNavPerms === 'function' && STAFF.user) applyNavPerms(); } catch(e){}

  /* التنسيق */
  var st = document.createElement('style');
  st.textContent = '.ac-wrap{display:flex;gap:0;padding:0;overflow:hidden;min-height:560px;height:calc(100vh - 260px)}' +
    '.ac-side{width:330px;flex:none;border-inline-end:1px solid var(--line,#D6DFE5);display:flex;flex-direction:column;gap:8px;padding:10px}' +
    '.ac-list{overflow:auto;flex:1;display:flex;flex-direction:column;gap:2px}' +
    '.ac-item{display:flex;align-items:center;gap:10px;width:100%;text-align:start;background:none;border:0;border-radius:8px;padding:10px;cursor:pointer;font:inherit;color:inherit}' +
    '.ac-item:hover{background:var(--bg-soft,#F5F7F9)}.ac-item.on{background:var(--gold-soft,#F3ECDD)}' +
    '.ac-av{width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--bg-soft,#EAF0F4);color:var(--pri,#1D5271)}' +
    '.ac-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.ac-tx b{font-size:.92rem}.ac-tx .tiny{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ac-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}' +
    '.ac-pane{flex:1;min-width:0;display:flex;flex-direction:column}' +
    '.ac-top{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line,#D6DFE5)}.ac-back{display:none}' +
    '.ac-msgs{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:var(--bg,#F5F7F9)}' +
    '.ac-msgs .empty{margin:auto}' +
    '.ac-msg{max-width:72%;padding:8px 12px;border-radius:12px;font-size:.92rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;display:flex;flex-direction:column;gap:4px}' +
    '.ac-msg.them{align-self:flex-start;background:var(--card,#fff);border:1px solid var(--line,#D6DFE5);color:var(--ink,#17384C)}' +
    '.ac-msg.me{align-self:flex-end;background:#1D5271;color:#fff}.ac-msg.me .tiny{color:#D5E2EA}.ac-msg .tiny{opacity:.85}' +
    '.ac-msg img{max-width:240px;max-height:240px;border-radius:8px;display:block}' +
    '.ac-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#D6DFE5)}.ac-form .inp{flex:1}' +
    '@media (max-width:900px){.ac-wrap{height:calc(100vh - 230px);min-height:460px}.ac-side{width:100%;border:0}.ac-wrap.has-open .ac-side{display:none}.ac-wrap:not(.has-open) .ac-pane{display:none}.ac-back{display:inline-flex}.ac-msg{max-width:86%}}';
  document.head.appendChild(st);

  var w = setInterval(function(){ if (!ready()) return; clearInterval(w); start(); }, 1000);
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') { var r = cur(); if (r && UI.view === 'app_chats') markRead(r); } });
})();
