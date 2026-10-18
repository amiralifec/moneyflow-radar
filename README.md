# رادار جریان پول (MoneyFlow Radar)

PWA فارسی، تاریک، موبایل‌فرست برای ردیابی جریان پول در Polymarket (کامل) + Kalshi و PredictIt (مکمل).
بدون build و بدون وابستگی npm؛ فقط فایل‌های ثابت + یک Function اختیاری برای کش/CORS.

## دیپلوی رایگان (پیشنهادی: Cloudflare Pages)
1. پوشه‌ی پروژه را در یک ریپوی GitHub بگذارید (یا در داشبورد Cloudflare Pages → Upload assets آپلود کنید؛ برای Functions بهتر است ریپو باشد).
2. Cloudflare Pages → Create project → Connect to Git → Build command: خالی · Output directory: `/`
3. پوشه‌ی `functions/` خودکار به `/api/*` تبدیل می‌شود (پروکسی کش‌دار برای gamma/clob/data/kalshi/predictit و ترجمه).
4. آدرس `https://<name>.pages.dev` را در Chrome اندروید باز کنید → منو ⋮ → «Install app / افزودن به صفحه اصلی».

بدون Functions (مثلاً Vercel/Netlify/GitHub Pages) هم کار می‌کند: اپ خودش مستقیم به APIهای عمومی وصل می‌شود؛
فقط اگر یکی از منابع CORS نداشته باشد (احتمالاً PredictIt) آن منبع بی‌صدا کنار می‌رود.

## نحوه‌ی کار
- به‌روزرسانی خودکار هر ۲ دقیقه (و هنگام بازگشت به اپ)، کش لبه ۴۵–۹۰ ثانیه برای رعایت rate limit.
- آخرین داده در حافظه‌ی گوشی ذخیره می‌شود؛ آفلاین هم آخرین وضعیت دیده می‌شود.
- امتیاز جریان پول (۰–۱۰۰) = حجم ۳۲٪ + اسپایک حجم ۲۰٪ + حرکت قیمت (وزن‌دار با نقدینگی) ۲۰٪ + نقدینگی ۱۴٪ + هم‌حرکتی ۱۴٪. همه‌ی آستانه‌ها در `js/analyze.js` بخش `CFG`.
- «حرکت واقعی»: تغییر ۲۴ساعته ≥ ۳ واحد درصد، حجم ≥ ۲۰هزار دلار و نقدینگی ≥ ۲۰هزار دلار؛ در غیر این صورت «نویز».
- «هشدار اختلاف» یک برآورد ساده و توضیح‌پذیر است (جهش بدون حجم، حجم بدون حرکت قیمت، خلاف روند هفتگی)، نه توصیه مالی.

## ساختار
index.html · css/app.css · js/{app,data,analyze,geo,i18n,util}.js · sw.js · manifest.webmanifest · icons/ · functions/api/[[path]].js
