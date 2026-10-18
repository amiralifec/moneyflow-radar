// ترجمه عنوان بازارها به فارسی
// لایه ۱: ترجمه آنی مبتنی بر قالب + واژه‌نامه (آفلاین، همیشه در دسترس)
// لایه ۲: ترجمه ماشینی رایگان در پس‌زمینه (از طریق /api/tr یا مستقیم) با کش دائمی
import { fa, safeJSON } from './util.js';

const MONTHS = {
  january: 'ژانویه', february: 'فوریه', march: 'مارس', april: 'آوریل', may: 'مه', june: 'ژوئن',
  july: 'ژوئیه', august: 'اوت', september: 'سپتامبر', october: 'اکتبر', november: 'نوامبر', december: 'دسامبر',
  jan: 'ژانویه', feb: 'فوریه', mar: 'مارس', apr: 'آوریل', jun: 'ژوئن', jul: 'ژوئیه', aug: 'اوت', sep: 'سپتامبر', sept: 'سپتامبر', oct: 'اکتبر', nov: 'نوامبر', dec: 'دسامبر',
};

// عبارت‌های چندکلمه‌ای اول (طولانی‌تر اولویت دارد)
const PHRASES = [
  ['federal reserve', 'فدرال رزرو'], ['interest rates', 'نرخ بهره'], ['interest rate', 'نرخ بهره'],
  ['no change', 'بدون تغییر'], ['bps', 'نقطه‌پایه'], ['bp', 'نقطه‌پایه'],
  ['strait of hormuz', 'تنگه هرمز'], ['xi jinping', 'شی جین‌پینگ'], ['supreme leader', 'رهبر ارشد'], ['persian gulf', 'خلیج فارس'], ['middle east', 'خاورمیانه'],
  ['united states', 'آمریکا'], ['united kingdom', 'بریتانیا'], ['european union', 'اتحادیه اروپا'],
  ['south korea', 'کره جنوبی'], ['north korea', 'کره شمالی'], ['saudi arabia', 'عربستان'], ['south africa', 'آفریقای جنوبی'],
  ['white house', 'کاخ سفید'], ['supreme court', 'دیوان عالی'], ['prime minister', 'نخست‌وزیر'],
  ['world cup', 'جام جهانی'], ['champions league', 'لیگ قهرمانان'], ['europa league', 'لیگ اروپا'],
  ['premier league', 'لیگ برتر انگلیس'], ['la liga', 'لالیگا'], ['serie a', 'سری‌آ'], ['bundesliga', 'بوندسلیگا'], ['ligue 1', 'لوشامپیونه'],
  ['real madrid', 'رئال مادرید'], ['barcelona', 'بارسلونا'], ['atletico madrid', 'اتلتیکو مادرید'], ['liverpool', 'لیورپول'], ['arsenal', 'آرسنال'], ['chelsea', 'چلسی'], ['juventus', 'یوونتوس'], ['paris saint-germain', 'پاری‌سن‌ژرمن'], ['psg', 'پاری‌سن‌ژرمن'], ['manchester united', 'منچستریونایتد'], ['manchester city', 'منچسترسیتی'],
  ['bayern munich', 'بایرن مونیخ'], ['inter milan', 'اینترمیلان'], ['ac milan', 'میلان'],
  ['crude oil', 'نفت خام'], ['natural gas', 'گاز طبیعی'], ['brent crude', 'نفت برنت'],
  ['price of', 'قیمت'], ['all-time high', 'رکورد تاریخی'], ['all time high', 'رکورد تاریخی'],
  ['nuclear deal', 'توافق هسته‌ای'], ['nuclear weapon', 'سلاح هسته‌ای'], ['ceasefire', 'آتش‌بس'],
  ['regime change', 'تغییر رژیم'], ['military action', 'اقدام نظامی'], ['air strike', 'حمله هوایی'], ['airstrike', 'حمله هوایی'],
  ['rate cut', 'کاهش نرخ بهره'], ['rate hike', 'افزایش نرخ بهره'], ['government shutdown', 'تعطیلی دولت'],
  ['stock market', 'بازار سهام'], ['market cap', 'ارزش بازار'], ['trading volume', 'حجم معاملات'],
];

