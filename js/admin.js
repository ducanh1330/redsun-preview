import { t, applyI18n, bindLangButtons, getLang, addStrings } from './i18n.js';
import { api, apiFetch, money, fmtDate, h, unitName, todayIso, addDays, fill } from './api.js';
import { VI, EN } from './admin/strings.js';
import { S, can, btn, card, heading, lbl, input, flash, fail as failToast, toastHost, setUnauthorizedHandler, drawer, errText } from './admin/ui.js';
import { renderDashboard, activityList } from './admin/dashboard.js';
import { renderBoard } from './admin/board.js';
import { renderGuests } from './admin/guests.js';
import { renderStock } from './admin/stock.js';
import { renderStaff } from './admin/staff.js';
import { renderReports } from './admin/reports.js';
import { renderTape } from './admin/tape.js';

addStrings(VI, EN);
const app = document.getElementById('app');
const STATUSES = ['pending', 'confirmed', 'deposit_paid', 'paid', 'needs_refund', 'cancelled', 'expired'];
const TONE = {
  pending: 'bg-sun-100 text-sun-600', confirmed: 'bg-palm-100 text-palm', deposit_paid: 'bg-palm-100 text-palm', paid: 'bg-palm-100 text-palm',
  needs_refund: 'bg-oxblood/10 text-oxblood', cancelled: 'bg-paper-2 text-ink-muted', expired: 'bg-paper-2 text-ink-muted',
};
Object.assign(S, { filters: { q: '', status: '', upcoming: true }, calFrom: todayIso() });
const unitLabel = (id) => (id === 'VILLA' ? t('ad.villa') : id === 'ALL' ? t('ad.allUnits') : unitName(S.config.units.find((u) => u.id === id) ?? { kind: 'room', code: id }));
const fail = failToast;
setUnauthorizedHandler(() => renderLogin());

// Tabs, in order, with the permission each needs.
const TABS = [
  ['dashboard', 'board', renderDashboardTab],
  ['board', 'board', (m) => renderBoard(m)],
  ['bookings', 'bookings', () => renderBookings()],
  ['calendar', 'calendar', (m) => renderTape(m, { openNewBooking })],
  ['guests', 'guests', (m) => renderGuests(m)],
  ['stock', 'stock.view', (m) => renderStock(m)],
  ['staff', 'shifts.self', (m) => renderStaff(m)],
  ['reports', 'settings', (m) => renderReports(m)],
  ['rates', 'settings', () => renderRates()],
  ['promos', 'settings', () => renderPromos()],
];
function renderDashboardTab(m) { return renderDashboard(m, { go }); }
function go(tab) { S.tab = tab; renderShell(); }

// ── login ──────────────────────────────────────────────────────────────────
function renderLogin(message) {
  S.me = null;
  stopBell();
  const user = h('input', { type: 'text', class: 'field', autocomplete: 'username', id: 'user', placeholder: 'admin', autocapitalize: 'none', spellcheck: 'false' });
  const pw = h('input', { type: 'password', class: 'field', autocomplete: 'current-password', required: true, id: 'pw' });
  const err = h('p', { class: 'mt-2 min-h-[1.25rem] text-sm text-oxblood', role: 'alert' }, message ?? '');
  const form = h('form', { class: 'w-full max-w-sm rounded-3xl border border-clay/70 bg-paper-card p-7 floating' },
    h('h1', { class: 'font-display text-2xl font-semibold' }, t('ad.login')),
    h('label', { class: 'mt-6 block', for: 'user' }, h('span', { class: 'mb-1.5 block text-sm font-semibold' }, t('mg.staff.username'))), user,
    h('label', { class: 'mt-4 block', for: 'pw' }, h('span', { class: 'mb-1.5 block text-sm font-semibold' }, t('ad.password'))), pw, err,
    h('button', { type: 'submit', class: 'btn mt-3 min-h-[2.875rem] w-full rounded-full bg-terra font-semibold text-paper hover:bg-terra-700' }, t('ad.signIn')),
    h('p', { class: 'mt-4 text-xs text-ink-muted' }, t('mg.loginHint')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/login', { method: 'POST', body: { username: user.value.trim(), password: pw.value } });
      start();
    } catch (ex) {
      err.textContent = t(`ad.${ex.code}`) !== `ad.${ex.code}` ? t(`ad.${ex.code}`) : t('ad.error', { code: ex.code });
      pw.select();
    }
  });
  // Pages demo: sample data lives in this browser; let testers start over.
  if (globalThis.REDSUN_PREVIEW) {
    form.append(h('div', { class: 'mt-5 border-t border-clay/70 pt-4 text-xs text-ink-muted' },
      h('p', {}, t('mg.demo.local')),
      btn(t('mg.demo.reset'), async (e) => {
        e.currentTarget.disabled = true;
        await apiFetch('api/__demo/reset', { method: 'POST' }).catch(() => {});
        flash(t('mg.demo.resetDone'));
        e.currentTarget.disabled = false;
      }, 'ghost', { class: 'mt-2' })));
  }
  fill(app, h('main', { class: 'grid min-h-screen place-items-center p-4' }, form), toastHost);
  user.focus();
  // Demo mode: skip the password with one click per role.
  api('/api/admin/demo').then((d) => {
    if (!d.enabled) return;
    form.append(h('div', { class: 'mt-5 border-t border-clay/70 pt-4' },
      h('p', { class: 'mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted' }, t('mg.demo.quick')),
      h('div', { class: 'flex flex-wrap gap-2' }, ...['owner', 'reception', 'housekeeping'].map((role) => btn(t(`mg.role.${role}`), () => demoLogin(role), role === 'owner' ? 'primary' : 'ghost')))));
  }).catch(() => {});
}

