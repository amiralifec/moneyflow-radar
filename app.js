// رادار جریان پول — برنامه اصلی (SPA بدون build)
import { fa, num, int, usd, pct, dpts, signedPct, arrow, dirClass, timeLeft, ago, esc, safeJSON, debounce, sparkPath, clamp } from './util.js';
import { CATS, CAT_BY_ID, CFG, LIQ_FA, analyzeAll, summarizeCats, buildFeed, mapData, analyzeTrades } from './analyze.js';
import { COUNTRIES, PLACE_BY_ID, CONTINENTS, MAP_W, MAP_H, project, landDotsPath } from './geo.js';
import { tr, enrich, isMachine } from './i18n.js';
import * as D from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const view = $('#view');
const REFRESH_MS = 120000;

// ---------------- وضعیت ----------------
const S = {
  store: new Map(),          // id → event (با _t زمان دریافت)
  list: [], clusters: [], cats: {}, feed: [], byId: new Map(),
  lastOk: 0, loading: false, error: null, firstLoad: true,
  src: new Set(['poly', 'kalshi', 'predictit']),
  cat: new Set(), tag: '', q: '', sort: 'flow', only: new Set(),
  shown: 30, searchRes: [],
  watch: new Set(safeJSON(localStorage.getItem('mf_watch'), [])),
  prefs: safeJSON(localStorage.getItem('mf_prefs'), { notify: false }) || { notify: false },
  map: { topic: 'all', cont: 'all', fs: false },
  topic: 'iran', sub: '',
  prev: new Map(),           // id → قیمت قبلی برای انیمیشن تغییر
};
const saveWatch = () => { try { localStorage.setItem('mf_watch', JSON.stringify([...S.watch])); } catch {} };
const savePrefs = () => { try { localStorage.setItem('mf_prefs', JSON.stringify(S.prefs)); } catch {} };

// ---------------- بارگذاری و تحلیل ----------------
function ingest(events, keepWatch = true) {
  const now = Date.now();
  for (const e of events) { e._t = now; S.store.set(e.id, e); }
  // حذف قدیمی‌ها (غیر از واچ‌لیست)
  for (const [id, e] of S.store) if (now - e._t > 25 * 60e3 && !(keepWatch && S.watch.has(id))) S.store.delete(id);
}

function recompute() {
  const events = [...S.store.values()];
  const { list, clusters } = analyzeAll(events);
  S.list = list; S.clusters = clusters;
  S.byId = new Map(list.map((x) => [x.ev.id, x]));
  S.cats = summarizeCats(list.filter((x) => x.ev.src === 'poly'));
  S.feed = buildFeed(list);
}

async function load({ manual = false } = {}) {
  if (S.loading) return;
  S.loading = true; setStatus('loading'); $('#btnRefresh').classList.add('spin');
  const before = new Map([...S.byId].map(([id, x]) => [id, x.a.mover.p]));
  let okPoly = false;
  try {
    const [poly, kal, pi] = await Promise.all([
      D.fetchPolymarket().then((r) => { D.saveSnapshot('poly', r); return r; }).catch((e) => { S.error = e; return null; }),
      D.fetchKalshi().then((r) => { D.saveSnapshot('kalshi', r); return r; }).catch(() => null),
      D.fetchPredictIt().then((r) => { D.saveSnapshot('predictit', r); return r; }).catch(() => null),
    ]);
    if (poly) { ingest(poly); okPoly = true; }
    if (kal) ingest(kal);
    if (pi) ingest(pi);
    if (!poly) {
      // آفلاین: از آخرین اسنپ‌شات
      for (const src of ['poly', 'kalshi', 'predictit']) {
        const sn = D.loadSnapshot(src);
        if (sn && !S.store.size) { sn.events.forEach((e) => { e._t = sn.t; S.store.set(e.id, e); }); S.lastOk = Math.max(S.lastOk, sn.t); }
      }
    }
    if (okPoly) { S.lastOk = Date.now(); S.error = null; }
    recompute();
    S.prev = before;
    watchAlerts(before);
    S.firstLoad = false;
    topicFetched.clear();
  } finally {
    S.loading = false; $('#btnRefresh').classList.remove('spin');
    setStatus(okPoly ? 'live' : S.store.size ? 'stale' : 'offline');
    render(true);
    translateVisible();
    if (route().name === 'topics') fetchTopic();
    setTimeout(() => { S.prev = new Map(); }, 2500);
    if (manual) toast(okPoly ? 'داده‌ها به‌روز شد ✓' : 'اتصال برقرار نشد؛ آخرین داده ذخیره‌شده نمایش داده می‌شود');
  }
}

function setStatus(st) {
  const el = $('#status');
  el.className = st === 'loading' ? '' : st;
  const t = { loading: 'در حال به‌روزرسانی…', live: 'زنده · ' + ago(S.lastOk), stale: 'داده قدیمی · ' + (S.lastOk ? ago(S.lastOk) : ''), offline: 'آفلاین — داده‌ای در دسترس نیست' }[st];
  el.innerHTML = '<i class="dot"></i> ' + esc(t);
  el.dataset.st = st;
}
setInterval(() => { const st = $('#status').dataset.st; if (st === 'live' || st === 'stale') setStatus(st); }, 20000);

// ---------------- هشدار واچ‌لیست ----------------
function watchAlerts(before) {
  if (!S.prefs.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  for (const id of S.watch) {
    const x = S.byId.get(id); if (!x) continue;
    const b = before.get(id); if (b === undefined) continue;
    const d = x.a.mover.p - b;
    if (Math.abs(d) >= 0.05) {
      const title = 'حرکت در واچ‌لیست';
      const body = tr(x.ev.title) + ' · ' + dpts(d) + ' واحد (اکنون ' + pct(x.a.mover.p) + ')';
      navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'w' + id, dir: 'rtl', lang: 'fa' })).catch(() => {});
    }
  }
}

// ---------------- اجزای نمایش ----------------
const flowColor = (s) => (s >= 70 ? '#2cff8f' : s >= 45 ? '#f5c542' : s >= 25 ? '#ff9e4a' : '#6b7a74');
const srcName = { poly: 'Polymarket', kalshi: 'Kalshi', predictit: 'PredictIt' };

function ring(score) {
  const C = 2 * Math.PI * 21, v = (score / 100) * C;
  return `<div class="ring" title="امتیاز جریان پول"><svg viewBox="0 0 54 54"><circle class="t" cx="27" cy="27" r="21"/><circle class="v" cx="27" cy="27" r="21" stroke="${flowColor(score)}" stroke-dasharray="${v.toFixed(1)} ${C.toFixed(1)}"/></svg><b style="color:${flowColor(score)}">${fa(score)}</b><small>جریان</small></div>`;
}

const FLAG_TXT = {
  spike: (a) => `⚡ اسپایک حجم ${num(a.ratio, a.ratio >= 10 ? 0 : 1)}×`,
  move: () => '✔ حرکت واقعی',
  noise: () => '〰 نویز کم‌حجم',
  corr: (a) => `🔗 ${fa(a.corrCount)} بازار هم‌حرکت`,
  gap: (a) => '⚠ هشدار اختلاف',
  new: () => '✦ تازه و پرحجم',
};

