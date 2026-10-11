// Shared building blocks for the admin screens.
import { t } from '../i18n.js';
import { h, fill, money } from '../api.js';

/** App-wide admin state: who is signed in, site config, current tab. */
export const S = { me: null, config: null, tab: 'dashboard' };
export const can = (perm) => S.me?.permissions?.includes('*') || S.me?.permissions?.includes(perm);
export const isOwner = () => S.me?.role === 'owner';

export const btn = (label, onclick, kind = 'ghost', extra = {}) => h('button', {
  type: 'button', onclick, ...extra,
  class: `btn inline-flex min-h-[2.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${
    kind === 'primary' ? 'bg-terra text-paper hover:bg-terra-700'
      : kind === 'dark' ? 'bg-ink text-paper hover:bg-oxblood'
        : kind === 'danger' ? 'border border-oxblood/30 text-oxblood hover:bg-oxblood/10'
          : 'border border-clay bg-paper-card hover:border-clay-2 hover:bg-paper'} ${extra.class ?? ''}`,
}, label);
export const card = (...children) => h('section', { class: 'rounded-2xl border border-clay/70 bg-paper-card p-4 elevated sm:p-5' }, ...children);
export const heading = (key, lead, right) => h('div', { class: 'mb-4 flex flex-wrap items-start justify-between gap-3' },
  h('div', {}, h('h2', { class: 'font-display text-xl font-semibold' }, t(key)), lead ? h('p', { class: 'mt-1 text-sm text-ink-muted' }, t(lead)) : null),
  right ?? null);
export const lbl = (key, input, cls = '') => h('label', { class: `block ${cls}` }, h('span', { class: 'mb-1 block text-xs font-semibold text-ink-muted' }, t(key)), input);
export const input = (attrs = {}) => h('input', { class: 'field field-sm', ...attrs });
export const select = (options, value, attrs = {}) => h('select', { class: 'field field-sm', ...attrs },
  ...options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) || null }, label)));
export const empty = (key) => h('p', { class: 'py-10 text-center text-sm text-ink-muted' }, t(key));
export const vnd = money;
export const num = (v) => new Intl.NumberFormat('vi-VN').format(v);

/** Chip with a dot: colour is never the only signal, the label always shows. */
export const chip = (text, tone = 'muted') => h('span', {
  class: `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone] ?? TONES.muted}`,
}, h('span', { class: 'h-1.5 w-1.5 rounded-full bg-current', 'aria-hidden': 'true' }), text);
export const TONES = {
  good: 'bg-palm-100 text-palm', warn: 'bg-sun-100 text-sun-600', bad: 'bg-oxblood/10 text-oxblood',
  info: 'bg-terra-100 text-terra-700', muted: 'bg-paper-2 text-ink-muted', dark: 'bg-ink text-paper',
};

// ── toasts ─────────────────────────────────────────────────────────────────
export const toastHost = h('div', { class: 'fixed bottom-4 left-1/2 z-[90] -translate-x-1/2', 'aria-live': 'polite' });
let toastTimer;
export function flash(text, tone = 'ok') {
  fill(toastHost, h('p', { class: `rounded-full px-5 py-2.5 text-sm font-semibold floating ${tone === 'ok' ? 'bg-palm text-paper' : 'bg-oxblood text-paper'}` }, text));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => fill(toastHost), 3500);
}

/** Readable message for an API error code. */
export function errText(err) {
  for (const key of [`mg.err.${err.code}`, `err.${err.code}`, `ad.${err.code}`, `ad.promo.${err.code}`]) {
    const v = t(key, err.details ?? {});
    if (v !== key) return v;
  }
  return t('ad.error', { code: err.code });
}
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export function fail(err) {
  if (err?.status === 401) return onUnauthorized();
  flash(errText(err), 'err');
}

// ── drawer: side panel on desktop, full sheet on phones ────────────────────
export function drawer(title, build, { wide = false, onClose } = {}) {
  const panel = h('div', { class: `ml-auto flex h-full w-full flex-col overflow-hidden bg-paper floating ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} sm:rounded-l-3xl` });
  const shade = h('div', { class: 'fixed inset-0 z-[70] flex bg-ink/40', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, panel);
  const body = h('div', { class: 'flex-1 overflow-y-auto p-4 sm:p-6' });
  const titleEl = h('h2', { class: 'font-display text-xl font-semibold' }, title);
  const close = () => {
    shade.remove();
    document.removeEventListener('keydown', esc);
    onClose?.();
  };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  fill(panel,
    h('div', { class: 'flex items-center justify-between gap-3 border-b border-clay/70 px-4 py-3 sm:px-6' }, titleEl,
      h('button', {
        type: 'button', class: 'btn grid h-10 w-10 place-items-center rounded-full hover:bg-paper-2', 'aria-label': t('ad.new.close'), onclick: close,
        html: '<svg viewBox="0 0 20 20" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15"/></svg>',
      })),
    body);
  shade.addEventListener('click', (e) => { if (e.target === shade) close(); });
  document.addEventListener('keydown', esc);
  document.body.append(shade);
  const api = { body, close, setTitle: (x) => { titleEl.textContent = x; }, refresh: () => fill(body, build(api)) };
  api.refresh();
  return api;
}

/** Tiny horizontal tab bar used inside screens. */
export function subTabs(items, active, onPick) {
  return h('div', { class: 'seg mb-4 max-w-full overflow-x-auto', role: 'tablist' },
    ...items.map(([id, key]) => h('button', { type: 'button', role: 'tab', 'aria-pressed': String(active === id), 'aria-selected': String(active === id), onclick: () => onPick(id) }, t(key))));
}

export const STAFF_ROLES = ['owner', 'reception', 'housekeeping'];
export const PAY_METHODS = ['cash', 'transfer', 'vietqr', 'card_onsite'];
export { h, fill, money };
