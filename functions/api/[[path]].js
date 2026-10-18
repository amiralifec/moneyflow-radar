// Cloudflare Pages Function — پروکسی کش‌دار برای APIهای عمومی
// مسیر: /api/<gamma|clob|data|kalshi|predictit|tr>/...
// هدف: ۱) حل CORS  ۲) کش لبه (رعایت rate limit)  ۳) فقط میزبان‌های مجاز

const UP = {
  gamma: { base: 'https://gamma-api.polymarket.com', ttl: 60 },
  clob: { base: 'https://clob.polymarket.com', ttl: 90 },
  data: { base: 'https://data-api.polymarket.com', ttl: 45 },
  kalshi: { base: 'https://api.elections.kalshi.com/trade-api/v2', ttl: 60 },
  predictit: { base: 'https://www.predictit.org/api/marketdata', ttl: 60 },
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra } });

export async function onRequest({ request, params, waitUntil }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return json({ error: 'method' }, 405);

  const url = new URL(request.url);
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const kind = parts[0];
  const rest = parts.slice(1).join('/');

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let res;
  if (kind === 'tr') {
    const q = (url.searchParams.get('q') || '').slice(0, 400);
    if (!q) return json({ error: 'q' }, 400);
    const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fa&dt=t&q=' + encodeURIComponent(q));
    if (!r.ok) return json({ error: 'upstream' }, 502);
    const j = await r.json();
    const t = (j[0] || []).map((x) => x[0]).join('');
    res = json({ t }, 200, { 'cache-control': 'public, max-age=604800' });
  } else if (UP[kind]) {
    const target = UP[kind].base + '/' + rest + url.search;
    const r = await fetch(target, { headers: { accept: 'application/json', 'user-agent': 'moneyflow-radar/1.0' }, cf: { cacheTtl: UP[kind].ttl, cacheEverything: true } });
    const body = await r.arrayBuffer();
    res = new Response(body, {
      status: r.status,
      headers: {
        'content-type': r.headers.get('content-type') || 'application/json',
        'cache-control': r.ok ? `public, max-age=${UP[kind].ttl}` : 'no-store',
        ...CORS,
      },
    });
  } else {
    return json({ error: 'unknown upstream' }, 404);
  }

  if (res.ok) waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
