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
  function upload(dataUrl, name){
    var fd = new FormData();
    fd.append('file', dataUrl);
    fd.append('upload_preset', C.uploadPreset);
    fd.append('folder', (C.folder || 'zulfi') + '/' + APP);
    if (name) fd.append('context', 'caption=' + String(name).replace(/[|=]/g, ' ').slice(0, 120));
    return fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(C.cloudName) + '/image/upload', { method: 'POST', body: fd })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.secure_url) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; }); });
  }

  var _readFile = readFile;
  readFile = function(f){
    return _readFile.apply(this, arguments).then(function(o){
      if (!o || o.type !== 'image' || typeof o.data !== 'string' || o.data.indexOf('data:image') !== 0) return o;
      busy++; if (busy === 1) try { toast('جاري رفع الصور إلى Cloudinary…', 'cloud_upload'); } catch(e){}
      return upload(o.data, o.name).then(function(j){
        o.data = j.secure_url; o.cloud = { id: j.public_id, w: j.width, h: j.height, bytes: j.bytes };
        return o;
      }).catch(function(err){
        console.warn('[cloudinary] تعذر الرفع، حُفظت الصورة محلياً', err);
        try { toast('تعذر رفع الصورة إلى Cloudinary، حُفظت داخل النظام', 'cloud_off'); } catch(e){}
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