// Demo mode: a strip that says which role you're viewing as, with one-click switching.
const demoSlot = h('div');
function demoBar() {
  if (!S.demo) return demoSlot;
  fill(demoSlot, h('div', { class: 'border-b border-sun/40 bg-sun-100' },
    h('div', { class: 'mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-sm sm:px-6' },
      h('span', { class: 'font-semibold' }, t('mg.demo.viewingAs')),
      ...['owner', 'reception', 'housekeeping'].map((role) => h('button', {
        type: 'button', 'aria-pressed': String(S.me.role === role),
        class: `btn rounded-full border px-3.5 py-1.5 font-semibold ${S.me.role === role ? 'border-ink bg-ink text-paper' : 'border-sun-600/30 bg-paper-card hover:border-ink'}`,
        onclick: () => (S.me.role === role ? null : demoLogin(role)),
      }, t(`mg.role.${role}`))),
      h('span', { class: 'text-ink-muted' }, t(`mg.demo.scope.${S.me.role}`)),
      h('a', { href: 'demo.html', class: 'btn ml-auto rounded-full px-3 py-1.5 font-semibold underline-offset-4 hover:underline' }, t('mg.demo.back')))));
  return demoSlot;
}

async function demoLogin(role) {
  try { await api('/api/admin/demo-login', { method: 'POST', body: { role } }); start(); } catch (err) { failToast(err); }
}

// ── shell ──────────────────────────────────────────────────────────────────
const main = h('main', { class: 'mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6' });
const bellSlot = h('div', { class: 'relative' });
let bellTimer = null;
const stopBell = () => { clearInterval(bellTimer); bellTimer = null; };
const SEEN_KEY = 'rs_admin_seen_event';
const seen = () => { try { return Number(localStorage.getItem(SEEN_KEY) || 0); } catch { return 0; } };

async function pollBell() {
  if (!can('events')) return fill(bellSlot);
  let events;
  try { events = await api('/api/admin/events?limit=30'); } catch { return; }
  const unread = events.filter((e) => e.id > seen() && e.type !== 'login').length;
  fill(bellSlot, h('button', {
    type: 'button', class: 'btn relative grid h-10 w-10 place-items-center rounded-full border border-clay bg-paper-card hover:bg-paper',
    'aria-label': unread ? t('mg.bell.unread', { n: unread }) : t('mg.bell.title'),
    onclick: () => {
      try { localStorage.setItem(SEEN_KEY, String(events[0]?.id ?? 0)); } catch { /* storage blocked */ }
      drawer(t('mg.bell.title'), () => activityList(events.filter((e) => e.type !== 'login')), { onClose: pollBell });
    },
    html: '<svg viewBox="0 0 20 20" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8a5 5 0 0 1 10 0c0 5 2 6 2 6H3s2-1 2-6"/><path d="M8.5 17a1.6 1.6 0 0 0 3 0"/></svg>',
  }, unread ? h('span', { class: 'absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-terra px-1 text-[10px] font-bold text-paper', 'aria-hidden': 'true' }, unread > 9 ? '9+' : String(unread)) : null));
}

function passwordDialog() {
  const d = drawer(t('mg.me.password'), () => {
    const cur = input({ type: 'password', autocomplete: 'current-password' });
    const next = input({ type: 'password', autocomplete: 'new-password' });
    return h('div', { class: 'grid gap-4' }, lbl('mg.me.current', cur), lbl('mg.me.new', next),
      h('div', {}, btn(t('ad.save'), async () => {
        try { await api('/api/admin/me/password', { method: 'POST', body: { current: cur.value, password: next.value } }); flash(t('mg.saved')); d.close(); } catch (err) { flash(errText(err), 'err'); }
      }, 'primary')));
  });
}