function card(x, { compact = false } = {}) {
  const { ev, a } = x;
  const m = a.mover;
  const p24 = clamp(m.p - m.dp, 0, 1);
  const dc = dirClass(m.dp);
  const multi = ev.markets.length > 1;
  const label = multi ? (m.label || m.q) : '';
  const growth = a.growth;
  const hasVol = !ev.noVolume;
  const prevP = S.prev.get(ev.id);
  const flash = prevP !== undefined && Math.abs(prevP - m.p) >= 0.005 ? (m.p > prevP ? 'flash-up' : 'flash-dn') : '';
  const tok = ev.src === 'poly' ? m.tok : '';
  const flags = a.flags.filter((f) => f !== 'noise' || !a.flags.includes('move')).slice(0, 4);
  return `<article class="card ${a.flow >= 70 ? 'hot' : ''} ${flash}" data-open="${esc(ev.id)}">
    <div class="c-top">
      ${ring(a.flow)}
      <div class="c-main">
        <h3 class="c-title" data-tr="${esc(ev.title)}">${esc(tr(ev.title))}</h3>
        <div class="c-sub"><span class="src ${ev.src}">${srcName[ev.src]}${ev.approx ? ' · تقریبی' : ''}</span><span>${CAT_BY_ID[a.cat].icon} ${CAT_BY_ID[a.cat].fa}</span><button class="star ${S.watch.has(ev.id) ? 'on' : ''}" data-watch="${esc(ev.id)}" aria-label="واچ‌لیست">${S.watch.has(ev.id) ? '★' : '☆'}</button></div>
      </div>
    </div>
    <div class="c-prob">
      <span class="p num">${pct(m.p)}</span>
      <span class="d ${dc} num">${arrow(m.dp)} ${dpts(m.dp)}</span>
      <span class="was">۲۴ ساعت قبل: <span class="num">${pct(p24)}</span></span>
      ${label ? `<span class="lbl" data-tr="${esc(label)}">${esc(tr(label))}</span>` : ''}
    </div>
    ${tok && !compact ? `<svg class="spark" data-tok="${esc(tok)}" viewBox="0 0 300 34" preserveAspectRatio="none"></svg>` : ''}
    <div class="metrics">
      <div><small>حجم ۲۴ساعته</small><b class="num">${hasVol ? usd(ev.v24) : '—'}</b></div>
      <div><small>رشد حجم</small><b class="num ${Number.isFinite(growth) ? dirClass(growth, 0.02) : 'flat'}">${hasVol && Number.isFinite(growth) ? signedPct(growth) : '—'}</b></div>
      <div><small>نقدینگی</small><b>${hasVol ? `<span class="liq ${a.liq}">${LIQ_FA[a.liq]}</span>` : '—'}</b></div>
      <div><small>زمان باقی‌مانده</small><b>${esc(timeLeft(ev.end))}</b></div>
    </div>
    ${flags.length ? `<div class="tags">${flags.map((f) => `<span class="tag ${f}">${FLAG_TXT[f](a)}</span>`).join('')}</div>` : ''}
  </article>`;
}

function skeleton(n = 4) { return `<div class="list">${'<div class="skel"></div>'.repeat(n)}</div>`; }

function chipsRow(items, isOn, attr, extra = '') {
  return `<div class="chips">${items.map((it) => `<button class="chip ${extra} ${isOn(it.id) ? 'on' : ''}" ${attr}="${esc(it.id)}">${it.label}</button>`).join('')}</div>`;
}

// ---------------- صفحه‌ها ----------------
function homeView() {
  if (!S.list.length) return S.firstLoad ? skeleton() : `<div class="empty">داده‌ای برای نمایش نیست.<br><button class="btn pri" data-act="refresh" style="margin-top:14px">تلاش دوباره</button></div>`;
  const poly = S.list.filter((x) => x.ev.src === 'poly');
  const total = poly.reduce((s, x) => s + x.ev.v24, 0);
  const movers = S.list.filter((x) => x.a.real).length;
  const spikes = S.list.filter((x) => x.a.spike).length;
  const hot = [...S.list].sort((p, q) => q.a.flow - p.a.flow).slice(0, 8);
  const catRows = CATS.map((c) => ({ c, s: S.cats[c.id] })).sort((p, q) => q.s.v24 - p.s.v24);
  const maxV = Math.max(1, ...catRows.map((r) => r.s.v24));
  const heat = [...poly].filter((x) => x.ev.liq > 0).sort((p, q) => q.ev.liq - p.ev.liq).slice(0, 18);
  const maxF = Math.max(1, ...heat.map((x) => x.a.flow));
  const cl = S.clusters.slice(0, 3);
  return `
  <div class="kpis">
    <div class="kpi gold"><small>حجم پول ۲۴ساعته (Polymarket)</small><b class="num">${usd(total)}</b></div>
    <div class="kpi"><small>بازارهای فعال رصدشده</small><b>${fa(S.list.length)}</b></div>
    <div class="kpi green"><small>حرکت‌های واقعی (غیرنویز)</small><b>${fa(movers)}</b></div>
    <div class="kpi"><small>اسپایک‌های حجمی</small><b>${fa(spikes)}</b></div>
  </div>
  ${cl.length ? `<h2 class="sec">هم‌حرکتی بازارها <small>چند بازار همزمان</small></h2><div class="feed">${cl.map(clusterHtml).join('')}</div>` : ''}
  <h2 class="sec">جریان پول به تفکیک دسته <small>۲۴ ساعت گذشته</small></h2>
  <div class="feed">${catRows.map(({ c, s }) => `
    <div class="cat" data-cat="${c.id}"><div class="ic">${c.icon}</div>
      <div><div class="nm"><span>${c.fa}</span><span class="num" style="color:var(--tx2);font-weight:400;font-size:12px">${fa(s.n)} بازار</span></div>
      <div class="bar"><i style="width:${(s.v24 / maxV * 100).toFixed(1)}%;background:${c.color}"></i></div></div>
      <div class="rt"><b class="num">${usd(s.v24)}</b><span class="${Number.isFinite(s.growth) ? dirClass(s.growth, 0.02) : 'flat'} num">${Number.isFinite(s.growth) ? arrow(s.growth, 0.02) + ' ' + signedPct(s.growth) : '—'}</span></div>
    </div>`).join('')}</div>
  <h2 class="sec">داغ‌ترین بازارها <small>بر اساس امتیاز جریان پول</small><a href="#/markets">همه ←</a></h2>
  <div class="list two">${hot.map((x) => card(x)).join('')}</div>
  <h2 class="sec">هیت‌مپ نقدینگی <small>۱۸ بازار پرنقدینگی</small></h2>
  <div class="heat">${heat.map((x) => `<div class="hc l-${x.a.liq}" data-open="${esc(x.ev.id)}"><span data-tr="${esc(x.ev.title)}">${esc(tr(x.ev.title))}</span><b class="num">${usd(x.ev.liq)}</b><i style="transform:scaleX(${(x.a.flow / maxF).toFixed(2)})"></i></div>`).join('')}</div>
  <div class="legend"><span style="--c:#2cff8f">نقدینگی بالا</span><span style="--c:#f5c542">متوسط</span><span style="--c:#ff4d6d">کم</span><span style="--c:#fff">نوار پایین = قدرت جریان</span></div>
  <h2 class="sec">فید رویدادها <small>استخراج‌شده از حرکت بازارها</small></h2>
  <div class="feed">${S.feed.slice(0, 12).map(feedItem).join('') || '<div class="empty">فعلاً رویداد معناداری ثبت نشده.</div>'}</div>
  <p class="disc">داده‌ها از APIهای عمومی Polymarket (کامل)، Kalshi و PredictIt (مکمل) گرفته می‌شود. «امتیاز جریان پول» و «هشدار اختلاف» برآوردهای ساده و توضیح‌پذیر از حجم، تغییر قیمت و نقدینگی‌اند؛ توصیه مالی نیستند.</p>`;
}

