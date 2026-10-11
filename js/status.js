import { t, applyI18n, bindLangButtons, errorText } from './i18n.js';
import { api, money, fmtDate, fmtTime, h, unitName, fill } from './api.js';

const root = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const ref = (params.get('ref') ?? '').toUpperCase();
const failed = params.get('failed') === '1';

const TONE = {
  pending: 'bg-sun-100 text-sun-600 border-sun-200',
  confirmed: 'bg-palm-100 text-palm border-palm-200',
  deposit_paid: 'bg-palm-100 text-palm border-palm-200',
  paid: 'bg-palm-100 text-palm border-palm-200',
  cancelled: 'bg-paper-2 text-ink-muted border-clay',
  expired: 'bg-paper-2 text-ink-muted border-clay',
  needs_refund: 'bg-oxblood/10 text-oxblood border-oxblood/20',
};

let config = null;
let booking = null;
let pollTimer = null;
let actionError = null;
let busy = false;

function copyButton(value) {
  const btn = h('button', { type: 'button', class: 'btn shrink-0 rounded-full border border-clay px-3 py-1.5 text-xs font-semibold hover:border-clay-2 hover:bg-paper-2' }, t('st.qr.copy'));
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(String(value)); btn.textContent = t('st.qr.copied'); setTimeout(() => { btn.textContent = t('st.qr.copy'); }, 1500); } catch { /* clipboard blocked */ }
  });
  return btn;
}

function vietqrPanel(q) {
  const row = (labelKey, value, copy) => h('div', { class: 'flex items-center justify-between gap-3 py-2.5' },
    h('dt', { class: 'text-sm text-ink-muted' }, t(labelKey)),
    h('dd', { class: 'flex min-w-0 items-center gap-2 text-right font-semibold' }, h('span', { class: 'truncate tabular' }, value), copy ? copyButton(copy) : null));
  return h('section', { class: 'mt-6 rounded-3xl border border-clay/70 bg-paper-card p-5 floating sm:p-7' },
    h('h2', { class: 'font-display text-2xl font-semibold display-tight' }, t('st.qr.title')),
    q.demo ? h('p', { class: 'mt-3 rounded-2xl bg-sun-100 p-3 text-sm font-medium text-ink' }, t('st.qr.demo')) : null,
    h('div', { class: 'mt-5 grid items-start gap-6 sm:grid-cols-[13rem_1fr]' },
      h('div', { class: 'overflow-hidden rounded-2xl border border-clay bg-white p-2' },
        q.qrUrl
          ? h('img', { src: q.qrUrl, alt: 'VietQR', class: 'aspect-square w-full object-contain', width: 400, height: 400 })
          : h('img', { src: 'https://placehold.co/400x400/F4EADF/6E5247?text=VietQR', alt: '', class: 'aspect-square w-full' })),
      h('dl', { class: 'divide-y divide-clay/70' },
        q.bank ? row('st.qr.bank', q.bank) : null,
        q.account ? row('st.qr.account', q.account, q.account) : null,
        q.accountName ? row('st.qr.name', q.accountName) : null,
        row('st.qr.amount', money(q.amount), q.amount),
        row('st.qr.note', q.note, q.note))),
    h('p', { class: 'copy mt-4 text-sm text-ink-muted' }, t('st.qr.wait')));
}

async function payWith(provider) {
  busy = true;
  actionError = null;
  render();
  try {
    const res = await api(`/api/bookings/${encodeURIComponent(ref)}/pay`, { method: 'POST', body: { provider } });
    if (res.next?.kind === 'redirect') { window.location.href = res.next.url; return; }
    await load();
  } catch (err) {
    actionError = errorText(err.code, err.details);
  }
  busy = false;
  render();
}

