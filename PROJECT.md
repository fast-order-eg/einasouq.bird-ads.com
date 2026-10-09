# 🚀 توثيق مشروع عين السوق (AdScope Intelligence)

> **المسار المحلي:** `E:\programing\flutter project\einasouq.bird-ads.com`  
> **الدومين الحي:** `https://einasouq.bird-ads.com`  
> **مستودع GitHub:** `https://github.com/fast-order-eg/einasouq.bird-ads.com.git` (فرع `main`)  
> **السيرفر الحي:** `my-cyberpanel` (IP: `72.60.188.135`)  

---

## 📌 1. نظرة عامة على المشروع (Project Overview)
**AdScope Intelligence** هو نظام سحابي متطور مخصص لمتابعة وتحليل الحملات الإعلانية على منصات ميتا (Meta Ads Manager)، استكشاف إعلانات المنافسين (Ad Library)، توليد تحليلات استراتيجية عميقة عبر الذكاء الاصطناعي (Google Vertex AI - Gemini 2.5 Pro)، وتوفير **API خارجي فائق السرعة والدقة** لربط منصات المتاجر الإلكترونية (مثل FastOrder) وأنظمة الـ CRM وبوتات الواتساب بحملات الإعلانات مباشرة.

---

## 🛠️ 2. المعمارية وحزمة التقنيات (Tech Stack)
- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript.
- **Styling & UI:** Tailwind CSS + Lucide Icons + خط عربي أنيق (Cairo) مع دعم كامل لاتجاه RTL.
- **Database & ORM:** Prisma ORM مع قاعدة بيانات MySQL على السيرفر المحلي والحي.
- **AI Engine:** Google Cloud Vertex AI (Gemini 2.5 Pro للتحليل العميق، و Gemini 2.5 Flash للاستخراج السريع).
  - ملف الحساب الخدمي: `E:/programing/flutter project/bot.bird-ads.com/project-c1442437-41e2-480c-86d-0935778ac612.json`
- **Social Integration:** Meta Graph API v21.0 مع دعم كامل لنافذة الإسناد والحسابات المدارة ومكتبة الإعلانات.
- **Production Server:** CyberPanel / OpenLiteSpeed كـ Reverse Proxy إلى Node.js عبر PM2 على منفذ `3005`.

---

## 🔑 3. متغيرات البيئة الأساسية (`.env`)
```env
# قاعدة البيانات
DATABASE_URL="mysql://root:password@localhost:3306/einasouq_db"

# توكن ميتا Graph API (حساب مدير الإعلانات)
META_USER_TOKEN="EAAL..."

# مفتاح API الشركاء والتجار (FastOrder / CRM / WhatsApp Bot)
MERCHANT_API_KEY="fastorder_merchant_secure_api_key_2026"

# الذكاء الاصطناعي ومصادقة النظام
GOOGLE_APPLICATION_CREDENTIALS="E:/programing/flutter project/bot.bird-ads.com/project-c1442437-41e2-480c-86d-0935778ac612.json"
GCP_PROJECT_ID="project-c1442437-41e2-480c-86d-0935778ac612"
GCP_LOCATION="us-central1"
JWT_SECRET="adscope_super_secure_jwt_secret_2026"
```

---

## 🌐 4. واجهة برمجة التطبيقات للشركاء والبوتات (Merchant & CRM Partner API)

تم بناء Endpoint احترافي موحد لخدمة المتاجر (FastOrder) وبوتات الذكاء الاصطناعي والـ CRM:

### المسار (Endpoint):
- **الرابط:** `POST https://einasouq.bird-ads.com/api/v1/merchant/campaigns-summary` (أو `GET` بنفس المعايير).
- **الأمان والـ Middleware:** معفى تماماً من مصادقة الكوكيز في `src/middleware.ts`، ومؤمن عبر Header:
  ```http
  Content-Type: application/json
  x-api-key: fastorder_merchant_secure_api_key_2026
  ```

### المدخلات المدعومة (Request Payload):
1. **الاستعلام بحملات معينة (`campaign_ids`):**
   ```json
   {
     "campaign_ids": ["120252097024640334", "120251910566260334"],
     "date_preset": "last_7d",
     "force_refresh": false
   }
   ```
2. **الاستعلام برقم الحساب الإعلاني بالكامل (`account_id`):**
   (يجلب تلقائياً الحملات النشطة للحساب ويحللها):
   ```json
   {
     "account_id": "974788257381751",
     "status_filter": "ACTIVE",
     "search": "حبيبة",
     "date_preset": "today",
     "force_refresh": true
   }
   ```
   - `status_filter`: الافتراضي `ACTIVE` (النشطة فقط)، أو `ALL` لجلب الكل، أو `PAUSED`.
   - `search`: بحث بالاسم لفلترة حملات عميل أو منتج معين داخل الحساب.
   - `date_preset`: (`today`, `yesterday`, `last_3d`, `last_7d`, `last_14d`, `last_30d`, `this_month`, `last_month`, `maximum`).

