# المنظومة الرقمية · جمعية المساجد بالزلفي

لوحة التحكم وبوابة المناديب والمقاولين، مربوطتان بقاعدة بيانات Firebase واحدة، وتُستضافان على GitHub Pages.

## الملفات

| الملف | الوظيفة |
|---|---|
| `index.html` | صفحة البداية: اختيار لوحة التحكم أو البوابة |
| `admin.html` | لوحة التحكم |
| `portal.html` | بوابة المناديب والمقاولين |
| `style.css` | ملف التنسيق الموحد للواجهتين |
| `firebase-config.js` | إعدادات مشروع Firebase (تُعبأ مرة واحدة) |
| `sync.js` | ربط الواجهتين بقاعدة البيانات والتحديث اللحظي |
| `firestore.rules` / `database.rules.json` | قواعد الأمان المقترحة |

## خطوات التشغيل

### 1) في Firebase Console
1. **Build ← Firestore Database ← Create database** (أو Realtime Database إن كنتم تستخدمونها).
2. **Build ← Authentication ← Sign-in method ← Anonymous ← Enable**.
3. **Authentication ← Settings ← Authorized domains ← Add domain**: أضف `USERNAME.github.io` (اسم حسابكم في GitHub).
4. **Firestore ← Rules**: الصق محتوى `firestore.rules` ثم **Publish** (أو `database.rules.json` في Realtime Database).
5. **Project settings ← General ← Your apps**: إن لم يوجد تطبيق ويب أضف واحداً (`</>`)، ثم انسخ قيم `firebaseConfig`.

### 2) في `firebase-config.js`
املأ: `authDomain` و`projectId` و`storageBucket` و`messagingSenderId` و`appId`.
- Cloud Firestore: اترك `databaseURL` فارغاً.
- Realtime Database: ضع رابطها في `databaseURL`.

### 3) في GitHub
1. أنشئ مستودعاً جديداً وارفع جميع الملفات كما هي (في الجذر).
2. **Settings ← Pages ← Source: Deploy from a branch ← main / (root) ← Save**.
3. بعد دقيقة يعمل الموقع على: `https://USERNAME.github.io/REPO/`.

## الدخول
- حساب مدير النظام في كل الخانات، وكلمة المرور **1447**. غيّرها بعد أول دخول.
- في أسفل يسار الشاشة مؤشر الاتصال: أخضر = متصل ومحفوظ في القاعدة.

## ملاحظات مهمة
- مفتاح `apiKey` يظهر في الملفات، وهذا طبيعي في Firebase. الحماية تأتي من قواعد الأمان وتسجيل الدخول.
- القواعد المقترحة تمنع غير المسجّلين، لكن الدخول المجهول متاح لكل من يفتح الموقع؛ لذلك هذه النسخة **للتجربة**. للتشغيل الرسمي: حسابات Firebase Auth لكل مستخدم، وقواعد حسب الدور، كما في دليل المبرمج.
- كل قسم من البيانات (الطلبات، المناديب، الكراسات…) يُحفظ في سجل مستقل ضمن `zulfi_state`، وعند تعديل شخصين القسم نفسه في اللحظة نفسها يُعتمد آخر حفظ.
- الصور والمرفقات تُحفظ داخل البيانات نفسها؛ للاستخدام الكثيف يُنصح بنقلها إلى Firebase Storage لاحقاً.