const WORDS = {
  bitcoin: 'بیت‌کوین', btc: 'بیت‌کوین', ethereum: 'اتریوم', eth: 'اتریوم', solana: 'سولانا', xrp: 'ریپل', dogecoin: 'دوج‌کوین', crypto: 'ارز دیجیتال',
  gold: 'طلا', silver: 'نقره', oil: 'نفت', crude: 'نفت خام', brent: 'برنت', wti: 'WTI', copper: 'مس', gas: 'گاز',
  iran: 'ایران', israel: 'اسرائیل', russia: 'روسیه', ukraine: 'اوکراین', china: 'چین', taiwan: 'تایوان', india: 'هند', pakistan: 'پاکستان',
  syria: 'سوریه', lebanon: 'لبنان', iraq: 'عراق', yemen: 'یمن', turkey: 'ترکیه', egypt: 'مصر', japan: 'ژاپن', germany: 'آلمان', france: 'فرانسه',
  italy: 'ایتالیا', spain: 'اسپانیا', brazil: 'برزیل', argentina: 'آرژانتین', canada: 'کانادا', mexico: 'مکزیک', venezuela: 'ونزوئلا', cuba: 'کوبا',
  gaza: 'غزه', hamas: 'حماس', hezbollah: 'حزب‌الله', nato: 'ناتو', un: 'سازمان ملل', eu: 'اتحادیه اروپا', us: 'آمریکا', usa: 'آمریکا', uk: 'بریتانیا',
  trump: 'ترامپ', biden: 'بایدن', harris: 'هریس', putin: 'پوتین', zelensky: 'زلنسکی', netanyahu: 'نتانیاهو', khamenei: 'خامنه‌ای', xi: 'شی', musk: 'ماسک',
  fed: 'فدرال رزرو', fomc: 'FOMC', inflation: 'تورم', recession: 'رکود', cpi: 'شاخص قیمت مصرف‌کننده', gdp: 'تولید ناخالص داخلی', unemployment: 'بیکاری',
  tariff: 'تعرفه', tariffs: 'تعرفه‌ها', sanctions: 'تحریم‌ها', war: 'جنگ', attack: 'حمله', strike: 'حمله', strikes: 'حملات', invade: 'حمله زمینی به', invasion: 'حمله نظامی',
  election: 'انتخابات', elections: 'انتخابات', president: 'رئیس‌جمهور', presidential: 'ریاست‌جمهوری', senate: 'سنا', congress: 'کنگره', house: 'مجلس نمایندگان',
  democrat: 'دموکرات', democrats: 'دموکرات‌ها', republican: 'جمهوری‌خواه', republicans: 'جمهوری‌خواهان', nuclear: 'هسته‌ای', missile: 'موشک', troops: 'نیروهای نظامی',
  win: 'برنده شود', wins: 'برنده می‌شود', winner: 'برنده', champion: 'قهرمان', final: 'فینال', match: 'مسابقه', game: 'بازی', season: 'فصل', cup: 'جام', league: 'لیگ',
  price: 'قیمت', above: 'بالاتر از', below: 'پایین‌تر از', over: 'بیش از', under: 'کمتر از', between: 'بین', and: 'و', or: 'یا', of: 'از', the: '', a: '', an: '',
  by: 'تا', before: 'پیش از', after: 'پس از', in: 'در', on: 'در', at: 'در', for: 'برای', to: 'به', from: 'از', with: 'با', vs: 'در برابر', versus: 'در برابر',
  yes: 'بله', no: 'خیر', more: 'بیشتر', less: 'کمتر', than: 'از', high: 'بالا', low: 'پایین', new: 'جدید', next: 'بعدی', first: 'اولین', last: 'آخرین',
  decrease: 'کاهش', increase: 'افزایش', cut: 'کاهش', hike: 'افزایش', rates: 'نرخ‌ها', rate: 'نرخ', meeting: 'نشست', decision: 'تصمیم',
  announce: 'اعلام کند', announces: 'اعلام می‌کند', resign: 'استعفا دهد', resigns: 'استعفا می‌دهد', released: 'منتشر شود', release: 'انتشار',
  deal: 'توافق', agreement: 'توافق', talks: 'مذاکرات', peace: 'صلح', military: 'نظامی', government: 'دولت', leader: 'رهبر', ceo: 'مدیرعامل',
  market: 'بازار', markets: 'بازارها', stock: 'سهام', stocks: 'سهام', ipo: 'عرضه اولیه', etf: 'ETF', approve: 'تأیید کند', approved: 'تأیید شود', ban: 'ممنوعیت',
  january: 'ژانویه', february: 'فوریه', march: 'مارس', april: 'آوریل', may: 'مه', june: 'ژوئن', july: 'ژوئیه', august: 'اوت', september: 'سپتامبر', october: 'اکتبر', november: 'نوامبر', december: 'دسامبر',
  jan: 'ژانویه', feb: 'فوریه', mar: 'مارس', apr: 'آوریل', jun: 'ژوئن', jul: 'ژوئیه', aug: 'اوت', sep: 'سپتامبر', sept: 'سپتامبر', oct: 'اکتبر', nov: 'نوامبر', dec: 'دسامبر',
  today: 'امروز', tomorrow: 'فردا', week: 'هفته', month: 'ماه', year: 'سال', day: 'روز', end: 'پایان', start: 'شروع', 'q1': 'فصل اول', 'q2': 'فصل دوم', 'q3': 'فصل سوم', 'q4': 'فصل چهارم',
  through: 'تا', visit: 'سفر کند', remain: 'باقی بماند', supreme: 'عالی', meet: 'دیدار کند', capture: 'تصرف کند', close: 'بسته شود', closed: 'بسته شود', hit: 'برسد', reach: 'برسد', exceed: 'فراتر رود', happen: 'رخ دهد', launch: 'عرضه کند', top: 'برتر', nominee: 'نامزد', nomination: 'نامزدی', party: 'حزب', seats: 'کرسی‌ها', seat: 'کرسی', votes: 'آرا', vote: 'رأی', poll: 'نظرسنجی', approval: 'محبوبیت', rating: 'امتیاز',
};

