/* =====================================================================
   حفظ الصور في Cloudinary بدل حفظها داخل قاعدة البيانات
   - يقرأ الإعدادات من window.ZULFI_CLOUDINARY (في firebase-config.js)
   - كل صورة تُرفع (مرفقات الطلبات، المراحل، التحديثات، المحادثات...) تُحفظ في Cloudinary
     ويُحفظ رابطها فقط في القاعدة
   - إذا لم تُضبط الإعدادات أو فشل الرفع: تبقى الصورة محفوظة كما كانت (داخل البيانات)
   ===================================================================== */
(function(){
  'use strict';
  var C = window.ZULFI_CLOUDINARY || {};
  var ON = !!(C.cloudName && C.uploadPreset);
  var HOST = 'res.cloudinary.com';

  /* الصور القادمة من Cloudinary تُحمَّل بإذن CORS حتى يمكن رسمها في ملفات PDF والتقارير */
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set) Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function(v){ if (typeof v === 'string' && v.indexOf(HOST) > -1 && !this.crossOrigin) this.crossOrigin = 'anonymous'; d.set.call(this, v); }
    });
  } catch(e){}

  if (!ON) { console.info('[cloudinary] غير مفعّل: أضف cloudName و uploadPreset في firebase-config.js'); return; }
  if (typeof readFile !== 'function') return;

  var APP = (typeof IS_PORTAL !== 'undefined' && IS_PORTAL) ? 'portal' : 'admin';
  var busy = 0;
  /* تصغير الصور الكبيرة قبل الرفع (حد الحساب المجاني 10MB) */
  function shrink(dataUrl){
    if (dataUrl.length < 1500000) return Promise.resolve(dataUrl);
    return new Promise(function(res){ var im = new Image(); im.onload = function(){ try {
        var k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.85)); } catch(e){ res(dataUrl); } };
      im.onerror = function(){ res(dataUrl); }; im.src = dataUrl; });
  }
  function post(dataUrl, name, extra, rtype){
    var fd = new FormData();
    fd.append('file', dataUrl);
    fd.append('upload_preset', C.uploadPreset);
    if (extra) { fd.append('folder', (C.folder || 'zulfi') + '/' + APP); if (name) fd.append('context', 'caption=' + String(name).replace(/[|=]/g, ' ').slice(0, 120)); }
    return fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(C.cloudName) + '/' + (rtype || 'image') + '/upload', { method: 'POST', body: fd })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok || !j.secure_url) { var e = new Error((j.error && j.error.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; }); });
  }
  function upload(dataUrl, name){
    var img = dataUrl.indexOf('data:image') === 0, rt = img ? 'image' : 'auto';
    return (img ? shrink(dataUrl) : Promise.resolve(dataUrl)).then(function(d){
      return post(d, name, true, rt).catch(function(e){ if (e.status === 400 && !/preset/i.test(e.message)) return post(d, name, false, rt); throw e; });
    });
  }
  /* رفع أي مرفق (صورة أو PDF أو ملف) وإرجاعه برابط https */
  window.zulfiCloudUpload = function(o){
    if (!o || typeof o.data !== 'string' || o.data.indexOf('data:') !== 0) return Promise.resolve(o);
    return upload(o.data, o.name).then(function(j){ o.data = j.secure_url; o.cloud = {id: j.public_id, bytes: j.bytes}; return o; });
  };
  window.zulfiCloudWhy = function(e){ return why(e); };
  /* شرح سبب الفشل بالعربي */
  function why(e){ var m = String(e && e.message || e || '');
    if (/preset not found|Upload preset.*not found/i.test(m)) return 'لا يوجد في Cloudinary إعداد رفع باسم «' + C.uploadPreset + '». أنشئه من Settings ← Upload ← Upload presets';
    if (/whitelisted|unsigned/i.test(m)) return 'إعداد الرفع «' + C.uploadPreset + '» ليس من نوع Unsigned. غيّر Signing Mode إلى Unsigned';
    if (/cloud_name|Invalid cloud|unknown api_key|401|404/i.test(m)) return 'اسم الحساب في Cloudinary غير صحيح (cloudName)';
    if (/File size too large|too large/i.test(m)) return 'حجم الصورة أكبر من المسموح في Cloudinary';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'تعذر الاتصال بـ Cloudinary (تحقق من الإنترنت)';
    return m; }
  window.zulfiCloudTest = function(){ var gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=';
    return post(gif, 'test', true).then(function(j){ toast('Cloudinary يعمل: ' + j.secure_url.slice(0, 60), 'cloud_done'); return j; }, function(e){ toast('Cloudinary: ' + why(e), 'cloud_off'); throw e; }); };

  var _readFile = readFile;
  readFile = function(f){
    return _readFile.apply(this, arguments).then(function(o){
      if (!o || typeof o.data !== 'string' || o.data.indexOf('data:') !== 0) return o;
      busy++; if (busy === 1) try { toast(o.type === 'image' ? 'جاري رفع الصور إلى Cloudinary…' : 'جاري رفع الملف إلى Cloudinary…', 'cloud_upload'); } catch(e){}
      return upload(o.data, o.name).then(function(j){
        o.data = j.secure_url; o.cloud = { id: j.public_id, w: j.width, h: j.height, bytes: j.bytes };
        return o;
      }).catch(function(err){
        console.warn('[cloudinary] تعذر الرفع، حُفظت الصورة محلياً', err);
        try { toast('تعذر رفع ' + (o.type === 'image' ? 'الصورة' : 'الملف') + ' إلى Cloudinary (' + why(err) + ')، حُفظ داخل النظام', 'cloud_off'); } catch(e){}
        return o;
      }).then(function(o2){ busy--; return o2; });
    });
  };

  /* رابط مصغّر للعرض السريع (اختياري للاستخدام في الصفحات) */
  window.cldThumb = function(url, w){
    if (typeof url !== 'string' || url.indexOf(HOST) < 0) return url;
    return url.replace('/upload/', '/upload/c_limit,w_' + (w || 600) + ',q_auto,f_auto/');
  };
})();