function clusterHtml(c) {
  const name = c.kind === 'cat' ? CAT_BY_ID[c.key].fa : (PLACE_BY_ID[c.key]?.fa || c.key);
  const dirTxt = c.up && !c.down ? 'همگی با افزایش احتمال' : c.down && !c.up ? 'همگی با کاهش احتمال' : `${fa(c.up)} بازار افزایش و ${fa(c.down)} بازار کاهش`;
  return `<div class="cluster" data-cluster="${c.kind}:${esc(c.key)}">🔗 <b>${fa(c.n)} بازار</b> در «${esc(name)}» همزمان حرکت معنادار داشته‌اند.<br><small style="color:var(--tx2)">${dirTxt} · مجموع حجم <span class="num">${usd(c.vol)}</span></small></div>`;
}

function feedItem(it) {
  const { ev, a, m } = it;
  const t = `<span data-tr="${esc(ev.title)}">${esc(tr(ev.title))}</span>`;
  const lab = ev.markets.length > 1 ? ` «${esc(tr(m.label || m.q))}»` : '';
  let ico = '📈', body = '';
  if (it.kind === 'move') {
    ico = m.dp > 0 ? '🟢' : '🔴';
    body = `${t}${lab}: احتمال از <b class="num">${pct(clamp(m.p - m.dp, 0, 1))}</b> به <b class="num ${dirClass(m.dp)}">${pct(m.p)}</b> رسید (${dpts(m.dp)} واحد) با حجم ${usd(ev.v24)}`;
  } else if (it.kind === 'spike') {
    ico = '⚡'; body = `${t}: حجم ${num(a.ratio, 1)} برابر میانگین روزهای قبل شد — ${usd(ev.v24)} در ۲۴ ساعت`;
  } else if (it.kind === 'new') {
    ico = '✦'; body = `${t}: بازار تازه‌ایجاد‌شده با ${usd(ev.v24)} حجم در ۲۴ ساعت`;
  } else {
    ico = '⚠'; body = `${t}: ${esc(a.gap.why)}`;
  }
  return `<div class="fi" data-open="${esc(ev.id)}"><div class="ico">${ico}</div><div class="tx">${body}<small>${CAT_BY_ID[a.cat].fa} · ${srcName[ev.src]}</small></div></div>`;
}

// ----- فهرست بازارها -----
function filterList() {
  let arr = S.list.filter((x) => S.src.has(x.ev.src));
  if (S.cat.size) arr = arr.filter((x) => S.cat.has(x.a.cat));
  if (S.tag) arr = arr.filter((x) => x.ev.tags.some((t) => t.s === S.tag));
  if (S.only.has('move')) arr = arr.filter((x) => x.a.real);
  if (S.only.has('spike')) arr = arr.filter((x) => x.a.spike);
  if (S.only.has('gap')) arr = arr.filter((x) => x.a.gap);
  if (S.only.has('watch')) arr = arr.filter((x) => S.watch.has(x.ev.id));
  const q = S.q.trim().toLowerCase();
  if (q) {
    const ids = new Set(S.searchRes.map((e) => e.id));
    arr = arr.filter((x) => {
      const hay = (x.ev.title + ' ' + tr(x.ev.title) + ' ' + x.ev.markets.map((m) => m.q + ' ' + m.label).join(' ') + ' ' + x.ev.tags.map((t) => t.l).join(' ')).toLowerCase();
      return hay.includes(q) || ids.has(x.ev.id);
    });
  }
  return sortList(arr, S.sort);
}
function sortList(arr, by) {
  const f = {
    flow: (x) => x.a.flow,
    vol: (x) => x.ev.v24,
    chg: (x) => Math.abs(x.a.mover.dp),
    liq: (x) => x.ev.liq,
    end: (x) => -(Date.parse(x.ev.end) || 9e15),
  }[by];
  return [...arr].sort((p, q) => f(q) - f(p) || q.ev.v24 - p.ev.v24);
}

function topTags() {
  const c = new Map();
  for (const x of S.list) for (const t of x.ev.tags) c.set(t.s, { l: t.l, v: (c.get(t.s)?.v || 0) + x.ev.v24, s: t.s });
  const skip = new Set(['recurring', 'earn-4', 'all', 'featured', 'new', 'weekly', 'daily', 'monthly', 'games', 'states']);
  return [...c.values()].filter((t) => t.s && !skip.has(t.s) && !/earn/i.test(t.s)).sort((a, b) => b.v - a.v).slice(0, 24);
}

function marketsView() {
  const arr = filterList();
  const tags = topTags();
  const srcItems = [{ id: 'poly', label: 'Polymarket' }, { id: 'kalshi', label: 'Kalshi' }, { id: 'predictit', label: 'PredictIt' }];
  const catItems = CATS.map((c) => ({ id: c.id, label: c.icon + ' ' + c.fa }));
  const onlyItems = [{ id: 'move', label: '✔ حرکت واقعی' }, { id: 'spike', label: '⚡ اسپایک' }, { id: 'gap', label: '⚠ اختلاف' }, { id: 'watch', label: '★ واچ‌لیست' }];
  return `
  <div class="search"><input id="q" type="search" inputmode="search" placeholder="جستجو: نفت، ایران، bitcoin، لیگ قهرمانان…" value="${esc(S.q)}" autocomplete="off"></div>
  ${chipsRow(srcItems, (id) => S.src.has(id), 'data-src', 'g')}
  ${chipsRow(catItems, (id) => S.cat.has(id), 'data-cat2')}
  ${chipsRow(onlyItems, (id) => S.only.has(id), 'data-only', 'g')}
  <div class="chips"><button class="chip ${!S.tag ? 'on' : ''}" data-tag="">همه تگ‌ها</button>${tags.map((t) => `<button class="chip ${S.tag === t.s ? 'on' : ''}" data-tag="${esc(t.s)}" data-tr="${esc(t.l)}">${esc(tr(t.l))}</button>`).join('')}</div>
  <div class="row2"><select class="sel" id="sort">
    ${[['flow', 'مرتب‌سازی: امتیاز جریان پول'], ['vol', 'بیشترین حجم ۲۴ساعته'], ['chg', 'بیشترین تغییر احتمال'], ['liq', 'بیشترین نقدینگی'], ['end', 'نزدیک‌ترین پایان']].map(([v, l]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
  </select><span id="cnt" style="color:var(--tx3);font-size:12.5px;white-space:nowrap">${fa(arr.length)} نتیجه</span></div>
  <div id="results">${resultsHtml(arr)}</div>`;
}
function resultsHtml(arr) {
  if (!arr.length) return `<div class="empty">موردی پیدا نشد.${S.q ? '<br>جستجو در Polymarket ادامه دارد…' : ''}</div>`;
  const slice = arr.slice(0, S.shown);
  return `<div class="list two">${slice.map((x) => card(x)).join('')}</div>` + (arr.length > S.shown ? `<button class="more" data-act="more">نمایش بیشتر (${fa(arr.length - S.shown)} مورد دیگر)</button>` : '');
}

