// موتور تحلیل جریان پول — توابع خالص (قابل تست با node)
// همه آستانه‌ها یکجا در CFG تا قابل تنظیم باشند.
import { clamp } from './util.js';
import { matchPlaces } from './geo.js';

export const CFG = {
  realMoveDp: 0.03,     // حداقل تغییر ۲۴ساعته (۳ واحد درصد) برای «حرکت»
  minVol: 20000,        // حداقل حجم ۲۴ساعته برای اینکه حرکت معنادار باشد
  minLiq: 20000,        // حداقل نقدینگی
  spikeRatio: 3,        // نسبت حجم امروز به میانگین روزانه قبلی
  spikeMinVol: 50000,
  bigTrade: 2000,       // معامله بزرگ (دلار)
  liqLow: 25000,
  liqHigh: 250000,
};

export const CATS = [
  { id: 'pol', fa: 'سیاست و ژئوپلیتیک', icon: '🏛', color: '#ff7a59' },
  { id: 'commod', fa: 'کامودیتی‌ها', icon: '🛢', color: '#f5c542' },
  { id: 'crypto', fa: 'کریپتو', icon: '₿', color: '#ffb020' },
  { id: 'econ', fa: 'اقتصاد و نرخ بهره', icon: '📈', color: '#4cc9f0' },
  { id: 'sports', fa: 'فوتبال و ورزش', icon: '⚽', color: '#2cff8f' },
  { id: 'world', fa: 'اخبار و رویدادهای جهانی', icon: '🌐', color: '#b794f6' },
];
export const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));

