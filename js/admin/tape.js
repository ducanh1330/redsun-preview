// Lịch & đóng phòng as a tape chart: rooms are rows, days are columns, and each
// booking is one bar from the middle of its check-in day to the middle of its
// check-out day (so a departure and the next arrival can share a day). Click a
// bar to open the stay; click (or drag across) empty days to book or close them.
import { t } from '../i18n.js';
import { api, fmtDate, addDays, todayIso, diffDays, unitName } from '../api.js';
import { can, isOwner, btn, flash, fail, errText, drawer, input, lbl, h, fill, vnd } from './ui.js';
import { openStay } from './board.js';
import { short } from './dashboard.js';

const SPANS = [7, 14, 30];
const ROW = 56; // px per room row
const st = {
  span: window.matchMedia('(min-width: 768px)').matches ? 14 : 7,
  from: addDays(todayIso(), -1), // start yesterday so in-house guests are in view
  data: null,
  anchor: null, // { unit, idx } first click of a click-click selection
  drag: null, // { unit, a, b } mouse drag in progress
  suppressClick: false,
};

// Bar look by stay: a text label + style, never colour alone.
function barKind(b) {
  if (b.status === 'pending') return 'held';
  if (b.stay_status === 'checked_in') return 'inhouse';
  if (b.stay_status === 'checked_out') return 'out';
  return 'reserved';
}
const BAR_CLASS = {
  reserved: 'border-2 border-terra bg-paper-card text-ink',
  inhouse: 'border-2 border-terra bg-terra text-paper',
  out: 'border border-clay-2 bg-clay/80 text-ink-muted',
  held: 'border-2 border-sun-600/60 text-ink',
};
const HELD_BG = 'background-image: repeating-linear-gradient(135deg, #FAEFD9 0 6px, #F3D9A8 6px 12px)';
const BLOCK_BG = 'background-image: repeating-linear-gradient(45deg, rgba(140,122,112,.35) 0 2px, transparent 2px 7px)';