// ----- صفحه‌های ویژه -----
const TOPICS = {
  iran: { fa: 'ایران', icon: '🇮🇷', tag: 'iran', test: (x) => x.a.iran, subs: [['all', 'همه'], ['nuc', 'هسته‌ای'], ['war', 'جنگ و امنیت'], ['oil', 'نفت و تنگه هرمز'], ['pol', 'سیاست داخلی']],
    subTest: { nuc: /nuclear|enrich|iaea|deal|uranium|fordow|natanz/i, war: /strike|attack|war|military|missile|ceasefire|invade|israel|us forces|bomb/i, oil: /oil|crude|hormuz|brent|gas|sanction/i, pol: /khamenei|pezeshkian|regime|election|president|leader|protest|supreme/i } },
  commod: { fa: 'کامودیتی‌ها', icon: '🛢', tag: 'commodities', test: (x) => x.a.cat === 'commod', subs: [['all', 'همه'], ['oil', 'نفت'], ['gold', 'طلا'], ['silver', 'نقره'], ['gas', 'گاز'], ['other', 'سایر']],
    subTest: { oil: /\b(oil|crude|brent|wti|opec)\b/i, gold: /\bgold\b/i, silver: /\bsilver\b/i, gas: /\b(natural gas|lng|gasoline)\b/i } },
  crypto: { fa: 'کریپتو', icon: '₿', tag: 'crypto', test: (x) => x.a.cat === 'crypto', subs: [['all', 'همه'], ['btc', 'بیت‌کوین'], ['eth', 'اتریوم'], ['sol', 'سولانا'], ['alt', 'آلت‌کوین‌ها']],
    subTest: { btc: /\b(bitcoin|btc)\b/i, eth: /\b(ethereum|eth)\b/i, sol: /\b(solana|sol)\b/i } },
  football: { fa: 'فوتبال', icon: '⚽', tag: 'soccer', test: (x) => x.a.football, subs: [['all', 'همه'], ['ucl', 'لیگ قهرمانان'], ['wc', 'جام جهانی'], ['epl', 'لیگ برتر'], ['esp', 'لالیگا'], ['oth', 'سایر لیگ‌ها']],
    subTest: { ucl: /champions league|europa league|uefa/i, wc: /world cup|fifa/i, epl: /premier league|arsenal|chelsea|liverpool|manchester|tottenham|newcastle|aston villa/i, esp: /la liga|real madrid|barcelona|atletico/i } },
};
const topicFetched = new Set();

function topicItems() {
  const T = TOPICS[S.topic];
  let arr = S.list.filter((x) => T.test(x) && S.src.has(x.ev.src));
  const sub = S.sub || 'all';
  if (sub !== 'all') {
    const re = T.subTest[sub];
    if (re) arr = arr.filter((x) => re.test(x.ev.title + ' ' + x.ev.markets.map((m) => m.q).join(' ')));
    else { // «سایر»
      const all = Object.values(T.subTest);
      arr = arr.filter((x) => !all.some((r) => r.test(x.ev.title)));
    }
  }
  return sortList(arr, S.sort === 'end' ? 'end' : 'flow');
}

function topicsView() {
  const T = TOPICS[S.topic];
  const arr = topicItems();
  const v24 = arr.reduce((s, x) => s + x.ev.v24, 0);
  const mv = arr.filter((x) => x.a.real).length;
  const fed = topicFetched.has(S.topic);
  return `
  <div class="chips">${Object.entries(TOPICS).map(([id, t]) => `<button class="chip ${S.topic === id ? 'on' : ''}" data-topic="${id}">${t.icon} ${t.fa}</button>`).join('')}</div>
  <div class="chips">${T.subs.map(([id, l]) => `<button class="chip g ${(S.sub || 'all') === id ? 'on' : ''}" data-sub="${id}">${l}</button>`).join('')}</div>
  <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi gold"><small>حجم ۲۴ساعته</small><b class="num" style="font-size:20px">${usd(v24)}</b></div>
    <div class="kpi"><small>بازارها</small><b style="font-size:20px">${fa(arr.length)}</b></div>
    <div class="kpi green"><small>حرکت واقعی</small><b style="font-size:20px">${fa(mv)}</b></div>
  </div>
  ${S.topic === 'iran' ? iranBox(arr) : ''}
  <h2 class="sec">${T.icon} بازارهای ${T.fa} <small>${fed ? '' : 'در حال تکمیل از Polymarket…'}</small></h2>
  ${arr.length ? `<div class="list two">${arr.slice(0, 40).map((x) => card(x)).join('')}</div>` : `<div class="empty">${fed ? 'بازار فعالی در این بخش پیدا نشد.' : 'در حال بارگذاری…'}</div>`}`;
}

function iranBox(arr) {
  const cl = S.clusters.find((c) => c.kind === 'country' && c.key === 'IR');
  const top = arr.filter((x) => x.a.real).slice(0, 1)[0];
  return `<div class="alert info" style="margin-top:0;margin-bottom:6px">🇮🇷 پوشش بازارهای مرتبط با ایران شامل هر بازاری است که عنوان یا تگ آن به ایران، تهران، تنگه هرمز، خامنه‌ای و… اشاره کند.${cl ? `<br>🔗 ${fa(cl.n)} بازار ایرانی همزمان حرکت معنادار داشته‌اند.` : ''}${top ? `<br>بیشترین حرکت: «${esc(tr(top.ev.title))}» (${dpts(top.a.mover.dp)} واحد)` : ''}</div>`;
}

async function fetchTopic() {
  const T = TOPICS[S.topic];
  if (topicFetched.has(S.topic)) return;
  topicFetched.add(S.topic);
  try {
    const evs = await D.fetchByTag(T.tag);
    ingest(evs); recompute();
  } catch { /* ادامه با داده موجود */ }
  if (route().name === 'topics') { render(); translateVisible(); }
}

// ----- واچ‌لیست / من -----
function watchView() {
  const ids = [...S.watch];
  const items = ids.map((id) => S.byId.get(id)).filter(Boolean);
  const missing = ids.length - items.length;
  const notifSupported = 'Notification' in window;
  return `
  <h2 class="sec" style="margin-top:4px">★ واچ‌لیست من <small>${fa(ids.length)} مورد</small></h2>
  ${items.length ? `<div class="list two">${items.map((x) => card(x)).join('')}</div>` : `<div class="empty">${ids.length ? 'در حال دریافت بازارهای ذخیره‌شده…' : 'هنوز چیزی ذخیره نکرده‌اید.<br>روی ☆ در کارت هر بازار بزنید.'}</div>`}
  ${missing > 0 && items.length ? `<p class="note">${fa(missing)} بازار ذخیره‌شده در حال حاضر در فهرست فعال نیست (ممکن است بسته شده باشد).</p>` : ''}
  <h2 class="sec">⚙ تنظیمات</h2>
  <div class="sw"><div>اعلان تغییر واچ‌لیست<small>${notifSupported ? 'وقتی اپ باز یا در پس‌زمینه است و بازار ذخیره‌شده ۵ واحد درصد حرکت کند. (اعلان پوش واقعی در نسخه بعدی)' : 'مرورگر شما اعلان را پشتیبانی نمی‌کند'}</small></div><button class="tgl ${S.prefs.notify ? 'on' : ''}" data-act="notify" ${notifSupported ? '' : 'disabled'} aria-label="اعلان"></button></div>
  <div class="sw"><div>به‌روزرسانی خودکار<small>هر ۲ دقیقه وقتی اپ باز است (با کش هوشمند برای رعایت محدودیت‌ها)</small></div><span class="liq high">فعال</span></div>
  <div class="btns"><button class="btn" data-act="share-watch">اشتراک‌گذاری واچ‌لیست</button><button class="btn" data-act="clear-cache">پاک‌کردن کش</button></div>
  <div class="btns" id="installBox" hidden><button class="btn pri" data-act="install">نصب اپ روی گوشی</button></div>
  <p class="disc">رادار جریان پول · نسخه ۱٫۰<br>ترجمه عنوان‌ها ماشینی است و ممکن است دقیق نباشد؛ متن اصلی در جزئیات هر بازار آمده است.</p>`;
}

