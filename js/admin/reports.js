// Báo cáo: revenue, money collected, occupancy, ADR, payment methods, rooms, top items. CSV export.
import { t } from '../i18n.js';
import { api, fmtDate, todayIso, addDays } from '../api.js';
import { S, btn, card, lbl, input, fail, empty, h, fill, vnd, num } from './ui.js';
import { barChart, rankBars } from './chart.js';
import { short } from './dashboard.js';

const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const nextMonth = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};
const prevMonth = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
};
const PRESETS = {
  d7: () => [addDays(todayIso(), -6), addDays(todayIso(), 1)],
  d30: () => [addDays(todayIso(), -29), addDays(todayIso(), 1)],
  month: () => [monthStart(todayIso()), nextMonth(monthStart(todayIso()))],
  last: () => [prevMonth(monthStart(todayIso())), monthStart(todayIso())],
};
let range = PRESETS.month();
let preset = 'month';

export async function renderReports(main) {
  const from = input({ type: 'date', value: range[0], class: 'field field-sm' });
  const to = input({ type: 'date', value: addDays(range[1], -1), class: 'field field-sm' });
  const apply = () => {
    if (!from.value || !to.value || to.value < from.value) return;
    range = [from.value, addDays(to.value, 1)];
    preset = '';
    renderReports(main);
  };
  from.addEventListener('change', apply);
  to.addEventListener('change', apply);
  const body = h('div', { class: 'grid gap-5' }, h('p', { class: 'py-10 text-center text-ink-muted' }, '…'));
  fill(main, h('div', { class: 'grid gap-5' },
    card(h('div', { class: 'flex flex-wrap items-end gap-3' },
      h('div', { class: 'seg' }, ...Object.keys(PRESETS).map((k) => h('button', { type: 'button', 'aria-pressed': String(preset === k), onclick: () => { preset = k; range = PRESETS[k](); renderReports(main); } }, t(`mg.rep.p.${k}`)))),
      lbl('mg.rep.from', from), lbl('mg.rep.to', to),
      h('a', { href: `/api/admin/reports?from=${range[0]}&to=${range[1]}&format=csv`, class: 'btn ml-auto inline-flex min-h-[2.5rem] items-center rounded-full border border-clay bg-paper-card px-4 text-sm font-semibold hover:border-clay-2 hover:bg-paper', download: '' }, t('mg.rep.csv')))),
    body));

  let r;
  try { r = await api(`/api/admin/reports?from=${range[0]}&to=${range[1]}`); } catch (err) { return fail(err); }
  const T = r.totals;
  const kpi = (key, value, sub) => h('div', { class: 'rounded-2xl border border-clay/70 bg-paper-card p-4 elevated' },
    h('p', { class: 'text-xs font-semibold uppercase tracking-wider text-ink-muted' }, t(key)),
    h('p', { class: 'mt-1 font-display text-2xl font-semibold tabular' }, value),
    sub ? h('p', { class: 'mt-1 text-xs text-ink-muted' }, sub) : null);
  const many = r.days.length > 20;
  const methodName = (m) => (t(`ad.method.${m}`) !== `ad.method.${m}` ? t(`ad.method.${m}`) : t(`pay.${m}`) !== `pay.${m}` ? t(`pay.${m}`) : m);

  fill(body,
    h('div', { class: 'grid grid-cols-2 gap-3 md:grid-cols-4' },
      kpi('mg.rep.revenue', vnd(T.revenue), t('mg.rep.revenueSub', { room: vnd(T.room_revenue), extras: vnd(T.extras) })),
      kpi('mg.rep.collected', vnd(T.collected), t('mg.rep.collectedSub')),
      kpi('mg.rep.occupancy', `${Math.round(T.occupancy * 100)}%`, t('mg.rep.roomNights', { n: T.room_nights })),
      kpi('mg.rep.adr', vnd(T.adr), t('mg.rep.adrSub')),
      kpi('mg.rep.bookings', num(T.bookings), t('mg.rep.online', { n: T.online })),
      kpi('mg.rep.cancelled', num(T.cancelled))),
    card(h('h2', { class: 'mb-3 font-display text-xl font-semibold' }, t('mg.rep.dailyRevenue')),
      barChart(r.days.map((d) => ({ label: fmtDate(d.date), short: fmtDate(d.date, { day: 'numeric' }), value: d.room_revenue + d.extras, tip: `${fmtDate(d.date)}: ${vnd(d.room_revenue + d.extras)}` })), { format: short, markEvery: many ? 5 : 1, title: t('mg.rep.dailyRevenue'), yTitle: t('mg.axis.money'), xTitle: t('mg.axis.days', { span: `${fmtDate(r.from, { day: 'numeric', month: 'numeric' })} – ${fmtDate(r.days.at(-1).date, { day: 'numeric', month: 'numeric' })}` }) })),
    card(h('h2', { class: 'mb-3 font-display text-xl font-semibold' }, t('mg.rep.dailyOcc')),
      barChart(r.days.map((d) => ({ label: fmtDate(d.date), short: fmtDate(d.date, { day: 'numeric' }), value: d.occupied, tip: `${fmtDate(d.date)}: ${d.occupied}/${r.rooms} ${t('mg.dash.roomsWord')}` })), { format: (v) => num(Math.round(v)), max: r.rooms, height: 140, markEvery: many ? 5 : 1, title: t('mg.rep.dailyOcc'), metric: 'occupancy', yTitle: t('mg.axis.rooms', { n: r.rooms }), xTitle: t('mg.axis.nights', { span: `${fmtDate(r.from, { day: 'numeric', month: 'numeric' })} – ${fmtDate(r.days.at(-1).date, { day: 'numeric', month: 'numeric' })}` }) })),
    h('div', { class: 'grid gap-5 lg:grid-cols-3' },
      card(h('h2', { class: 'mb-3 font-display text-lg font-semibold' }, t('mg.rep.byMethod')),
        r.by_method.length ? rankBars(r.by_method.map((m) => ({ label: `${methodName(m.method)} · ${m.n}`, value: m.amount })), { format: vnd }) : empty('mg.dash.nothing')),
      card(h('h2', { class: 'mb-3 font-display text-lg font-semibold' }, t('mg.rep.byRoom')),
        rankBars(r.by_room.map((x) => ({ label: x.code, value: x.nights })), { format: (v) => t('sum.nights', { n: v }), metric: 'occupancy' })),
      card(h('h2', { class: 'mb-3 font-display text-lg font-semibold' }, t('mg.rep.topItems')),
        r.top_items.length ? rankBars(r.top_items.map((x) => ({ label: `${x.name} × ${x.qty}`, value: x.amount })), { format: vnd, metric: 'items' }) : empty('mg.dash.nothing'))),
    card(h('h2', { class: 'mb-3 font-display text-lg font-semibold' }, t('mg.rep.table')),
      h('div', { class: 'overflow-x-auto' }, h('table', { class: 'tbl w-full min-w-[640px] text-sm' },
        h('thead', {}, h('tr', {}, ...['mg.rep.date', 'mg.rep.roomRevenue', 'mg.rep.extras', 'mg.rep.collected', 'mg.rep.occupancy'].map((k) => h('th', { scope: 'col' }, t(k))))),
        h('tbody', {}, ...r.days.map((d) => h('tr', {},
          h('td', { class: 'whitespace-nowrap' }, fmtDate(d.date)), h('td', { class: 'tabular' }, vnd(d.room_revenue)), h('td', { class: 'tabular' }, vnd(d.extras)),
          h('td', { class: 'tabular' }, vnd(d.collected)), h('td', { class: 'tabular' }, `${d.occupied}/${r.rooms}`))))))));
}
