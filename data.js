// لایه داده: Polymarket (کامل) + Kalshi و PredictIt (مکمل) + تاریخچه CLOB + معاملات
// ابتدا پروکسی هم‌دامنه (/api/...) با کش لبه؛ در صورت نبود، مستقیم از API عمومی.
import { nz, safeJSON } from './util.js';

const BASES = {
  gamma: ['/api/gamma', 'https://gamma-api.polymarket.com'],
  clob: ['/api/clob', 'https://clob.polymarket.com'],
  data: ['/api/data', 'https://data-api.polymarket.com'],
  kalshi: ['/api/kalshi', 'https://api.elections.kalshi.com/trade-api/v2'],
  predictit: ['/api/predictit', 'https://www.predictit.org/api/marketdata'],
};

const pref = safeJSON(localStorage.getItem('mf_base'), {}) || {};
const memo = new Map(); // url → {t, v}
const inflight = new Map();

function order(kind) {
  const list = BASES[kind];
  return pref[kind] === 1 ? [list[1], list[0]] : list;
}

export async function getJSON(kind, path, { ttl = 45000, signal } = {}) {
  const key = kind + path;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    let lastErr;
    for (const base of order(kind)) {
      try {
        const res = await fetch(base + path, { signal, headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (!(res.headers.get('content-type') || '').includes('json')) throw new Error('not-json');
        const v = await res.json();
        const idx = BASES[kind].indexOf(base);
        if (pref[kind] !== idx) { pref[kind] = idx; try { localStorage.setItem('mf_base', JSON.stringify(pref)); } catch {} }
        memo.set(key, { t: Date.now(), v });
        return v;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('network');
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ---------- Polymarket ----------
function normMarket(m) {
  const prices = safeJSON(m.outcomePrices, []) || [];
  const outs = safeJSON(m.outcomes, []) || [];
  const toks = safeJSON(m.clobTokenIds, []) || [];
  let p = parseFloat(prices[0]);
  if (!Number.isFinite(p)) p = nz(m.lastTradePrice, NaN);
  return {
    id: String(m.id),
    cid: m.conditionId || '',
    q: m.question || m.groupItemTitle || '',
    label: m.groupItemTitle || '',
    out0: outs[0] || 'Yes',
    p,
    dp: nz(m.oneDayPriceChange),
    wp: nz(m.oneWeekPriceChange),
    mp: nz(m.oneMonthPriceChange),
    hp: nz(m.oneHourPriceChange),
    hasDp: m.oneDayPriceChange !== undefined && m.oneDayPriceChange !== null,
    v24: nz(m.volume24hr),
    v1w: nz(m.volume1wk),
    vol: nz(m.volumeNum ?? m.volume),
    liq: nz(m.liquidityNum ?? m.liquidity),
    spread: Number.isFinite(+m.spread) ? +m.spread : NaN,
    bid: nz(m.bestBid, NaN),
    ask: nz(m.bestAsk, NaN),
    end: m.endDate || '',
    tok: toks[0] || '',
    yesNo: outs.length === 2 && /^yes$/i.test(outs[0] || ''),
  };
}

export function normEvent(e) {
  const mk = (e.markets || [])
    .filter((m) => m.closed !== true && m.active !== false)
    .map(normMarket)
    .filter((m) => Number.isFinite(m.p))
    .sort((a, b) => b.v24 - a.v24 || b.vol - a.vol)
    .slice(0, 10);
  if (!mk.length) return null;
  const tags = (e.tags || []).map((t) => ({ l: t.label || '', s: t.slug || '' })).filter((t) => t.l);
  return {
    id: String(e.id),
    src: 'poly',
    slug: e.slug || '',
    url: e.slug ? 'https://polymarket.com/event/' + e.slug : 'https://polymarket.com',
    title: e.title || mk[0].q,
    image: e.image || e.icon || '',
    end: e.endDate || mk[0].end || '',
    created: e.createdAt || e.startDate || '',
    v24: nz(e.volume24hr, mk.reduce((s, m) => s + m.v24, 0)),
    v1w: nz(e.volume1wk, mk.reduce((s, m) => s + m.v1w, 0)),
    v1m: nz(e.volume1mo),
    vol: nz(e.volume, mk.reduce((s, m) => s + m.vol, 0)),
    liq: nz(e.liquidity, mk.reduce((s, m) => s + m.liq, 0)),
    tags,
    negRisk: !!e.negRisk,
    markets: mk,
  };
}

const Q = 'active=true&closed=false&order=volume24hr&ascending=false';

export async function fetchPolymarket({ signal } = {}) {
  const pages = await Promise.all(
    [0, 100].map((off) => getJSON('gamma', `/events?${Q}&limit=100&offset=${off}`, { signal }).catch(() => null))
  );
  const raw = pages.filter(Array.isArray).flat();
  if (!raw.length) throw new Error('no data');
  const seen = new Set();
  const out = [];
  for (const e of raw) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const n = normEvent(e);
    if (n) out.push(n);
  }
  return out;
}

export async function fetchByTag(slug, { signal } = {}) {
  const raw = await getJSON('gamma', `/events?${Q}&limit=60&tag_slug=${encodeURIComponent(slug)}`, { signal });
  return (Array.isArray(raw) ? raw : []).map(normEvent).filter(Boolean);
}

export async function searchPolymarket(q, { signal } = {}) {
  const j = await getJSON('gamma', `/public-search?q=${encodeURIComponent(q)}&limit_per_type=25&events_status=active`, { signal, ttl: 60000 });
  return (j?.events || []).map(normEvent).filter(Boolean);
}

export async function fetchEventsByIds(ids, { signal } = {}) {
  const res = await Promise.all(
    ids.slice(0, 25).map((id) => getJSON('gamma', `/events/${encodeURIComponent(id)}`, { signal, ttl: 30000 }).then(normEvent).catch(() => null))
  );
  return res.filter(Boolean);
}

// تاریخچه قیمت: [{t,p}]
export async function fetchHistory(tok, interval = '1m', fidelity = 360, { signal } = {}) {
  if (!tok) return [];
  const j = await getJSON('clob', `/prices-history?market=${encodeURIComponent(tok)}&interval=${interval}&fidelity=${fidelity}`, { signal, ttl: 90000 });
  return Array.isArray(j?.history) ? j.history.map((x) => ({ t: x.t * 1000, p: +x.p })) : [];
}

export async function fetchTrades(cid, limit = 400, { signal } = {}) {
  if (!cid) return [];
  const j = await getJSON('data', `/trades?market=${encodeURIComponent(cid)}&limit=${limit}&takerOnly=true`, { signal, ttl: 45000 });
  return (Array.isArray(j) ? j : []).map((x) => ({
    t: nz(x.timestamp) * 1000,
    side: x.side,
    size: nz(x.size),
    price: nz(x.price),
    usd: nz(x.size) * nz(x.price),
    outcome: x.outcome,
  }));
}

// ---------- Kalshi (مکمل) ----------
export async function fetchKalshi({ signal } = {}) {
  const j = await getJSON('kalshi', '/markets?status=open&limit=1000&mve_filter=exclude', { signal, ttl: 60000 });
  const groups = new Map();
  for (const m of j?.markets || []) {
    const p = parseFloat(m.last_price_dollars ?? m.yes_bid_dollars);
    if (!Number.isFinite(p) || p <= 0) continue;
    const prev = parseFloat(m.previous_price_dollars);
    const v24c = parseFloat(m.volume_24h_fp);
    const oi = parseFloat(m.open_interest_fp);
    const mk = {
      id: m.ticker, cid: '', q: m.title || m.yes_sub_title || m.ticker, label: m.yes_sub_title || '',
      out0: 'Yes', p,
      dp: Number.isFinite(prev) && prev > 0 ? p - prev : 0,
      hasDp: Number.isFinite(prev) && prev > 0,
      wp: 0, mp: 0, hp: 0,
      v24: (Number.isFinite(v24c) ? v24c : 0) * p, // تخمین دلاری = تعداد قرارداد × قیمت
      v1w: 0, vol: (parseFloat(m.volume_fp) || 0) * p,
      liq: (Number.isFinite(oi) ? oi : 0) * p, // اینجا «سقف تعهد باز» جایگزین نقدینگی است
      spread: (parseFloat(m.yes_ask_dollars) - parseFloat(m.yes_bid_dollars)) || NaN,
      bid: parseFloat(m.yes_bid_dollars), ask: parseFloat(m.yes_ask_dollars),
      end: m.close_time || m.expiration_time || '', tok: '', yesNo: true,
    };
    const g = groups.get(m.event_ticker) || [];
    g.push(mk);
    groups.set(m.event_ticker, g);
  }
  const events = [];
  for (const [tk, arr] of groups) {
    arr.sort((a, b) => b.v24 - a.v24);
    const top = arr[0];
    events.push({
      id: 'k:' + tk, src: 'kalshi', slug: tk, url: 'https://kalshi.com/markets/' + tk.split('-')[0].toLowerCase(),
      title: top.q, image: '', end: top.end, created: '',
      v24: arr.reduce((s, x) => s + x.v24, 0), v1w: 0, v1m: 0, vol: arr.reduce((s, x) => s + x.vol, 0),
      liq: arr.reduce((s, x) => s + x.liq, 0), tags: [], negRisk: arr.length > 1, markets: arr.slice(0, 8), approx: true,
    });
  }
  events.sort((a, b) => b.v24 - a.v24);
  return events.slice(0, 150);
}

// ---------- PredictIt (مکمل؛ بدون حجم) ----------
export async function fetchPredictIt({ signal } = {}) {
  const j = await getJSON('predictit', '/all/', { signal, ttl: 60000 });
  const events = [];
  for (const m of j?.markets || []) {
    if (m.status && m.status !== 'Open') continue;
    const mk = (m.contracts || [])
      .filter((c) => c.status === 'Open' && Number.isFinite(+c.lastTradePrice))
      .map((c) => {
        const p = +c.lastTradePrice;
        const prev = +c.lastClosePrice;
        return {
          id: 'pi' + c.id, cid: '', q: c.name || m.name, label: m.contracts.length > 1 ? c.shortName || c.name : '',
          out0: 'Yes', p, dp: Number.isFinite(prev) && prev > 0 ? p - prev : 0, hasDp: Number.isFinite(prev) && prev > 0,
          wp: 0, mp: 0, hp: 0, v24: 0, v1w: 0, vol: 0, liq: 0, spread: (+c.bestBuyYesCost - +c.bestSellYesCost) || NaN,
          bid: +c.bestSellYesCost, ask: +c.bestBuyYesCost, end: c.dateEnd && c.dateEnd !== 'NA' ? c.dateEnd : '', tok: '', yesNo: true,
        };
      })
      .sort((a, b) => b.p - a.p)
      .slice(0, 8);
    if (!mk.length) continue;
    events.push({
      id: 'pi:' + m.id, src: 'predictit', slug: String(m.id), url: m.url || 'https://www.predictit.org',
      title: m.name, image: m.image || '', end: mk[0].end, created: '',
      v24: 0, v1w: 0, v1m: 0, vol: 0, liq: 0, tags: [], negRisk: mk.length > 1, markets: mk, noVolume: true,
    });
  }
  return events;
}

// ---------- ذخیره محلی (آفلاین) ----------
const SNAP = 'mf_snap_v1';
export function saveSnapshot(src, events) {
  try {
    const slim = events.slice(0, 220);
    localStorage.setItem(SNAP + ':' + src, JSON.stringify({ t: Date.now(), events: slim }));
  } catch { /* پر بودن حافظه */ }
}
export function loadSnapshot(src) {
  return safeJSON(localStorage.getItem(SNAP + ':' + src), null);
}
