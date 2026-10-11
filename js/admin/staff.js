// Nhân viên: accounts & roles, weekly shift schedule, monthly payroll. Staff see their own shifts.
import { t } from '../i18n.js';
import { api, fmtDate, todayIso, addDays } from '../api.js';
import { S, isOwner, btn, card, lbl, input, select, chip, flash, fail, errText, drawer, subTabs, empty, h, fill, vnd, STAFF_ROLES } from './ui.js';

const SLOTS = ['morning', 'afternoon', 'night'];
const NEXT = { none: 'scheduled', scheduled: 'worked', worked: 'absent', absent: 'none' };
const SHIFT_TONE = { scheduled: 'bg-sun-100 text-sun-600 border-sun-200', worked: 'bg-palm-100 text-palm border-palm-200', absent: 'bg-oxblood/10 text-oxblood border-oxblood/20', none: 'bg-paper text-ink-muted border-clay' };
const mondayOf = (iso) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
let tab = 'people';
let week = mondayOf(todayIso());
let month = todayIso().slice(0, 7);

export function renderStaff(main) {
  if (!isOwner()) return myShifts(main);
  const body = h('div');
  const draw = () => {
    fill(main, h('div', {}, subTabs([['people', 'mg.staff.people'], ['shifts', 'mg.staff.shifts'], ['payroll', 'mg.staff.payroll']], tab, (x) => { tab = x; draw(); }), body));
    ({ people, shifts, payroll })[tab](body, draw);
  };
  draw();
}

async function people(body, redraw) {
  let rows;
  try { rows = await api('/api/admin/staff'); } catch (err) { return fail(err); }
  fill(body, card(
    h('div', { class: 'mb-3 flex justify-end' }, btn(t('mg.staff.new'), () => staffForm(null, redraw), 'primary')),
    h('div', { class: 'overflow-x-auto' }, h('table', { class: 'tbl w-full min-w-[720px] text-sm' },
      h('thead', {}, h('tr', {}, ...['mg.g.name', 'mg.staff.username', 'mg.staff.role', 'mg.staff.pay', 'mg.staff.commission', ''].map((k) => h('th', { scope: 'col' }, k ? t(k) : '')))),
      h('tbody', {}, ...rows.map((s) => h('tr', { class: s.active ? '' : 'opacity-50' },
        h('td', {}, h('span', { class: 'font-semibold' }, s.name), s.phone ? h('span', { class: 'block text-xs text-ink-muted' }, s.phone) : null),
        h('td', { class: 'tabular' }, s.username),
        h('td', {}, chip(t(`mg.role.${s.role}`), s.role === 'owner' ? 'dark' : s.role === 'reception' ? 'info' : 'good'), !s.active ? h('span', { class: 'ml-2 text-xs' }, t('mg.item.inactive')) : null),
        h('td', { class: 'tabular' }, s.role === 'owner' ? '—' : s.pay_type === 'shift' ? `${vnd(s.shift_rate)} / ${t('mg.staff.perShift')}` : `${vnd(s.base_salary)} / ${t('mg.staff.perMonth')}`),
        h('td', { class: 'tabular' }, s.commission_percent ? `${s.commission_percent}%` : '—'),
        h('td', { class: 'text-right' }, btn(t('mg.edit'), () => staffForm(s, redraw)))))))),
    h('p', { class: 'mt-3 text-xs text-ink-muted' }, t('mg.staff.rolesHint'))));
}

