// Khách hàng: guest profiles, groups, stay & payment history.
import { t } from '../i18n.js';
import { api, fmtDate } from '../api.js';
import { S, btn, card, lbl, input, select, chip, flash, fail, errText, drawer, empty, h, fill, vnd } from './ui.js';
import { openStay } from './board.js';

const SEGMENTS = ['individual', 'group', 'regular', 'vip'];
const SEG_TONE = { individual: 'muted', group: 'info', regular: 'good', vip: 'warn' };
const F = { q: '', segment: '' };

export function renderGuests(main) {
  const q = input({ type: 'search', value: F.q, placeholder: t('mg.g.search'), class: 'field field-sm w-full sm:w-80', 'aria-label': t('mg.g.search') });
  const seg = select([['', t('mg.g.allGroups')], ...SEGMENTS.map((s) => [s, t(`mg.seg.${s}`)])], F.segment, { 'aria-label': t('mg.g.group'), class: 'field field-sm w-auto' });
  const body = h('div', { class: 'mt-4 overflow-x-auto' });
  let timer;
  q.addEventListener('input', () => { F.q = q.value; clearTimeout(timer); timer = setTimeout(load, 200); });
  seg.addEventListener('change', () => { F.segment = seg.value; load(); });

  fill(main, card(
    h('div', { class: 'flex flex-wrap items-center gap-3' }, q, seg,
      h('div', { class: 'ml-auto' }, btn(t('mg.g.new'), () => openGuest(null, load), 'primary'))),
    body));

  async function load() {
    let rows;
    try { rows = await api(`/api/admin/guests?${new URLSearchParams({ q: F.q, segment: F.segment })}`); } catch (err) { return fail(err); }
    if (!rows.length) return fill(body, empty('mg.g.none'));
    fill(body, h('table', { class: 'tbl w-full min-w-[820px] text-sm' },
      h('thead', {}, h('tr', {}, ...['mg.g.name', 'book.phone', 'mg.g.idNumber', 'mg.g.group', 'mg.g.visits', 'mg.g.spent', 'mg.g.lastStay'].map((k) => h('th', { scope: 'col' }, t(k))))),
      h('tbody', {}, ...rows.map((g) => h('tr', { class: 'cursor-pointer', onclick: () => openGuest(g.id, load) },
        h('td', {}, h('button', { type: 'button', class: 'btn text-left font-semibold underline-offset-2 hover:underline', onclick: (e) => { e.stopPropagation(); openGuest(g.id, load); } }, g.name),
          g.visits >= 2 ? h('span', { class: 'ml-2' }, chip(t('mg.g.returning'), 'good')) : null),
        h('td', { class: 'tabular' }, g.phone || '—'),
        h('td', { class: 'tabular' }, g.id_number || '—'),
        h('td', {}, chip(t(`mg.seg.${g.segment}`), SEG_TONE[g.segment])),
        h('td', { class: 'tabular' }, g.visits),
        h('td', { class: 'tabular' }, vnd(g.spent)),
        h('td', { class: 'whitespace-nowrap' }, g.last_stay ? fmtDate(g.last_stay) : '—'))))));
  }
  load();
}

