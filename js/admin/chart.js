// Single-series bar chart in plain HTML: one hue, thin bars with rounded tops
// anchored to the baseline, a 2px gap, recessive grid, hover/focus tooltip and
// a hidden table so screen readers get the numbers too.
import { h } from './ui.js';

// One colour per kind of measure, the same on every chart (validated for contrast and colour-blind safety):
//   money → terracotta, occupancy (rooms, nights) → green, items sold → gold.
export const METRIC = { money: '#A3401E', occupancy: '#00806A', items: '#B98318' };

/** Round numbers for the y-axis: 0 … niceMax in 3–5 even steps. */
function niceTicks(maxValue, fixedMax) {
  if (fixedMax && Number.isInteger(fixedMax) && fixedMax <= 6) return Array.from({ length: fixedMax + 1 }, (_, i) => i);
  const raw = Math.max(1, maxValue) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw);
  const top = Math.ceil(Math.max(1, maxValue) / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/**
 * points: [{ label, short, value, tip }]
 * opts: { format(v) → tick/tooltip text, yTitle, xTitle, height, max, markEvery, metric }
 * The y-axis is on the left with round numbers from 0; yTitle names the measure and unit,
 * xTitle names what each bar is (e.g. one bar per day).
 */
export function barChart(points, { format = String, height = 180, max, markEvery = 1, title = '', metric = 'money', yTitle = '', xTitle = '' } = {}) {
  const ticks = niceTicks(Math.max(0, ...points.map((p) => p.value)), max);
  const top = ticks[ticks.length - 1] || 1;
  const tip = h('div', { class: 'pointer-events-none absolute z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-paper shadow-lg', role: 'status' });
  const show = (el, p) => {
    tip.textContent = p.tip ?? `${p.label}: ${format(p.value)}`;
    tip.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    const box = plot.getBoundingClientRect();
    tip.style.left = `${r.left - box.left + r.width / 2}px`;
    tip.style.top = `${Math.max(0, r.top - box.top - 34)}px`;
  };
  const hide = () => tip.classList.add('hidden');

  const bars = points.map((p, i) => {
    const pct = Math.max(0, Math.min(100, (p.value / top) * 100));
    const col = h('button', {
      type: 'button',
      class: 'group relative flex h-full min-w-0 flex-1 cursor-default items-end focus-visible:outline-none',
      'aria-label': p.tip ?? `${p.label}: ${format(p.value)}`,
      onmouseenter: (e) => show(e.currentTarget, p), onfocus: (e) => show(e.currentTarget, p), onmouseleave: hide, onblur: hide,
    }, h('span', {
      class: 'block w-full rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ink',
      style: `height: ${pct}%; min-height: ${p.value > 0 ? 2 : 0}px; background: ${METRIC[metric]}`,
    }));
    return { col, label: i % markEvery === 0 ? p.short ?? p.label : '' };
  });

  // Gridlines with their value on the left (the y-axis); the 0 line is the baseline.
  const grid = ticks.map((v) => h('div', { class: `absolute inset-x-0 border-t ${v === 0 ? 'border-ink/30' : 'border-dashed border-clay/80'}`, style: `bottom: ${(v / top) * 100}%` },
    h('span', { class: 'absolute right-full top-0 mr-2 -translate-y-1/2 whitespace-nowrap text-[10px] tabular text-ink-muted' }, format(v))));
  const plot = h('div', { class: 'relative', style: `height: ${height}px` },
    ...grid,
    h('div', { class: 'relative flex h-full items-end gap-[2px]' }, ...bars.map((b) => b.col)),
    tip);
  return h('figure', { class: 'w-full' },
    title ? h('figcaption', { class: 'sr-only' }, title) : null,
    yTitle ? h('p', { class: 'mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted' }, `↑ ${yTitle}`) : null,
    h('div', { class: 'pl-12' },
      plot,
      h('div', { class: 'mt-1.5 flex gap-[2px] text-[10px] text-ink-muted', 'aria-hidden': 'true' },
        ...bars.map((b) => h('span', { class: 'min-w-0 flex-1 truncate text-center' }, b.label))),
      xTitle ? h('p', { class: 'mt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-muted' }, `${xTitle} →`) : null),
    h('table', { class: 'sr-only' },
      yTitle || xTitle ? h('thead', {}, h('tr', {}, h('th', {}, xTitle), h('th', {}, yTitle))) : null,
      h('tbody', {}, ...points.map((p) => h('tr', {}, h('th', {}, p.label), h('td', {}, format(p.value)))))));
}

/** Horizontal bars for a short ranked list (payment methods, rooms, items). */
export function rankBars(rows, { format = String, metric = 'money' } = {}) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return h('ul', { class: 'grid gap-2.5' }, ...rows.map((r) => h('li', {},
    h('div', { class: 'flex items-baseline justify-between gap-3 text-sm' }, h('span', { class: 'truncate' }, r.label), h('span', { class: 'tabular font-semibold' }, format(r.value))),
    h('div', { class: 'mt-1 h-2 rounded-full bg-paper-2' }, h('div', { class: 'h-full rounded-full', style: `width: ${(r.value / top) * 100}%; background: ${METRIC[metric]}` })))));
}