function staffForm(s, done) {
  const d = drawer(s ? s.name : t('mg.staff.new'), () => {
    const v = s ?? { role: 'reception', pay_type: 'monthly', active: 1 };
    const f = {
      name: input({ value: v.name ?? '', maxlength: 80 }), phone: input({ value: v.phone ?? '', type: 'tel' }),
      username: input({ value: v.username ?? '', maxlength: 30, autocomplete: 'off', disabled: s ? true : null }),
      password: input({ type: 'password', autocomplete: 'new-password', placeholder: s ? t('mg.staff.keepPassword') : '' }),
      role: select(STAFF_ROLES.map((r) => [r, t(`mg.role.${r}`)]), v.role, { disabled: s?.username === 'admin' ? true : null }),
      pay_type: select([['monthly', t('mg.staff.monthly')], ['shift', t('mg.staff.byShift')]], v.pay_type),
      base_salary: input({ type: 'number', min: 0, step: 100000, value: v.base_salary ?? 0 }),
      shift_rate: input({ type: 'number', min: 0, step: 10000, value: v.shift_rate ?? 0 }),
      commission_percent: input({ type: 'number', min: 0, max: 50, step: 0.5, value: v.commission_percent ?? 0 }),
      active: h('input', { type: 'checkbox', class: 'h-4 w-4 accent-[#A3401E] focus-ring', checked: v.active ? true : null, disabled: s?.id === S.me.id || s?.username === 'admin' ? true : null }),
    };
    return h('div', { class: 'grid gap-4' },
      h('div', { class: 'grid gap-3 sm:grid-cols-2' },
        lbl('mg.g.name', f.name), lbl('book.phone', f.phone), lbl('mg.staff.username', f.username), lbl('ad.password', f.password),
        lbl('mg.staff.role', f.role), lbl('mg.staff.payType', f.pay_type), lbl('mg.staff.baseSalary', f.base_salary), lbl('mg.staff.shiftRate', f.shift_rate),
        lbl('mg.staff.commissionPct', f.commission_percent)),
      h('p', { class: 'text-xs text-ink-muted' }, t('mg.staff.commissionHint')),
      s ? h('label', { class: 'flex items-center gap-2 text-sm font-medium' }, f.active, t('mg.staff.activeLabel')) : null,
      h('div', {}, btn(t('ad.save'), async () => {
        const body = {
          name: f.name.value, phone: f.phone.value, role: f.role.value, pay_type: f.pay_type.value,
          base_salary: Number(f.base_salary.value || 0), shift_rate: Number(f.shift_rate.value || 0), commission_percent: Number(f.commission_percent.value || 0),
          ...(f.password.value ? { password: f.password.value } : {}),
          ...(s ? { active: f.active.checked } : { username: f.username.value }),
        };
        try {
          if (s) await api(`/api/admin/staff/${s.id}`, { method: 'PUT', body });
          else await api('/api/admin/staff', { method: 'POST', body });
          flash(t('mg.saved'));
          d.close();
          done();
        } catch (err) { flash(errText(err), 'err'); }
      }, 'primary')));
  });
}

async function shifts(body, redraw) {
  let staff;
  let rows;
  try {
    [staff, rows] = await Promise.all([api('/api/admin/staff'), api(`/api/admin/shifts?from=${week}&to=${addDays(week, 7)}`)]);
  } catch (err) { return fail(err); }
  staff = staff.filter((s) => s.active && s.role !== 'owner');
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const at = (sid, date, slot) => rows.find((r) => r.staff_id === sid && r.date === date && r.slot === slot)?.status ?? 'none';
  const cell = (s, date, slot) => {
    const st = at(s.id, date, slot);
    return h('button', {
      type: 'button',
      class: `btn w-full rounded-lg border px-1 py-1.5 text-[11px] font-semibold ${SHIFT_TONE[st]}`,
      'aria-label': `${s.name} · ${fmtDate(date)} · ${t(`mg.slot.${slot}`)}: ${t(`mg.shift.${st}`)}`,
      onclick: async () => {
        try { await api('/api/admin/shifts', { method: 'PUT', body: { staff_id: s.id, date, slot, status: NEXT[st] } }); shifts(body, redraw); } catch (err) { fail(err); }
      },
    }, st === 'none' ? '+' : t(`mg.shift.short.${st}`));
  };
  fill(body, card(
    h('div', { class: 'mb-3 flex flex-wrap items-center justify-between gap-3' },
      h('h2', { class: 'font-display text-xl font-semibold' }, `${fmtDate(week)} → ${fmtDate(addDays(week, 6))}`),
      h('div', { class: 'flex gap-2' },
        btn('←', () => { week = addDays(week, -7); shifts(body, redraw); }, 'ghost', { 'aria-label': t('avail.prev') }),
        btn(t('avail.today'), () => { week = mondayOf(todayIso()); shifts(body, redraw); }),
        btn('→', () => { week = addDays(week, 7); shifts(body, redraw); }, 'ghost', { 'aria-label': t('avail.next') }))),
    h('p', { class: 'mb-3 text-sm text-ink-muted' }, t('mg.shift.hint')),
    staff.length ? h('div', { class: 'overflow-x-auto' }, h('table', { class: 'w-full min-w-[860px] border-separate border-spacing-1 text-xs' },
      h('thead', {}, h('tr', {}, h('th', { class: 'p-1 text-left' }, ''), ...days.map((dd) => h('th', { class: `p-1 text-center font-semibold ${dd === todayIso() ? 'text-terra' : 'text-ink-muted'}` }, fmtDate(dd, { weekday: 'short', day: 'numeric', month: 'numeric' }))))),
      h('tbody', {}, ...staff.map((s) => h('tr', {},
        h('th', { scope: 'row', class: 'whitespace-nowrap p-1 pr-3 text-left text-sm font-semibold' }, s.name, h('span', { class: 'block text-xs font-normal text-ink-muted' }, t(`mg.role.${s.role}`))),
        ...days.map((dd) => h('td', { class: 'p-0.5 align-top' }, h('div', { class: 'grid gap-1' }, ...SLOTS.map((slot) => h('div', { class: 'grid grid-cols-[1.5rem_1fr] items-center gap-1' },
          h('span', { class: 'text-[10px] text-ink-muted', 'aria-hidden': 'true' }, t(`mg.slot.abbr.${slot}`)), cell(s, dd, slot)))))))))))
      : empty('mg.staff.noStaff')));
}