function renderShell() {
  const tabs = TABS.filter(([, perm]) => can(perm));
  if (!tabs.some(([id]) => id === S.tab)) S.tab = tabs[0][0];
  fill(app,
    h('header', { class: 'sticky top-0 z-40 border-b border-clay/70 bg-paper/95 backdrop-blur' },
      h('div', { class: 'mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6' },
        h('a', { href: './', class: 'btn flex items-center gap-2 rounded-full px-1' },
          h('span', { class: 'h-6 w-6 rounded-full bg-terra', 'aria-hidden': 'true' }),
          h('span', { class: 'font-display text-lg font-semibold' }, 'RedSun'),
          h('span', { class: 'hidden whitespace-nowrap rounded-full bg-palm-100 px-2 py-0.5 text-xs font-semibold text-palm sm:inline' }, t('ad.title'))),
        h('div', { class: 'flex items-center gap-2' },
          bellSlot,
          h('button', { type: 'button', class: 'btn hidden rounded-full px-3 py-2 text-left text-sm hover:bg-paper-2 sm:block', onclick: passwordDialog, title: t('mg.me.password') },
            h('span', { class: 'block font-semibold leading-tight' }, S.me.name), h('span', { class: 'block text-xs text-ink-muted' }, t(`mg.role.${S.me.role}`))),
          h('div', { class: 'seg !p-[3px]', role: 'group' },
            h('button', { type: 'button', 'data-lang-btn': 'vi', class: '!min-h-[2.25rem] !px-2.5 text-xs', 'aria-pressed': String(getLang() === 'vi') }, 'VI'),
            h('button', { type: 'button', 'data-lang-btn': 'en', class: '!min-h-[2.25rem] !px-2.5 text-xs', 'aria-pressed': String(getLang() === 'en') }, 'EN')),
          btn(t('ad.signOut'), async () => { await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); renderLogin(); }))),
      h('nav', { class: 'mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6', role: 'tablist' },
        ...tabs.map(([id]) => h('button', {
          type: 'button', role: 'tab', 'aria-selected': String(S.tab === id),
          class: 'tab btn whitespace-nowrap px-3 py-3 text-sm font-semibold text-ink-muted hover:text-ink',
          onclick: () => go(id),
        }, t(`mg.tab.${id}`))))),
    demoBar(), main, toastHost);
  bindLangButtons();
  fill(main);
  TABS.find(([id]) => id === S.tab)[2](main);
  pollBell();
  if (!bellTimer) bellTimer = setInterval(pollBell, 30_000);
}