const GLOSS_PHRASE_RE = new RegExp(
  '(?<![A-Za-z])(' + PHRASES.map(([k]) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|') + ')(?![A-Za-z])',
  'gi'
);
const PHRASE_MAP = Object.fromEntries(PHRASES.map(([k, v]) => [k.toLowerCase(), v]));

function numFa(s) {
  return fa(String(s).replace(/,/g, '٬'));
}

function money(s) {
  // $150,000 → ۱۵۰٬۰۰۰ دلار ; $1.5B → ۱٫۵ میلیارد دلار
  return s.replace(/\$\s?([\d,]+(?:\.\d+)?)\s?([kKmMbB]|million|billion|trillion)?/g, (_, n, u) => {
    const unit = !u ? '' : /^k$/i.test(u) ? ' هزار' : /^m$|million/i.test(u) ? ' میلیون' : /^b$|billion/i.test(u) ? ' میلیارد' : ' تریلیون';
    return numFa(n.replace('.', '٫')) + unit + ' دلار';
  });
}

function dateFa(s) {
  // "December 31, 2026" → "۳۱ دسامبر ۲۰۲۶" ; "Dec 31" → "۳۱ دسامبر"
  return s
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/gi, (_, m, d, y) => numFa(d) + ' ' + MONTHS[m.toLowerCase()] + (y ? ' ' + numFa(y) : ''))
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi, (_, m, y) => MONTHS[m.toLowerCase()] + ' ' + numFa(y))
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, (m) => MONTHS[m.toLowerCase()]);
}

