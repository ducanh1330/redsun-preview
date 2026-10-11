// Date-range picker that replaces a pair of <input type="date"> (check-in / check-out).
// The inputs stay in the DOM as hidden fields, so existing code keeps reading
// .value and listening for 'change'. Days fully booked (for the chosen booking
// type) can't be picked, and a stay can't run across a booked night.
import { t } from './i18n.js';
import { api, h, fill, addDays, todayIso, diffDays, fmtDate } from './api.js';

const MAX_NIGHTS = 30;
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
function shiftMonth(iso, n) {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
const daysInMonth = (iso) => diffDays(iso, shiftMonth(iso, 1));

const ICON = {
  cal: '<svg viewBox="0 0 20 20" class="h-4 w-4 shrink-0 text-ink-muted" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/></svg>',
  prev: '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 5 7.5 10l5 5"/></svg>',
  next: '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7.5 5 5 5-5 5"/></svg>',
};

export function attachRangePicker({ inEl, outEl, mode = () => 'room' }) {
  const today = todayIso();
  const avail = new Map(); // date → { free, villa }
  const loaded = new Set(); // month starts already fetched
  const state = { start: inEl.value || '', end: outEl.value || '', picking: 'start', view: monthStart(inEl.value || today), hover: '', open: false };
  let lastTrigger = null;

  // ── triggers: one per input, so existing layouts keep their two fields ──
  const makeTrigger = (input, which) => {
    const label = h('span', { class: 'truncate' });
    const btn = h('button', {
      type: 'button',
      class: 'field btn flex items-center gap-2 text-left',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      onclick: () => openAt(which, btn),
    }, h('span', { html: ICON.cal }), label);
    input.type = 'hidden';
    input.after(btn);
    return { btn, label };
  };
  const trigIn = makeTrigger(inEl, 'start');
  const trigOut = makeTrigger(outEl, 'end');

  function syncTriggers() {
    const show = ({ btn, label }, value, active) => {
      label.textContent = value ? fmtDate(value, { weekday: 'short', day: 'numeric', month: 'short' }) : t('dp.add');
      label.classList.toggle('text-ink-muted', !value);
      btn.classList.toggle('!border-terra', state.open && active);
      btn.setAttribute('aria-expanded', String(state.open));
    };
    show(trigIn, state.start, state.picking === 'start');
    show(trigOut, state.end, state.picking === 'end');
  }

  // ── popover: anchored card on ≥640px, bottom sheet on phones ────────────
  const backdrop = h('div', { class: 'fixed inset-0 z-[69] hidden bg-ink/40 sm:hidden', 'aria-hidden': 'true', onclick: () => close() });
  const pop = h('div', {
    role: 'dialog',
    class: 'fixed inset-x-0 bottom-0 z-[70] hidden max-h-[88svh] overflow-y-auto rounded-t-3xl border border-clay/70 bg-paper-card p-4 floating sm:absolute sm:inset-x-auto sm:bottom-auto sm:max-h-none sm:rounded-3xl sm:p-5',
  });
  document.body.append(backdrop, pop);

  const blocked = (d) => {
    const a = avail.get(d);
    if (!a) return false;
    return mode() === 'villa' ? a.villa !== 'free' : a.free === 0;
  };
  const partial = (d) => {
    const a = avail.get(d);
    return Boolean(a) && mode() !== 'villa' && a.free > 0 && a.villa !== 'free';
  };
  // Latest check-out for the chosen check-in: the first booked night ends the stay.
  function maxEnd() {
    for (let n = 1; n <= MAX_NIGHTS; n += 1) {
      const night = addDays(state.start, n);
      if (blocked(night)) return night;
    }
    return addDays(state.start, MAX_NIGHTS);
  }

  async function loadMonths(months) {
    const missing = months.filter((m) => !loaded.has(m) && shiftMonth(m, 1) > today);
    if (!missing.length) return;
    missing.forEach((m) => loaded.add(m));
    const from = missing[0] < today ? today : missing[0];
    const to = shiftMonth(missing[missing.length - 1], 1);
    try {
      const data = await api(`/api/availability?from=${from}&to=${to}`);
      for (const d of data.days) avail.set(d.date, { free: d.free, villa: d.villa });
      if (state.open) render();
    } catch {
      missing.forEach((m) => loaded.delete(m)); // retry next render
    }
  }

  function disabledReason(d) {
    if (d < today) return 'past';
    // Past the first booked night: unreachable, but only "full" if that day itself is booked.
    if (state.picking === 'end' && state.start && d > state.start) return d > maxEnd() ? (blocked(d) ? 'blocked' : 'range') : null;
    return blocked(d) ? 'blocked' : null; // picking (or restarting) check-in
  }

  // Range styling is applied in place by paintRange(), never by rebuilding the
  // grid: rebuilding on hover swapped the button under the cursor between
  // mousedown and mouseup, so clicks on a check-out day were lost.
  const EDGE = ['bg-terra', 'font-semibold', 'text-paper', 'shadow-[0_6px_16px_-6px_rgba(163,64,30,0.6)]'];
  const BANDS = {
    mid: ['bg-terra-100'],
    start: ['bg-gradient-to-r', 'from-transparent', 'from-50%', 'to-terra-100', 'to-50%'],
    end: ['bg-gradient-to-r', 'from-terra-100', 'from-50%', 'to-transparent', 'to-50%'],
  };
  const ALL_BANDS = [...new Set(Object.values(BANDS).flat())];

  function paintRange() {
    const { start, end, picking, hover } = state;
    const rangeEnd = end || (picking === 'end' && start && hover > start ? hover : '');
    pop.querySelectorAll('[data-cell]').forEach((cell) => {
      const d = cell.dataset.cell;
      const btn = cell.firstElementChild;
      const band = !start || !rangeEnd ? null
        : d > start && d < rangeEnd ? 'mid' : d === start ? 'start' : d === rangeEnd ? 'end' : null;
      cell.classList.remove(...ALL_BANDS);
      if (band) cell.classList.add(...BANDS[band]);
      const edge = !btn.disabled && (d === start || d === rangeEnd);
      btn.classList.toggle('hover:bg-paper-2', !btn.disabled && !edge);
      EDGE.forEach((c) => btn.classList.toggle(c, edge));
      btn.classList.toggle('ring-1', d === today && !edge);
      btn.setAttribute('aria-pressed', String(d === start || d === end));
      btn.querySelector('.dp-dot')?.classList.toggle('hidden', edge);
    });
  }

  function monthGrid(first) {
    const { start, end, picking } = state;
    const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(h('span', { 'aria-hidden': 'true' }));
    for (let i = 0; i < daysInMonth(first); i += 1) {
      const d = addDays(first, i);
      const reason = disabledReason(d);
      const focusable = d === (picking === 'end' && start ? end || start : start || today);
      cells.push(h('div', { class: 'relative py-0.5', 'data-cell': d },
        h('button', {
          type: 'button',
          'data-date': d,
          tabindex: focusable ? '0' : '-1',
          disabled: reason ? true : null,
          'aria-label': `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${reason === 'blocked' ? ` — ${t('dp.full')}` : partial(d) ? ` — ${t('dp.partial')}` : ''}`,
          class: `relative mx-auto grid h-11 w-11 place-items-center rounded-full text-sm tabular ring-inset ring-clay-2 focus-ring sm:h-10 sm:w-10 ${
            reason === 'past' || reason === 'range' ? 'cursor-not-allowed text-ink-muted/40'
              : reason === 'blocked' ? 'cursor-not-allowed text-ink-muted/50 line-through'
                : 'cursor-pointer'}`,
          onclick: () => pick(d),
          onmouseenter: () => {
            if (state.picking === 'end' && state.start && d > state.start && d !== state.hover) {
              state.hover = d;
              paintRange();
            }
          },
        },
        String(Number(d.slice(8))),
        partial(d) && !reason ? h('span', { 'aria-hidden': 'true', class: 'dp-dot absolute bottom-1.5 h-1 w-1 rounded-full bg-sun' }) : null)));
    }
    const weekdays = Array.from({ length: 7 }, (_, i) => fmtDate(addDays('2026-01-05', i), { weekday: 'narrow' }));
    return h('div', { class: 'min-w-0' },
      h('p', { class: 'mb-3 text-center font-display text-lg font-semibold capitalize' }, fmtDate(first, { month: 'long', year: 'numeric' })),
      h('div', { class: 'grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-muted' }, ...weekdays.map((w) => h('span', { class: 'pb-2' }, w))),
      h('div', { class: 'grid grid-cols-7' }, ...cells));
  }

  function render() {
    const two = window.matchMedia('(min-width: 768px)').matches;
    const months = two ? [state.view, shiftMonth(state.view, 1)] : [state.view];
    loadMonths(months);
    const nights = state.start && state.end ? diffDays(state.start, state.end) : 0;
    const headline = state.picking === 'start' ? t('dp.pickIn') : t('dp.pickOut');
    const navBtn = (label, icon, onclick, disabled) => h('button', {
      type: 'button', class: 'btn grid h-10 w-10 shrink-0 place-items-center rounded-full border border-clay hover:bg-paper-2',
      'aria-label': label, disabled: disabled ? true : null, onclick, html: icon,
    });
    pop.setAttribute('aria-label', headline);
    fill(pop,
      h('div', { class: 'mx-auto mb-3 h-1 w-10 rounded-full bg-clay sm:hidden', 'aria-hidden': 'true' }),
      h('div', { class: 'flex items-center justify-between gap-3' },
        navBtn(t('dp.prevMonth'), ICON.prev, () => { state.view = shiftMonth(state.view, -1); render(); }, state.view <= monthStart(today)),
        h('p', { class: 'text-center text-sm font-semibold text-ink-2', 'aria-live': 'polite' },
          nights ? `${t('sum.nights', { n: nights })} · ${fmtDate(state.start)} → ${fmtDate(state.end)}` : headline),
        navBtn(t('dp.nextMonth'), ICON.next, () => { state.view = shiftMonth(state.view, 1); render(); })),
      h('div', {
        class: `mt-4 grid gap-8 ${two ? 'grid-cols-2' : 'grid-cols-1'}`,
        onmouseleave: () => { if (state.hover) { state.hover = ''; paintRange(); } },
      }, ...months.map(monthGrid)),
      h('div', { class: 'mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-clay/70 pt-4' },
        h('ul', { class: 'flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted' },
          h('li', { class: 'flex items-center gap-1.5' }, h('span', { class: 'h-1.5 w-1.5 rounded-full bg-sun', 'aria-hidden': 'true' }), t('dp.partial')),
          h('li', { class: 'flex items-center gap-1.5' }, h('span', { class: 'text-ink-muted/60 line-through', 'aria-hidden': 'true' }, '12'), t('dp.full'))),
        h('div', { class: 'flex gap-2' },
          h('button', { type: 'button', class: 'btn min-h-[2.5rem] rounded-full px-4 text-sm font-semibold text-ink-2 underline-offset-4 hover:underline', onclick: clear }, t('dp.clear')),
          h('button', { type: 'button', class: 'btn min-h-[2.5rem] rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:bg-oxblood', onclick: () => close(true) }, t('dp.done')))));
    paintRange();
    syncTriggers();
  }

  function place() {
    if (!window.matchMedia('(min-width: 640px)').matches) {
      pop.style.left = '';
      pop.style.top = '';
      pop.style.width = '';
      return;
    }
    const width = Math.min(window.innerWidth - 32, window.matchMedia('(min-width: 768px)').matches ? 680 : 360);
    pop.style.width = `${width}px`;
    // Measure the whole field (label + value) so the popover never covers the label.
    const anchor = trigIn.btn.closest('label, .seg-field') ?? trigIn.btn;
    let r = anchor.getBoundingClientRect();
    const height = pop.offsetHeight;
    const gap = 8;
    const fitsBelow = r.bottom + gap + height <= window.innerHeight - gap;
    const fitsAbove = r.top - gap - height >= gap;
    if (!fitsBelow && !fitsAbove) {
      // Neither side has room: scroll so the field sits near the top, then open below it.
      window.scrollBy({ top: r.top - 88, behavior: 'instant' });
      r = anchor.getBoundingClientRect();
    }
    // Open upward when the field is low on screen (e.g. the search bar at the bottom of the hero).
    const above = !fitsBelow && fitsAbove;
    const left = Math.min(Math.max(16, r.left), window.innerWidth - width - 16);
    pop.style.left = `${left + window.scrollX}px`;
    pop.style.top = `${(above ? r.top - gap - height : r.bottom + gap) + window.scrollY}px`;
  }

  function openAt(which, anchor) {
    state.picking = which === 'end' && state.start ? 'end' : 'start';
    state.view = monthStart(which === 'end' && state.end ? state.end : state.start || today);
    if (state.view < monthStart(today)) state.view = monthStart(today);
    state.open = true;
    lastTrigger = anchor;
    pop.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    render();
    place();
    pop.querySelector('[data-date][tabindex="0"]:not([disabled])')?.focus({ preventScroll: true });
  }

  function close(returnFocus = false) {
    if (!state.open) return;
    state.open = false;
    state.hover = '';
    pop.classList.add('hidden');
    backdrop.classList.add('hidden');
    syncTriggers();
    if (returnFocus) lastTrigger?.focus({ preventScroll: true });
  }

  function commit() {
    inEl.value = state.start;
    outEl.value = state.end;
    // One event once both values are set; listeners read both inputs.
    outEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pick(d) {
    if (state.picking === 'start' || !state.start || d <= state.start) {
      state.start = d;
      state.end = '';
      state.picking = 'end';
      render();
      pop.querySelector(`[data-date="${d}"]`)?.focus({ preventScroll: true });
      return;
    }
    state.end = d;
    state.picking = 'start';
    commit();
    render();
    setTimeout(() => close(true), 180);
  }

  function clear() {
    state.start = '';
    state.end = '';
    state.picking = 'start';
    commit();
    render();
  }

  // Keyboard: arrows move between days, Esc closes.
  pop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    const cur = e.target.closest?.('[data-date]')?.dataset.date;
    if (!step || !cur) return;
    e.preventDefault();
    const next = addDays(cur, step);
    if (next < today) return;
    if (!pop.querySelector(`[data-date="${next}"]`)) { state.view = shiftMonth(state.view, step > 0 ? 1 : -1); render(); }
    pop.querySelector(`[data-date="${next}"]`)?.focus();
  });

  document.addEventListener('pointerdown', (e) => {
    if (state.open && !pop.contains(e.target) && !trigIn.btn.contains(e.target) && !trigOut.btn.contains(e.target)) close();
  });
  window.addEventListener('resize', () => { if (state.open) { render(); place(); } });
  document.addEventListener('langchange', () => { syncTriggers(); if (state.open) render(); });

  syncTriggers();
  return {
    /** Call after code outside the picker changes the inputs. */
    sync() {
      state.start = inEl.value || '';
      state.end = outEl.value || '';
      syncTriggers();
    },
    /** Forget cached availability (e.g. after a booking failed as taken). */
    refresh() {
      avail.clear();
      loaded.clear();
      if (state.open) render();
    },
  };
}