### مزايا الدقة والمطابقة (Meta Ads Manager Match):
1. **تصحيح نوع النتائج وحساب الـ CPA تلقائياً:**
   - حملات الرسائل والواتساب (`OUTCOME_ENGAGEMENT` / `MESSAGES`): ترجع `result_type: "messages"` و `result_label: "رسائل"` وتحسب CPA لكل رسالة.
   - حملات مبيعات المتجر (`OUTCOME_SALES` / البكسل): ترجع `result_type: "purchase"` و `result_label: "طلبات شراء (متجر)"` وتحسب CPA لكل طلب شراء.
2. **تاريخ ووقت الانتهاء والبدء (`start_time` و `stop_time`):**
   - بصيغة ISO8601، ويجلب تاريخ الانتهاء من الحملة أو الـ Adset أو `null` إذا كانت مستمرة.
3. **نافذة الإسناد:**
   - تفعيل `use_account_attribution_setting(true)` و `action_attribution_windows: ['7d_click', '1d_view']`.
4. **المنطقة الزمنية:**
   - تعتمد توقيت الحساب الإعلاني (`Africa/Cairo` +03:00).
5. **الهيكل الهرمي وروابط المنشورات:**
   - كل حملة `campaign` تحتوي على `adsets`، وبداخل كل `adset` مصفوفة إعلاناتها `ads`.
   - كل إعلان يحتوي على `creative.post_url` (رابط منشور فيسبوك أو إنستغرام الفعلي القابل للنقر)، و `preview_url`، و `image_url`، والمقاييس المالية المنفصلة.

---

## 🔄 5. خادم الإنتاج ونظام النشر السلس (Zero Downtime Deployment)

### تفاصيل السيرفر:
- **المضيف في SSH Config:** `my-cyberpanel`
- **عنوان IP:** `72.60.188.135`
- **المستخدم:** `root`
- **مسار المشروع على السيرفر:** `/home/bird-ads.com/einasouq.bird-ads.com`
- **إدارة العمليات:** PM2 Process ID `5` (الاسم: `einasouq-app`) على المنفذ `3005`.

### خطوات النشر التلقائي والسلس (Zero Downtime):
لأي تعديل برمجي يتم تنفيذه في الجلسات، يتم تطبيق الأوامر التالية بدون أي توقف للخدمة:

1. **محلياً (Local):**
   ```powershell
   git add .
   git commit -m "feat/fix: وصف التعديل"
   git push origin main
   ```

2. **على السيرفر الحي (Remote via SSH):**
   ```bash
   ssh my-cyberpanel "cd /home/bird-ads.com/einasouq.bird-ads.com && git pull origin main && npm run build && pm2 reload einasouq-app --update-env"
   ```
   > 💡 **ملاحظة:** يتم استخدام `pm2 reload einasouq-app` بدلاً من `restart` لإعادة التحميل بدون أي ثانية توقف (Zero Downtime)؛ حيث تظل العملية القديمة تستقبل الطلبات حتى تجهز النسخة الجديدة وتستلم الـ Requests بسلاسة.

3. **التحقق من حالة التطبيق واللوجز:**
   ```bash
   ssh my-cyberpanel "pm2 show einasouq-app"
   ssh my-cyberpanel "curl -s -o /dev/null -w '%{http_code}' http://localhost:3005/api/diagnostics"
   ```

---

## 🧠 6. قواعد الذكاء الاصطناعي وإدارة البيانات

1. **عزل تحليلات الحملات (AI Prompt Isolation):**
   - تم تجريد برومبت Vertex AI في `src/lib/vertex.ts` من أي نصوص ثابتة أو افتراضات تخص عميل معين (مثل FastOrder أو المطاعم). البرومبت ديناميكي بنسبة 100% ويستنتج نشاط الحملة والجمهور المستهدف من بيانات الإعلان النصية وصورته الفعلية.
2. **أولوية الحالة اليدوية (Custom Business Status):**
   - التعديل اليدوي لحالة مديري الأعمال والحسابات (`ACTIVE`, `RESTRICTED`, `ASSETS_RESTRICTED`) عبر `/api/ads/toggle-business-status` يُخزن في قاعدة البيانات وله **أولوية مطلقة** على أي حالة يتم جلبها تلقائياً من فيسبوك.

---

## 📜 7. قواعد المساعد الذكي الصارمة في هذا المشروع (Assistant Rules)

عند فتح أي جلسة عمل جديدة مع هذا المشروع، يجب الالتزام الصارم بالقواعد التالية:
1. **اللغة:** التحدث دائماً باللغة العربية بالعامية المصرية الودودة.
2. **الملخصات:** ممنوع تماماً إنشاء أي ملف `walkthrough.md` — المختصر يكتب في رسالة الرد فقط.
3. **خطة المهام:** عند إنشاء أو تعديل ملف `tasks.md` يجب كتابته كاملاً باللغة العربية.
4. **تحديثات التقدم:** وسوم `<PROGRESS_UPDATE>` تُكتب دائماً باللغة العربية.
5. **سرعة التنفيذ:** قراءة هذا الملف `PROJECT.md` أولاً لفهم بنية المشروع وتفادي استهلاك التوكن في استكشاف المسارات والأوامر.
