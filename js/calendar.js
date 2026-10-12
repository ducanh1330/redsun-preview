import { t, getLang } from './i18n.js';
import { api, fmtDate, h, unitName, todayIso, addDays, diffDays, fill } from './api.js';

// Guests see three states only: free / few left / none. "On hold" and
// "closed" are the owner's business, so they read as "none" here.
const DAY_AHEAD = 31; // Day view looks this far ahead for "free again from".

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

/** 1600000 → "1,6tr" (vi) / "1.6M" (en). Short enough for a calendar cell. */
export function shortPrice(v) {
  if (v == null) return '';
  const vi = getLang() === 'vi';
  const n = new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 }).format(v / 1e6);
  return vi ? `${n}tr` : `${n}M`;
}

export function initCalendar(root, config, booking) {
  const today = todayIso();
  const units = config.units;
  const state = {
    view: 'month', anchor: today, data: null, error: false, loading: false,
    pendingIn: null, // month: check-in tapped, waiting for check-out
    weekPick: null, // week: { unit, from } first night tapped on a room row
    selUnit: null, // room chosen from the week/day view (highlights its row, prices the stay)
  };
  // Every day seen so far, so the summary can price a stay that spans views.
  const known = new Map();
  let seq = 0;

  const toolbar = h('div', { class: 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' });
  const legend = h('ul', { class: 'flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2' });
  const instruction = h('p', { class: 'text-sm text-ink-muted' });
  const surface = h('div', { class: 'mt-4 rounded-3xl border border-clay/70 bg-paper-card p-2 elevated sm:p-5' });
  const hint = h('div', { class: 'mt-4 min-h-[3rem]', 'aria-live': 'polite' });
  root.append(toolbar, h('div', { class: 'mt-4 flex flex-col gap-2' }, legend, instruction), surface, hint);

  const isFree = (day, id) => day?.units[id] === 'free';
  const freeUnits = (day) => units.filter((u) => isFree(day, u.id));
  const unitPrice = (day, id) => day?.prices?.units?.[id];
  const lowest = (day) => {
    const p = freeUnits(day).map((u) => unitPrice(day, u.id)).filter((x) => x != null);
    return p.length ? Math.min(...p) : null;
  };
  // A stay works only if one room is free on every night of it (guests don't switch rooms mid-stay).
  const stayable = (from, to) => units.some((u) => {
    for (let d = from; d < to; d = addDays(d, 1)) if (!isFree(known.get(d), u.id)) return false;
    return true;
  });
  // Latest check-out reachable from a check-in (nights not loaded yet count as unknown → stop).
  const MAX_NIGHTS = 30;
  const lastOut = (from) => {
    let out = from;
    while (diffDays(from, out) < MAX_NIGHTS && known.has(out) && stayable(from, addDays(out, 1))) out = addDays(out, 1);
    return out;
  };
  // free = every room, few = some, none = nothing left
  const level = (day) => { const n = freeUnits(day).length; return n === units.length ? 'free' : n ? 'few' : 'none'; };

  function range() {
    if (state.view === 'month') { const from = monthStart(state.anchor); return { from, to: nextMonth(from) }; }
    if (state.view === 'week') { const from = mondayOf(state.anchor); return { from, to: addDays(from, 7) }; }
    return { from: state.anchor, to: addDays(state.anchor, 1) };
  }

  function periodLabel() {
    const { from, to } = range();
    if (state.view === 'month') return fmtDate(from, { month: 'long', year: 'numeric' });
    if (state.view === 'week') return `${fmtDate(from, { day: 'numeric', month: 'numeric' })} – ${fmtDate(addDays(to, -1), { day: 'numeric', month: 'numeric', year: 'numeric' })}`;
    return fmtDate(from, { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  function move(dir) {
    if (state.view === 'month') state.anchor = dir > 0 ? nextMonth(monthStart(state.anchor)) : prevMonth(monthStart(state.anchor));
    else state.anchor = addDays(state.anchor, dir * (state.view === 'week' ? 7 : 1));
    if (state.anchor < today && state.view === 'day') state.anchor = today;
    load();
  }

  const iconBtn = (labelKey, path, onclick, disabled) => h('button', {
    type: 'button', class: 'btn grid h-11 w-11 shrink-0 place-items-center rounded-full border border-clay bg-paper-card hover:border-clay-2 hover:bg-paper', 'aria-label': t(labelKey), onclick, disabled: disabled || null,
    html: `<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`,
  });

  const swatch = (cls) => h('span', { class: `inline-block h-3.5 w-3.5 rounded ${cls}`, 'aria-hidden': 'true' });

  function renderToolbar() {
    const { from } = range();
    const atStart = from <= (state.view === 'month' ? monthStart(today) : state.view === 'week' ? mondayOf(today) : today);
    fill(toolbar,
      h('div', { class: 'seg', role: 'group', 'aria-label': t('avail.view') },
        ...['day', 'week', 'month'].map((v) => h('button', {
          type: 'button', 'aria-pressed': String(state.view === v),
          onclick: () => {
            if (state.view === v) return;
            state.view = v;
            state.weekPick = null;
            state.pendingIn = null;
            // Land on the chosen check-in if there is one, so the selection stays in view.
            const { checkIn } = booking.range;
            state.anchor = checkIn && checkIn >= today ? checkIn : state.anchor < today ? today : state.anchor;
            load();
          },
        }, t(`avail.view.${v}`)))),
      h('div', { class: 'flex w-full items-center gap-2 sm:w-auto' },
        iconBtn('avail.prev', 'M12.5 5 7.5 10l5 5', () => move(-1), atStart),
        h('p', { class: 'min-w-0 flex-1 truncate whitespace-nowrap text-center font-display text-base font-semibold capitalize tabular sm:min-w-[12rem] sm:flex-none sm:text-lg', 'aria-live': 'polite' }, periodLabel()),
        iconBtn('avail.next', 'm7.5 5 5 5-5 5', () => move(1)),
        h('button', { type: 'button', class: 'btn ml-1 min-h-[2.75rem] shrink-0 whitespace-nowrap rounded-full border border-clay bg-paper-card px-4 text-sm font-semibold hover:border-clay-2 hover:bg-paper', onclick: () => { state.anchor = today; load(); } }, t('avail.today'))),
    );
    fill(legend,
      h('li', { class: 'flex items-center gap-2' }, swatch('border border-clay-2 bg-paper'), t('cal.free')),
      state.view === 'month' ? h('li', { class: 'flex items-center gap-2' }, swatch('border border-sun-200 bg-sun-100'), t('cal.few')) : null,
      h('li', { class: 'flex items-center gap-2' }, swatch('bg-clay'), t('cal.none')));
    instruction.textContent = t(`cal.how.${state.view}`);
  }

  const picking = () => Boolean(state.pendingIn || state.weekPick);
  const inSelected = (d) => {
    if (picking()) return false;
    const { checkIn, checkOut } = booking.range;
    return checkIn && checkOut && d >= checkIn && d < checkOut;
  };
  const cancelPick = () => { state.pendingIn = null; state.weekPick = null; renderBody(); renderHint(); };
  const clearAll = () => { state.pendingIn = null; state.weekPick = null; state.selUnit = null; booking.clear(); };

  const freeText = (day) => {
    const free = freeUnits(day);
    return free.length ? t('avail.freeRooms', { rooms: free.map((u) => u.code).join(', ') }) : t('cal.none');
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

  // ── Month: whole house at a glance, lowest price per night ─────────────────
  function onDayClick(date) {
    if (state.pendingIn === date) return cancelPick();
    if (!state.pendingIn || date < state.pendingIn) {
      state.pendingIn = date;
      state.selUnit = null;
      renderBody();
      renderHint();
      return;
    }
    const checkIn = state.pendingIn;
    state.pendingIn = null;
    booking.setRange(checkIn, date);
  }

  function renderMonth() {
    const { from, to } = range();
    const lead = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
    const weekdays = Array.from({ length: 7 }, (_, i) => fmtDate(addDays('2026-01-05', i), { weekday: 'short' }));
    const total = units.length;

    const maxOut = state.pendingIn ? lastOut(state.pendingIn) : null;
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(h('div', { 'aria-hidden': 'true' }));
    for (let d = from; d < to; d = addDays(d, 1)) {
      const day = known.get(d);
      const past = d < today;
      const lv = day ? level(day) : null;
      const full = lv === 'none';
      // A fully booked night can still be someone's check-out day.
      // While picking check-out: only days a room stays free until (a full night can still be the check-out day).
      const afterIn = state.pendingIn && d > state.pendingIn;
      const unreachable = afterIn && d > maxOut;
      const disabled = past || unreachable || (full && !afterIn);
      const selected = inSelected(d);
      const pending = state.pendingIn === d;
      const isEdge = pending || (!picking() && d === booking.range.checkIn);
      const price = day && !past ? lowest(day) : null;
      const label = !day || past ? '' : lv === 'free' ? t('cal.free') : full ? t('cal.none') : t('villa.left', { n: freeUnits(day).length, total });
      const tone = isEdge ? 'border-terra bg-terra text-paper'
        : selected ? 'border-terra-300 bg-terra-100'
          : past ? 'border-transparent bg-transparent text-ink-muted/40'
            : full ? 'border-transparent bg-clay/70 text-ink-muted'
              : lv === 'few' ? 'border-sun-200 bg-sun-100/60 hover:border-sun'
                : 'border-clay/70 bg-paper hover:border-clay-2';
      const longDate = fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
      const tipText = day && !past ? `${freeText(day)}${price != null ? ` · ${t('cal.from', { price: shortPrice(price) })}` : ''}` : '';
      cells.push(h('button', {
        type: 'button',
        class: `btn relative flex min-h-[3.75rem] flex-col items-start justify-between rounded-xl border p-1.5 text-left sm:min-h-[5.25rem] sm:p-2.5 ${tone} ${disabled ? 'cursor-not-allowed' : ''} ${unreachable ? 'opacity-35' : ''}`,
        disabled: disabled || null,
        'aria-label': past ? `${longDate} — ${t('state.past')}` : `${longDate} — ${tipText}`,
        'aria-pressed': String(selected || pending),
        onclick: () => onDayClick(d),
        onmouseenter: (e) => tipText && showTip(e.currentTarget, tipText),
        onmouseleave: hideTip,
        onfocus: (e) => tipText && showTip(e.currentTarget, tipText),
        onblur: hideTip,
      },
      h('span', { class: `tabular text-sm font-semibold sm:text-base ${full && !past && !isEdge ? 'line-through decoration-ink-muted/60' : ''} ${d === today && !isEdge ? 'text-terra' : ''}` }, String(Number(d.slice(8)))),
      h('span', { class: 'flex flex-col gap-0.5' },
        label ? h('span', { class: `hidden text-xs font-semibold leading-tight sm:block ${isEdge ? 'text-paper/85' : full ? 'text-ink-muted' : lv === 'few' ? 'text-sun-600' : 'text-palm'}` }, label) : null,
        price != null ? h('span', { class: `tabular text-[10px] font-medium leading-tight sm:text-xs ${isEdge ? 'text-paper/85' : 'text-ink-2'}`, 'aria-hidden': 'true' },
          h('span', { class: 'hidden sm:inline' }, `${t('cal.fromWord')} `), shortPrice(price)) : null)));
    }
    return h('div', {},
      h('div', { class: 'mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wider text-ink-muted sm:gap-2' }, ...weekdays.map((w) => h('div', {}, w))),
      h('div', { class: 'grid grid-cols-7 gap-1 sm:gap-2', onmouseleave: hideTip }, ...cells));
  }

  // ── Week: rooms × 7 nights; tap first and last night on a row ──────────────
  function onWeekCellRange(u, from, last) {
    // Every night between must be free for this room; otherwise start over at the last tap.
    for (let d = from; d <= last; d = addDays(d, 1)) {
      if (!isFree(known.get(d), u.id)) { state.weekPick = { unit: u.id, from: last }; renderBody(); renderHint(); return; }
    }
    state.weekPick = null;
    state.pendingIn = null;
    state.selUnit = u.id;
    booking.pickUnit(u.id);
    booking.setRange(from, addDays(last, 1));
  }

  function onWeekCell(u, date) {
    const p = state.weekPick;
    if (p && p.unit === u.id && p.from === date) return cancelPick();
    if (p && p.unit === u.id && date > p.from) {
      // Every night between must be free for this room; otherwise start over here.
      onWeekCellRange(u, p.from, date);
      return;
    }
    state.weekPick = { unit: u.id, from: date };
    renderBody();
    renderHint();
  }

  function renderWeek() {
    const { from } = range();
    const dates = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    // Same column template on every row so the nights line up.
    const cols = 'grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5 md:grid-cols-[9.5rem_repeat(7,minmax(0,1fr))]';
    const head = h('div', { class: cols },
      h('div', { class: 'self-end px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:text-xs' }, t('avail.room')),
      ...dates.map((d) => h('div', { class: `pb-1 text-center leading-tight ${d === today ? 'text-terra' : ''}` },
        h('span', { class: 'block text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:text-xs' }, fmtDate(d, { weekday: 'short' })),
        h('span', { class: 'block text-sm font-semibold tabular' }, String(Number(d.slice(8)))))));

    const rows = units.map((u) => {
      const p = state.weekPick?.unit === u.id ? state.weekPick : null;
      const rowSelected = state.selUnit === u.id;
      return h('div', { class: cols, role: 'group', 'aria-label': unitName(u) },
        h('div', { class: 'flex min-w-0 flex-col justify-center px-1' },
          h('span', { class: 'font-semibold tabular' }, u.code),
          h('span', { class: 'hidden truncate text-xs text-ink-muted md:block' }, t(`unit.kind.${u.kind}`))),
        ...dates.map((d) => {
          const day = known.get(d);
          const past = d < today;
          const free = !past && isFree(day, u.id);
          const picked = p && p.from === d;
          const sel = rowSelected && inSelected(d);
          const price = unitPrice(day, u.id);
          const tone = picked ? 'border-terra bg-terra text-paper'
            : sel ? 'border-terra-300 bg-terra-100 text-ink'
              : free ? 'border-clay/70 bg-paper text-ink-2 hover:border-palm hover:bg-palm-100'
                : 'border-transparent bg-clay/60 text-ink-muted';
          return h('button', {
            type: 'button',
            class: `btn flex h-11 min-w-0 items-center justify-center rounded-lg border text-[10px] font-semibold tabular sm:h-12 sm:text-xs ${tone} ${past ? 'opacity-40' : ''}`,
            disabled: (!free && !picked) || null,
            'aria-pressed': String(Boolean(picked || sel)),
            'aria-label': `${unitName(u)}, ${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${past ? t('state.past') : free ? `${t('cal.free')}, ${shortPrice(price)}` : t('cal.none')}`,
            onclick: () => onWeekCell(u, d),
          }, free || picked ? shortPrice(price) : h('span', { 'aria-hidden': 'true' }, '—'));
        }));
    });
    return h('div', { class: 'flex flex-col gap-1 sm:gap-1.5' }, head, ...rows);
  }

  // ── Day: one card per room for that night ──────────────────────────────────
  const freeAgain = (id, date) => {
    for (let d = addDays(date, 1); d < addDays(date, DAY_AHEAD); d = addDays(d, 1)) {
      const day = known.get(d);
      if (!day) return null;
      if (isFree(day, id)) return d;
    }
    return null;
  };
  const capText = (u) => (u.kind === 'dorm' ? t('unit.capDorm', { adults: u.adults }) : t('unit.cap', { adults: u.adults, children: u.children }));
  const bookBtn = (onclick) => h('button', { type: 'button', class: 'btn min-h-[2.75rem] shrink-0 rounded-full bg-terra px-5 text-sm font-semibold text-paper hover:bg-terra-700', onclick }, t('avail.book'));
  const priceTag = (v) => h('span', { class: 'shrink-0 text-right' }, h('span', { class: 'block font-semibold tabular' }, shortPrice(v)), h('span', { class: 'block text-xs text-ink-muted' }, t('unit.perNight')));

  function renderDay() {
    const date = state.anchor;
    const day = known.get(date);
    if (!day) return h('p', {}, '');
    const pick = (u) => { state.selUnit = u.id; state.pendingIn = null; booking.pickUnit(u.id); booking.setRange(date, addDays(date, 1)); booking.goToForm(); };
    const allFree = freeUnits(day).length === units.length;
    const cards = [];
    if (allFree && day.prices?.villa != null) {
      cards.push(h('li', { class: 'flex items-center gap-3 rounded-2xl border border-terra-300 bg-terra-100/50 p-3.5 sm:col-span-2 sm:p-4' },
        h('span', { class: 'min-w-0 flex-1' },
          h('span', { class: 'block font-display text-lg font-semibold' }, t('sum.villa')),
          h('span', { class: 'block text-sm text-ink-muted' }, t('cal.villaSub'))),
        priceTag(day.prices.villa),
        bookBtn(() => { state.selUnit = null; state.pendingIn = null; booking.setMode('villa'); booking.setRange(date, addDays(date, 1)); booking.goToForm(); })));
    }
    for (const u of units) {
      const free = isFree(day, u.id);
      const again = free ? null : freeAgain(u.id, date);
      cards.push(h('li', { class: `flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4 ${free ? 'border-clay/70 bg-paper' : 'border-transparent bg-clay/40'}` },
        h('span', { class: 'min-w-0 flex-1' },
          h('span', { class: 'block font-semibold' }, unitName(u)),
          h('span', { class: 'block text-sm text-ink-muted' }, capText(u)),
          free ? null : h('span', { class: 'mt-1 block text-sm font-medium text-ink-2' },
            again ? t('cal.freeAgain', { date: fmtDate(again, { weekday: 'short', day: 'numeric', month: 'numeric' }) }) : t('cal.fullAhead'))),
        free ? priceTag(unitPrice(day, u.id)) : null,
        free ? bookBtn(() => pick(u))
          : again ? h('button', { type: 'button', class: 'btn min-h-[2.75rem] shrink-0 rounded-full border border-clay bg-paper-card px-4 text-sm font-semibold hover:border-clay-2 hover:bg-paper', onclick: () => { state.anchor = again; load(); } }, t('cal.goThere')) : null));
    }
    return h('ul', { class: 'grid gap-2 sm:grid-cols-2 sm:gap-3' }, ...cards);
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

  // Price of the chosen stay: the picked room if any, else the cheapest free room each night.
  function stayPrice(checkIn, checkOut) {
    let sum = 0;
    for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
      const day = known.get(d);
      const p = state.selUnit ? unitPrice(day, state.selUnit) : lowest(day);
      if (p == null) return null;
      sum += p;
    }
    return sum;
  }

  const ghostBtn = (label, onclick) => h('button', { type: 'button', class: 'btn min-h-[2.75rem] rounded-full border border-clay bg-paper-card px-4 text-sm font-semibold hover:border-clay-2 hover:bg-paper', onclick }, label);

  function renderHint() {
    const { checkIn, checkOut } = booking.range;
    if (state.pendingIn || state.weekPick) {
      const from = state.pendingIn ?? state.weekPick.from;
      const room = state.weekPick ? units.find((u) => u.id === state.weekPick.unit)?.code : null;
      const one = state.weekPick;
      fill(hint, h('div', { class: 'flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun-100 px-4 py-3' },
        h('p', { class: 'min-w-0 text-sm font-medium text-ink' }, room ? t('cal.pickedWeek', { room, date: fmtDate(from) }) : t('avail.pickedIn', { date: fmtDate(from) }),
          // Month: say how far the stay can go before some night is fully booked.
          state.pendingIn ? h('span', { class: 'mt-1 block font-normal text-ink-2' }, t('cal.lastOut', { date: fmtDate(lastOut(state.pendingIn)) })) : null),
        h('div', { class: 'flex flex-wrap gap-2' },
          one ? ghostBtn(t('cal.oneNight'), () => onWeekCellRange(units.find((x) => x.id === one.unit), one.from, one.from)) : null,
          ghostBtn(t('cal.cancel'), cancelPick))));
    } else if (checkIn && checkOut) {
      const n = diffDays(checkIn, checkOut);
      const total = stayPrice(checkIn, checkOut);
      const room = state.selUnit ? units.find((u) => u.id === state.selUnit)?.code : null;
      fill(hint, h('div', { class: 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-terra-300 bg-paper-card px-4 py-3 elevated' },
        h('p', { class: 'min-w-0 text-sm font-semibold tabular' },
          `${room ? `${room} · ` : ''}${fmtDate(checkIn, { day: 'numeric', month: 'numeric' })} → ${fmtDate(checkOut, { day: 'numeric', month: 'numeric' })} · ${t('sum.nights', { n })}`,
          total != null ? h('span', { class: 'text-ink-muted' }, ` · ${room ? shortPrice(total) : t('cal.from', { price: shortPrice(total) })}`) : null),
        h('div', { class: 'flex flex-wrap items-center gap-2' },
          ghostBtn(t('cal.clear'), clearAll),
          h('a', { href: '#booking', class: 'btn inline-flex min-h-[2.75rem] items-center rounded-full bg-terra px-5 text-sm font-semibold text-paper hover:bg-terra-700', onclick: (e) => { e.preventDefault(); booking.goToForm(); } }, t('book.continue')))));
    } else fill(hint);
  }

  async function load() {
    const mySeq = ++seq;
    const { from, to: viewTo } = range();
    // Day view fetches a month ahead to say when a booked room frees up.
    const to = state.view === 'day' ? addDays(from, DAY_AHEAD) : viewTo;
    state.loading = true;
    state.error = false;
    renderToolbar();
    renderBody();
    try {
      const data = await api(`/api/availability?from=${from}&to=${to}`);
      if (mySeq !== seq) return;
      state.data = data;
      for (const d of data.days) known.set(d.date, d);
    } catch {
      if (mySeq !== seq) return;
      state.error = true;
    }
    state.loading = false;
    renderBody();
    renderHint();
  }

  document.addEventListener('booking:range', () => { state.pendingIn = null; state.weekPick = null; renderBody(); renderHint(); });
  document.addEventListener('booking:selection', (e) => {
    const { mode, units: ids } = e.detail;
    if (state.selUnit && (mode !== 'room' || !ids.includes(state.selUnit))) state.selUnit = ids.length === 1 && mode === 'room' ? ids[0] : null;
    renderBody();
    renderHint();
  });
  document.addEventListener('availability:refresh', () => { known.clear(); load(); });
  document.addEventListener('langchange', () => { renderToolbar(); renderBody(); renderHint(); });
  load();
}