function render() {
  if (!booking) return;
  const b = booking;
  document.title = `${t('st.title', { ref: b.ref })} — RedSun Villa`;
  const unitsById = Object.fromEntries((config?.units ?? []).map((u) => [u.id, u]));
  const rooms = b.type === 'villa' ? t('sum.villa') : b.units.map((id) => (unitsById[id] ? unitName(unitsById[id]) : id)).join(', ');
  const desc = {
    pending: t('st.pending.d', { time: b.holdExpiresAt ? fmtTime(b.holdExpiresAt) : '' }),
    deposit_paid: t('st.deposit_paid.d', { amount: money(b.balance) }),
    confirmed: t('st.confirmed.d', { amount: money(b.balance) }),
  }[b.status] ?? t(`st.${b.status}.d`);

  const row = (label, value, cls = '') => h('div', { class: `flex items-baseline justify-between gap-4 py-2.5 ${cls}` }, h('dt', { class: 'text-ink-muted' }, label), h('dd', { class: 'tabular text-right font-semibold' }, value));
  const others = b.status === 'pending' ? (config?.providers ?? []).filter((p) => p.enabled && !(p.id === b.provider && p.id === 'vietqr')) : [];

  fill(root, 
    h('div', { class: 'flex flex-wrap items-center justify-between gap-3' },
      h('h1', { class: 'font-display display-tight text-[clamp(2rem,5vw,3rem)] font-semibold leading-tight' }, t('st.title', { ref: b.ref })),
      h('span', { class: `rounded-full border px-3.5 py-1.5 text-sm font-semibold ${TONE[b.status] ?? TONE.cancelled}` }, t(`st.${b.status}`))),
    h('p', { class: 'copy mt-3 text-[1.0625rem] text-ink-2' }, desc),
    failed && b.status === 'pending' ? h('p', { class: 'mt-4 rounded-2xl bg-oxblood/10 p-3 text-sm font-medium text-oxblood', role: 'alert' }, t('st.failed')) : null,

    b.vietqr ? vietqrPanel(b.vietqr) : null,

    h('section', { class: 'mt-6 rounded-3xl border border-clay/70 bg-paper-card p-5 elevated sm:p-7' },
      h('dl', { class: 'divide-y divide-clay/70 text-sm' },
        row(t('st.stay'), `${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} · ${t('sum.nights', { n: b.nights })}`),
        row(t('st.rooms'), rooms),
        row(t('st.guests'), t('sum.guests', { a: b.adults, c: b.children })),
        row(t('sum.subtotal'), money(b.subtotal)),
        b.autoDiscount ? row(document.documentElement.lang === 'en' ? b.autoDiscount.label_en : b.autoDiscount.label_vi, `−${money(b.autoDiscount.amount)}`, 'text-palm') : null,
        b.promo ? row(t('sum.promo', { code: b.promo.code }), `−${money(b.promo.amount)}`, 'text-palm') : null,
        row(h('span', { class: 'font-display text-lg font-semibold text-ink' }, t('sum.total')), h('span', { class: 'font-display text-xl' }, money(b.total))),
        row(t('st.paidSoFar'), money(b.amountPaid)),
        b.balance > 0 && b.status !== 'cancelled' && b.status !== 'expired' ? row(t('st.balance'), money(b.balance), 'text-terra') : null),
      h('p', { class: 'mt-4 flex flex-wrap gap-2 text-xs text-ink-muted' },
        h('span', { class: 'rounded-full bg-paper-2 px-3 py-1.5' }, t('contact.checkin', { time: b.checkInTime })),
        h('span', { class: 'rounded-full bg-paper-2 px-3 py-1.5' }, t('contact.checkout', { time: b.checkOutTime })))),

    others.length ? h('section', { class: 'mt-6' },
      h('h2', { class: 'text-sm font-semibold' }, t('st.otherMethod')),
      h('div', { class: 'mt-3 flex flex-wrap gap-2' }, ...others.map((p) => h('button', {
        type: 'button', class: 'btn min-h-[2.75rem] rounded-full border border-clay bg-paper-card px-4 text-sm font-semibold hover:border-clay-2 hover:bg-paper-2', disabled: busy || null, onclick: () => payWith(p.id),
      }, t(`pay.${p.id}`)))),
      actionError ? h('p', { class: 'mt-3 rounded-2xl bg-oxblood/10 p-3 text-sm font-medium text-oxblood', role: 'alert' }, actionError) : null) : null,

    h('p', { class: 'mt-8 text-sm text-ink-muted' }, t('st.keepRef'), h('strong', { class: 'tabular text-ink' }, b.ref)),
    h('div', { class: 'mt-4 flex flex-wrap gap-3' },
      h('a', { href: './', class: 'btn inline-flex min-h-[2.75rem] items-center rounded-full border border-clay px-5 text-sm font-semibold hover:border-clay-2 hover:bg-paper-2' }, t('st.home')),
      ['expired', 'cancelled'].includes(b.status) ? h('a', { href: './#booking', class: 'btn inline-flex min-h-[2.75rem] items-center rounded-full bg-terra px-5 text-sm font-semibold text-paper hover:bg-terra-700' }, t('st.newBooking')) : null),
  );
}

async function load() {
  try {
    booking = await api(`/api/bookings/${encodeURIComponent(ref)}`);
    render();
  } catch (err) {
    clearInterval(pollTimer);
    fill(root, h('div', { class: 'py-16 text-center' },
      h('p', { class: 'font-display text-2xl font-semibold' }, err.code === 'not_found' ? t('st.notFound') : errorText(err.code)),
      h('a', { href: './', class: 'btn mt-6 inline-flex min-h-[2.75rem] items-center rounded-full bg-terra px-5 text-sm font-semibold text-paper hover:bg-terra-700' }, t('st.home'))));
    return;
  }
  // Keep polling while we wait for a webhook or the owner to confirm a transfer.
  if (booking.status !== 'pending') clearInterval(pollTimer);
}

applyI18n();
bindLangButtons();
fill(root, h('p', { class: 'py-16 text-center text-ink-muted' }, t('st.loading')));
document.addEventListener('langchange', render);
config = await api('/api/config').catch(() => null);
if (!ref) {
  fill(root, h('p', { class: 'py-16 text-center font-display text-2xl' }, t('st.notFound')));
} else {
  await load();
  if (booking?.status === 'pending') pollTimer = setInterval(load, 5000);
}
