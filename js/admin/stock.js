// Dịch vụ & kho: services, goods for sale, amenities used per stay, fixed equipment, stock history.
import { t } from '../i18n.js';
import { api, unitName } from '../api.js';
import { S, can, isOwner, btn, card, lbl, input, select, chip, flash, fail, errText, drawer, subTabs, empty, h, fill, vnd, num } from './ui.js';

const KINDS = ['service', 'goods', 'consumable', 'asset'];
let tab = 'goods';

export function renderStock(main) {
  const body = h('div');
  const draw = () => {
    fill(main, h('div', {},
      subTabs([...KINDS.map((k) => [k, `mg.kind.${k}`]), ['moves', 'mg.stock.history']], tab, (x) => { tab = x; draw(); }),
      h('p', { class: 'mb-4 max-w-3xl text-sm text-ink-muted' }, t(`mg.kind.${tab}.lead`)),
      body));
    tab === 'moves' ? loadMoves() : loadItems();
  };

  async function loadItems() {
    let items;
    try { items = await api(`/api/admin/items?kind=${tab}&all=1`); } catch (err) { return fail(err); }
    const kind = tab;
    const cols = ['mg.item.name', kind === 'service' ? null : 'mg.item.stock', kind === 'asset' ? 'mg.item.inRooms' : null, kind === 'asset' ? 'mg.item.inStore' : null,
      ['service', 'goods'].includes(kind) ? 'mg.price' : null, kind === 'consumable' ? 'mg.item.perCheckout' : null, isOwner() && kind !== 'service' ? 'mg.item.cost' : null, kind === 'goods' ? 'mg.item.sold' : null, ''].filter((c) => c !== null);
    fill(body, card(
      h('div', { class: 'mb-3 flex justify-end' }, isOwner() ? btn(t('mg.item.new'), () => itemForm(null, kind, loadItems), 'primary') : null),
      items.length ? h('div', { class: 'overflow-x-auto' }, h('table', { class: 'tbl w-full min-w-[720px] text-sm' },
        h('thead', {}, h('tr', {}, ...cols.map((c) => h('th', { scope: 'col' }, c ? t(c) : '')))),
        h('tbody', {}, ...items.map((i) => {
          const actions = [];
          if (kind !== 'service' && can('stock.receive')) actions.push(btn(t('mg.stock.receive'), () => stockForm(i, 'purchase', loadItems)));
          if (kind !== 'service' && isOwner()) {
            actions.push(btn(t('mg.stock.count'), () => stockForm(i, 'adjust', loadItems)));
            actions.push(btn(t('mg.stock.loss'), () => stockForm(i, 'loss', loadItems), 'danger'));
          }
          if (isOwner()) actions.push(btn(t('mg.edit'), () => itemForm(i, kind, loadItems)));
          return h('tr', { class: i.active ? '' : 'opacity-50' },
            h('td', {}, h('span', { class: 'font-semibold' }, i.name), i.category ? h('span', { class: 'block text-xs text-ink-muted' }, i.category) : null,
              !i.active ? h('span', { class: 'block text-xs text-ink-muted' }, t('mg.item.inactive')) : null),
            kind === 'service' ? null : h('td', { class: 'whitespace-nowrap' }, h('span', { class: 'tabular font-semibold' }, `${num(i.stock)} ${i.unit}`), i.low ? h('span', { class: 'ml-2' }, chip(t('mg.stock.low'), i.stock <= 0 ? 'bad' : 'warn')) : null),
            kind === 'asset' ? h('td', { class: 'tabular' }, `${num(i.in_rooms)} (${i.per_room}/${t('mg.item.room')})`) : null,
            kind === 'asset' ? h('td', { class: `tabular ${i.in_store < 0 ? 'font-semibold text-oxblood' : ''}` }, num(i.in_store)) : null,
            ['service', 'goods'].includes(kind) ? h('td', { class: 'tabular' }, vnd(i.price)) : null,
            kind === 'consumable' ? h('td', { class: 'tabular' }, `${i.per_checkout} ${i.unit}`) : null,
            isOwner() && kind !== 'service' ? h('td', { class: 'tabular text-ink-muted' }, vnd(i.cost)) : null,
            kind === 'goods' ? h('td', { class: 'tabular' }, num(i.sold)) : null,
            h('td', {}, h('div', { class: 'flex flex-wrap justify-end gap-2' }, ...actions)));
        }))))
        : empty('mg.item.none')));
  }

  async function loadMoves() {
    let rows;
    try { rows = await api('/api/admin/stock-moves'); } catch (err) { return fail(err); }
    const when = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
    fill(body, card(rows.length ? h('div', { class: 'overflow-x-auto' }, h('table', { class: 'tbl w-full min-w-[720px] text-sm' },
      h('thead', {}, h('tr', {}, ...['mg.when', 'mg.item.name', 'mg.qty', 'mg.stock.reason', 'mg.stock.where', 'mg.who'].map((k) => h('th', { scope: 'col' }, t(k))))),
      h('tbody', {}, ...rows.map((m) => h('tr', {},
        h('td', { class: 'whitespace-nowrap' }, when.format(new Date(m.created_at))),
        h('td', {}, m.item_name),
        h('td', { class: `tabular font-semibold ${m.qty < 0 ? 'text-oxblood' : 'text-palm'}` }, `${m.qty > 0 ? '+' : ''}${num(m.qty)} ${m.item_unit}`),
        h('td', {}, t(`mg.reason.${m.reason}`), m.note ? h('span', { class: 'block text-xs text-ink-muted' }, m.note) : null),
        h('td', { class: 'tabular' }, m.booking_ref || (m.unit_id ? S.config.units.find((u) => u.id === m.unit_id)?.code : '') || '—'),
        h('td', {}, m.staff_name || '—')))))) : empty('mg.stock.noMoves')));
  }
  draw();
}