export function renderTape(main, { openNewBooking }) {
  // minmax(0,1fr): let the wide grid scroll inside the card instead of stretching the page.
  const root = h('div', { class: 'grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4' });
  fill(main, root);

  async function load() {
    const to = addDays(st.from, st.span);
    fill(root, h('p', { class: 'py-10 text-center text-ink-muted' }, '…'));
    try { st.data = await api(`/api/admin/tape?from=${st.from}&to=${to}`); } catch (err) { return fail(err); }
    draw();
  }
  const move = (days) => { st.from = addDays(st.from, days); st.anchor = null; load(); };

  function toolbar() {
    const to = addDays(st.from, st.span - 1);
    return h('div', { class: 'flex flex-wrap items-center gap-2' },
      h('div', { class: 'seg', role: 'group', 'aria-label': t('mg.tape.zoom') },
        ...SPANS.map((n) => h('button', { type: 'button', 'aria-pressed': String(st.span === n), onclick: () => { st.span = n; load(); } }, t('mg.tape.days', { n })))),
      btn('←', () => move(-Math.max(7, Math.floor(st.span / 2))), 'ghost', { 'aria-label': t('avail.prev') }),
      btn(t('avail.today'), () => { st.from = addDays(todayIso(), -1); load(); }),
      btn('→', () => move(Math.max(7, Math.floor(st.span / 2))), 'ghost', { 'aria-label': t('avail.next') }),
      h('p', { class: 'ml-1 font-display text-lg font-semibold' }, `${fmtDate(st.from)} → ${fmtDate(to)}`),
      h('div', { class: 'ml-auto' }, btn(t('mg.refresh'), load)));
  }

  function legend() {
    const sw = (cls, style = '') => h('span', { class: `inline-block h-3.5 w-6 rounded ${cls}`, style, 'aria-hidden': 'true' });
    return h('div', { class: 'flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-2' },
      h('span', { class: 'flex items-center gap-1.5' }, sw(BAR_CLASS.reserved), t('mg.tape.k.reserved')),
      h('span', { class: 'flex items-center gap-1.5' }, sw(BAR_CLASS.inhouse), t('mg.tape.k.inhouse')),
      h('span', { class: 'flex items-center gap-1.5' }, sw(BAR_CLASS.held, HELD_BG), t('mg.tape.k.held')),
      h('span', { class: 'flex items-center gap-1.5' }, sw(BAR_CLASS.out), t('mg.tape.k.out')),
      h('span', { class: 'flex items-center gap-1.5' }, sw('border border-ink-muted/40', BLOCK_BG), t('mg.tape.k.blocked')),
      h('span', { class: 'text-ink-muted' }, t(isOwner() ? 'mg.tape.helpOwner' : 'mg.tape.help')));
  }

  function draw() {
    const d = st.data;
    const N = st.span;
    const units = d.units;
    const days = Array.from({ length: N }, (_, i) => addDays(st.from, i));
    const todayIdx = diffDays(st.from, d.today);
    const colMin = N <= 7 ? 6 : N <= 14 ? 4.25 : 2.75; // rem
    const labelW = window.matchMedia('(min-width: 640px)').matches ? 11 : 5.5;
    const cols = `${labelW}rem repeat(${N}, minmax(${colMin}rem, 1fr))`;

    // Which room-nights are taken (for the click/drag selection).
    const taken = new Set();
    for (const b of d.bookings) {
      if (b.stay_status === 'checked_out') continue;
      for (let i = 0; i < N; i += 1) if (days[i] >= b.check_in && days[i] < b.check_out) b.unit_ids.forEach((u) => taken.add(`${u}|${i}`));
    }
    for (const k of d.blocks) {
      for (let i = 0; i < N; i += 1) {
        if (days[i] >= k.start_date && days[i] <= k.end_date) (k.target === 'ALL' ? units.map((u) => u.id) : [k.target]).forEach((u) => taken.add(`${u}|${i}`));
      }
    }
    const freeCell = (unit, i) => !taken.has(`${unit}|${i}`) && days[i] >= d.today;

    // ── header ─────────────────────────────────────────────────────────────
    const header = [h('div', { class: 'sticky left-0 z-30 bg-paper-card', style: 'grid-row: 1; grid-column: 1' })];
    days.forEach((day, i) => {
      const free = d.free[i]?.free ?? 0;
      header.push(h('div', { style: `grid-row: 1; grid-column: ${i + 2}`, class: `border-b border-clay/70 px-1 pb-2 pt-1 text-center ${i === todayIdx ? 'rounded-t-lg bg-terra-100' : ''}` },
        h('p', { class: `text-[10px] font-semibold uppercase tracking-wider ${i === todayIdx ? 'text-terra' : 'text-ink-muted'}` }, fmtDate(day, { weekday: 'short' })),
        h('p', { class: `tabular text-sm font-semibold ${i === todayIdx ? 'text-terra' : ''}` }, fmtDate(day, { day: 'numeric', month: 'numeric' })),
        h('p', { class: `mt-0.5 text-[10px] font-semibold ${free === 0 ? 'text-oxblood' : free === units.length ? 'text-palm' : 'text-sun-600'}` },
          free === 0 ? t('mg.tape.full') : t('mg.tape.free', { n: free }))));
    });

    // ── room rows: label + selectable day cells ────────────────────────────
    const rows = [];
    const cellEls = new Map();
    units.forEach((u, r) => {
      rows.push(h('div', { class: 'sticky left-0 z-20 flex flex-col justify-center border-b border-clay/60 bg-paper-card pr-2', style: `grid-row: ${r + 2}; grid-column: 1; height: ${ROW}px` },
        h('p', { class: 'font-display text-lg font-semibold leading-none' }, u.code),
        h('p', { class: 'hidden truncate text-xs text-ink-muted sm:block' }, t(`unit.kind.${u.kind}`))));
      days.forEach((day, i) => {
        const free = freeCell(u.id, i);
        const cell = h('button', {
          type: 'button',
          class: `ring-inset ring-terra border-b border-l border-clay/50 ${i === todayIdx ? 'bg-terra-100/50' : day < d.today ? 'bg-paper-2/60' : ''} ${free ? 'cursor-pointer hover:bg-sun-100' : 'cursor-default'}`,
          // Explicit column: the bar layer below covers the same grid area.
          style: `grid-row: ${r + 2}; grid-column: ${i + 2}; height: ${ROW}px`,
          tabindex: free ? '0' : '-1',
          'aria-label': `${u.code} · ${fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })} · ${free ? t('state.free') : t('mg.tape.taken')}`,
          onpointerdown: (e) => { if (e.pointerType === 'mouse' && free) { st.drag = { unit: u.id, a: i, b: i }; paintSel(); } },
          onpointerenter: () => { if (st.drag && st.drag.unit === u.id && free) { st.drag.b = i; paintSel(); } },
          onpointerup: (e) => {
            if (e.pointerType !== 'mouse' || !st.drag) return;
            const sel = st.drag;
            st.drag = null;
            if (sel.a !== sel.b) { st.suppressClick = true; st.anchor = null; choose(sel.unit, sel.a, sel.b); }
            paintSel();
          },
          onclick: () => {
            if (st.suppressClick) { st.suppressClick = false; return; }
            if (!free) return;
            // Click once to start, click another day on the same row to finish (works on phones too).
            if (st.anchor && st.anchor.unit === u.id) {
              const a = st.anchor.idx;
              st.anchor = null;
              paintSel();
              choose(u.id, a, i);
              return;
            }
            st.anchor = { unit: u.id, idx: i };
            paintSel();
            flash(t('mg.tape.pickEnd'));
          },
        });
        cellEls.set(`${u.id}|${i}`, cell);
        rows.push(cell);
      });
    });
    function paintSel() {
      const sel = st.drag ? { unit: st.drag.unit, lo: Math.min(st.drag.a, st.drag.b), hi: Math.max(st.drag.a, st.drag.b) }
        : st.anchor ? { unit: st.anchor.unit, lo: st.anchor.idx, hi: st.anchor.idx } : null;
      cellEls.forEach((el, key) => {
        const [unit, i] = key.split('|');
        const on = Boolean(sel && unit === sel.unit && Number(i) >= sel.lo && Number(i) <= sel.hi);
        el.classList.toggle('!bg-terra-100', on);
        el.classList.toggle('ring-2', on);
      });
    }

    // ── bars, absolutely placed over the day columns ───────────────────────
    const pos = (startDate, endDate) => {
      // Half-day model: start mid check-in day, end mid check-out day.
      const s = diffDays(st.from, startDate) + 0.5;
      const e = diffDays(st.from, endDate) + 0.5;
      const left = Math.max(0, s);
      const right = Math.min(N, e);
      return { left: (left / N) * 100, width: Math.max(0, ((right - left) / N) * 100), clipL: s < 0, clipR: e > N };
    };
    const rowOf = (unitId) => units.findIndex((u) => u.id === unitId);
    const bars = [];
    for (const b of d.bookings) {
      const p = pos(b.check_in, b.check_out);
      if (p.width <= 0) continue;
      const kind = barKind(b);
      const nights = diffDays(b.check_in, b.check_out);
      const rowsIdx = b.unit_ids.map(rowOf).filter((x) => x >= 0).sort((x, y) => x - y);
      // Whole villa = one tall bar over every room; room bookings = one bar per room.
      const groups = b.type === 'villa' ? [[rowsIdx[0], rowsIdx[rowsIdx.length - 1]]] : rowsIdx.map((x) => [x, x]);
      for (const [r0, r1] of groups) {
        const label = `${b.name}${b.type === 'villa' ? ` · ${t('ad.villa')}` : ''}`;
        bars.push(h('button', {
          type: 'button',
          class: `btn pointer-events-auto absolute flex flex-col justify-center overflow-hidden px-2 text-left text-xs shadow-sm hover:z-20 hover:shadow-md ${BAR_CLASS[kind]} ${p.clipL ? 'rounded-l-none border-l-0' : 'rounded-l-lg'} ${p.clipR ? 'rounded-r-none border-r-0' : 'rounded-r-lg'}`,
          style: `left: calc(${p.left}% + 2px); width: calc(${p.width}% - 4px); top: ${r0 * ROW + 7}px; height: ${(r1 - r0 + 1) * ROW - 14}px; ${kind === 'held' ? HELD_BG : ''}`,
          title: `${label} · ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)} · ${t(`mg.tape.k.${kind}`)}${b.balance > 0 && can('frontdesk') ? ` · ${t('mg.stay.balance')} ${vnd(b.balance)}` : ''}`,
          'aria-label': `${label}, ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}, ${t(`mg.tape.k.${kind}`)}`,
          onclick: () => (can('frontdesk') ? openStay(b.ref, load) : null),
        },
        h('span', { class: 'truncate font-semibold' }, label),
        h('span', { class: 'flex items-center gap-1.5 truncate opacity-85' },
          t('sum.nights', { n: nights }),
          b.balance > 0 && kind !== 'out' && can('frontdesk')
            ? h('span', { class: `rounded px-1 font-semibold ${kind === 'inhouse' ? 'bg-paper/25' : 'bg-terra-100 text-terra-700'}` }, `${t('mg.tape.owes')} ${short(b.balance)}`) : null)));
      }
    }
    for (const k of d.blocks) {
      const p = pos(k.start_date, addDays(k.end_date, 1));
      if (p.width <= 0) continue;
      const [r0, r1] = k.target === 'ALL' ? [0, units.length - 1] : [rowOf(k.target), rowOf(k.target)];
      bars.push(h('button', {
        type: 'button',
        class: 'btn pointer-events-auto absolute flex items-center overflow-hidden rounded-lg border border-ink-muted/40 bg-paper px-2 text-left text-xs font-semibold text-ink-2',
        style: `left: calc(${p.left}% + 2px); width: calc(${p.width}% - 4px); top: ${r0 * ROW + 7}px; height: ${(r1 - r0 + 1) * ROW - 14}px; ${BLOCK_BG}`,
        title: `${t('state.blocked')}${k.reason ? `: ${k.reason}` : ''}${isOwner() ? ` · ${t('mg.tape.clickReopen')}` : ''}`,
        onclick: () => isOwner() && reopen(k),
      }, h('span', { class: 'truncate rounded bg-paper/90 px-1' }, `${t('state.blocked')}${k.reason ? ` · ${k.reason}` : ''}`)));
    }
    const todayLine = todayIdx >= 0 && todayIdx < N
      ? h('div', { class: 'pointer-events-none absolute bottom-0 top-0 w-0.5 bg-terra/70', style: `left: ${((todayIdx + 0.5) / N) * 100}%`, 'aria-hidden': 'true' }) : null;
    const overlay = h('div', {
      class: 'pointer-events-none relative',
      style: `grid-column: 2 / span ${N}; grid-row: 2 / span ${units.length}; height: ${units.length * ROW}px`,
    }, todayLine, ...bars);

    fill(root,
      h('section', { class: 'min-w-0 rounded-2xl border border-clay/70 bg-paper-card p-4 elevated sm:p-5' },
        toolbar(), h('div', { class: 'mt-3' }, legend()),
        h('div', { class: 'mt-4 overflow-x-auto', onpointerleave: () => { if (st.drag) { st.drag = null; paintSel(); } } },
          h('div', { class: 'grid select-none', style: `grid-template-columns: ${cols}` }, ...header, ...rows, overlay))));
    paintSel();
  }

  // ── after picking empty days: book, book whole villa, or close ─────────
  function choose(unitId, a, b) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const unit = st.data.units.find((u) => u.id === unitId);
    const nights = hi - lo + 1;
    const checkIn = addDays(st.from, lo);
    const checkOut = addDays(st.from, hi + 1);
    const cellsFree = Array.from({ length: nights }, (_, i) => lo + i).every((i) => {
      const day = addDays(st.from, i);
      return !st.data.bookings.some((x) => x.stay_status !== 'checked_out' && x.unit_ids.includes(unitId) && x.check_in <= day && x.check_out > day)
        && !st.data.blocks.some((k) => (k.target === 'ALL' || k.target === unitId) && k.start_date <= day && k.end_date >= day);
    });
    if (!cellsFree) return flash(t('err.unavailable'), 'err');
    const villaFree = st.data.free.slice(lo, hi + 1).every((f) => f.free === st.data.units.length);
    // The panel's content is built while drawer() runs, so actions look it up lazily.
    let dlg = null;
    dlg = drawer(`${unit.code} · ${fmtDate(checkIn)} → ${fmtDate(checkOut)}`, () => h('div', { class: 'grid gap-3' },
      h('p', { class: 'text-sm text-ink-muted' }, t('mg.tape.chosen', { n: nights, room: unitName(unit) })),
      can('bookings') ? btn(t('mg.tape.bookRoom', { room: unit.code }), () => { dlg.close(); openNewBooking({ type: 'room', units: [unitId], checkIn, checkOut }, load); }, 'primary') : null,
      can('bookings') && villaFree ? btn(t('mg.tape.bookVilla'), () => { dlg.close(); openNewBooking({ type: 'villa', checkIn, checkOut }, load); }) : null,
      isOwner() ? closeForm(unitId, checkIn, addDays(checkOut, -1), () => dlg) : null));
  }

  function closeForm(unitId, start, end, getDlg) {
    const reason = input({ maxlength: 120, placeholder: t('mg.tape.reasonPh') });
    const whole = h('input', { type: 'checkbox', class: 'h-4 w-4 accent-[#A3401E] focus-ring' });
    return h('div', { class: 'mt-3 grid gap-3 border-t border-clay/70 pt-4' },
      h('p', { class: 'text-sm font-semibold' }, t('mg.tape.closeTitle')),
      lbl('ad.block.reason', reason),
      h('label', { class: 'flex items-center gap-2 text-sm' }, whole, t('mg.tape.closeAll')),
      h('div', {}, btn(t('ad.block.add'), async () => {
        try {
          await api('/api/admin/blocks', { method: 'POST', body: { target: whole.checked ? 'ALL' : unitId, start_date: start, end_date: end, reason: reason.value } });
          flash(t('mg.saved'));
          getDlg().close();
          load();
        } catch (err) { flash(errText(err), 'err'); }
      }, 'dark')));
  }

  async function reopen(k) {
    if (!window.confirm(t('mg.tape.reopenConfirm', { from: fmtDate(k.start_date), to: fmtDate(k.end_date) }))) return;
    try { await api(`/api/admin/blocks/${k.id}`, { method: 'DELETE' }); flash(t('mg.saved')); load(); } catch (err) { fail(err); }
  }

  load();
}