// ----- نقشه -----
let landPath = '';
const CONT_BOX = { // [lonMin, lonMax, latMin, latMax]
  all: [-180, 180, -58, 80], me: [24, 64, 10, 44], eu: [-12, 50, 34, 72], as: [60, 150, -12, 56], af: [-20, 52, -36, 38], na: [-170, -50, 8, 72], sa: [-85, -32, -57, 14], oc: [110, 180, -48, -8],
};
function mapView() {
  if (!landPath) landPath = landDotsPath(3);
  const rows = mapData(S.list.filter((x) => x.ev.src === 'poly'), { topic: S.map.topic });
  const filtered = rows.filter((r) => S.map.cont === 'all' || PLACE_BY_ID[r.id].cont === S.map.cont);
  const maxV = Math.max(1, ...rows.map((r) => r.v24));
  const box = CONT_BOX[S.map.cont];
  const [x0, y0] = project(box[0], box[3]), [x1, y1] = project(box[1], box[2]);
  const vb = `${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}`;
  const zoom = MAP_W / (x1 - x0);
  const bubbles = [...rows].sort((a, b) => b.v24 - a.v24).map((r, i) => {
    const pl = PLACE_BY_ID[r.id]; const [x, y] = project(pl.lon, pl.lat);
    if (x < x0 - 30 || x > x1 + 30 || y < y0 - 30 || y > y1 + 30) return '';
    const k = Math.sqrt(r.v24 / maxV);
    const rad = (5 + 26 * k) / Math.sqrt(zoom);
    const avgFlow = r.items.slice(0, 5).reduce((s, x) => s + x.a.flow, 0) / Math.min(5, r.items.length);
    const col = avgFlow >= 55 ? '#ff7a59' : avgFlow >= 38 ? '#f5c542' : avgFlow >= 22 ? '#8dff5a' : '#2cff8f';
    const label = i < 14 || S.map.cont !== 'all';
    return `<g class="bub" data-place="${r.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle class="b" r="${(rad * 1.9).toFixed(1)}" fill="${col}" opacity=".14"/>
      <circle class="b" r="${rad.toFixed(1)}" fill="${col}" opacity=".55" stroke="${col}" stroke-width="${(1.2 / Math.sqrt(zoom)).toFixed(2)}"/>
      ${label ? `<text y="${(rad + 11 / Math.sqrt(zoom)).toFixed(1)}" text-anchor="middle" style="font-size:${(11 / Math.sqrt(zoom)).toFixed(1)}px">${esc(pl.fa)}</text>` : ''}
    </g>`;
  }).join('');
  const topics = [{ id: 'all', label: 'همه موضوعات' }, ...CATS.map((c) => ({ id: c.id, label: c.icon + ' ' + c.fa }))];
  const conts = [{ id: 'all', label: 'جهان' }, ...Object.entries(CONTINENTS).map(([id, l]) => ({ id, label: l }))];
  return `
  ${chipsRow(topics, (id) => S.map.topic === id, 'data-mtopic')}
  ${chipsRow(conts, (id) => S.map.cont === id, 'data-mcont', 'g')}
  <div class="mapbox ${S.map.fs ? 'fs' : ''}" id="mapbox">
    <div class="tools"><button data-act="mapfs" aria-label="تمام‌صفحه">${S.map.fs ? '✕' : '⛶'}</button></div>
    <svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="نقشه جریان پول جهان">
      <path class="land" d="${landPath}" stroke-width="${(4.2).toFixed(1)}"/>
      ${bubbles}
    </svg>
  </div>
  <div class="mapleg"><span>کم</span><span class="grad"></span><span>پرجریان</span></div>
  <p class="note">اندازه حباب = حجم ۲۴ساعته بازارهای مرتبط با آن کشور/منطقه؛ رنگ = قدرت میانگین جریان پول (سبز آرام ← نارنجی داغ). یک بازار ممکن است به چند کشور تعلق داشته باشد. روی حباب بزنید.</p>
  <h2 class="sec">پرجریان‌ترین کشورها</h2>
  <div class="feed">${[...filtered].sort((a, b) => b.v24 - a.v24).slice(0, 10).map((r) => `
    <div class="cat" data-place="${r.id}"><div class="ic">📍</div><div><div class="nm"><span>${esc(PLACE_BY_ID[r.id].fa)}</span><span class="num" style="color:var(--tx2);font-weight:400;font-size:12px">${fa(r.n)} بازار</span></div><div class="bar"><i style="width:${(r.v24 / maxV * 100).toFixed(1)}%;background:var(--gold)"></i></div></div><div class="rt"><b class="num">${usd(r.v24)}</b></div></div>`).join('') || '<div class="empty">برای این فیلتر داده‌ای نیست.</div>'}</div>`;
}

function placeSheet(id) {
  const pl = PLACE_BY_ID[id]; if (!pl) return;
  const rows = mapData(S.list.filter((x) => x.ev.src === 'poly'), { topic: S.map.topic }).find((r) => r.id === id);
  const items = rows ? rows.items : [];
  openSheet(`<h3>📍 ${esc(pl.fa)}</h3>
  <div class="sub"><span>${CONTINENTS[pl.cont] || ''}</span><span>·</span><span class="num">${usd(rows?.v24 || 0)} حجم ۲۴ساعته</span><span>·</span><span>${fa(items.length)} بازار</span></div>
  <div class="list" style="margin-top:14px">${items.slice(0, 25).map((x) => card(x, { compact: true })).join('') || '<div class="empty">بازاری یافت نشد.</div>'}</div>`);
}

// ---------------- جزئیات بازار ----------------
let detail = null;
async function openDetail(id) {
  const x = S.byId.get(id) || (S.store.has(id) ? { ev: S.store.get(id), a: analyzeAll([S.store.get(id)]).list[0].a } : null);
  if (!x) return;
  detail = { id, mi: Math.max(0, x.ev.markets.indexOf(x.a.mover)), range: '1w', hist: null, trades: null };
  paintDetail();
  loadDetailData();
}

