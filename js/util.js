/* MoneyFlow Radar — utilities */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(d);
}

export function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  const s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
  return s;
}

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 'ث';
  if (s < 3600) return Math.floor(s / 60) + 'د';
  if (s < 86400) return Math.floor(s / 3600) + 'س';
  return Math.floor(s / 86400) + 'ر';
}

export function toast(msg, ms = 2500) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, ms);
}

export function store(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
export function load(key, def = null) {
  try {
    const v = localStorage.getItem(key);
    return v != null ? JSON.parse(v) : def;
  } catch { return def; }
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h;
}
