import { t } from './i18n.js';
import { api, fmtDate, h, unitName, todayIso, addDays, diffDays, fill } from './api.js';

const STATES = ['free', 'held', 'booked', 'blocked'];

function mondayOf(iso) {
  const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((wd + 6) % 7));
}
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
function nextMonth(iso) {
  const [y, m] = iso.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
function prevMonth(iso) {
  const [y, m] = iso.split('-').map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
}

export function initCalendar(root, config, booking) {
  const today = todayIso();
  const state = { view: 'month', anchor: today, data: null, error: false, loading: false, pendingIn: null };
  let seq = 0;

  const toolbar = h('div', { class: 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' });
  const legend = h('ul', { class: 'flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2' });
  const surface = h('div', { class: 'mt-4 rounded-3xl border border-clay/70 bg-paper-card p-3 elevated sm:p-5' });
  const hint = h('div', { class: 'mt-4 min-h-[3rem]', 'aria-live': 'polite' });
  root.append(toolbar, h('div', { class: 'mt-4' }, legend), surface, hint);

  function range() {
    if (state.view === 'month') { const from = monthStart(state.anchor); return { from, to: nextMonth(from) }; }
    if (state.view === 'week') { const from = mondayOf(state.anchor); return { from, to: addDays(from, 7) }; }
    return { from: state.anchor, to: addDays(state.anchor, 1) };
  }

  function periodLabel() {
    const { from, to } = range();
    if (state.view === 'month') return fmtDate(from, { month: 'long', year: 'numeric' });
    if (state.view === 'week') return `${fmtDate(from, { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(to, -1), { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return fmtDate(from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function move(dir) {
    if (state.view === 'month') state.anchor = dir > 0 ? nextMonth(monthStart(state.anchor)) : prevMonth(monthStart(state.anchor));
    else state.anchor = addDays(state.anchor, dir * (state.view === 'week' ? 7 : 1));
    load();
  }

  const iconBtn = (labelKey, path, onclick, disabled) => h('button', {
    type: 'button', class: 'btn grid h-11 w-11 place-items-center rounded-full border border-clay bg-paper-card hover:border-clay-2 hover:bg-paper', 'aria-label': t(labelKey), onclick, disabled: disabled || null,
    html: `<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`,
  });

  function renderToolbar() {
    const { from } = range();
    const atStart = from <= (state.view === 'month' ? monthStart(today) : state.view === 'week' ? mondayOf(today) : today);
    fill(toolbar, 
      h('div', { class: 'seg', role: 'group', 'aria-label': t('avail.view') },
        ...['day', 'week', 'month'].map((v) => h('button', { type: 'button', 'aria-pressed': String(state.view === v), onclick: () => { state.view = v; load(); } }, t(`avail.view.${v}`)))),
      h('div', { class: 'flex w-full items-center gap-2 sm:w-auto' },
        iconBtn('avail.prev', 'M12.5 5 7.5 10l5 5', () => move(-1), atStart),
        h('p', { class: 'min-w-0 flex-1 text-center font-display text-base font-semibold capitalize sm:min-w-[11rem] sm:flex-none sm:text-lg', 'aria-live': 'polite' }, periodLabel()),
        iconBtn('avail.next', 'm7.5 5 5 5-5 5', () => move(1)),
        h('button', { type: 'button', class: 'btn ml-1 min-h-[2.75rem] shrink-0 whitespace-nowrap rounded-full border border-clay bg-paper-card px-4 text-sm font-semibold hover:border-clay-2 hover:bg-paper', onclick: () => { state.anchor = today; load(); } }, t('avail.today'))),
    );
    if (state.view === 'month') {
      // Whole-house view: three states, no per-room colours.
      fill(legend,
        h('li', { class: 'flex items-center gap-2' }, h('span', { class: 'inline-block h-3.5 w-3.5 rounded border border-clay-2 bg-paper', 'aria-hidden': 'true' }), t('villa.legend.free')),
        h('li', { class: 'flex items-center gap-2' }, h('span', { class: 'inline-block h-3.5 w-3.5 rounded border border-sun-200 bg-sun-100', 'aria-hidden': 'true' }), t('villa.legend.partial')),
        h('li', { class: 'flex items-center gap-2' }, h('span', { class: 'inline-block h-3.5 w-3.5 rounded bg-clay', 'aria-hidden': 'true' }), t('villa.legend.full')),
        h('li', { class: 'text-ink-muted' }, t('villa.legend.hover')));
      return;
    }
    fill(legend, ...STATES.map((s) => h('li', { class: 'flex items-center gap-2' }, h('span', { class: `st st-${s} inline-block h-3.5 w-3.5`, 'aria-hidden': 'true' }), t(`state.${s}`))));
  }

  const inSelected = (d) => {
    const { checkIn, checkOut } = booking.range;
    return checkIn && checkOut && d >= checkIn && d < checkOut;
  };

  function onDayClick(date) {
    if (!state.pendingIn || date <= state.pendingIn) {
      state.pendingIn = date;
      renderBody();
      renderHint();
      return;
    }
    const checkIn = state.pendingIn;
    state.pendingIn = null;
    booking.setRange(checkIn, date);
  }

  const freeUnits = (day) => config.units.filter((u) => day.units[u.id] === 'free');
  const freeText = (day) => {
    const free = freeUnits(day);
    return free.length ? t('avail.freeRooms', { rooms: free.map((u) => u.code).join(', ') }) : t('villa.full');
  };

  // One floating label, shown on hover/focus: which rooms are left that night.
  const tip = h('div', { class: 'pointer-events-none fixed z-50 hidden max-w-[16rem] rounded-xl bg-ink px-3 py-2 text-xs font-medium text-paper shadow-lg', role: 'tooltip' });
  document.body.append(tip);
  const showTip = (el, text) => {
    tip.textContent = text;
    tip.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
    tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
  };
  const hideTip = () => tip.classList.add('hidden');
  window.addEventListener('scroll', hideTip, { passive: true });

  function renderMonth() {
    const { from, to } = range();
    const byDate = Object.fromEntries((state.data?.days ?? []).map((d) => [d.date, d]));
    const lead = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
    const weekdays = Array.from({ length: 7 }, (_, i) => fmtDate(addDays('2026-01-05', i), { weekday: 'short' }));
    const total = config.units.length;

    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(h('div', { 'aria-hidden': 'true' }));
    for (let d = from; d < to; d = addDays(d, 1)) {
      const day = byDate[d];
      const past = d < today;
      const full = day && day.free === 0;
      // A fully booked night can still be someone's check-out day.
      const canPickOut = state.pendingIn && d > state.pendingIn;
      const disabled = past || (full && !canPickOut);
      const selected = inSelected(d);
      const pending = state.pendingIn === d;
      const isEdge = d === booking.range.checkIn || pending;
      const label = !day || past ? '' : day.free === total ? t('villa.free') : full ? t('villa.full') : t('villa.left', { n: day.free, total });
      const tone = isEdge ? 'border-terra bg-terra text-paper'
        : selected ? 'border-terra-300 bg-terra-100'
          : past ? 'border-transparent bg-transparent text-ink-muted/40'
            : full ? 'border-transparent bg-clay/70 text-ink-muted'
              : day && day.free < total ? 'border-sun-200 bg-sun-100/60 hover:border-sun'
                : 'border-clay/70 bg-paper hover:border-clay-2';
      const tipText = day && !past ? `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })} — ${freeText(day)}` : '';
      cells.push(h('button', {
        type: 'button',
        class: `btn relative flex min-h-[3.75rem] flex-col items-start justify-between rounded-xl border p-1.5 text-left sm:min-h-[5.25rem] sm:p-2.5 ${tone} ${disabled ? 'cursor-not-allowed' : ''}`,
        disabled: disabled || null,
        'aria-label': past ? `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })} — ${t('state.past')}` : tipText,
        'aria-pressed': String(selected || pending),
        onclick: () => onDayClick(d),
        onmouseenter: (e) => tipText && showTip(e.currentTarget, freeText(day)),
        onmouseleave: hideTip,
        onfocus: (e) => tipText && showTip(e.currentTarget, freeText(day)),
        onblur: hideTip,
      },
      h('span', { class: `tabular text-sm font-semibold sm:text-base ${full && !past && !isEdge ? 'line-through decoration-ink-muted/60' : ''} ${d === today && !isEdge ? 'text-terra' : ''}` }, String(Number(d.slice(8)))),
      // Phones: just "3/5" on partly booked days (the colour and crossed-out date carry the rest).
      label && day.free > 0 && day.free < total ? h('span', { class: `tabular text-[11px] font-semibold sm:hidden ${isEdge ? 'text-paper/85' : 'text-sun-600'}`, 'aria-hidden': 'true' }, `${day.free}/${total}`) : null,
      label ? h('span', { class: `hidden text-xs font-semibold leading-tight sm:block ${isEdge ? 'text-paper/85' : full ? 'text-ink-muted' : day.free < total ? 'text-sun-600' : 'text-palm'}` }, label) : null));
    }
    return h('div', {},
      h('div', { class: 'mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted sm:gap-2' }, ...weekdays.map((w) => h('div', {}, w))),
      h('div', { class: 'grid grid-cols-7 gap-1 sm:gap-2', onmouseleave: hideTip }, ...cells));
  }

  function renderWeek() {
    const { from, to } = range();
    const days = (state.data?.days ?? []).filter((d) => d.date >= from && d.date < to);
    return h('div', { class: 'overflow-x-auto' },
      h('table', { class: 'w-full min-w-[640px] border-separate border-spacing-1 text-sm' },
        h('thead', {}, h('tr', {},
          h('th', { class: 'sticky left-0 z-10 bg-paper-card p-2 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted', scope: 'col' }, t('avail.room')),
          ...days.map((d) => h('th', { scope: 'col', class: `p-2 text-center font-semibold ${d.date === today ? 'text-terra' : ''}` },
            h('span', { class: 'block text-xs uppercase tracking-wider text-ink-muted' }, fmtDate(d.date, { weekday: 'short' })), fmtDate(d.date, { day: 'numeric', month: 'numeric' }))))),
        h('tbody', {}, ...config.units.map((u) => h('tr', {},
          h('th', { scope: 'row', class: 'sticky left-0 z-10 bg-paper-card p-2 text-left font-semibold' }, unitName(u)),
          ...days.map((d) => {
            const s = d.units[u.id];
            const past = d.date < today;
            const free = s === 'free' && !past;
            return h('td', { class: 'p-0' }, h('button', {
              type: 'button',
              class: `btn flex h-12 w-full items-center justify-center rounded-lg text-xs font-semibold ${past ? 'opacity-40' : ''} ${free ? 'st st-free text-palm hover:bg-palm-100' : `st st-${s} ${s === 'booked' ? 'text-paper' : 'text-ink'}`}`,
              disabled: !free || null,
              'aria-label': `${unitName(u)}, ${fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${t(`state.${past ? 'past' : s}`)}`,
              onclick: () => { booking.pickUnit(u.id); booking.setRange(d.date, addDays(d.date, 1)); booking.goToForm(); },
            }, free ? t('avail.book') : h('span', { class: 'sr-only' }, t(`state.${s}`))));
          }))))));
  }

  function renderDay() {
    const day = state.data?.days?.[0];
    if (!day) return h('p', {}, '');
    return h('ul', { class: 'divide-y divide-clay/70' }, ...config.units.map((u) => {
      const s = day.units[u.id];
      const free = s === 'free' && day.date >= today;
      return h('li', { class: 'flex items-center gap-3 py-3.5' },
        h('span', { class: `st st-${s} h-8 w-2 shrink-0`, 'aria-hidden': 'true' }),
        h('span', { class: 'min-w-0 flex-1' }, h('span', { class: 'block font-semibold' }, unitName(u)), h('span', { class: 'block text-sm text-ink-muted' }, t(`state.${s}`))),
        free ? h('button', { type: 'button', class: 'btn min-h-[2.75rem] rounded-full bg-terra px-5 text-sm font-semibold text-paper hover:bg-terra-700', onclick: () => { booking.pickUnit(u.id); booking.setRange(day.date, addDays(day.date, 1)); booking.goToForm(); } }, t('avail.book')) : null);
    }));
  }

  function renderBody() {
    if (state.error) {
      fill(surface, h('div', { class: 'flex flex-col items-center gap-3 py-10 text-center' }, h('p', { class: 'text-ink-muted' }, t('avail.error')),
        h('button', { type: 'button', class: 'btn rounded-full border border-clay px-5 py-2.5 font-semibold hover:bg-paper-2', onclick: load }, t('avail.retry'))));
      return;
    }
    if (!state.data) { fill(surface, h('p', { class: 'py-16 text-center text-ink-muted' }, t('avail.loading'))); return; }
    fill(surface, state.view === 'month' ? renderMonth() : state.view === 'week' ? renderWeek() : renderDay());
    surface.style.opacity = state.loading ? '0.6' : '1';
  }

  function renderHint() {
    const { checkIn, checkOut } = booking.range;
    if (state.pendingIn) {
      const day = state.data?.days?.find((x) => x.date === state.pendingIn);
      fill(hint, h('p', { class: 'rounded-2xl bg-sun-100 px-4 py-3 text-sm font-medium text-ink' },
        t('avail.pickedIn', { date: fmtDate(state.pendingIn) }), day ? h('span', { class: 'mt-1 block font-normal text-ink-2' }, freeText(day)) : null));
    } else if (checkIn && checkOut) {
      fill(hint, h('div', { class: 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-terra-300 bg-paper-card px-4 py-3 elevated' },
        h('p', { class: 'text-sm font-semibold' }, `${fmtDate(checkIn)} → ${fmtDate(checkOut)} · ${t('sum.nights', { n: diffDays(checkIn, checkOut) })}`),
        h('a', { href: '#booking', class: 'btn inline-flex min-h-[2.75rem] items-center rounded-full bg-terra px-5 text-sm font-semibold text-paper hover:bg-terra-700', onclick: (e) => { e.preventDefault(); booking.goToForm(); } }, t('book.continue'))));
    } else fill(hint, );
  }

  async function load() {
    const mySeq = ++seq;
    const { from, to } = range();
    state.loading = true;
    state.error = false;
    renderToolbar();
    renderBody();
    try {
      const data = await api(`/api/availability?from=${from}&to=${to}`);
      if (mySeq !== seq) return;
      state.data = data;
    } catch {
      if (mySeq !== seq) return;
      state.error = true;
    }
    state.loading = false;
    renderBody();
  }

  document.addEventListener('booking:range', () => { state.pendingIn = null; renderBody(); renderHint(); });
  document.addEventListener('availability:refresh', load);
  document.addEventListener('langchange', () => { renderToolbar(); renderBody(); renderHint(); });
  load();
}