function paintDetail() {
  if (!detail) return;
  const x = S.byId.get(detail.id); if (!x) return;
  const { ev, a } = x; const m = ev.markets[detail.mi] || ev.markets[0];
  const corr = a.corrWith.map((i) => S.byId.get(i)).filter(Boolean);
  const gapHtml = a.gap ? `<div class="alert">⚠ <b>هشدار اختلاف</b>${Number.isFinite(a.gap.est) ? ` — بازار روی <b class="num">${pct(a.gap.p)}</b> است و برآورد ساده‌ی مبتنی بر شواهد <b class="num">${pct(a.gap.est)}</b> (اختلاف ${dpts(a.gap.diff)} واحد).` : ' — حجم غیرعادی با قیمت ثابت.'}<br>${esc(a.gap.why)}<br><small style="color:var(--tx3)">برآورد ساده، نه پیش‌بینی قطعی و نه توصیه مالی.</small></div>` : '';
  const vsM = Number.isFinite(a.vsMonth) ? `<div class="st"><small>نسبت به میانگین ماهانه</small><b class="num ${a.vsMonth >= 1.5 ? 'up' : ''}">${num(a.vsMonth, 1)}×</b></div>` : '';
  const html = `
  <h3 data-tr="${esc(ev.title)}">${esc(tr(ev.title))}</h3>
  <div class="sub"><span class="src ${ev.src}">${srcName[ev.src]}</span><span>${CAT_BY_ID[a.cat].icon} ${CAT_BY_ID[a.cat].fa}</span><span>⏳ ${esc(timeLeft(ev.end))}</span>${isMachine(ev.title) ? '<span class="src">ترجمه ماشینی</span>' : ''}</div>
  <div class="sub" style="margin-top:4px;direction:ltr;text-align:left;opacity:.7">${esc(ev.title)}</div>
  <div class="grid2">
    <div class="st"><small>امتیاز جریان پول</small><b class="num" style="color:${flowColor(a.flow)}">${fa(a.flow)}/۱۰۰</b></div>
    <div class="st"><small>حجم ۲۴ساعته</small><b class="num">${ev.noVolume ? '—' : usd(ev.v24)}</b></div>
    <div class="st"><small>نقدینگی</small><b>${ev.noVolume ? '—' : `${usd(ev.liq)} · ${LIQ_FA[a.liq]}`}</b></div>
    <div class="st"><small>رشد حجم</small><b class="num ${Number.isFinite(a.growth) ? dirClass(a.growth, .02) : ''}">${Number.isFinite(a.growth) ? signedPct(a.growth) : '—'}</b></div>
    ${vsM}
    <div class="st"><small>بازار هم‌حرکت</small><b>${fa(a.corrCount || 0)}</b></div>
  </div>
  <div class="note" style="margin:-4px 0 8px">تفکیک امتیاز (از سقف هر بخش): حجم <span class="num">${fa(Math.round(a.volScore * 32))}/۳۲</span> · اسپایک <span class="num">${fa(Math.round(a.spikeScore * 20))}/۲۰</span> · حرکت <span class="num">${fa(Math.round(a.moveScore * 20))}/۲۰</span> · نقدینگی <span class="num">${fa(Math.round(a.liqScore * 14))}/۱۴</span> · همبستگی <span class="num">${fa(Math.round(a.corrScore * 14))}/۱۴</span></div>
  ${gapHtml}
  ${a.noise ? `<div class="alert info">〰 این حرکت در بازار کم‌حجم/کم‌نقدینگی رخ داده و احتمالاً نویز است.</div>` : ''}
  <h2 class="sec" style="margin-top:16px">${ev.markets.length > 1 ? 'گزینه‌ها / بازارها' : 'بازار'}</h2>
  <div>${ev.markets.map((mm, i) => `<div class="mrow ${i === detail.mi ? 'on' : ''}" data-mi="${i}">
    <div class="q" data-tr="${esc(mm.label || mm.q)}">${esc(tr(mm.label || mm.q))}</div><div class="pp num">${pct(mm.p, mm.p < 0.1 || mm.p > 0.9 ? 1 : 0)}</div>
    <small>حجم <span class="num">${ev.noVolume ? '—' : usd(mm.v24)}</span> · نقدینگی <span class="num">${ev.noVolume ? '—' : usd(mm.liq)}</span></small>
    <small class="${dirClass(mm.dp)} num" style="text-align:left">${arrow(mm.dp)} ${dpts(mm.dp)} (۲۴ساعت)${mm.wp ? ' · ' + dpts(mm.wp) + ' (هفته)' : ''}</small></div>`).join('')}</div>
  <h2 class="sec">نمودار احتمال <small id="rangeBtns">
    ${['1d', '1w', '1m'].map((r) => `<a data-range="${r}" style="margin-inline-start:10px;${detail.range === r ? 'text-decoration:underline' : 'color:var(--tx3)'}">${{ '1d': 'روز', '1w': 'هفته', '1m': 'ماه' }[r]}</a>`).join('')}</small></h2>
  <div class="chartbox" id="chartbox">${chartHtml()}</div>
  ${ev.src === 'poly' ? `<h2 class="sec">جریان معاملات اخیر <small>معاملات تازه‌ی همین بازار</small></h2><div id="tradebox">${tradesHtml()}</div>` : ''}
  ${corr.length ? `<h2 class="sec">بازارهای هم‌حرکت</h2><div class="feed">${corr.map((c) => `<div class="fi" data-open="${esc(c.ev.id)}"><div class="ico">🔗</div><div class="tx"><span data-tr="${esc(c.ev.title)}">${esc(tr(c.ev.title))}</span><small class="num">${dpts(c.a.mover.dp)} واحد · ${usd(c.ev.v24)}</small></div></div>`).join('')}</div>` : ''}
  <div class="btns">
    <button class="btn pri" data-act="share" data-id="${esc(ev.id)}">اشتراک‌گذاری سیگنال</button>
    <button class="btn ${S.watch.has(ev.id) ? 'pri' : ''}" data-watch="${esc(ev.id)}" data-sheetwatch>${S.watch.has(ev.id) ? '★ در واچ‌لیست' : '☆ افزودن به واچ‌لیست'}</button>
    <a class="btn ghost" href="${esc(ev.url)}" target="_blank" rel="noopener">باز کردن در ${srcName[ev.src]} ↗</a>
  </div>
  ${ev.approx ? '<p class="note">حجم Kalshi از «تعداد قرارداد × قیمت» تخمین زده شده و ممکن است با رقم رسمی کمی تفاوت داشته باشد.</p>' : ''}
  ${ev.noVolume ? '<p class="note">PredictIt حجم و نقدینگی در API عمومی ندارد؛ فقط قیمت و تغییر نسبت به آخرین بسته‌شدن نمایش داده می‌شود.</p>' : ''}`;
  const keep = $('#sheet')?.scrollTop || 0;
  openSheet(html, true);
  $('#sheet').scrollTop = keep;
  bindChart();
}

function chartHtml() {
  const h = detail.hist;
  if (h === null) return '<div class="empty" style="padding:50px 0">در حال دریافت تاریخچه…</div>';
  if (!h.length) return '<div class="empty" style="padding:40px 0">تاریخچه‌ای برای این بازار در دسترس نیست.</div>';
  const W = 320, H = 170, padL = 6, padR = 6, padT = 14, padB = 18;
  const ps = h.map((q) => q.p); const mn = Math.min(...ps), mx = Math.max(...ps); const span = Math.max(mx - mn, 0.02);
  const t0 = h[0].t, t1 = h[h.length - 1].t;
  const X = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * (W - padL - padR);
  const Y = (p) => H - padB - ((p - mn) / span) * (H - padT - padB);
  const pts = h.map((q) => `${X(q.t).toFixed(1)},${Y(q.p).toFixed(1)}`);
  const up = ps[ps.length - 1] >= ps[0];
  const col = up ? '#2cff8f' : '#ff4d6d';
  const area = `M${pts[0]} L${pts.join(' L')} L${X(t1).toFixed(1)},${H - padB} L${X(t0).toFixed(1)},${H - padB}Z`;
  const tb = detail.trades?.buckets;
  let vb = '';
  if (tb && tb.length > 1) {
    const mv = Math.max(...tb.map((b) => b.usd), 1);
    vb = tb.filter((b) => b.t >= t0 && b.t <= t1).map((b) => `<rect x="${(X(b.t) - 2).toFixed(1)}" y="${(H - padB - 26 * (b.usd / mv)).toFixed(1)}" width="4" height="${(26 * (b.usd / mv)).toFixed(1)}" fill="#f5c542" opacity=".35"/>`).join('');
  }
  return `<svg class="chart" id="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" data-t0="${t0}" data-t1="${t1}">
    <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#gA)"/>${vb}
    <path d="M${pts.join(' L')}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <line id="cl" x1="0" x2="0" y1="${padT}" y2="${H - padB}" stroke="#fff" stroke-opacity=".5" stroke-dasharray="3 3" visibility="hidden" vector-effect="non-scaling-stroke"/>
  </svg><span class="ylab hi num">${pct(mx, 1)}</span><span class="ylab lo num">${pct(mn, 1)}</span><div class="tip" id="tip">${pct(ps[ps.length - 1], 1)} · اکنون</div>`;
}