// ── bookings ───────────────────────────────────────────────────────────────
async function renderBookings() {
  const q = h('input', { type: 'search', class: 'field field-sm w-full sm:w-72', placeholder: t('ad.search'), value: S.filters.q, 'aria-label': t('ad.search') });
  const status = h('select', { class: 'field field-sm w-auto', 'aria-label': t('ad.col.status') },
    h('option', { value: '' }, t('ad.allStatus')), ...STATUSES.map((s) => h('option', { value: s, selected: S.filters.status === s || null }, t(`st.${s}`))));
  const upcoming = h('input', { type: 'checkbox', class: 'h-4 w-4 accent-[#A3401E] focus-ring', checked: S.filters.upcoming || null });
  const body = h('div', { class: 'mt-4 overflow-x-auto' }, h('p', { class: 'py-8 text-center text-ink-muted' }, '…'));
  let timer;
  const reload = () => { clearTimeout(timer); timer = setTimeout(load, 200); };
  q.addEventListener('input', () => { S.filters.q = q.value; reload(); });
  status.addEventListener('change', () => { S.filters.status = status.value; load(); });
  upcoming.addEventListener('change', () => { S.filters.upcoming = upcoming.checked; load(); });

  const formSlot = h('div');
  const toggleForm = () => {
    if (formSlot.firstChild) { fill(formSlot); return; }
    fill(formSlot, newBookingForm(async (booking) => {
      fill(formSlot);
      flash(t('ad.new.created', { ref: booking.ref }));
      await load();
    }, () => fill(formSlot)));
    formSlot.querySelector('input, select')?.focus();
  };

  fill(main, h('div', { class: 'grid gap-5' }, formSlot, card(
    h('div', { class: 'flex flex-wrap items-center gap-3' }, q, status,
      h('label', { class: 'flex items-center gap-2 text-sm font-medium' }, upcoming, t('ad.upcoming')),
      h('div', { class: 'ml-auto' }, btn(t('ad.new'), toggleForm, 'primary'))),
    body)));

  async function act(fn) {
    try { await fn(); await load(); } catch (err) { if (err.status === 401) renderLogin(); else fail(err); }
  }

  async function load() {
    const params = new URLSearchParams();
    if (S.filters.q) params.set('q', S.filters.q);
    if (S.filters.status) params.set('status', S.filters.status);
    if (S.filters.upcoming) params.set('upcoming', '1');
    let rows;
    try { rows = await api(`/api/admin/bookings?${params}`); } catch (err) { if (err.status === 401) renderLogin(); else fail(err); return; }
    if (!rows.length) { fill(body, h('p', { class: 'py-10 text-center text-ink-muted' }, t('ad.none'))); return; }
    fill(body, h('table', { class: 'tbl w-full min-w-[960px] text-sm' },
      h('thead', {}, h('tr', {}, ...['ref', 'guest', 'stay', 'rooms', 'total', 'paid', 'status', 'actions'].map((c) => h('th', { scope: 'col' }, t(`ad.col.${c}`))))),
      h('tbody', {}, ...rows.map((b) => {
        const balance = b.total - b.amount_paid;
        const live = ['pending', 'confirmed', 'deposit_paid', 'paid', 'needs_refund'].includes(b.status);
        const actions = [];
        if (b.status === 'pending') {
          actions.push(btn(t('ad.confirmTransfer', { amount: money(b.amount_due) }), () => {
            if (window.confirm(t('ad.confirmPay', { amount: money(b.amount_due), ref: b.ref }))) act(() => api(`/api/admin/bookings/${b.ref}/payments`, { method: 'POST', body: { amount: b.amount_due, provider: b.provider === 'vietqr' ? 'vietqr' : 'transfer' } }));
          }, 'primary'));
        }
        if (b.status === 'confirmed' && balance > 0) {
          actions.push(btn(t('ad.collect', { amount: money(balance) }), () => {
            if (window.confirm(t('ad.confirmPay', { amount: money(balance), ref: b.ref }))) act(() => api(`/api/admin/bookings/${b.ref}/payments`, { method: 'POST', body: { amount: balance, provider: 'cash' } }));
          }, 'primary'));
        }
        if (b.status === 'deposit_paid' && balance > 0) {
          actions.push(btn(t('ad.collectRest', { amount: money(balance) }), () => {
            if (window.confirm(t('ad.confirmPay', { amount: money(balance), ref: b.ref }))) act(() => api(`/api/admin/bookings/${b.ref}/payments`, { method: 'POST', body: { amount: balance, provider: 'cash' } }));
          }));
        }
        if (live) {
          actions.push(btn(t('ad.cancel'), () => {
            if (window.confirm(t('ad.confirmCancel', { ref: b.ref }))) act(() => api(`/api/admin/bookings/${b.ref}/cancel`, { method: 'POST', body: {} }));
          }, 'danger'));
        }
        return h('tr', {},
          h('td', {}, h('span', { class: 'font-semibold tabular' }, b.ref), h('span', { class: 'block text-xs text-ink-muted' }, b.provider ? t(`pay.${b.provider}`) : '')),
          h('td', {}, h('span', { class: 'block font-medium' }, b.name), h('a', { href: `tel:${b.phone}`, class: 'block text-xs text-ink-muted underline-offset-2 hover:underline' }, b.phone),
            b.email ? h('span', { class: 'block text-xs text-ink-muted' }, b.email) : null,
            b.note ? h('span', { class: 'mt-1 block max-w-[16rem] text-xs italic text-ink-2' }, `“${b.note}”`) : null),
          h('td', { class: 'whitespace-nowrap' }, `${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}`, h('span', { class: 'block text-xs text-ink-muted' }, t('sum.guests', { a: b.adults, c: b.children }))),
          h('td', {}, b.type === 'villa' ? h('span', { class: 'font-semibold text-terra' }, t('ad.villa')) : b.unit_ids.map(unitLabel).join(', ')),
          h('td', { class: 'whitespace-nowrap tabular' }, money(b.total), b.promo_code ? h('span', { class: 'block text-xs text-palm' }, b.promo_code) : null),
          h('td', { class: 'whitespace-nowrap tabular' }, money(b.amount_paid)),
          h('td', {}, h('span', { class: `inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[b.status]}` }, t(`st.${b.status}`))),
          h('td', {}, h('div', { class: 'flex flex-wrap gap-2' }, ...actions)));
      }))));
  }
  load();
}