// واژه‌به‌واژه: ناشناخته‌ها (نام‌های خاص) همان‌طور که هستند می‌مانند
function glossary(s) {
  let t = s;
  t = money(t);
  t = dateFa(t);
  t = t.replace(GLOSS_PHRASE_RE, (m) => PHRASE_MAP[m.toLowerCase()] || m);
  t = t.replace(/\b[A-Za-z][A-Za-z']*\b/g, (w) => {
    const k = w.toLowerCase();
    return Object.prototype.hasOwnProperty.call(WORDS, k) ? WORDS[k] : w;
  });
  t = t.replace(/\d[\d,.]*%?/g, (n) => numFa(n.replace('.', '٫')));
  return t.replace(/\s{2,}/g, ' ').replace(/\s+([؟?،,:؛])/g, '$1').trim();
}

const G = (x) => glossary(x);

// قالب‌های پرتکرار؛ هرکدام تابعی که رشته فارسی برمی‌گرداند
const TEMPLATES = [
  [/^Will the Fed (decrease|increase) interest rates by (\d+)(\+?) bps after the (\w+) (\d{4}) meeting\?$/i, (m) =>
    `آیا فدرال رزرو پس از نشست ${G(m[4])} ${fa(m[5])} نرخ بهره را ${/decrease/i.test(m[1]) ? 'کاهش' : 'افزایش'} ${fa(m[2])}${m[3] ? '+' : ''} نقطه‌پایه می‌دهد؟`],
  [/^Will there be no change in Fed interest rates after the (\w+) (\d{4}) meeting\?$/i, (m) =>
    `آیا پس از نشست ${G(m[1])} ${fa(m[2])} نرخ بهره فدرال رزرو بدون تغییر می‌ماند؟`],
  [/^Fed Decision in (\w+)\??$/i, (m) => `تصمیم فدرال رزرو در ${G(m[1])}`],
  [/^(.+?) vs\.? (.+?)(?::\s*(.+))?$/i, (m) => `${G(m[1])} در برابر ${G(m[2])}${m[3] ? ' — ' + G(m[3]) : ''}`],
  [/^Will (.+?) (?:reach|hit) (.+?) (?:by|before|in|on) (.+?)\?$/i, (m) => `آیا ${G(m[1])} تا ${G(m[3])} به ${G(m[2])} می‌رسد؟`],
  [/^Will (.+?) (?:be above|close above|exceed|trade above|finish above) (.+?) (?:on|by|in) (.+?)\?$/i, (m) => `آیا ${G(m[1])} در ${G(m[3])} بالاتر از ${G(m[2])} خواهد بود؟`],
  [/^Will (.+?) (?:be below|close below|fall below|drop below|trade below) (.+?) (?:on|by|in) (.+?)\?$/i, (m) => `آیا ${G(m[1])} در ${G(m[3])} پایین‌تر از ${G(m[2])} خواهد بود؟`],
  [/^Will (.+?) win (?:the )?(.+?)\?$/i, (m) => `آیا ${G(m[1])} برنده ${G(m[2])} می‌شود؟`],
  [/^Will (.+?) (?:strike|attack|bomb) (.+?) (?:by|before|in|on) (.+?)\?$/i, (m) => `آیا ${G(m[1])} تا ${G(m[3])} به ${G(m[2])} حمله می‌کند؟`],
  [/^Will (.+?) (?:invade|take over) (.+?) (?:by|before|in|on) (.+?)\?$/i, (m) => `آیا ${G(m[1])} تا ${G(m[3])} به ${G(m[2])} حمله نظامی می‌کند؟`],
  [/^Will there be (.+?) (?:by|before|in|on) (.+?)\?$/i, (m) => `آیا تا ${G(m[2])} ${G(m[1])} رخ می‌دهد؟`],
  [/^Will (.+?) (?:announce|release|launch) (.+?) (?:by|before|in|on) (.+?)\?$/i, (m) => `آیا ${G(m[1])} تا ${G(m[3])} ${G(m[2])} را اعلام می‌کند؟`],
  [/^Will (.+?) (?:by|before|in|on) (.+?)\?$/i, (m) => `آیا ${G(m[1])} تا ${G(m[2])}؟`],
  [/^Will (.+?)\?$/i, (m) => `آیا ${G(m[1])}؟`],
  [/^(.+?) (?:by|before)\.{3}\??$/i, (m) => `${G(m[1])} تا چه زمانی؟`],
];