function tradesHtml() {
  const t = detail.trades;
  if (t === null) return '<div class="empty" style="padding:20px">در حال دریافت معاملات…</div>';
  if (!t) return '<div class="empty" style="padding:20px">معامله‌ای ثبت نشده یا API در دسترس نیست.</div>';
  const hrs = t.span / 3600e3;
  const biasPos = ((t.bias + 1) / 2) * 100;
  return `<div class="st"><small>آخرین ${fa(t.n)} معامله (بازه ≈ ${num(hrs, hrs < 10 ? 1 : 0)} ساعت) · مجموع <span class="num">${usd(t.total)}</span></small>
    <div class="bias"><i style="inset-inline-start:calc(${(100 - biasPos).toFixed(1)}% - 2px)"></i></div>
    <div style="display:flex;justify-content:space-between;font-size:12px"><span class="up">فشار صعودی (بله) <span class="num">${usd(t.buyYes)}</span></span><span class="down">فشار نزولی <span class="num">${usd(t.sellYes)}</span></span></div></div>
    ${t.big.length ? `<div style="margin-top:8px"><small style="color:var(--tx3)">معاملات بزرگ (≥ ${usd(CFG.bigTrade)})</small>${t.big.map((b) => `<div class="tr"><span class="${b.bullish ? 'up' : 'down'}">${b.bullish ? '▲ خرید «بله»' : '▼ فشار «خیر»'} · ${b.side === 'BUY' ? 'خرید' : 'فروش'} ${esc(b.outcome || '')}</span><span class="num">${usd(b.usd)} @ ${pct(b.price)} · ${esc(ago(b.t))}</span></div>`).join('')}</div>` : '<p class="note">معامله بزرگی در این بازه ثبت نشده است.</p>'}`;
}

async function loadDetailData() {
  const d = detail; if (!d) return;
  const x = S.byId.get(d.id); if (!x) return;
  const m = x.ev.markets[d.mi] || x.ev.markets[0];
  if (x.ev.src !== 'poly') { d.hist = []; d.trades = null; updateChart(); return; }
  d.hist = null; d.trades = d.trades || null;
  const rg = { '1d': ['1d', 15], '1w': ['1w', 60], '1m': ['1m', 360] }[d.range];
  const [h, tr_] = await Promise.all([
    D.fetchHistory(m.tok, rg[0], rg[1]).catch(() => []),
    D.fetchTrades(m.cid, 400).then(analyzeTrades).catch(() => false),
  ]);
  if (detail !== d) return;
  d.hist = h; d.trades = tr_ === null ? false : tr_;
  updateChart();
}
function updateChart() {
  const cb = $('#chartbox'); if (cb) { cb.innerHTML = chartHtml(); bindChart(); }
  const tb = $('#tradebox'); if (tb) tb.innerHTML = tradesHtml();
}
function bindChart() {
  const svg = $('#chart'); if (!svg || !detail?.hist?.length) return;
  const h = detail.hist; const t0 = h[0].t, t1 = h[h.length - 1].t;
  const mv = (e) => {
    const r = svg.getBoundingClientRect();
    const f = clamp((e.clientX - r.left) / r.width, 0, 1);
    const t = t0 + f * (t1 - t0);
    let best = h[0]; for (const q of h) if (Math.abs(q.t - t) < Math.abs(best.t - t)) best = q;
    const line = $('#cl'); line.setAttribute('x1', f * 320); line.setAttribute('x2', f * 320); line.setAttribute('visibility', 'visible');
    $('#tip').textContent = pct(best.p, 1) + ' · ' + new Date(best.t).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  svg.addEventListener('pointermove', mv); svg.addEventListener('pointerdown', mv);
}

// ---------------- Sheet / toast ----------------
function openSheet(html, keep = false) {
  const sh = $('#sheet'), sc = $('#scrim');
  sh.innerHTML = `<div class="grab" data-act="close"></div>` + html;
  sh.hidden = false; sc.hidden = false;
  if (!keep) { sh.scrollTop = 0; sh.style.animation = 'none'; void sh.offsetWidth; sh.style.animation = ''; }
  document.body.style.overflow = 'hidden';
  translateVisible();
}
function closeSheet() {
  $('#sheet').hidden = true; $('#sheet').innerHTML = ''; $('#scrim').hidden = true; document.body.style.overflow = ''; detail = null;
}
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
}

// ---------------- ترجمه پس‌زمینه ----------------
let trBusy = false;
const applyTr = debounce(() => {
  $$('[data-tr]').forEach((el) => { const en = el.dataset.tr; const t = tr(en); if (el.textContent !== t) el.textContent = t; });
}, 120);
async function translateVisible() {
  if (trBusy) return; trBusy = true;
  try {
    const titles = $$('[data-tr]').map((el) => el.dataset.tr);
    await enrich(titles, applyTr);
    applyTr();
  } finally { trBusy = false; }
}

// ---------------- sparkline تنبل ----------------
const sparkQueue = []; let sparkActive = 0;
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); sparkQueue.push(e.target); pumpSpark(); }
}, { rootMargin: '200px' }) : null;
function observeSparks() { $$('svg.spark[data-tok]:not([data-done])').forEach((el) => io && io.observe(el)); }
async function pumpSpark() {
  while (sparkActive < 3 && sparkQueue.length) {
    const el = sparkQueue.shift(); if (!el.isConnected) continue;
    sparkActive++;
    D.fetchHistory(el.dataset.tok, '1d', 30).then((h) => {
      if (!el.isConnected) return;
      if (h.length < 3) { el.style.display = 'none'; return; }
      const ps = h.map((q) => q.p); const up = ps[ps.length - 1] >= ps[0];
      el.innerHTML = `<path d="${sparkPath(ps, 300, 34)}" stroke="${up ? '#2cff8f' : '#ff4d6d'}" vector-effect="non-scaling-stroke"/>`;
      el.dataset.done = '1';
    }).catch(() => { el.style.display = 'none'; }).finally(() => { sparkActive--; pumpSpark(); });
  }
}

// ---------------- مسیریابی و رندر ----------------
function route() {
  const h = (location.hash || '#/home').replace(/^#\/?/, '').split('/');
  return { name: h[0] || 'home', arg: h[1] || '' };
}
function render(soft = false) {
  const r = route();
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === r.name));
  const y = window.scrollY;
  if (r.name === 'map') { view.innerHTML = mapView(); }
  else if (r.name === 'markets') { if (soft && document.activeElement?.id === 'q') { const f = filterList(); $('#results').innerHTML = resultsHtml(f); $('#cnt').textContent = fa(f.length) + ' نتیجه'; observeSparks(); return; } view.innerHTML = marketsView(); }
  else if (r.name === 'topics') { if (r.arg && TOPICS[r.arg] && S.topic !== r.arg) { S.topic = r.arg; S.sub = ''; } view.innerHTML = topicsView(); fetchTopic(); }
  else if (r.name === 'watch') { view.innerHTML = watchView(); fetchWatchMissing(); const ib = $('#installBox'); if (ib && deferredPrompt) ib.hidden = false; }
  else view.innerHTML = homeView();
  if (soft) window.scrollTo(0, y);
  observeSparks();
  if (detail) paintDetail();
}

async function fetchWatchMissing() {
  const missing = [...S.watch].filter((id) => !S.byId.has(id) && !id.includes(':'));
  if (!missing.length) return;
  try { const evs = await D.fetchEventsByIds(missing); if (evs.length) { ingest(evs); recompute(); if (route().name === 'watch') { render(true); translateVisible(); } } } catch {}
}

