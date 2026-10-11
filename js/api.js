import { locale, t } from './i18n.js';

export class ApiError extends Error {
  constructor(code, details, status, data = {}) {
    super(code);
    this.code = code;
    this.details = details;
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  // GitHub Pages preview build: no server, the page answers its own calls.
  if (globalThis.REDSUN_PREVIEW) {
    const { previewApi } = await import('./preview.js');
    return previewApi(path, { method, body });
  }
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'generic', data.details, res.status, data);
  return data;
}

export const money = (n) => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat(locale(), { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

export const fmtTime = (isoDateTime) =>
  new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(isoDateTime));

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export const diffDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export const unitName = (u) => t('unit.name', { code: u.code, kind: t(`unit.kind.${u.kind}`) });

/** replaceChildren that skips null/false (the DOM API would print them as text). */
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));

/** Tiny element builder: h('div', { class: 'x', onclick }, child, 'text'). Text is always set safely. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // only ever used with static SVG strings
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