// ── owner creates a booking ────────────────────────────────────────────────
function newBookingForm(onCreated, onClose, prefill = {}) {
  const F = {
    type: h('select', { class: 'field field-sm' }, h('option', { value: 'room' }, t('search.mode.room')), h('option', { value: 'villa' }, t('search.mode.villa'))),
    checkIn: h('input', { type: 'date', class: 'field field-sm', min: todayIso(), value: todayIso() }),
    checkOut: h('input', { type: 'date', class: 'field field-sm', min: addDays(todayIso(), 1), value: addDays(todayIso(), 1) }),
    adults: h('select', { class: 'field field-sm' }, ...Array.from({ length: 14 }, (_, i) => h('option', { value: i + 1, selected: i === 1 || null }, i + 1))),
    children: h('select', { class: 'field field-sm' }, ...Array.from({ length: 9 }, (_, i) => h('option', { value: i }, i))),
    name: h('input', { class: 'field field-sm', maxlength: 80, autocomplete: 'off' }),
    phone: h('input', { class: 'field field-sm', type: 'tel', maxlength: 20, autocomplete: 'off' }),
    email: h('input', { class: 'field field-sm', type: 'email', maxlength: 120, autocomplete: 'off' }),
    note: h('input', { class: 'field field-sm', maxlength: 500 }),
    promo: h('input', { class: 'field field-sm uppercase', maxlength: 30, placeholder: t('book.promoPh') }),
    payment: h('select', { class: 'field field-sm' },
      h('option', { value: 'none' }, t('ad.new.none')),
      h('option', { value: 'deposit' }, t('ad.new.deposit', { pct: S.config.depositPercent })),
      h('option', { value: 'full' }, t('ad.new.full'))),
    method: h('select', { class: 'field field-sm' }, ...['cash', 'transfer', 'vietqr', 'card_onsite'].map((m) => h('option', { value: m }, t(`ad.method.${m}`)))),
  };
  // Opened from the calendar with dates/rooms already chosen.
  if (prefill.type) F.type.value = prefill.type;
  if (prefill.checkIn) F.checkIn.value = prefill.checkIn;
  if (prefill.checkOut) F.checkOut.value = prefill.checkOut;
  const unitBoxes = S.config.units.map((u) => {
    const cb = h('input', { type: 'checkbox', value: u.id, class: 'h-4 w-4 accent-[#A3401E] focus-ring', checked: prefill.units?.includes(u.id) ? true : null });
    return { cb, el: h('label', { class: 'flex min-h-[2.5rem] cursor-pointer items-center gap-2 rounded-xl border border-clay bg-paper px-3 text-sm font-medium hover:border-clay-2' }, cb, unitName(u)) };
  });
  const unitsRow = h('div', { class: 'flex flex-wrap gap-2' }, ...unitBoxes.map((x) => x.el));
  const preview = h('div', { class: 'rounded-xl bg-paper-2 p-4 text-sm', 'aria-live': 'polite' }, '…');
  const errorBox = h('p', { class: 'min-h-[1.25rem] text-sm font-medium text-oxblood', role: 'alert' });
  const submit = btn(t('ad.new.submit'), create, 'primary');

  const body = () => ({
    type: F.type.value, units: unitBoxes.filter((x) => x.cb.checked).map((x) => x.cb.value),
    checkIn: F.checkIn.value, checkOut: F.checkOut.value, adults: Number(F.adults.value), children: Number(F.children.value),
    promo: F.promo.value.trim(),
  });

  let seq = 0;
  let timer;
  async function refresh() {
    const mine = ++seq;
    unitsRow.classList.toggle('hidden', F.type.value === 'villa');
    F.method.disabled = F.payment.value === 'none';
    F.checkOut.min = F.checkIn.value ? addDays(F.checkIn.value, 1) : '';
    try {
      const q = await api('/api/quote', { method: 'POST', body: body() });
      if (mine !== seq) return;
      const collected = { none: 0, deposit: q.deposit, full: q.total }[F.payment.value];
      fill(preview,
        h('div', { class: 'flex flex-wrap gap-x-6 gap-y-1' },
          h('span', {}, `${t('sum.subtotal')}: `, h('strong', { class: 'tabular' }, money(q.subtotal))),
          q.autoDiscount ? h('span', { class: 'text-palm' }, `${getLang() === 'en' ? q.autoDiscount.label_en : q.autoDiscount.label_vi}: −${money(q.autoDiscount.amount)}`) : null,
          q.promo ? h('span', { class: 'text-palm' }, `${t('sum.promo', { code: q.promo.code })}: −${money(q.promo.amount)}`) : null,
          h('span', {}, `${t('sum.total')}: `, h('strong', { class: 'tabular' }, money(q.total))),
          h('span', {}, `${t('ad.new.collected')}: `, h('strong', { class: 'tabular text-terra' }, money(collected)))),
        q.promoError ? h('p', { class: 'mt-1 text-oxblood' }, t(`err.${q.promoError}`, q.promoErrorDetails ?? {})) : null);
      errorBox.textContent = '';
    } catch (err) {
      if (mine !== seq) return;
      fill(preview, h('span', { class: 'text-ink-muted' }, err.code === 'select_rooms' ? t('err.select_rooms') : t(`err.${err.code}`, err.details ?? {})));
    }
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 200); };
  for (const el of [...Object.values(F), ...unitBoxes.map((x) => x.cb)]) {
    el.addEventListener('change', schedule);
    el.addEventListener('input', schedule);
  }

  async function create() {
    errorBox.textContent = '';
    submit.disabled = true;
    try {
      const booking = await api('/api/admin/bookings', {
        method: 'POST',
        body: { ...body(), name: F.name.value, phone: F.phone.value, email: F.email.value, note: F.note.value, payment: F.payment.value, method: F.method.value, lang: getLang() },
      });
      onCreated(booking);
    } catch (err) {
      if (err.status === 401) { renderLogin(); return; }
      errorBox.textContent = t(`err.${err.code}`, err.details ?? {}) === `err.${err.code}` ? t('ad.error', { code: err.code }) : t(`err.${err.code}`, err.details ?? {});
      submit.disabled = false;
    }
  }

  refresh();
  return card(
    h('div', { class: 'mb-4 flex items-start justify-between gap-3' },
      h('div', {}, h('h2', { class: 'font-display text-xl font-semibold' }, t('ad.new.title')), h('p', { class: 'mt-1 text-sm text-ink-muted' }, t('ad.new.lead'))),
      btn(t('ad.new.close'), onClose)),
    h('div', { class: 'grid gap-3 sm:grid-cols-3 lg:grid-cols-6' },
      lbl('search.mode', F.type), lbl('search.checkin', F.checkIn), lbl('search.checkout', F.checkOut),
      lbl('search.adults', F.adults), lbl('search.children', F.children), lbl('book.promo', F.promo)),
    h('div', { class: 'mt-3' }, unitsRow),
    h('div', { class: 'mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4' },
      lbl('book.name', F.name), lbl('book.phone', F.phone), lbl('book.email', F.email), lbl('book.note', F.note)),
    h('div', { class: 'mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4' }, lbl('ad.new.collected', F.payment), lbl('ad.new.method', F.method)),
    h('div', { class: 'mt-4' }, preview),
    h('div', { class: 'mt-4 flex flex-wrap items-center gap-3' }, submit, errorBox));
}