function stockForm(item, type, done) {
  const d = drawer(`${t(`mg.stock.${type === 'purchase' ? 'receive' : type === 'adjust' ? 'count' : 'loss'}`)} · ${item.name}`, () => {
    const qty = input({ type: 'number', min: type === 'adjust' ? 0 : 1, value: type === 'adjust' ? item.stock : 1, class: 'field field-sm tabular' });
    const unit = select([['', '—'], ...S.config.units.map((u) => [u.id, unitName(u)])], '');
    const note = input({ maxlength: 200 });
    return h('div', { class: 'grid gap-4' },
      h('p', { class: 'text-sm text-ink-muted' }, `${t('mg.item.stock')}: `, h('strong', { class: 'tabular text-ink' }, `${num(item.stock)} ${item.unit}`)),
      lbl(type === 'adjust' ? 'mg.stock.counted' : 'mg.qty', qty),
      type === 'loss' ? lbl('mg.stock.where', unit) : null,
      lbl('mg.g.note', note),
      h('div', {}, btn(t('ad.save'), async () => {
        try {
          await api(`/api/admin/items/${item.id}/stock`, { method: 'POST', body: { type, qty: Number(qty.value), counted: Number(qty.value), unit_id: unit.value || null, note: note.value } });
          flash(t('mg.saved'));
          d.close();
          done();
        } catch (err) { flash(errText(err), 'err'); }
      }, 'primary')));
  });
}

function itemForm(item, kind, done) {
  const d = drawer(item ? item.name : t('mg.item.new'), () => {
    const v = item ?? { kind, active: 1 };
    const f = {
      name: input({ value: v.name ?? '', maxlength: 80 }), category: input({ value: v.category ?? '', maxlength: 40, placeholder: t(`mg.item.catHint.${kind}`) }),
      unit: input({ value: v.unit ?? '', maxlength: 20, placeholder: t('mg.item.unitHint') }),
      price: input({ type: 'number', min: 0, step: 1000, value: v.price ?? 0 }), cost: input({ type: 'number', min: 0, step: 1000, value: v.cost ?? 0 }),
      stock: input({ type: 'number', min: 0, value: v.stock ?? 0 }), min_stock: input({ type: 'number', min: 0, value: v.min_stock ?? 0 }),
      per_checkout: input({ type: 'number', min: 0, value: v.per_checkout ?? 0 }), per_room: input({ type: 'number', min: 0, value: v.per_room ?? 0 }),
      active: h('input', { type: 'checkbox', class: 'h-4 w-4 accent-[#A3401E] focus-ring', checked: v.active ? true : null }),
    };
    const show = (k) => ({
      price: ['service', 'goods'].includes(kind), cost: kind !== 'service', stock: !item && kind !== 'service', min_stock: ['goods', 'consumable'].includes(kind),
      per_checkout: kind === 'consumable', per_room: kind === 'asset',
    })[k] ?? true;
    return h('div', { class: 'grid gap-4' },
      h('div', { class: 'grid gap-3 sm:grid-cols-2' },
        lbl('mg.item.name', f.name), lbl('mg.item.category', f.category), lbl('mg.item.unit', f.unit),
        show('price') ? lbl('mg.price', f.price) : null, show('cost') ? lbl('mg.item.cost', f.cost) : null,
        show('stock') ? lbl('mg.item.opening', f.stock) : null, show('min_stock') ? lbl('mg.item.minStock', f.min_stock) : null,
        show('per_checkout') ? lbl('mg.item.perCheckout', f.per_checkout) : null, show('per_room') ? lbl('mg.item.perRoom', f.per_room) : null),
      kind === 'consumable' ? h('p', { class: 'text-xs text-ink-muted' }, t('mg.item.perCheckoutHint')) : null,
      item ? h('label', { class: 'flex items-center gap-2 text-sm font-medium' }, f.active, t('mg.item.activeLabel')) : null,
      h('div', {}, btn(t('ad.save'), async () => {
        const body = { kind, ...Object.fromEntries(Object.entries(f).map(([k, el]) => [k, k === 'active' ? el.checked : el.type === 'number' ? Number(el.value || 0) : el.value])) };
        try {
          if (item) await api(`/api/admin/items/${item.id}`, { method: 'PUT', body });
          else await api('/api/admin/items', { method: 'POST', body });
          flash(t('mg.saved'));
          d.close();
          done();
        } catch (err) { flash(errText(err), 'err'); }
      }, 'primary')));
  });
}