export function quickTranslate(en) {
  const s = String(en || '').trim();
  if (!s) return '';
  for (const [re, fn] of TEMPLATES) {
    const m = s.match(re);
    if (m) {
      try { return fn(m); } catch { /* ادامه با واژه‌نامه */ }
    }
  }
  return G(s);
}

// ---------- لایه ماشینی با کش ----------
const LS_KEY = 'mf_tr_v1';
let cache = {};
try { cache = safeJSON(localStorage.getItem(LS_KEY), {}) || {}; } catch { cache = {}; }
const pending = new Set();
const failed = new Map();
let saveT;
const hasLatin = (s) => /[A-Za-z]{3,}/.test(s);

function saveCache() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      const keys = Object.keys(cache);
      if (keys.length > 2500) keys.slice(0, keys.length - 2000).forEach((k) => delete cache[k]);
      localStorage.setItem(LS_KEY, JSON.stringify(cache));
    } catch { /* پر بودن حافظه */ }
  }, 800);
}

// ترجمه همگام: کش ماشینی → قالب/واژه‌نامه
export function tr(en) {
  if (!en) return '';
  return cache[en] || quickTranslate(en);
}
export const isMachine = (en) => !!cache[en];

async function machine(text) {
  const enc = encodeURIComponent(text);
  const tries = [
    async () => {
      const r = await fetch('/api/tr?q=' + enc, { headers: { accept: 'application/json' } });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('proxy');
      const j = await r.json();
      if (!j.t) throw new Error('empty');
      return j.t;
    },
    async () => {
      const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fa&dt=t&q=' + enc);
      if (!r.ok) throw new Error('gtx');
      const j = await r.json();
      return (j[0] || []).map((x) => x[0]).join('');
    },
    async () => {
      const r = await fetch('https://api.mymemory.translated.net/get?langpair=en|fa&q=' + enc);
      if (!r.ok) throw new Error('mm');
      const j = await r.json();
      const t = j?.responseData?.translatedText;
      if (!t || /MYMEMORY WARNING|QUERY LENGTH/i.test(t)) throw new Error('mm-limit');
      return t;
    },
  ];
  for (const f of tries) {
    try {
      const t = await f();
      if (t && t.trim()) return t.trim();
    } catch { /* بعدی */ }
  }
  return null;
}

// ترجمه پس‌زمینه برای فهرست عنوان‌ها؛ onUpdate پس از هر دسته صدا زده می‌شود
export async function enrich(titles, onUpdate, max = 36) {
  const todo = [...new Set(titles)].filter((t) => t && hasLatin(t) && !cache[t] && !pending.has(t) && (failed.get(t) || 0) < 2).slice(0, max);
  if (!todo.length) return;
  todo.forEach((t) => pending.add(t));
  let done = 0, changed = false;
  const worker = async () => {
    while (todo.length) {
      const t = todo.shift();
      const out = await machine(t);
      pending.delete(t);
      if (out && /[؀-ۿ]/.test(out)) {
        cache[t] = out;
        changed = true;
        done++;
        if (done % 6 === 0) { saveCache(); onUpdate && onUpdate(); }
      } else {
        failed.set(t, (failed.get(t) || 0) + 1);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (changed) { saveCache(); onUpdate && onUpdate(); }
}