async function payroll(body) {
  let rows;
  try { rows = await api(`/api/admin/payroll?month=${month}`); } catch (err) { return fail(err); }
  const monthInput = input({ type: 'month', value: month, class: 'field field-sm w-44' });
  monthInput.addEventListener('change', () => { month = monthInput.value || month; payroll(body); });
  const total = rows.reduce((s, r) => s + r.total, 0);
  fill(body, card(
    h('div', { class: 'mb-3 flex flex-wrap items-end justify-between gap-3' }, lbl('mg.staff.month', monthInput),
      h('p', { class: 'text-sm' }, `${t('mg.staff.totalPay')}: `, h('strong', { class: 'font-display text-xl tabular' }, vnd(total)))),
    rows.length ? h('div', { class: 'overflow-x-auto' }, h('table', { class: 'tbl w-full min-w-[860px] text-sm' },
      h('thead', {}, h('tr', {}, ...['mg.g.name', 'mg.staff.base', 'mg.staff.sales', 'mg.staff.commission', 'mg.staff.adjust', 'sum.total', ''].map((k) => h('th', { scope: 'col' }, k ? t(k) : '')))),
      h('tbody', {}, ...rows.map((r) => h('tr', {},
        h('td', {}, h('span', { class: 'font-semibold' }, r.name), h('span', { class: 'block text-xs text-ink-muted' }, t(`mg.role.${r.role}`))),
        h('td', { class: 'tabular' }, vnd(r.base), r.pay_type === 'shift' ? h('span', { class: 'block text-xs text-ink-muted' }, t('mg.staff.shiftsWorked', { n: r.worked_shifts })) : null),
        h('td', { class: 'tabular' }, vnd(r.sales)),
        h('td', { class: 'tabular' }, vnd(r.commission), r.commission_percent ? h('span', { class: 'block text-xs text-ink-muted' }, `${r.commission_percent}%`) : null),
        h('td', { class: 'tabular' }, vnd(r.adjustments_total), ...r.adjustments.map((a) => h('span', { class: 'block text-xs text-ink-muted' }, `${a.amount > 0 ? '+' : ''}${vnd(a.amount)} ${a.note}`))),
        h('td', { class: 'font-semibold tabular' }, vnd(r.total)),
        h('td', { class: 'text-right' }, btn(t('mg.staff.addAdjust'), () => adjustForm(r, () => payroll(body))))))))) : empty('mg.staff.noStaff'),
    h('p', { class: 'mt-3 text-xs text-ink-muted' }, t('mg.staff.payrollHint'))));
}

function adjustForm(r, done) {
  const d = drawer(`${t('mg.staff.addAdjust')} · ${r.name}`, () => {
    const kind = select([['bonus', t('mg.staff.bonus')], ['deduct', t('mg.staff.deduct')]], 'bonus');
    const amount = input({ type: 'number', min: 1000, step: 10000, class: 'field field-sm tabular' });
    const note = input({ maxlength: 120 });
    return h('div', { class: 'grid gap-4' }, lbl('mg.staff.adjustType', kind), lbl('mg.staff.amount', amount), lbl('mg.g.note', note),
      h('div', {}, btn(t('ad.save'), async () => {
        const v = Math.abs(Number(amount.value || 0)) * (kind.value === 'deduct' ? -1 : 1);
        try { await api('/api/admin/payroll/adjustments', { method: 'POST', body: { staff_id: r.staff_id, month, amount: v, note: note.value } }); flash(t('mg.saved')); d.close(); done(); } catch (err) { flash(errText(err), 'err'); }
      }, 'primary')));
  });
}

async function myShifts(main) {
  let rows;
  try { rows = await api(`/api/admin/shifts?from=${todayIso()}&to=${addDays(todayIso(), 14)}`); } catch (err) { return fail(err); }
  fill(main, card(h('h2', { class: 'mb-3 font-display text-xl font-semibold' }, t('mg.staff.myShifts')),
    rows.length ? h('ul', { class: 'divide-y divide-clay/60' }, ...rows.map((r) => h('li', { class: 'flex items-center justify-between gap-3 py-2.5' },
      h('span', { class: 'font-semibold' }, `${fmtDate(r.date, { weekday: 'long', day: 'numeric', month: 'numeric' })} · ${t(`mg.slot.${r.slot}`)}`),
      chip(t(`mg.shift.${r.status}`), r.status === 'worked' ? 'good' : r.status === 'absent' ? 'bad' : 'warn'))))
      : empty('mg.staff.noShifts')));
}