// Booking form in a side panel, e.g. from days picked on the calendar.
function openNewBooking(prefill, done = () => {}) {
  const d = drawer(t('ad.new.title'), () => newBookingForm((booking) => {
    d.close();
    flash(t('ad.new.created', { ref: booking.ref }));
    done();
  }, () => d.close(), prefill), { wide: true });
}

// ── rates ──────────────────────────────────────────────────────────────────
async function renderRates() {
  let data;
  try { data = await api('/api/admin/rates'); } catch (err) { if (err.status === 401) return renderLogin(); return fail(err); }
  const order = ['VILLA', ...S.config.units.map((u) => u.id)];
  const rows = order.map((id) => data.rates.find((r) => r.target === id)).filter(Boolean).map((r) => ({
    r, base: h('input', { type: 'number', min: 1000, step: 1000, class: 'field field-sm w-36 tabular', value: r.base, 'aria-label': `${unitLabel(r.target)} ${t('ad.rates.base')}` }),
    weekend: h('input', { type: 'number', min: 1000, step: 1000, class: 'field field-sm w-36 tabular', value: r.weekend, 'aria-label': `${unitLabel(r.target)} ${t('ad.rates.weekend')}` }),
  }));
  const sp = {
    target: h('select', { class: 'field field-sm' }, h('option', { value: 'ALL' }, t('ad.allUnits')), h('option', { value: 'VILLA' }, t('ad.villa')), ...S.config.units.map((u) => h('option', { value: u.id }, unitName(u)))),
    from: h('input', { type: 'date', class: 'field field-sm' }), to: h('input', { type: 'date', class: 'field field-sm' }),
    price: h('input', { type: 'number', min: 1000, step: 1000, class: 'field field-sm' }), mult: h('input', { type: 'number', min: 0.1, max: 5, step: 0.05, class: 'field field-sm', placeholder: '1.5' }),
    label: h('input', { class: 'field field-sm', maxlength: 80, placeholder: 'Tết 2027' }),
  };

  fill(main, h('div', { class: 'grid gap-5 lg:grid-cols-2' },
    card(heading('ad.rates.title'),
      h('div', { class: 'overflow-x-auto' }, h('table', { class: 'tbl w-full text-sm' },
        h('thead', {}, h('tr', {}, h('th', {}, t('ad.rates.target')), h('th', {}, t('ad.rates.base')), h('th', {}, t('ad.rates.weekend')))),
        h('tbody', {}, ...rows.map((x) => h('tr', {}, h('td', { class: 'font-medium' }, unitLabel(x.r.target)), h('td', {}, x.base), h('td', {}, x.weekend)))))),
      h('div', { class: 'mt-4' }, btn(t('ad.save'), async () => {
        try {
          await api('/api/admin/rates', { method: 'PUT', body: rows.map((x) => ({ target: x.r.target, base: Number(x.base.value), weekend: Number(x.weekend.value) })) });
          flash(t('ad.saved'));
          S.config = await api('/api/config');
        } catch (err) { fail(err); }
      }, 'primary'))),
    card(heading('ad.special.title', 'ad.special.lead'),
      h('div', { class: 'grid gap-3 sm:grid-cols-2' },
        lbl('ad.block.target', sp.target), lbl('ad.special.label', sp.label), lbl('ad.block.from', sp.from), lbl('ad.block.to', sp.to),
        lbl('ad.special.price', sp.price), lbl('ad.special.mult', sp.mult)),
      h('div', { class: 'mt-4' }, btn(t('ad.special.add'), async () => {
        try {
          await api('/api/admin/special-rates', { method: 'POST', body: { target: sp.target.value, start_date: sp.from.value, end_date: sp.to.value, price: sp.price.value, multiplier: sp.mult.value, label: sp.label.value } });
          flash(t('ad.saved'));
          renderRates();
        } catch (err) { fail(err); }
      }, 'primary')),
      h('ul', { class: 'mt-5 divide-y divide-clay/70 border-t border-clay/70' }, ...(data.specials.length ? data.specials.map((s) => h('li', { class: 'flex items-center justify-between gap-3 py-2.5' },
        h('span', {}, h('span', { class: 'block font-semibold' }, `${s.label || '—'} · ${unitLabel(s.target)}`),
          h('span', { class: 'block text-sm text-ink-muted' }, `${fmtDate(s.start_date)} → ${fmtDate(s.end_date)} · ${s.price != null ? money(s.price) : `×${s.multiplier}`}`)),
        btn(t('ad.promo.delete'), async () => { await api(`/api/admin/special-rates/${s.id}`, { method: 'DELETE' }).catch(fail); renderRates(); }, 'danger')))
        : [h('li', { class: 'py-4 text-sm text-ink-muted' }, t('ad.special.none'))])))));
}