const RE = {
  sports: /\b(soccer|football|nba|nfl|mlb|nhl|ufc|mma|tennis|golf|f1|formula 1|grand prix|olympic|world cup|champions league|europa league|premier league|la liga|serie a|bundesliga|ligue 1|uefa|fifa|super bowl|stanley cup|world series|wimbledon|us open|nascar|boxing|cricket|ipl|vs\.?|match|playoffs?|finals?|mvp|ballon d'or|transfer|real madrid|barcelona|bayern|arsenal|chelsea|liverpool|manchester|psg|juventus|inter milan|ac milan|napoli|tottenham|dortmund|atletico)\b/i,
  football: /\b(soccer|football|world cup|champions league|europa league|premier league|la liga|serie a|bundesliga|ligue 1|uefa|fifa|real madrid|barcelona|bayern|arsenal|chelsea|liverpool|manchester|psg|juventus|inter milan|ac milan|napoli|tottenham|dortmund|atletico|mls|copa|euro 20|ballon d'or|messi|ronaldo|mbapp|haaland|salah)\b/i,
  nflish: /\b(nfl|super bowl|quarterback)\b/i,
  crypto: /\b(bitcoin|btc|ethereum|eth|solana|sol|xrp|ripple|dogecoin|doge|crypto|altcoin|stablecoin|binance|coinbase|memecoin|token|airdrop|defi|microstrategy|strategy holds)\b/i,
  commod: /\b(oil|crude|brent|wti|gold|silver|copper|platinum|natural gas|lng|opec|commodit|gasoline|wheat|corn|coffee|cocoa|uranium|lithium)\b/i,
  econ: /\b(fed|fomc|federal reserve|interest rates?|rate cuts?|rate hikes?|inflation|cpi|pce|gdp|recession|unemployment|jobs report|nonfarm|payrolls?|tariffs?|treasury|yield|s&p|nasdaq|dow jones|stock|stocks|ipo|market cap|earnings|ecb|boj|bank of england|powell|warsh|debt ceiling|shutdown|dollar|dxy)\b/i,
  pol: /\b(war|ceasefire|invade|invasion|strike|strikes|missile|nuclear|military|troops|nato|sanctions?|regime|coup|election|elections|president|prime minister|senate|congress|house|governor|mayor|democrat|republican|gop|trump|biden|harris|vance|putin|zelensky|netanyahu|khamenei|xi jinping|iran|israel|gaza|hamas|hezbollah|russia|ukraine|china|taiwan|korea|syria|lebanon|yemen|houthi|venezuela|maduro|impeach|supreme court|cabinet|resign|parliament|referendum|tariff deal|peace deal|treaty|united nations|un security)\b/i,
};
const TAG_MAP = {
  crypto: ['crypto', 'bitcoin', 'ethereum', 'solana', 'altcoins', 'xrp', 'dogecoin', 'memecoins', 'crypto-prices'],
  commod: ['commodities', 'oil', 'gold', 'silver', 'natural-gas', 'crude-oil', 'energy'],
  econ: ['economy', 'fed', 'fed-rates', 'fomc', 'inflation', 'us-cpi', 'economic-policy', 'macro-indicators', 'stocks', 'finance', 'business', 'global-rates', 'recession', 'tariffs', 'earnings'],
  sports: ['sports', 'soccer', 'football', 'nba', 'nfl', 'mlb', 'nhl', 'tennis', 'golf', 'ufc', 'mma', 'f1', 'cricket', 'olympics', 'world-cup', 'epl', 'champions-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1', 'basketball', 'baseball', 'hockey', 'boxing'],
  pol: ['politics', 'geopolitics', 'world', 'middle-east', 'iran', 'israel', 'russia', 'ukraine', 'china', 'elections', 'global-elections', 'world-elections', 'us-politics', 'trump', 'trump-presidency', 'foreign-policy', 'war'],
};

export function classify(ev) {
  const slugs = new Set(ev.tags.map((t) => t.s.toLowerCase()));
  const title = ev.title + ' ' + (ev.markets[0]?.q || '');
  const has = (cat) => TAG_MAP[cat].some((s) => slugs.has(s));
  let cat;
  if (has('sports') || (RE.sports.test(title) && !RE.pol.test(title) && !RE.crypto.test(title))) cat = 'sports';
  else if (has('crypto') || RE.crypto.test(title)) cat = 'crypto';
  else if (has('commod') || RE.commod.test(title)) cat = 'commod';
  else if (has('econ') || RE.econ.test(title)) cat = 'econ';
  else if (has('pol') || RE.pol.test(title)) cat = 'pol';
  else cat = 'world';
  const football = cat === 'sports' && (RE.football.test(title) || ['soccer', 'football', 'epl', 'champions-league', 'world-cup', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1', 'ucl'].some((s) => slugs.has(s))) && !RE.nflish.test(title);
  const countries = matchPlaces(title + ' ' + ev.tags.map((t) => t.l).join(' '));
  const iran = countries.includes('IR') || slugs.has('iran');
  return { cat, football, countries, iran };
}

export const liqLevel = (liq) => (liq >= CFG.liqHigh ? 'high' : liq >= CFG.liqLow ? 'mid' : 'low');
export const LIQ_FA = { low: 'کم', mid: 'متوسط', high: 'بالا' };

const lg = (x) => Math.log10(Math.max(x, 1));

// نسبت حجم ۲۴ساعته به میانگین روزانه‌ی دوره‌ی قبل (هفتگی؛ و اگر نبود ماهانه)
function volRatio(v24, v1w, v1m) {
  let prior = 0;
  if (v1w > v24 * 1.0001) prior = (v1w - v24) / 6;
  else if (v1m > v24 * 1.0001) prior = (v1m - v24) / 29;
  if (prior < 500) return { ratio: v24 > 5000 ? 5 : 1, growth: NaN, prior };
  return { ratio: Math.min(v24 / prior, 99), growth: Math.min(v24 / prior - 1, 10), prior };
}

// تحلیل یک بازار (یک ردیف در رویداد)
export function marketStats(m) {
  const real = Math.abs(m.dp) >= CFG.realMoveDp && m.v24 >= CFG.minVol && m.liq >= CFG.minLiq;
  const noise = Math.abs(m.dp) >= CFG.realMoveDp && !real;
  return { real, noise, rel: clamp((lg(m.liq) - 3.5) / 2.5, 0, 1) * clamp((lg(m.v24) - 3.3) / 2.5, 0, 1) };
}

// تحلیل یک رویداد (بدون همبستگی؛ آن در مرحله‌ی بعد می‌آید)
export function analyzeEvent(ev) {
  const c = classify(ev);
  const mk = ev.markets;
  const top = mk[0];
  // بازارِ «متحرک‌ترین» در بین بازارهای پرحجم همین رویداد
  let mover = top, best = -1;
  for (const m of mk) {
    const s = marketStats(m);
    const w = Math.abs(m.dp) * (0.3 + s.rel);
    if (w > best && m.v24 >= 1000) { best = w; mover = m; }
  }
  const ms = marketStats(mover);
  const vr = ev.noVolume ? { ratio: 1, growth: NaN, prior: 0 } : volRatio(ev.v24, ev.v1w, ev.v1m);
  const dailyMonth = ev.v1m > 0 ? ev.v1m / 30 : 0;
  const vsMonth = dailyMonth > 500 ? ev.v24 / dailyMonth : NaN;

  const volScore = clamp((lg(ev.v24) - 3.7) / 3.3, 0, 1);
  const spikeScore = clamp(Math.log2(Math.max(vr.ratio, 1)) / 3, 0, 1) * (ev.v24 > 10000 ? 1 : 0.3);
  const moveScore = clamp(Math.abs(mover.dp) / 0.15, 0, 1) * (0.35 + 0.65 * ms.rel);
  const liqScore = clamp((lg(ev.liq) - 4) / 2.5, 0, 1);

  const liq = liqLevel(ev.liq);
  const spike = !ev.noVolume && vr.ratio >= CFG.spikeRatio && ev.v24 >= CFG.spikeMinVol;
  const topP = top.p;

  const a = {
    ...c, mover, topP,
    dp: mover.dp, moverIsTop: mover === top,
    real: ms.real, noise: ms.noise && !ms.real,
    spike, ratio: vr.ratio, growth: vr.growth, vsMonth,
    liq, volScore, spikeScore, moveScore, liqScore,
    corr: 0, corrScore: 0, corrWith: [],
    gap: null, flags: [],
  };

  // اختلاف ساده‌ی مبتنی بر شواهد (توضیح‌پذیر؛ توصیه‌ی مالی نیست)
  const pm = mover.p;
  if (!ev.noVolume) {
    if (Math.abs(mover.dp) >= 0.06 && vr.ratio < 1.3 && ev.liq < 150000 && pm > 0.03 && pm < 0.97) {
      const est = clamp(pm - 0.5 * mover.dp, 0.01, 0.99);
      a.gap = { kind: 'unbacked', p: pm, est, diff: est - pm, why: 'جهش قیمت بدون افزایش حجم و با نقدینگی محدود؛ احتمال بازگشت بخشی از حرکت.' };
    } else if (spike && ev.v24 >= 100000 && Math.abs(mover.dp) < 0.01 && pm > 0.1 && pm < 0.9) {
      a.gap = { kind: 'stealth', p: pm, est: NaN, diff: NaN, why: 'حجم چند برابر میانگین است اما قیمت تقریباً ثابت مانده؛ نشانه‌ی جذب یا جابه‌جایی پول بدون اثر قیمتی (حرکت احتمالی در راه).' };
    } else if (Math.abs(mover.wp) >= 0.12 && Math.sign(mover.wp) !== Math.sign(mover.dp) && Math.abs(mover.dp) >= 0.04 && ms.real) {
      const est = clamp(pm - 0.3 * mover.dp, 0.01, 0.99);
      a.gap = { kind: 'reversal', p: pm, est, diff: est - pm, why: 'حرکت ۲۴ساعته خلاف روند هفتگی است؛ ممکن است اصلاح موقت باشد.' };
    }
  }

  a.flow = 0; // پس از همبستگی محاسبه می‌شود
  return a;
}

// نمره‌ی نهایی ۰..۱۰۰
export function finalizeScore(ev, a) {
  let s = 0.32 * a.volScore + 0.2 * a.spikeScore + 0.2 * a.moveScore + 0.14 * a.liqScore + 0.14 * a.corrScore;
  if (ev.noVolume) s = 0.5 * a.moveScore + 0.5 * a.corrScore * 0.6; // PredictIt: بدون حجم
  if (!ev.noVolume && (ev.liq < 10000 || ev.v24 < 5000)) s *= 0.5;
  return Math.round(clamp(s, 0, 1) * 100);
}

// تحلیل کل مجموعه + همبستگی
export function analyzeAll(events) {
  const list = events.map((ev) => ({ ev, a: analyzeEvent(ev) }));

  // کلاستر: «حرکت‌کنندگان واقعی» در هر دسته و هر کشور/تگ مشخص
  const movers = list.filter((x) => x.a.real);
  const bucketKey = (x) => [
    ...x.a.countries.filter((c) => !c.startsWith('R_') && c !== 'US').map((c) => 'c:' + c), // آمریکا خیلی عمومی است؛ هم‌حرکتی‌اش معنادار نیست
    ...x.ev.tags.map((t) => t.s).filter((s) => s && !GENERIC.has(s.toLowerCase())).map((s) => 't:' + s),
  ];
  const byBucket = new Map();
  for (const x of movers) for (const k of bucketKey(x)) (byBucket.get(k) || byBucket.set(k, []).get(k)).push(x);
  const catMovers = new Map();
  for (const x of movers) (catMovers.get(x.a.cat) || catMovers.set(x.a.cat, []).get(x.a.cat)).push(x);

  for (const x of list) {
    const related = new Set();
    for (const k of bucketKey(x)) for (const y of byBucket.get(k) || []) if (y !== x) related.add(y);
    const sameCat = (catMovers.get(x.a.cat) || []).filter((y) => y !== x);
    // قوی: اشتراک کشور/تگ مشخص ؛ ضعیف: هم‌دسته
    const strong = related.size;
    const weak = Math.max(0, sameCat.length - strong);
    x.a.corr = strong + (x.a.real ? Math.min(weak, 3) * 0.5 : 0);
    x.a.corrScore = clamp(x.a.corr / 4, 0, 1);
    x.a.corrWith = [...related].slice(0, 5).map((y) => y.ev.id);
    x.a.corrCount = Math.round(strong + (x.a.real ? weak : 0));
    x.a.flow = finalizeScore(x.ev, x.a);
    // برچسب‌ها
    const f = x.a.flags;
    if (x.a.spike) f.push('spike');
    if (x.a.real) f.push('move');
    if (x.a.noise) f.push('noise');
    if (x.a.corrCount >= 2 && x.a.real) f.push('corr');
    if (x.a.gap) f.push('gap');
    if (x.ev.created && Date.now() - Date.parse(x.ev.created) < 48 * 3600e3 && x.ev.v24 > 100000) f.push('new');
  }

  // هشدارهای هم‌حرکتی در سطح دسته/کشور
  const clusters = [];
  for (const [cat, arr] of catMovers) {
    if (arr.length >= 3) {
      const up = arr.filter((x) => x.a.dp > 0).length;
      clusters.push({ kind: 'cat', key: cat, n: arr.length, up, down: arr.length - up, vol: arr.reduce((s, x) => s + x.ev.v24, 0), ids: arr.slice(0, 8).map((x) => x.ev.id) });
    }
  }
  for (const [k, arr] of byBucket) {
    if (k.startsWith('c:') && arr.length >= 3) {
      const up = arr.filter((x) => x.a.dp > 0).length;
      clusters.push({ kind: 'country', key: k.slice(2), n: arr.length, up, down: arr.length - up, vol: arr.reduce((s, x) => s + x.ev.v24, 0), ids: arr.slice(0, 8).map((x) => x.ev.id) });
    }
  }
  clusters.sort((a, b) => b.vol - a.vol);

  return { list, clusters };
}

const GENERIC = new Set(['politics', 'world', 'sports', 'recurring', 'trump', 'economy', 'finance', 'business', 'crypto', 'tech', 'culture', 'all', 'featured', 'pop-culture', 'games', 'earn-4', 'new', 'breaking-news', 'weekly', 'daily', 'monthly', 'states']);

// خلاصه‌ی هر دسته
export function summarizeCats(list) {
  const out = {};
  for (const c of CATS) out[c.id] = { id: c.id, n: 0, v24: 0, prior: 0, flow: 0, movers: 0, liq: 0 };
  for (const { ev, a } of list) {
    const o = out[a.cat];
    o.n++; o.v24 += ev.v24; o.liq += ev.liq; o.flow += a.flow;
    if (a.real) o.movers++;
    const vr = ev.noVolume ? 0 : volRatio(ev.v24, ev.v1w, ev.v1m).prior;
    o.prior += vr;
  }
  for (const k in out) {
    const o = out[k];
    o.avgFlow = o.n ? o.flow / o.n : 0;
    o.growth = o.prior > 0 ? o.v24 / o.prior - 1 : NaN;
  }
  return out;
}

// فید رویدادها از روی حرکت بازارها
export function buildFeed(list, now = Date.now()) {
  const items = [];
  for (const { ev, a } of list) {
    const m = a.mover;
    if (a.real) {
      items.push({ id: ev.id, kind: 'move', w: Math.abs(m.dp) * 100 + Math.log10(ev.v24 + 1) * 3, ev, a, m });
    }
    if (a.spike) items.push({ id: ev.id + ':s', kind: 'spike', w: Math.log2(a.ratio) * 6 + Math.log10(ev.v24 + 1) * 3, ev, a, m });
    if (a.flags.includes('new')) items.push({ id: ev.id + ':n', kind: 'new', w: 12 + Math.log10(ev.v24 + 1) * 3, ev, a, m });
    if (a.gap && a.gap.kind !== 'stealth') items.push({ id: ev.id + ':g', kind: 'gap', w: 8 + Math.abs(a.gap.diff) * 60, ev, a, m });
  }
  items.sort((x, y) => y.w - x.w);
  const seen = new Set(), out = [];
  for (const it of items) {
    const k = it.ev.id + it.kind;
    if (seen.has(k)) continue;
    seen.add(k); out.push(it);
    if (out.length >= 40) break;
  }
  return out;
}

// داده‌ی نقشه: حجم هر کشور/منطقه
export function mapData(list, { topic = 'all', cont = 'all' } = {}) {
  const by = new Map();
  for (const x of list) {
    if (topic !== 'all' && x.a.cat !== topic) continue;
    for (const id of x.a.countries) {
      const o = by.get(id) || { id, v24: 0, n: 0, items: [], moveSum: 0 };
      o.v24 += x.ev.v24; o.n++; o.items.push(x);
      if (x.a.real) o.moveSum += Math.abs(x.a.dp);
      by.set(id, o);
    }
  }
  return [...by.values()].map((o) => ({ ...o, items: o.items.sort((p, q) => q.a.flow - p.a.flow) }));
}

// ---- تحلیل معاملات (برای صفحه جزئیات) ----
export function analyzeTrades(trades, now = Date.now()) {
  if (!trades.length) return null;
  const sorted = [...trades].sort((a, b) => a.t - b.t);
  const span = sorted[sorted.length - 1].t - sorted[0].t;
  let buyYes = 0, sellYes = 0, big = [];
  for (const x of sorted) {
    const bullish = (x.side === 'BUY' && /^yes$/i.test(x.outcome)) || (x.side === 'SELL' && /^no$/i.test(x.outcome));
    if (bullish) buyYes += x.usd; else sellYes += x.usd;
    if (x.usd >= CFG.bigTrade) big.push({ ...x, bullish });
  }
  big.sort((a, b) => b.usd - a.usd);
  // سطل‌های ساعتی
  const H = 3600e3, start = Math.floor(sorted[0].t / H) * H;
  const buckets = [];
  for (let t = start; t <= sorted[sorted.length - 1].t; t += H) buckets.push({ t, usd: 0 });
  for (const x of sorted) buckets[Math.min(buckets.length - 1, Math.floor((x.t - start) / H))].usd += x.usd;
  const total = buyYes + sellYes;
  return { n: sorted.length, span, total, buyYes, sellYes, bias: total ? (buyYes - sellYes) / total : 0, big: big.slice(0, 8), buckets };
}
