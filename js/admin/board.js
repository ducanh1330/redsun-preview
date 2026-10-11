// Room board (Sơ đồ phòng) and the stay drawer: check-in, services, room move,
// check-out and receipt. Housekeeping staff get the cleaning controls only.
import { t, getLang } from '../i18n.js';
import { api, fmtDate, unitName, todayIso } from '../api.js';
import { parseCccd } from '../../../shared/cccd.mjs';
import { S, can, isOwner, btn, card, lbl, input, select, chip, flash, fail, errText, drawer, h, fill, vnd, PAY_METHODS } from './ui.js';

const STATE_TONE = { free: 'good', occupied: 'info', arriving: 'warn', late_arrival: 'bad', due_out: 'warn', overdue: 'bad', held: 'muted', blocked: 'muted' };
const CLEAN_TONE = { clean: 'good', dirty: 'bad', cleaning: 'warn' };
const FILTERS = ['all', 'free', 'occupied', 'arriving', 'due_out', 'dirty'];
let filter = 'all';

const unitById = (id) => S.config.units.find((u) => u.id === id) ?? { id, code: id, kind: 'room', floor: '?' };
const unitsLabel = (ids) => ids.map((id) => unitById(id).code).join(', ');

export async function renderBoard(main) {
  const grid = h('div', { class: 'grid gap-5' }, h('p', { class: 'py-10 text-center text-ink-muted' }, '…'));
  const bar = h('div', { class: 'mb-4 flex flex-wrap items-center gap-2' });
  fill(main, h('div', {}, bar, grid));

  async function load() {
    let rooms;
    try { rooms = await api('/api/admin/board'); } catch (err) { return fail(err); }
    const count = (f) => rooms.filter((r) => match(r, f)).length;
    fill(bar, ...FILTERS.map((f) => h('button', {
      type: 'button', 'aria-pressed': String(filter === f),
      class: `btn rounded-full border px-3.5 py-1.5 text-sm font-semibold ${filter === f ? 'border-ink bg-ink text-paper' : 'border-clay bg-paper-card text-ink-2 hover:border-clay-2'}`,
      onclick: () => { filter = f; load(); },
    }, `${t(`mg.board.f.${f}`)} · ${count(f)}`)),
    h('span', { class: 'ml-auto' }, btn(t('mg.refresh'), load)));
    const shown = rooms.filter((r) => match(r, filter));
    const floors = [...new Set(shown.map((r) => r.floor))].sort((a, b) => b - a);
    fill(grid, ...(floors.length ? floors.map((f) => h('section', {},
      h('h2', { class: 'mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted' }, t('floor.label', { n: f })),
      h('div', { class: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' }, ...shown.filter((r) => r.floor === f).map((r) => roomCard(r, load)))))
      : [h('p', { class: 'py-10 text-center text-ink-muted' }, t('mg.board.none'))]));
  }
  load();
}

function match(r, f) {
  if (f === 'all') return true;
  if (f === 'dirty') return r.clean !== 'clean';
  if (f === 'occupied') return ['occupied', 'due_out', 'overdue'].includes(r.state);
  if (f === 'arriving') return ['arriving', 'late_arrival'].includes(r.state);
  if (f === 'due_out') return ['due_out', 'overdue'].includes(r.state);
  return r.state === f;
}

function roomCard(r, reload) {
  const b = r.booking;
  const setClean = async (clean) => {
    try { await api(`/api/admin/rooms/${r.id}/clean`, { method: 'POST', body: { clean } }); flash(t('mg.saved')); reload(); } catch (err) { fail(err); }
  };
  const actions = [];
  if (b && can('frontdesk')) {
    const primary = ['arriving', 'late_arrival'].includes(r.state) ? t('mg.stay.checkIn') : ['due_out', 'overdue'].includes(r.state) ? t('mg.stay.checkOut') : t('mg.stay.open');
    actions.push(btn(primary, () => openStay(b.ref, reload), ['arriving', 'late_arrival', 'due_out', 'overdue'].includes(r.state) ? 'primary' : 'ghost'));
  }
  if (can('housekeeping')) {
    if (r.clean !== 'clean') actions.push(btn(t('mg.clean.markClean'), () => setClean('clean'), b ? 'ghost' : 'dark'));
    if (r.clean === 'dirty') actions.push(btn(t('mg.clean.start'), () => setClean('cleaning')));
    if (r.clean === 'clean') actions.push(btn(t('mg.clean.markDirty'), () => setClean('dirty')));
  }
  return h('article', { class: `flex flex-col rounded-2xl border bg-paper-card p-4 elevated ${r.state === 'overdue' ? 'border-oxblood/40' : 'border-clay/70'}` },
    h('div', { class: 'flex items-start justify-between gap-3' },
      h('div', { class: 'min-w-0' },
        h('p', { class: 'font-display text-2xl font-semibold leading-none' }, r.code),
        h('p', { class: 'mt-1 truncate text-sm text-ink-muted' }, t(`unit.kind.${r.kind}`))),
      h('div', { class: 'flex flex-col items-end gap-1.5' }, chip(t(`mg.state.${r.state}`), STATE_TONE[r.state]), chip(t(`mg.clean.${r.clean}`), CLEAN_TONE[r.clean]))),
    b ? h('div', { class: 'mt-4 rounded-xl bg-paper-2 p-3 text-sm' },
      h('p', { class: 'font-semibold' }, b.name, b.type === 'villa' ? h('span', { class: 'ml-2 text-xs font-semibold text-terra' }, t('ad.villa')) : null),
      h('p', { class: 'text-ink-muted' }, `${fmtDate(b.check_in)} → ${fmtDate(b.check_out)} · ${t('sum.nights', { n: b.nights })} · ${t('sum.guests', { a: b.adults, c: b.children })}`),
      can('frontdesk') && b.balance > 0 ? h('p', { class: 'mt-1 font-semibold text-terra tabular' }, `${t('mg.stay.balance')}: ${vnd(b.balance)}`) : null)
      : r.block_reason !== null && r.state === 'blocked' ? h('p', { class: 'mt-4 text-sm text-ink-muted' }, r.block_reason || t('state.blocked')) : null,
    r.next ? h('p', { class: 'mt-3 text-xs text-ink-muted' }, `${t('mg.board.next')}: ${r.next.name} · ${fmtDate(r.next.check_in)}`) : null,
    r.clean_note ? h('p', { class: 'mt-2 text-xs italic text-ink-2' }, `“${r.clean_note}”`) : null,
    actions.length ? h('div', { class: 'mt-auto flex flex-wrap gap-2 pt-4' }, ...actions) : null);
}

// ── stay drawer ────────────────────────────────────────────────────────────
export function openStay(ref, onChange = () => {}) {
  let data = null;
  let mode = 'view'; // view | checkin | checkout | move | receipt
  let items = null;
  const d = drawer(ref, () => (data ? view() : h('p', { class: 'text-ink-muted' }, '…')), { wide: true, onClose: onChange });

  async function load() {
    try {
      data = await api(`/api/admin/stays/${ref}`);
      if (!items) items = await api('/api/admin/items').catch(() => []);
      d.setTitle(`${data.booking.name} · ${ref}`);
      d.refresh();
    } catch (err) { fail(err); d.close(); }
  }
  async function act(fn, okKey, nextMode = 'view') {
    try {
      data = { ...data, ...(await fn()) };
      mode = nextMode;
      flash(t(okKey));
      d.refresh();
      onChange();
    } catch (err) { flash(errText(err), 'err'); }
  }

  const today = todayIso();
  function view() {
    const b = data.booking;
    const canCheckIn = b.stay_status === 'reserved' && ['confirmed', 'deposit_paid', 'paid'].includes(b.status) && b.check_in <= today && b.check_out > today;
    const header = h('div', { class: 'flex flex-wrap items-center gap-2' },
      chip(t(`mg.stay.status.${b.stay_status}`), b.stay_status === 'checked_in' ? 'info' : b.stay_status === 'checked_out' ? 'muted' : 'warn'),
      chip(t(`st.${b.status}`), b.status === 'paid' ? 'good' : b.status === 'pending' ? 'warn' : 'muted'),
      h('span', { class: 'text-sm text-ink-muted' }, `${b.type === 'villa' ? t('ad.villa') : unitsLabel(b.units)} · ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)} · ${t('sum.guests', { a: b.adults, c: b.children })}`));

    const tools = [];
    if (mode === 'view') {
      if (canCheckIn) tools.push(btn(t('mg.stay.checkIn'), () => { mode = 'checkin'; d.refresh(); }, 'primary'));
      if (b.stay_status === 'reserved' && b.status === 'pending') tools.push(h('p', { class: 'text-sm text-ink-muted' }, t('mg.stay.awaitingPayment')));
      if (b.stay_status === 'reserved' && b.check_in > today) tools.push(h('p', { class: 'text-sm text-ink-muted' }, t('mg.stay.arrivesOn', { date: fmtDate(b.check_in) })));
      if (b.stay_status === 'checked_in') {
        tools.push(btn(t('mg.stay.checkOut'), () => { mode = 'checkout'; d.refresh(); }, 'primary'));
        if (b.type === 'room') tools.push(btn(t('mg.stay.move'), () => { mode = 'move'; d.refresh(); }));
      }
      if (b.stay_status === 'reserved' && b.type === 'room' && b.status !== 'pending') tools.push(btn(t('mg.stay.move'), () => { mode = 'move'; d.refresh(); }));
      if (b.stay_status === 'checked_out') tools.push(btn(t('mg.stay.print'), () => printReceipt(data), 'dark'));
    }

    return h('div', { class: 'grid gap-5' },
      header,
      tools.length ? h('div', { class: 'flex flex-wrap items-center gap-2' }, ...tools) : null,
      mode === 'checkin' ? checkInForm() : null,
      mode === 'move' ? moveForm() : null,
      mode === 'checkout' ? checkoutForm() : null,
      billCard(),
      b.stay_status !== 'checked_out' && !['cancelled', 'expired'].includes(b.status) ? chargeForm() : null,
      guestsCard());
  }

  function billCard() {
    const { room, charges, payments, totals } = data;
    const row = (label, value, cls = '') => h('div', { class: `flex items-baseline justify-between gap-4 py-1.5 ${cls}` }, h('span', {}, label), h('span', { class: 'tabular' }, value));
    const roomLabel = (l) => (l.target === 'VILLA' ? t('sum.villa') : unitName(unitById(l.target)));
    return card(
      h('h3', { class: 'font-display text-lg font-semibold' }, t('mg.stay.bill')),
      h('div', { class: 'mt-2 divide-y divide-clay/60 text-sm' },
        ...room.lines.map((l) => row(`${roomLabel(l)} · ${t('sum.nights', { n: l.nights.length })}`, vnd(l.subtotal))),
        room.discount ? row(t('mg.stay.roomDiscount'), `−${vnd(room.discount)}`, 'text-palm') : null,
        ...charges.map((c) => h('div', { class: 'flex items-center justify-between gap-3 py-1.5' },
          h('span', { class: 'min-w-0' }, `${c.name} × ${c.qty}`, c.staff_name ? h('span', { class: 'ml-2 text-xs text-ink-muted' }, c.staff_name) : null),
          h('span', { class: 'flex items-center gap-2' }, h('span', { class: 'tabular' }, vnd(c.amount)),
            data.booking.stay_status !== 'checked_out' ? h('button', {
              type: 'button', class: 'btn rounded-full px-2 py-1 text-xs font-semibold text-oxblood hover:bg-oxblood/10', 'aria-label': `${t('mg.stay.void')} ${c.name}`,
              onclick: () => window.confirm(t('mg.stay.voidConfirm', { name: c.name })) && act(() => api(`/api/admin/stays/${ref}/charges/${c.id}`, { method: 'DELETE' }), 'mg.saved'),
            }, t('mg.stay.void')) : null))),
        totals.bill_discount ? row(t('mg.stay.billDiscount'), `−${vnd(totals.bill_discount)}`, 'text-palm') : null,
        row(h('strong', {}, t('sum.total')), h('strong', {}, vnd(totals.bill))),
        ...payments.map((p) => row(`${t('mg.stay.paid')} · ${t(`ad.method.${p.provider}`) !== `ad.method.${p.provider}` ? t(`ad.method.${p.provider}`) : t(`pay.${p.provider}`)} · ${fmtDate(p.created_at.slice(0, 10))}`, `−${vnd(p.amount)}`, 'text-ink-muted')),
        row(h('strong', {}, t('mg.stay.balance')), h('strong', { class: totals.balance > 0 ? 'text-terra' : 'text-palm' }, vnd(totals.balance)))));
  }

  function chargeForm() {
    const sellable = (items ?? []).filter((i) => ['service', 'goods'].includes(i.kind) && i.active);
    const pick = select([['', t('mg.stay.pickItem')], ...sellable.map((i) => [i.id, `${i.name} · ${vnd(i.price)}${i.kind === 'goods' ? ` · ${t('mg.stock.left', { n: i.stock })}` : ''}`])], '');
    const qty = input({ type: 'number', min: 1, value: 1, class: 'field field-sm w-20 tabular', 'aria-label': t('mg.qty') });
    const custom = isOwner() ? { name: input({ placeholder: t('mg.stay.customName') }), price: input({ type: 'number', min: 0, step: 1000, placeholder: t('mg.price'), class: 'field field-sm w-32 tabular' }) } : null;
    return card(
      h('h3', { class: 'font-display text-lg font-semibold' }, t('mg.stay.addService')),
      h('div', { class: 'mt-3 flex flex-wrap items-end gap-2' },
        h('div', { class: 'min-w-[14rem] flex-1' }, pick), qty,
        btn(t('mg.add'), () => pick.value && act(() => api(`/api/admin/stays/${ref}/charges`, { method: 'POST', body: { item_id: Number(pick.value), qty: Number(qty.value) } }), 'mg.saved'), 'primary')),
      custom ? h('div', { class: 'mt-3 flex flex-wrap items-end gap-2 border-t border-clay/60 pt-3' },
        h('div', { class: 'min-w-[12rem] flex-1' }, custom.name), custom.price,
        btn(t('mg.stay.addCustom'), () => custom.name.value.trim() && act(() => api(`/api/admin/stays/${ref}/charges`, { method: 'POST', body: { name: custom.name.value, price: Number(custom.price.value), qty: 1 } }), 'mg.saved'))) : null,
      !sellable.length ? h('p', { class: 'mt-2 text-xs text-ink-muted' }, t('mg.stay.noItems')) : null);
  }

  function guestsCard() {
    if (!data.guests.length) return null;
    return card(
      h('h3', { class: 'font-display text-lg font-semibold' }, t('mg.stay.guests')),
      h('ul', { class: 'mt-2 divide-y divide-clay/60 text-sm' }, ...data.guests.map((g) => h('li', { class: 'flex flex-wrap justify-between gap-2 py-2' },
        h('span', { class: 'font-medium' }, g.name),
        h('span', { class: 'text-ink-muted' }, [g.phone, g.id_number && `CCCD ${g.id_number}`, g.dob && fmtDate(g.dob, { day: 'numeric', month: 'numeric', year: 'numeric' })].filter(Boolean).join(' · '))))));
  }

  // ── check-in ─────────────────────────────────────────────────────────────
  function checkInForm() {
    const b = data.booking;
    const main = data.guests.find((g) => g.id === b.guest_id) ?? {};
    const F = {
      name: input({ value: main.name ?? b.name, maxlength: 80 }),
      phone: input({ value: main.phone ?? b.phone, type: 'tel', maxlength: 20 }),
      id_number: input({ value: main.id_number ?? '', inputmode: 'numeric', maxlength: 20 }),
      dob: input({ type: 'date', value: main.dob ?? '' }),
      gender: select([['', '—'], ['male', t('mg.g.male')], ['female', t('mg.g.female')], ['other', t('mg.g.other')]], main.gender ?? ''),
      nationality: input({ value: main.nationality ?? 'VN', maxlength: 40 }),
      address: input({ value: main.address ?? '', maxlength: 200 }),
    };
    const fillFromCard = (g) => {
      F.name.value = g.name; F.id_number.value = g.id_number; F.dob.value = g.dob ?? ''; F.gender.value = g.gender; F.address.value = g.address;
      flash(t('mg.cccd.filled'));
    };
    const companions = h('div', { class: 'grid gap-2' });
    const addCompanion = (g = {}) => {
      const row = { name: input({ value: g.name ?? '', placeholder: t('book.name') }), id_number: input({ value: g.id_number ?? '', placeholder: 'CCCD', inputmode: 'numeric' }), dob: input({ type: 'date', value: g.dob ?? '' }) };
      const el = h('div', { class: 'grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2', 'data-companion': '' }, row.name, row.id_number, row.dob,
        h('button', { type: 'button', class: 'btn rounded-full px-2 py-1 text-xs font-semibold text-oxblood hover:bg-oxblood/10', 'aria-label': t('mg.remove'), onclick: () => el.remove() }, '✕'));
      el.row = row;
      companions.append(el);
    };
    return card(
      h('div', { class: 'flex flex-wrap items-center justify-between gap-2' },
        h('h3', { class: 'font-display text-lg font-semibold' }, t('mg.stay.checkIn')),
        btn(t('mg.cccd.scan'), () => scanCccd(fillFromCard), 'dark')),
      h('div', { class: 'mt-3 grid gap-3 sm:grid-cols-2' },
        lbl('book.name', F.name), lbl('book.phone', F.phone), lbl('mg.g.idNumber', F.id_number), lbl('mg.g.dob', F.dob),
        lbl('mg.g.gender', F.gender), lbl('mg.g.nationality', F.nationality), lbl('mg.g.address', F.address, 'sm:col-span-2')),
      h('div', { class: 'mt-4 border-t border-clay/60 pt-3' },
        h('div', { class: 'mb-2 flex items-center justify-between' }, h('p', { class: 'text-sm font-semibold' }, t('mg.stay.companions')),
          h('span', { class: 'flex gap-2' }, btn(t('mg.cccd.scanShort'), () => scanCccd((g) => addCompanion(g))), btn(t('mg.add'), () => addCompanion()))),
        companions),
      h('div', { class: 'mt-4 flex flex-wrap gap-2' },
        btn(t('mg.stay.confirmCheckIn'), () => act(async () => {
          const out = await api(`/api/admin/stays/${ref}/check-in`, {
            method: 'POST',
            body: {
              guest: Object.fromEntries(Object.entries(F).map(([k, el]) => [k, el.value])),
              companions: [...companions.querySelectorAll('[data-companion]')].map((el) => Object.fromEntries(Object.entries(el.row).map(([k, x]) => [k, x.value]))),
            },
          });
          if (out.warnings?.dirty?.length) flash(t('mg.stay.dirtyWarning', { rooms: unitsLabel(out.warnings.dirty) }), 'err');
          return out;
        }, 'mg.stay.checkedIn'), 'primary'),
        btn(t('mg.cancel'), () => { mode = 'view'; d.refresh(); })));
  }

  // ── room move ────────────────────────────────────────────────────────────
  function moveForm() {
    const b = data.booking;
    const from = select(b.units.map((id) => [id, unitName(unitById(id))]), b.units[0]);
    const to = select(S.config.units.filter((u) => !b.units.includes(u.id)).map((u) => [u.id, unitName(u)]), '');
    return card(
      h('h3', { class: 'font-display text-lg font-semibold' }, t('mg.stay.move')),
      h('p', { class: 'mt-1 text-sm text-ink-muted' }, t('mg.stay.moveLead')),
      h('div', { class: 'mt-3 grid gap-3 sm:grid-cols-2' }, lbl('mg.stay.moveFrom', from), lbl('mg.stay.moveTo', to)),
      h('div', { class: 'mt-4 flex gap-2' },
        btn(t('mg.stay.confirmMove'), () => act(() => api(`/api/admin/stays/${ref}/move`, { method: 'POST', body: { from: from.value, to: to.value } }), 'mg.saved'), 'primary'),
        btn(t('mg.cancel'), () => { mode = 'view'; d.refresh(); })));
  }

  // ── check-out ────────────────────────────────────────────────────────────
  function checkoutForm() {
    const { totals } = data;
    const discount = isOwner() ? input({ type: 'number', min: 0, step: 1000, value: 0, class: 'field field-sm w-40 tabular' }) : null;
    const rows = h('div', { class: 'grid gap-2' });
    const summary = h('p', { class: 'text-sm font-semibold', 'aria-live': 'polite' });
    const due = () => Math.max(0, totals.extras + totals.room - Number(discount?.value || 0) - totals.paid);
    const addRow = (method = 'cash', amount = 0) => {
      const m = select(PAY_METHODS.map((x) => [x, t(`ad.method.${x}`)]), method);
      const a = input({ type: 'number', min: 0, step: 1000, value: amount, class: 'field field-sm tabular' });
      const el = h('div', { class: 'grid grid-cols-[1fr_1fr_auto] items-center gap-2', 'data-pay': '' }, m, a,
        h('button', { type: 'button', class: 'btn rounded-full px-2 py-1 text-xs font-semibold text-oxblood hover:bg-oxblood/10', 'aria-label': t('mg.remove'), onclick: () => { el.remove(); recalc(); } }, '✕'));
      el.m = m; el.a = a;
      a.addEventListener('input', recalc);
      rows.append(el);
    };
    const entered = () => [...rows.querySelectorAll('[data-pay]')].reduce((s, el) => s + Number(el.a.value || 0), 0);
    function recalc() {
      const left = due() - entered();
      summary.textContent = `${t('mg.stay.due')}: ${vnd(due())} · ${left === 0 ? t('mg.stay.matched') : left > 0 ? t('mg.stay.short', { v: vnd(left) }) : t('mg.stay.over', { v: vnd(-left) })}`;
      summary.className = `text-sm font-semibold ${left === 0 ? 'text-palm' : 'text-oxblood'}`;
    }
    discount?.addEventListener('input', () => {
      const first = rows.querySelector('[data-pay]');
      if (first && rows.querySelectorAll('[data-pay]').length === 1) first.a.value = due();
      recalc();
    });
    if (due() > 0) addRow('cash', due());
    recalc();
    return card(
      h('h3', { class: 'font-display text-lg font-semibold' }, t('mg.stay.checkOut')),
      data.booking.check_out > today ? h('p', { class: 'mt-1 rounded-xl bg-sun-100 p-2.5 text-sm' }, t('mg.stay.early', { date: fmtDate(data.booking.check_out) })) : null,
      discount ? h('div', { class: 'mt-3' }, lbl('mg.stay.billDiscount', discount)) : null,
      h('div', { class: 'mt-3' }, h('div', { class: 'mb-2 flex items-center justify-between' }, h('p', { class: 'text-sm font-semibold' }, t('mg.stay.payments')), btn(t('mg.stay.addMethod'), () => { addRow('transfer', Math.max(0, due() - entered())); recalc(); })), rows),
      h('div', { class: 'mt-3' }, summary),
      h('div', { class: 'mt-4 flex flex-wrap gap-2' },
        btn(t('mg.stay.confirmCheckOut'), () => act(() => api(`/api/admin/stays/${ref}/check-out`, {
          method: 'POST',
          body: { discount: Number(discount?.value || 0), payments: [...rows.querySelectorAll('[data-pay]')].map((el) => ({ method: el.m.value, amount: Number(el.a.value || 0) })) },
        }), 'mg.stay.checkedOut'), 'primary'),
        btn(t('mg.cancel'), () => { mode = 'view'; d.refresh(); })));
  }

  load();
  return d;
}

// ── ID card (CCCD) QR: camera where supported, otherwise a scanner gun / paste field ──
export function scanCccd(onResult) {
  let stream = null;
  let timer = null;
  const stop = () => { clearInterval(timer); stream?.getTracks().forEach((tr) => tr.stop()); };
  const d = drawer(t('mg.cccd.title'), () => {
    const text = input({ placeholder: t('mg.cccd.paste'), autocomplete: 'off', class: 'field' });
    const msg = h('p', { class: 'min-h-[1.25rem] text-sm text-oxblood', role: 'alert' });
    const accept = (raw) => {
      const g = parseCccd(raw);
      if (!g) { msg.textContent = t('mg.cccd.bad'); return false; }
      stop();
      d.close();
      onResult(g);
      return true;
    };
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); accept(text.value); } });
    const video = h('video', { class: 'aspect-[4/3] w-full rounded-2xl bg-ink object-cover', playsinline: true, muted: true });
    const hasCamera = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
    if (hasCamera) {
      (async () => {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          video.srcObject = stream;
          await video.play();
          timer = setInterval(async () => {
            const codes = await detector.detect(video).catch(() => []);
            for (const c of codes) if (accept(c.rawValue)) return;
          }, 300);
        } catch { msg.textContent = t('mg.cccd.noCamera'); }
      })();
    }
    setTimeout(() => text.focus(), 50);
    return h('div', { class: 'grid gap-4' },
      hasCamera ? video : h('p', { class: 'rounded-xl bg-paper-2 p-3 text-sm' }, t('mg.cccd.noCameraHint')),
      h('p', { class: 'text-sm text-ink-muted' }, t('mg.cccd.hint')),
      text, msg,
      h('div', {}, btn(t('mg.cccd.use'), () => accept(text.value), 'primary')));
  }, { onClose: stop });
}