// ── promos + rules ─────────────────────────────────────────────────────────
async function renderPromos() {
  let data;
  try { data = await api('/api/admin/promos'); } catch (err) { if (err.status === 401) return renderLogin(); return fail(err); }
  const f = {
    code: h('input', { class: 'field field-sm uppercase', maxlength: 30, placeholder: 'SUMMER10' }),
    type: h('select', { class: 'field field-sm' }, h('option', { value: 'percent' }, t('ad.promo.percent')), h('option', { value: 'fixed' }, t('ad.promo.fixed'))),
    value: h('input', { type: 'number', min: 1, class: 'field field-sm', placeholder: '10' }),
    minNights: h('input', { type: 'number', min: 1, class: 'field field-sm', value: 1 }),
    from: h('input', { type: 'date', class: 'field field-sm' }), to: h('input', { type: 'date', class: 'field field-sm' }),
    maxUses: h('input', { type: 'number', min: 1, class: 'field field-sm', placeholder: t('ad.any') }),
    appliesTo: h('select', { class: 'field field-sm' }, ...['all', 'room', 'villa'].map((v) => h('option', { value: v }, t(`ad.promo.${v}`)))),
  };
  const body = (p, overrides = {}) => ({ code: p.code, type: p.type, value: p.value, min_nights: p.min_nights, valid_from: p.valid_from, valid_to: p.valid_to, max_uses: p.max_uses, applies_to: p.applies_to, active: p.active, note: p.note, ...overrides });

  fill(main, h('div', { class: 'grid gap-5' },
    card(heading('ad.promo.title'),
      h('div', { class: 'grid gap-3 sm:grid-cols-4 lg:grid-cols-8' },
        lbl('ad.promo.code', f.code), lbl('ad.promo.type', f.type), lbl('ad.promo.value', f.value), lbl('ad.promo.minNights', f.minNights),
        lbl('ad.promo.from', f.from), lbl('ad.promo.to', f.to), lbl('ad.promo.maxUses', f.maxUses), lbl('ad.promo.appliesTo', f.appliesTo)),
      h('div', { class: 'mt-4' }, btn(t('ad.promo.add'), async () => {
        try {
          await api('/api/admin/promos', { method: 'POST', body: { code: f.code.value, type: f.type.value, value: f.value.value, min_nights: f.minNights.value, valid_from: f.from.value, valid_to: f.to.value, max_uses: f.maxUses.value, applies_to: f.appliesTo.value } });
          flash(t('ad.saved'));
          renderPromos();
        } catch (err) { fail(err); }
      }, 'primary')),
      h('div', { class: 'mt-5 overflow-x-auto' }, h('table', { class: 'tbl w-full min-w-[760px] text-sm' },
        h('thead', {}, h('tr', {}, ...['code', 'value', 'minNights', 'appliesTo', 'from', 'used', 'active'].map((k) => h('th', {}, t(`ad.promo.${k}`))), h('th', {}, ''))),
        h('tbody', {}, ...data.promos.map((p) => h('tr', { class: p.active ? '' : 'opacity-60' },
          h('td', { class: 'font-semibold tabular' }, p.code, p.note ? h('span', { class: 'block text-xs font-normal text-ink-muted' }, p.note) : null),
          h('td', { class: 'tabular' }, p.type === 'percent' ? `${p.value}%` : money(p.value)),
          h('td', { class: 'tabular' }, p.min_nights),
          h('td', {}, t(`ad.promo.${p.applies_to}`)),
          h('td', { class: 'whitespace-nowrap text-ink-muted' }, p.valid_from || p.valid_to ? `${p.valid_from ? fmtDate(p.valid_from) : '…'} → ${p.valid_to ? fmtDate(p.valid_to) : '…'}` : '—'),
          h('td', { class: 'tabular' }, `${p.used}${p.max_uses ? ` / ${p.max_uses}` : ''}`),
          h('td', {}, btn(p.active ? t('ad.promo.on') : t('ad.promo.off'), async () => {
            try { await api(`/api/admin/promos/${p.code}`, { method: 'PUT', body: body(p, { active: !p.active }) }); renderPromos(); } catch (err) { fail(err); }
          }, 'ghost', { 'aria-pressed': String(Boolean(p.active)), class: p.active ? '!border-palm-200 !bg-palm-100 !text-palm' : '' })),
          h('td', {}, btn(t('ad.promo.delete'), async () => { await api(`/api/admin/promos/${p.code}`, { method: 'DELETE' }).catch(fail); renderPromos(); }, 'danger')))))))),
    card(heading('ad.rules.title', 'ad.rules.lead'),
      h('div', { class: 'grid gap-3 md:grid-cols-2' }, ...data.rules.map((r) => {
        const threshold = h('input', { type: 'number', min: 1, max: 365, class: 'field field-sm w-24 tabular', value: r.threshold, 'aria-label': t('ad.rules.threshold') });
        const percent = h('input', { type: 'number', min: 0, max: 90, class: 'field field-sm w-24 tabular', value: r.percent, 'aria-label': t('ad.rules.percent') });
        const active = h('input', { type: 'checkbox', class: 'h-4 w-4 accent-[#A3401E] focus-ring', checked: r.active ? true : null });
        return h('div', { class: 'rounded-xl border border-clay/70 bg-paper p-4' },
          h('p', { class: 'font-semibold' }, getLang() === 'en' ? r.label_en : r.label_vi),
          h('div', { class: 'mt-3 flex flex-wrap items-end gap-3' },
            lbl('ad.rules.threshold', threshold), lbl('ad.rules.percent', percent),
            h('label', { class: 'flex min-h-[2.5rem] items-center gap-2 text-sm font-medium' }, active, t('ad.promo.active')),
            btn(t('ad.save'), async () => {
              try { await api(`/api/admin/rules/${r.id}`, { method: 'PUT', body: { threshold: Number(threshold.value), percent: Number(percent.value), active: active.checked } }); flash(t('ad.saved')); } catch (err) { fail(err); }
            }, 'primary')));
      })))));
}

async function start() {
  const as = new URLSearchParams(location.search).get('as');
  if (as) {
    history.replaceState(null, '', location.pathname);
    await api('/api/admin/demo-login', { method: 'POST', body: { role: as } }).catch(() => {});
  }
  S.demo = await api('/api/admin/demo').then((d) => d.enabled).catch(() => false);
  try {
    S.me = await api('/api/admin/me');
  } catch {
    renderLogin();
    return;
  }
  S.config = await api('/api/config');
  // Each role starts where its work is.
  S.tab = { owner: 'dashboard', reception: 'board', housekeeping: 'board' }[S.me.role] ?? 'dashboard';
  renderShell();
}

applyI18n();
document.addEventListener('langchange', () => (S.me ? renderShell() : renderLogin()));
bindLangButtons();
start();