// ---------------- رویدادها ----------------
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-watch],[data-open],[data-cat],[data-cat2],[data-src],[data-only],[data-tag],[data-topic],[data-sub],[data-mtopic],[data-mcont],[data-place],[data-act],[data-cluster],[data-mi],[data-range]');
  if (!t) return;
  const d = t.dataset;
  if (d.watch !== undefined) {
    e.stopPropagation();
    const id = d.watch;
    if (S.watch.has(id)) { S.watch.delete(id); toast('از واچ‌لیست حذف شد'); } else { S.watch.add(id); toast('به واچ‌لیست اضافه شد ★'); }
    saveWatch();
    if (d.sheetwatch !== undefined) paintDetail();
    render(true); return;
  }
  if (d.mi !== undefined) { detail.mi = +d.mi; detail.hist = null; detail.trades = null; paintDetail(); loadDetailData(); return; }
  if (d.range) { detail.range = d.range; detail.hist = null; paintDetail(); loadDetailData(); return; }
  if (d.open) { openDetail(d.open); return; }
  if (d.place) { placeSheet(d.place); return; }
  if (d.cat) { S.cat = new Set([d.cat]); S.shown = 30; location.hash = '#/markets'; return; }
  if (d.cat2) { S.cat.has(d.cat2) ? S.cat.delete(d.cat2) : S.cat.add(d.cat2); S.shown = 30; render(); return; }
  if (d.src) { if (S.src.has(d.src) && S.src.size > 1) S.src.delete(d.src); else S.src.add(d.src); render(); return; }
  if (d.only) { S.only.has(d.only) ? S.only.delete(d.only) : S.only.add(d.only); S.shown = 30; render(); return; }
  if (d.tag !== undefined && t.classList.contains('chip')) { S.tag = d.tag; S.shown = 30; render(); translateVisible(); return; }
  if (d.topic) { S.topic = d.topic; S.sub = ''; history.replaceState(null, '', '#/topics/' + d.topic); render(); translateVisible(); return; }
  if (d.sub) { S.sub = d.sub; render(); translateVisible(); return; }
  if (d.mtopic) { S.map.topic = d.mtopic; render(); return; }
  if (d.mcont) { S.map.cont = d.mcont; render(); return; }
  if (d.cluster) {
    const [kind, key] = d.cluster.split(':');
    const c = S.clusters.find((q) => q.kind === kind && q.key === key); if (!c) return;
    const name = kind === 'cat' ? CAT_BY_ID[key].fa : PLACE_BY_ID[key]?.fa;
    openSheet(`<h3>🔗 هم‌حرکتی در «${esc(name || key)}»</h3><div class="sub">${fa(c.n)} بازار · مجموع حجم <span class="num">${usd(c.vol)}</span></div><div class="list" style="margin-top:14px">${c.ids.map((i) => S.byId.get(i)).filter(Boolean).map((x) => card(x, { compact: true })).join('')}</div>`);
    return;
  }
  switch (d.act) {
    case 'close': closeSheet(); break;
    case 'refresh': load({ manual: true }); break;
    case 'more': S.shown += 30; render(true); translateVisible(); break;
    case 'mapfs': toggleFs(); break;
    case 'share': shareSignal(d.id); break;
    case 'share-watch': shareWatch(); break;
    case 'notify': toggleNotify(); break;
    case 'install': doInstall(); break;
    case 'clear-cache': clearCaches(); break;
  }
});
$('#scrim').addEventListener('click', closeSheet);
$('#btnRefresh').addEventListener('click', () => load({ manual: true }));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#sheet').hidden) closeSheet(); else if (S.map.fs) toggleFs(); } });

view.addEventListener('input', (e) => {
  if (e.target.id === 'q') { S.q = e.target.value; S.shown = 30; render(true); remoteSearch(); }
});
view.addEventListener('change', (e) => { if (e.target.id === 'sort') { S.sort = e.target.value; render(); translateVisible(); } });

const remoteSearch = debounce(async () => {
  const q = S.q.trim(); if (q.length < 3) { S.searchRes = []; return; }
  try {
    const res = await D.searchPolymarket(q);
    if (q !== S.q.trim()) return;
    S.searchRes = res; ingest(res); recompute(); render(true); translateVisible();
  } catch { /* جستجوی محلی کافی است */ }
}, 450);

window.addEventListener('hashchange', () => { closeSheet(); render(); translateVisible(); window.scrollTo(0, 0); });

// ---------------- نقشه تمام‌صفحه ----------------
function toggleFs() {
  S.map.fs = !S.map.fs;
  const box = $('#mapbox');
  if (S.map.fs) { box?.requestFullscreen?.().catch(() => {}); document.body.style.overflow = 'hidden'; }
  else { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); document.body.style.overflow = ''; }
  render();
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && S.map.fs) { S.map.fs = false; document.body.style.overflow = ''; render(); } });

// ---------------- اشتراک‌گذاری ----------------
function signalText(x) {
  const { ev, a } = x; const m = a.mover;
  return `📡 رادار جریان پول\n${tr(ev.title)}${ev.markets.length > 1 ? ' — ' + tr(m.label || m.q) : ''}\nاحتمال: ${pct(m.p)} (${dpts(m.dp)} واحد در ۲۴ ساعت)\nحجم ۲۴ساعته: ${usd(ev.v24)} · امتیاز جریان: ${fa(a.flow)}/۱۰۰\n${ev.url}`;
}
async function shareText(text, url) {
  try {
    if (navigator.share) { await navigator.share({ title: 'رادار جریان پول', text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('متن سیگنال کپی شد ✓'); } catch { prompt('کپی کنید:', text); }
}
function shareSignal(id) { const x = S.byId.get(id); if (x) shareText(signalText(x)); }
function shareWatch() {
  const items = [...S.watch].map((id) => S.byId.get(id)).filter(Boolean);
  if (!items.length) return toast('واچ‌لیست خالی است');
  shareText('📡 واچ‌لیست رادار جریان پول\n\n' + items.map((x) => `• ${tr(x.ev.title)} — ${pct(x.a.mover.p)} (${dpts(x.a.mover.dp)})`).join('\n'));
}

// ---------------- اعلان / نصب / کش ----------------
async function toggleNotify() {
  if (S.prefs.notify) { S.prefs.notify = false; savePrefs(); render(true); return; }
  try {
    const p = await Notification.requestPermission();
    S.prefs.notify = p === 'granted'; savePrefs();
    toast(p === 'granted' ? 'اعلان فعال شد' : 'اجازه اعلان داده نشد');
  } catch { toast('اعلان پشتیبانی نمی‌شود'); }
  render(true);
}
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#btnInstall').hidden = false; const ib = $('#installBox'); if (ib) ib.hidden = false; });
window.addEventListener('appinstalled', () => { deferredPrompt = null; $('#btnInstall').hidden = true; toast('اپ نصب شد ✓'); });
async function doInstall() {
  if (!deferredPrompt) return toast('از منوی مرورگر «Install app / افزودن به صفحه اصلی» را بزنید');
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#btnInstall').hidden = true;
}
$('#btnInstall').addEventListener('click', doInstall);
async function clearCaches() {
  try {
    ['mf_tr_v1', 'mf_snap_v1:poly', 'mf_snap_v1:kalshi', 'mf_snap_v1:predictit'].forEach((k) => localStorage.removeItem(k));
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch {}
  toast('کش پاک شد؛ بارگذاری مجدد…'); setTimeout(() => location.reload(), 700);
}

// ---------------- راه‌اندازی ----------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// نمایش فوری از اسنپ‌شات، سپس داده زنده
(function boot() {
  const sn = D.loadSnapshot('poly');
  if (sn && Date.now() - sn.t < 6 * 3600e3) {
    sn.events.forEach((e) => { e._t = Date.now() - 24 * 60e3; S.store.set(e.id, e); });
    S.lastOk = sn.t; recompute(); S.firstLoad = false; setStatus('stale');
  }
  render(); translateVisible();
  load();
})();
let timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - S.lastOk > 90000) load(); });
window.addEventListener('online', () => load());