// ── printable receipt ──────────────────────────────────────────────────────
function printReceipt(data) {
  const b = data.booking;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const line = (l, v) => `<tr><td>${esc(l)}</td><td style="text-align:right">${esc(v)}</td></tr>`;
  const roomLabel = (l) => (l.target === 'VILLA' ? t('sum.villa') : unitName(unitById(l.target)));
  const html = `<!doctype html><html lang="${getLang()}"><meta charset="utf-8"><title>${esc(b.ref)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:360px;margin:24px auto;color:#1D1412}h1{font:600 22px Georgia,serif;margin:0}table{width:100%;border-collapse:collapse;margin-top:12px}td{padding:4px 0;border-bottom:1px dashed #ddd}tfoot td{font-weight:700;border:0}p{margin:2px 0;color:#6E5247}</style>
<h1>RedSun Villa</h1><p>${esc(t('mg.stay.receipt'))} · ${esc(b.ref)}</p><p>${esc(b.name)} · ${esc(b.phone)}</p><p>${esc(b.check_in)} → ${esc(b.check_out)}</p>
<table><tbody>${data.room.lines.map((l) => line(`${roomLabel(l)} × ${l.nights.length}`, vnd(l.subtotal))).join('')}
${data.room.discount ? line(t('mg.stay.roomDiscount'), `−${vnd(data.room.discount)}`) : ''}
${data.charges.map((c) => line(`${c.name} × ${c.qty}`, vnd(c.amount))).join('')}
${data.totals.bill_discount ? line(t('mg.stay.billDiscount'), `−${vnd(data.totals.bill_discount)}`) : ''}</tbody>
<tfoot>${line(t('sum.total'), vnd(data.totals.bill))}${line(t('mg.stay.paid'), vnd(data.totals.paid))}</tfoot></table>
<p style="margin-top:16px">${esc(t('mg.stay.thanks'))}</p><script>print()</script>`;
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return flash(t('mg.popupBlocked'), 'err');
  w.document.write(html);
  w.document.close();
}