export function openGuest(id, onChange = () => {}) {
  let g = null;
  const d = drawer(id ? '…' : t('mg.g.new'), () => form(), { wide: true, onClose: onChange });
  async function load() {
    try { g = await api(`/api/admin/guests/${id}`); d.setTitle(g.name); d.refresh(); } catch (err) { fail(err); d.close(); }
  }
  function form() {
    if (id && !g) return h('p', { class: 'text-ink-muted' }, '…');
    const v = g ?? {};
    const f = {
      name: input({ value: v.name ?? '', maxlength: 80 }), phone: input({ value: v.phone ?? '', type: 'tel' }), email: input({ value: v.email ?? '', type: 'email' }),
      id_number: input({ value: v.id_number ?? '', inputmode: 'numeric' }), dob: input({ type: 'date', value: v.dob ?? '' }),
      gender: select([['', '—'], ['male', t('mg.g.male')], ['female', t('mg.g.female')], ['other', t('mg.g.other')]], v.gender ?? ''),
      nationality: input({ value: v.nationality ?? 'VN' }), address: input({ value: v.address ?? '' }),
      segment: select(SEGMENTS.map((s) => [s, t(`mg.seg.${s}`)]), v.segment ?? 'individual'),
      note: h('textarea', { class: 'field field-sm min-h-[5rem]', maxlength: 1000 }, v.note ?? ''),
    };
    const save = async () => {
      const body = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]));
      try {
        g = id ? await api(`/api/admin/guests/${id}`, { method: 'PUT', body }) : await api('/api/admin/guests', { method: 'POST', body });
        flash(t('mg.saved'));
        if (!id) { id = g.id; }
        await load();
      } catch (err) { flash(errText(err), 'err'); }
    };
    return h('div', { class: 'grid gap-5' },
      g ? h('div', { class: 'grid grid-cols-3 gap-3' },
        ...[['mg.g.visits', g.visits], ['mg.g.spent', vnd(g.spent)], ['mg.g.lastStay', g.last_stay ? fmtDate(g.last_stay) : '—']].map(([k, val]) => h('div', { class: 'rounded-xl border border-clay/70 bg-paper-card p-3' },
          h('p', { class: 'text-xs font-semibold uppercase tracking-wider text-ink-muted' }, t(k)), h('p', { class: 'mt-1 font-display text-xl font-semibold tabular' }, val)))) : null,
      card(h('div', { class: 'grid gap-3 sm:grid-cols-2' },
        lbl('mg.g.name', f.name), lbl('book.phone', f.phone), lbl('book.email', f.email), lbl('mg.g.idNumber', f.id_number),
        lbl('mg.g.dob', f.dob), lbl('mg.g.gender', f.gender), lbl('mg.g.nationality', f.nationality), lbl('mg.g.group', f.segment),
        lbl('mg.g.address', f.address, 'sm:col-span-2'), lbl('mg.g.note', f.note, 'sm:col-span-2')),
      h('div', { class: 'mt-4' }, btn(t('ad.save'), save, 'primary'))),
      g ? card(h('h3', { class: 'mb-2 font-display text-lg font-semibold' }, t('mg.g.history')),
        g.bookings.length ? h('ul', { class: 'divide-y divide-clay/60' }, ...g.bookings.map((b) => h('li', { class: 'flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm' },
          h('div', {}, h('p', { class: 'font-semibold tabular' }, b.ref),
            h('p', { class: 'text-ink-muted' }, `${fmtDate(b.check_in)} → ${fmtDate(b.check_out)} · ${b.type === 'villa' ? t('ad.villa') : b.unit_ids.map((u) => S.config.units.find((x) => x.id === u)?.code ?? u).join(', ')}`)),
          h('div', { class: 'flex items-center gap-2' }, h('span', { class: 'tabular' }, vnd(b.total + b.extras_total - b.bill_discount)), chip(t(`st.${b.status}`), b.status === 'paid' ? 'good' : 'muted'),
            btn(t('mg.stay.open'), () => openStay(b.ref, load))))))
          : empty('mg.g.noHistory')) : null,
      g?.payments.length ? card(h('h3', { class: 'mb-2 font-display text-lg font-semibold' }, t('mg.g.payments')),
        h('ul', { class: 'divide-y divide-clay/60 text-sm' }, ...g.payments.map((p) => h('li', { class: 'flex justify-between gap-3 py-2' },
          h('span', {}, `${fmtDate(p.created_at.slice(0, 10))} · ${p.ref} · ${t(`ad.method.${p.provider}`) !== `ad.method.${p.provider}` ? t(`ad.method.${p.provider}`) : t(`pay.${p.provider}`)}`),
          h('span', { class: 'tabular font-semibold' }, vnd(p.amount)))))) : null);
  }
  if (id) load();
  return d;
}
