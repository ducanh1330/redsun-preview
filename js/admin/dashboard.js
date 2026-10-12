// Tổng quan: what needs doing today, at a glance. Money only for the owner.
import { t } from '../i18n.js';
import { api, fmtDate } from '../api.js';
import { S, can, btn, card, chip, fail, empty, h, fill, vnd, num } from './ui.js';
import { barChart } from './chart.js';
import { openStay } from './board.js';
import { openIssuesList } from './conditions.js';

const codes = (ids) => ids.map((id) => S.config.units.find((u) => u.id === id)?.code ?? id).join(', ');
// Axis/tooltip money: 1.5tr (triệu = million ₫), 500k (nghìn); 0 stays 0.
export const short = (v) => (v === 0 ? '0' : v >= 1e6 ? `${num(Number((v / 1e6).toFixed(1)))}tr` : `${num(Math.round(v / 1000))}k`);
const span = (from, to) => `${fmtDate(from, { day: 'numeric', month: 'numeric' })} – ${fmtDate(to, { day: 'numeric', month: 'numeric' })}`;

export async function renderDashboard(main, { go }) {
  fill(main, h('p', { class: 'py-10 text-center text-ink-muted' }, '…'));
  let d;
  try { d = await api('/api/admin/dashboard'); } catch (err) { return fail(err); }
  const reload = () => renderDashboard(main, { go });
  const c = d.counts;

  const tile = (key, value, { tone = '', sub = null, onclick = null } = {}) => h(onclick ? 'button' : 'div', {
    type: onclick ? 'button' : null, onclick,
    class: `rounded-2xl border bg-paper-card p-4 text-left elevated ${tone || 'border-clay/70'} ${onclick ? 'btn hover:border-clay-2' : ''}`,
  },
  h('p', { class: 'text-xs font-semibold uppercase tracking-wider text-ink-muted' }, t(key)),
  h('p', { class: 'mt-1 font-display text-3xl font-semibold leading-none tabular' }, value),
  sub ? h('p', { class: 'mt-1.5 text-xs text-ink-muted' }, sub) : null);

  const tiles = [
    tile('mg.dash.arrivals', c.arrivals, { onclick: () => go('board') }),
    tile('mg.dash.departures', c.departures, { tone: c.overdue ? 'border-oxblood/50' : '', sub: c.overdue ? t('mg.dash.overdue', { n: c.overdue }) : null, onclick: () => go('board') }),
    tile('mg.dash.inHouse', c.in_house),
    tile('mg.dash.occupied', `${c.occupied_tonight}/${d.rooms}`, { sub: t('mg.dash.occupancyPct', { p: Math.round((c.occupied_tonight / d.rooms) * 100) }) }),
    tile('mg.dash.dirty', c.dirty, { tone: c.dirty ? 'border-sun/60' : '', onclick: () => go('board') }),
  ];
  if (d.money) {
    tiles.push(
      tile('mg.dash.today', vnd(d.money.today)),
      tile('mg.dash.month', vnd(d.money.month)),
      tile('mg.dash.outstanding', vnd(d.money.outstanding), { sub: t('mg.dash.outstandingSub') }),
    );
    if (c.pending_payment) tiles.push(tile('mg.dash.pending', c.pending_payment, { onclick: () => go('bookings') }));
  }

  const list = (rows, kind) => (rows.length ? h('ul', { class: 'divide-y divide-clay/60' }, ...rows.map((b) => h('li', { class: 'flex flex-wrap items-center justify-between gap-3 py-2.5' },
    h('div', { class: 'min-w-0' },
      h('p', { class: 'truncate font-semibold' }, b.name),
      h('p', { class: 'text-sm text-ink-muted' }, `${b.type === 'villa' ? t('ad.villa') : codes(b.units)} · ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}`)),
    h('div', { class: 'flex items-center gap-2' },
      b.balance > 0 && can('frontdesk') ? h('span', { class: 'text-sm font-semibold text-terra tabular' }, vnd(b.balance)) : null,
      kind === 'departures' && b.check_out < d.today ? chip(t('mg.state.overdue'), 'bad') : null,
      can('frontdesk') ? btn(t(kind === 'arrivals' ? 'mg.stay.checkIn' : kind === 'departures' ? 'mg.stay.checkOut' : 'mg.stay.open'), () => openStay(b.ref, reload), kind === 'upcoming' ? 'ghost' : 'primary') : null))))
    : empty('mg.dash.nothing'));

  const occ = barChart(d.occupancy_ahead.map((x) => ({
    label: fmtDate(x.date), short: fmtDate(x.date, { day: 'numeric' }), value: x.occupied,
    tip: `${fmtDate(x.date)}: ${x.occupied}/${x.rooms} ${t('mg.dash.roomsWord')}`,
  })), { format: (v) => num(Math.round(v)), max: d.rooms, height: 140, title: t('mg.dash.occAhead'), metric: 'occupancy',
    yTitle: t('mg.axis.rooms', { n: d.rooms }), xTitle: t('mg.axis.nights', { span: span(d.occupancy_ahead[0].date, d.occupancy_ahead.at(-1).date) }) });

  const money = d.money ? card(
    h('div', { class: 'mb-3 flex flex-wrap items-baseline justify-between gap-2' },
      h('h2', { class: 'font-display text-xl font-semibold' }, t('mg.dash.revenue30')),
      h('p', { class: 'text-sm text-ink-muted' },
        `${t('mg.rep.revenue')}: `, h('strong', { class: 'tabular text-ink' }, vnd(d.money.last30_totals.revenue)),
        ` · ${t('mg.rep.occupancy')}: `, h('strong', { class: 'tabular text-ink' }, `${Math.round(d.money.last30_totals.occupancy * 100)}%`))),
    barChart(d.money.last30.map((x) => ({ label: fmtDate(x.date), short: fmtDate(x.date, { day: 'numeric' }), value: x.revenue, tip: `${fmtDate(x.date)}: ${vnd(x.revenue)}` })), {
      format: short, markEvery: 5, title: t('mg.dash.revenue30'),
      yTitle: t('mg.axis.money'), xTitle: t('mg.axis.days', { span: span(d.money.last30[0].date, d.money.last30.at(-1).date) }),
    })) : null;

  const issuesSlot = h('div');
  const title = (key, right = null) => h('div', { class: 'mb-2 flex items-center justify-between gap-2' }, h('h2', { class: 'font-display text-xl font-semibold' }, t(key)), right);

  fill(main, h('div', { class: 'grid gap-5' },
    h('div', { class: 'grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5' }, ...tiles),
    money,
    h('div', { class: 'grid gap-5 lg:grid-cols-2' },
      card(title('mg.dash.arrivalsToday'), list(d.arrivals, 'arrivals')),
      card(title('mg.dash.departuresToday'), list(d.departures, 'departures'))),
    h('div', { class: 'grid gap-5 lg:grid-cols-2' },
      card(title('mg.dash.occAhead'), occ),
      card(title('mg.dash.upcoming'), list(d.upcoming, 'upcoming'))),
    h('div', { class: 'grid gap-5 lg:grid-cols-2' },
      card(title('mg.dash.lowStock', can('stock.view') ? btn(t('mg.dash.toStock'), () => go('stock')) : null),
        d.low_stock.length ? h('ul', { class: 'divide-y divide-clay/60' }, ...d.low_stock.map((i) => h('li', { class: 'flex justify-between gap-3 py-2 text-sm' },
          h('span', {}, i.name), chip(t('mg.stock.left', { n: `${i.stock} ${i.unit}`.trim() }), i.stock <= 0 ? 'bad' : 'warn'))))
          : empty('mg.dash.stockOk')),
      card(title('mg.dash.activity'), activityList(d.events))),
    issuesSlot));
  // Problems from room reports (missing / broken / dirty), resolved here by the front desk.
  if (can('roomreport')) openIssuesList(reload).then((list) => fill(issuesSlot, card(title('mg.rc.openIssues'), list)));
}

