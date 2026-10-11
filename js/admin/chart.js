// Single-series bar chart in plain HTML: one hue, thin bars with rounded tops
// anchored to the baseline, a 2px gap, recessive grid, hover/focus tooltip and
// a hidden table so screen readers get the numbers too.
import { h } from './ui.js';

// One colour per kind of measure, the same on every chart (validated for contrast and colour-blind safety):
//   money → terracotta, occupancy (rooms, nights) → green, items sold → gold.
export const METRIC = { money: '#A3401E', occupancy: '#00806A', items: '#B98318' };

/**
 * points: [{ label, short, value, tip }]
 * opts: { format(v) → string, height, max, markEvery }
 */
export function barChart(points, { format = String, height = 180, max, markEvery = 1, title = '', metric = 'money' } = {}) {
  const top = max ?? Math.max(1, ...points.map((p) => p.value));
  const tip = h('div', { class: 'pointer-events-none absolute z-10 hidden -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-paper shadow-lg', role: 'status' });
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
    const pct = top ? Math.max(0, Math.min(100, (p.value / top) * 100)) : 0;
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

  const grid = [1, 0.5].map((f) => h('div', { class: 'absolute inset-x-0 border-t border-dashed border-clay/80', style: `bottom: ${f * 100}%` },
    h('span', { class: 'absolute -top-2.5 right-0 bg-paper-card pl-1 text-[10px] tabular text-ink-muted' }, format(top * f))));
  const plot = h('div', { class: 'relative', style: `height: ${height}px` },
    ...grid,
    h('div', { class: 'absolute inset-x-0 bottom-0 border-t border-ink/30' }),
    h('div', { class: 'relative flex h-full items-end gap-[2px] pr-14', 'aria-hidden': 'false' }, ...bars.map((b) => b.col)),
    tip);
  return h('figure', { class: 'w-full' },
    title ? h('figcaption', { class: 'sr-only' }, title) : null,
    plot,
    h('div', { class: 'mt-1.5 flex gap-[2px] pr-14 text-[10px] text-ink-muted', 'aria-hidden': 'true' },
      ...bars.map((b) => h('span', { class: 'min-w-0 flex-1 truncate text-center' }, b.label))),
    h('table', { class: 'sr-only' }, h('tbody', {}, ...points.map((p) => h('tr', {}, h('th', {}, p.label), h('td', {}, format(p.value)))))));
}

/** Horizontal bars for a short ranked list (payment methods, rooms, items). */
export function rankBars(rows, { format = String, metric = 'money' } = {}) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return h('ul', { class: 'grid gap-2.5' }, ...rows.map((r) => h('li', {},
    h('div', { class: 'flex items-baseline justify-between gap-3 text-sm' }, h('span', { class: 'truncate' }, r.label), h('span', { class: 'tabular font-semibold' }, format(r.value))),
    h('div', { class: 'mt-1 h-2 rounded-full bg-paper-2' }, h('div', { class: 'h-full rounded-full', style: `width: ${(r.value / top) * 100}%; background: ${METRIC[metric]}` })))));
}