export function activityList(events, { initial = 5 } = {}) {
  if (!events?.length) return empty('mg.dash.nothing');
  const when = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
  const item = (e) => h('li', { class: 'py-2 text-sm' },
    h('p', {}, h('span', { class: 'font-semibold' }, t(`mg.ev.${e.type}`)), e.booking_ref ? h('span', { class: 'ml-2 text-xs tabular text-ink-muted' }, e.booking_ref) : null),
    h('p', { class: 'text-ink-muted' }, e.message),
    h('p', { class: 'text-xs text-ink-muted' }, `${when.format(new Date(e.created_at))}${e.staff_name ? ` · ${e.staff_name}` : ''}`));
  const list = h('ul', { class: 'divide-y divide-clay/60' }, ...events.slice(0, initial).map(item));
  if (events.length <= initial) return list;
  let open = false;
  const toggle = btn(t('mg.more', { n: events.length - initial }), () => {
    open = !open;
    fill(list, ...(open ? events : events.slice(0, initial)).map(item));
    toggle.textContent = open ? t('mg.less') : t('mg.more', { n: events.length - initial });
    toggle.setAttribute('aria-expanded', String(open));
  }, 'ghost', { 'aria-expanded': 'false', class: 'mt-2' });
  return h('div', {}, list, toggle);
}
