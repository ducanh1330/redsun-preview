// Room condition reports: take photos before check-in, after check-out and after
// cleaning; list problems (missing / broken / dirty). Front desk resolves each
// problem by writing it off from stock and/or charging the guest.
import { t } from '../i18n.js';
import { api } from '../api.js';
import { S, can, btn, chip, lbl, input, select, flash, fail, errText, drawer, empty, h, fill, vnd } from './ui.js';

const STAGES = ['check_in', 'check_out', 'cleaning', 'other'];
const KINDS = ['missing', 'broken', 'dirty', 'other'];
const STAGE_TONE = { check_in: 'info', check_out: 'warn', cleaning: 'good', other: 'muted' };
const KIND_TONE = { missing: 'bad', broken: 'bad', dirty: 'warn', other: 'muted' };
const when = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const codeOf = (unitId) => S.config.units.find((u) => u.id === unitId)?.code ?? unitId;
export const photoUrl = (file) => `/api/admin/photos/${encodeURIComponent(file)}`;

async function uploadPhoto(file) {
  const res = await fetch('/api/admin/photos', { method: 'POST', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'upload_failed'), { code: data.error ?? 'upload_failed', status: res.status });
  return data.file;
}

/** Report form. stage: preset step; bookingRef: the stay it belongs to (optional, the server works it out). */
export function openReport({ unitId, stage = 'other', bookingRef = null, onDone = () => {} }) {
  let items = []; // room items (for problems)
  let sellable = []; // minibar goods + services (for 'used')
  const used = new Map(); // item id → qty
  const photos = []; // { file, url }
  let uploading = 0;
  // Kept outside build() so typed text and problem rows survive re-renders.
  const note = h('textarea', { class: 'field field-sm min-h-[4.5rem]', maxlength: 1000 });
  const issues = h('div', { class: 'grid gap-2' });
  const usedBox = h('div');
  const thumbs = h('div', { class: 'grid grid-cols-3 gap-2 sm:grid-cols-4' });
  const picker = h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, class: 'sr-only', id: 'rc-photos' });

  function renderThumbs() {
    if (!photos.length && !uploading) return fill(thumbs, h('p', { class: 'col-span-full rounded-xl border border-dashed border-clay p-4 text-center text-sm text-ink-muted' }, t('mg.rc.photoHint')));
    fill(thumbs,
      ...photos.map((p, i) => h('div', { class: 'relative aspect-square overflow-hidden rounded-xl bg-paper-2' },
        h('img', { src: p.url, alt: t('mg.rc.photoN', { n: i + 1 }), class: 'h-full w-full object-cover' }),
        h('button', { type: 'button', class: 'absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-ink/70 text-paper', 'aria-label': t('mg.remove'), onclick: () => { photos.splice(i, 1); renderThumbs(); } }, '✕'))),
      uploading ? h('div', { class: 'grid aspect-square place-items-center rounded-xl border border-dashed border-clay text-xs text-ink-muted' }, t('mg.rc.uploading', { n: uploading })) : null);
  }
  picker.addEventListener('change', async () => {
    const files = [...picker.files];
    picker.value = '';
    uploading += files.length;
    renderThumbs();
    for (const f of files) {
      try { photos.push({ file: await uploadPhoto(f), url: URL.createObjectURL(f) }); } catch (err) { flash(errText(err), 'err'); }
      uploading -= 1;
      renderThumbs();
    }
  });
  renderThumbs();

  // One card per problem: type as big toggles, labelled "which item" and a quantity stepper.
  const KIND_ACTIVE = { missing: 'border-oxblood bg-oxblood text-paper', broken: 'border-oxblood bg-oxblood text-paper', dirty: 'border-sun-600 bg-sun text-ink', other: 'border-ink bg-ink text-paper' };
  function addIssue(preset = {}) {
    let kind = preset.kind ?? 'missing';
    let qty = 1;
    const n = issues.querySelectorAll('[data-issue]').length + 1;
    const item = select([['', t('mg.rc.otherThing')], ...items.map((i) => [i.id, `${i.name}${i.category ? ` · ${i.category}` : ''}`])], preset.item_id ?? '', { class: 'field field-sm w-full' });
    const label = input({ placeholder: t('mg.rc.whatPh'), maxlength: 80, class: 'field field-sm w-full' });
    label.classList.toggle('hidden', Boolean(preset.item_id));
    item.addEventListener('change', () => { label.classList.toggle('hidden', Boolean(item.value)); if (!item.value) label.focus(); });

    const kinds = h('div', { class: 'grid grid-cols-4 gap-1.5', role: 'group', 'aria-label': t('mg.rc.kindLabel') });
    const paintKinds = () => fill(kinds, ...KINDS.map((k) => h('button', {
      type: 'button', 'aria-pressed': String(kind === k),
      class: `btn min-h-[2.5rem] rounded-lg border text-sm font-semibold ${kind === k ? KIND_ACTIVE[k] : 'border-clay bg-paper-card text-ink-2 hover:border-clay-2'}`,
      onclick: () => { kind = k; paintKinds(); },
    }, t(`mg.rc.kind.${k}`))));
    paintKinds();

    const qtyOut = h('span', { class: 'w-8 text-center font-semibold tabular', 'aria-live': 'polite' }, '1');
    const stepBtn = (d, label2, path) => h('button', {
      type: 'button', class: 'btn grid h-10 w-10 place-items-center rounded-full border border-clay-2 hover:border-ink', 'aria-label': label2,
      onclick: () => { qty = Math.min(99, Math.max(1, qty + d)); qtyOut.textContent = String(qty); },
      html: `<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="${path}"/></svg>`,
    });

    const row = h('div', { class: 'grid gap-3 rounded-2xl border border-clay/70 bg-paper-card p-3 sm:p-4', 'data-issue': '' },
      h('div', { class: 'flex items-center justify-between gap-2' },
        h('p', { class: 'text-xs font-semibold uppercase tracking-wider text-ink-muted' }, t('mg.rc.issueN', { n })),
        h('button', { type: 'button', class: 'btn rounded-full px-3 py-1.5 text-sm font-semibold text-oxblood hover:bg-oxblood/10', onclick: () => row.remove() }, t('mg.rc.removeIssue'))),
      h('div', {}, h('p', { class: 'mb-1 text-xs font-semibold text-ink-muted' }, t('mg.rc.kindLabel')), kinds),
      h('div', { class: 'grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end' },
        h('div', {}, h('p', { class: 'mb-1 text-xs font-semibold text-ink-muted' }, t('mg.rc.which')), h('div', { class: 'grid gap-2' }, item, label)),
        h('div', {}, h('p', { class: 'mb-1 text-xs font-semibold text-ink-muted' }, t('mg.qty')),
          h('div', { class: 'flex items-center gap-1' }, stepBtn(-1, t('guests.less'), 'M5 10h10'), qtyOut, stepBtn(1, t('guests.more'), 'M10 5v10M5 10h10')))));
    row.read = () => ({ item_id: item.value ? Number(item.value) : null, label: label.value, qty, kind });
    issues.append(row);
    if (!preset.item_id) (item.value ? null : item).focus?.();
  }

  const d = drawer(t('mg.rc.title', { room: codeOf(unitId) }), build, { wide: true });
  api('/api/admin/items').then((x) => {
    items = x.filter((i) => i.kind !== 'service');
    sellable = x.filter((i) => ['goods', 'service'].includes(i.kind));
    d.refresh();
  }).catch(() => {});

  function build() {
    note.placeholder = t('mg.rc.notePh');
    const quick = items.filter((i) => ['asset', 'consumable'].includes(i.kind)).slice(0, 8);
    const submit = btn(t('mg.rc.submit'), async () => {
      if (uploading) return flash(t('mg.rc.wait'), 'err');
      submit.disabled = true;
      try {
        await api('/api/admin/room-reports', {
          method: 'POST',
          body: {
            unit_id: unitId, stage, booking_ref: bookingRef, note: note.value,
            photos: photos.map((p) => p.file),
            issues: [...issues.querySelectorAll('[data-issue]')].map((r) => r.read()).filter((x) => x.item_id || x.label.trim()),
            used: [...used].map(([item_id, qty]) => ({ item_id, qty })),
          },
        });
        flash(t('mg.rc.saved'));
        d.close();
        onDone();
      } catch (err) { flash(errText(err), 'err'); submit.disabled = false; }
    }, 'primary');

    return h('div', { class: 'grid gap-5' },
      h('div', {},
        h('p', { class: 'mb-2 text-sm font-semibold' }, t('mg.rc.stage')),
        // 2×2 on phones, one row on wider screens.
        h('div', { class: 'grid grid-cols-2 gap-2 sm:grid-cols-4', role: 'group', 'aria-label': t('mg.rc.stage') },
          ...STAGES.map((s) => h('button', {
            type: 'button', 'aria-pressed': String(stage === s), onclick: () => { stage = s; d.refresh(); },
            class: `btn min-h-[2.75rem] rounded-xl border px-3 text-sm font-semibold ${stage === s ? 'border-ink bg-ink text-paper' : 'border-clay bg-paper-card text-ink-2 hover:border-clay-2'}`,
          }, t(`mg.rc.stage.${s}`)))),
        bookingRef ? h('p', { class: 'mt-2 text-xs text-ink-muted' }, t('mg.rc.forBooking', { ref: bookingRef })) : null),
      h('div', {},
        h('div', { class: 'mb-2 flex items-center justify-between gap-2' },
          h('p', { class: 'text-sm font-semibold' }, t('mg.rc.photos')),
          h('label', { for: 'rc-photos', class: 'btn inline-flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:bg-oxblood' },
            h('span', { 'aria-hidden': 'true', html: '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6.5h3l1.5-2h5L14 6.5h3v9H3z"/><circle cx="10" cy="11" r="3"/></svg>' }),
            t('mg.rc.takePhoto'))),
        picker, thumbs),
      lbl('mg.g.note', note),
      h('div', {},
        h('p', { class: 'text-sm font-semibold' }, t('mg.rc.issues')),
        h('p', { class: 'mb-2 text-xs text-ink-muted' }, t('mg.rc.issuesHint')),
        // One tap for the usual things kept in rooms.
        quick.length ? h('div', { class: 'mb-3 flex flex-wrap gap-2' }, h('span', { class: 'self-center text-xs text-ink-muted' }, t('mg.rc.quick')),
          ...quick.map((i) => h('button', { type: 'button', class: 'btn rounded-full border border-clay bg-paper-card px-3 py-1.5 text-sm font-medium hover:border-ink', onclick: () => addIssue({ item_id: i.id }) }, `+ ${i.name}`))) : null,
        issues,
        h('button', { type: 'button', class: 'btn mt-2 w-full rounded-2xl border-2 border-dashed border-clay px-4 py-3 text-sm font-semibold text-ink-2 hover:border-ink hover:text-ink', onclick: () => addIssue() }, t('mg.rc.addIssue'))),
      usedSection(),
      h('div', {}, submit));
  }

  // What the guest used (minibar, snacks, services) → added to their bill; goods leave stock.
  function renderUsed() {
    const lines = [...used].map(([id, qty]) => ({ item: sellable.find((i) => i.id === id), qty })).filter((l) => l.item);
    const total = lines.reduce((t2, l) => t2 + l.item.price * l.qty, 0);
    const bump = (id, delta) => {
      const next = (used.get(id) ?? 0) + delta;
      const it = sellable.find((i) => i.id === id);
      if (it?.kind === 'goods' && next > it.stock) return flash(t('mg.err.out_of_stock', { stock: it.stock }), 'err');
      if (next <= 0) used.delete(id); else used.set(id, Math.min(99, next));
      renderUsed();
    };
    const step = (id, delta, label2, path) => h('button', {
      type: 'button', class: 'btn grid h-9 w-9 place-items-center rounded-full border border-clay-2 hover:border-ink', 'aria-label': label2,
      onclick: () => bump(id, delta),
      html: `<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="${path}"/></svg>`,
    });
    fill(usedBox,
      sellable.length ? h('div', { class: 'flex flex-wrap gap-2' }, ...sellable.map((i) => h('button', {
        type: 'button',
        disabled: !bookingRef || (i.kind === 'goods' && i.stock <= 0) ? true : null,
        class: `btn rounded-full border px-3 py-1.5 text-sm font-medium ${used.has(i.id) ? 'border-terra bg-terra-100' : 'border-clay bg-paper-card hover:border-ink'} disabled:opacity-40`,
        onclick: () => bump(i.id, 1),
      }, `+ ${i.name}`, h('span', { class: 'ml-1.5 text-xs text-ink-muted tabular' }, vnd(i.price)))))
        : h('p', { class: 'text-sm text-ink-muted' }, t('mg.stay.noItems')),
      lines.length ? h('ul', { class: 'mt-3 divide-y divide-clay/60 rounded-2xl border border-clay/70 bg-paper-card px-3' },
        ...lines.map((l) => h('li', { class: 'flex flex-wrap items-center justify-between gap-2 py-2' },
          h('span', { class: 'min-w-0' }, h('span', { class: 'block font-semibold' }, l.item.name),
            h('span', { class: 'block text-xs text-ink-muted' }, `${vnd(l.item.price)}${l.item.kind === 'goods' ? ` · ${t('mg.stock.left', { n: l.item.stock - l.qty })}` : ''}`)),
          h('span', { class: 'flex items-center gap-2' },
            step(l.item.id, -1, t('guests.less'), 'M5 10h10'),
            h('span', { class: 'w-6 text-center font-semibold tabular' }, String(l.qty)),
            step(l.item.id, 1, t('guests.more'), 'M10 5v10M5 10h10'),
            h('span', { class: 'w-24 text-right font-semibold tabular' }, vnd(l.item.price * l.qty))))),
        h('li', { class: 'flex justify-between py-2 text-sm' }, h('span', {}, t('mg.rc.usedTotal')), h('strong', { class: 'tabular text-terra' }, vnd(total)))) : null);
  }
  function usedSection() {
    renderUsed();
    return h('div', {},
      h('p', { class: 'text-sm font-semibold' }, t('mg.rc.used')),
      h('p', { class: 'mb-2 text-xs text-ink-muted' }, bookingRef ? t('mg.rc.usedHint', { ref: bookingRef }) : t('mg.rc.usedNoGuest')),
      usedBox);
  }
  return d;
}

/** Reports as a history list (photos, notes, problems). */
export function reportList(reports, { onChange = () => {} } = {}) {
  if (!reports.length) return empty('mg.rc.none');
  return h('ul', { class: 'grid gap-3' }, ...reports.map((r) => h('li', { class: 'rounded-xl border border-clay/70 bg-paper p-3' },
    h('div', { class: 'flex flex-wrap items-center gap-2 text-sm' },
      h('span', { class: 'font-display text-lg font-semibold' }, codeOf(r.unit_id)),
      chip(t(`mg.rc.stage.${r.stage}`), STAGE_TONE[r.stage]),
      h('span', { class: 'text-ink-muted' }, `${when.format(new Date(r.created_at))}${r.staff_name ? ` · ${r.staff_name}` : ''}`),
      r.booking_ref ? h('span', { class: 'text-xs tabular text-ink-muted' }, `${r.booking_ref}${r.guest_name ? ` · ${r.guest_name}` : ''}`) : null),
    r.photos.length ? h('div', { class: 'mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6' }, ...r.photos.map((p, i) => h('a', {
      href: photoUrl(p.file), target: '_blank', rel: 'noopener', class: 'btn block aspect-square overflow-hidden rounded-lg bg-paper-2',
    }, h('img', { src: photoUrl(p.file), alt: t('mg.rc.photoN', { n: i + 1 }), loading: 'lazy', class: 'h-full w-full object-cover' })))) : null,
    r.note ? h('p', { class: 'mt-2 text-sm' }, r.note) : null,
    r.used?.length ? h('p', { class: 'mt-2 text-sm' }, h('span', { class: 'font-semibold' }, `${t('mg.rc.usedShort')}: `),
      r.used.filter((u) => !u.voided).map((u) => `${u.name} ×${u.qty} (${vnd(u.amount)})`).join(', ') || '—') : null,
    r.issues.length ? h('ul', { class: 'mt-2 grid gap-1.5' }, ...r.issues.map((i) => issueRow({ ...i, unit_id: r.unit_id, booking_ref: r.booking_ref, guest_name: r.guest_name }, onChange))) : null)));
}

function issueRow(i, onChange) {
  const resolved = i.status === 'resolved';
  const outcome = resolved ? [
    i.stock_written_off ? t('mg.rc.wroteOff') : null,
    i.charged_amount ? t('mg.rc.charged', { v: vnd(i.charged_amount) }) : null,
    i.resolution_note || null,
  ].filter(Boolean).join(' · ') || t('mg.rc.closedNoAction') : '';
  return h('li', { class: 'flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper-card px-2.5 py-2 text-sm' },
    h('span', { class: 'flex flex-wrap items-center gap-2' },
      i.unit_id && i.reported_at ? h('span', { class: 'font-display font-semibold' }, codeOf(i.unit_id)) : null,
      chip(t(`mg.rc.kind.${i.kind}`), KIND_TONE[i.kind]),
      h('span', { class: 'font-semibold' }, `${i.label}${i.qty > 1 ? ` ×${i.qty}` : ''}`),
      resolved ? h('span', { class: 'text-xs text-palm' }, `✓ ${outcome}`) : null),
    !resolved && can('frontdesk') ? btn(t('mg.rc.resolve'), () => openResolve(i, onChange), 'primary') : !resolved ? chip(t('mg.rc.open'), 'warn') : null);
}

/** Resolve a problem: write off stock and/or charge the guest. */
export function openResolve(issue, onDone = () => {}) {
  const d = drawer(t('mg.rc.resolveTitle', { what: issue.label }), () => {
    const suggested = (issue.item_price || issue.item_cost || 0) * issue.qty;
    const writeOff = h('input', { type: 'checkbox', class: 'mt-0.5 h-4 w-4 accent-[#A3401E] focus-ring', checked: issue.item_id && ['missing', 'broken'].includes(issue.kind) ? true : null, disabled: issue.item_id ? null : true });
    const charge = input({ type: 'number', min: 0, step: 1000, value: 0, class: 'field field-sm w-40 tabular' });
    const note = input({ maxlength: 200, placeholder: t('mg.rc.resolveNotePh') });
    return h('div', { class: 'grid gap-4' },
      h('p', { class: 'text-sm' }, h('strong', {}, `${codeOf(issue.unit_id)} · ${t(`mg.rc.kind.${issue.kind}`)}: ${issue.label}${issue.qty > 1 ? ` ×${issue.qty}` : ''}`),
        issue.booking_ref ? h('span', { class: 'block text-ink-muted' }, t('mg.rc.stay', { ref: issue.booking_ref, name: issue.guest_name ?? '' })) : null),
      h('label', { class: `flex items-start gap-2 text-sm ${issue.item_id ? '' : 'opacity-60'}` }, writeOff,
        h('span', {}, h('span', { class: 'block font-semibold' }, t('mg.rc.writeOff')),
          h('span', { class: 'block text-xs text-ink-muted' }, issue.item_id ? t('mg.rc.writeOffHint', { n: issue.qty, item: issue.item_name }) : t('mg.rc.noItem')))),
      h('div', {},
        lbl('mg.rc.charge', charge),
        h('p', { class: 'mt-1 text-xs text-ink-muted' }, issue.booking_ref ? t('mg.rc.chargeHint') : t('mg.rc.noBill')),
        suggested ? btn(t('mg.rc.useSuggested', { v: vnd(suggested) }), () => { charge.value = suggested; }, 'ghost', { class: 'mt-2' }) : null),
      lbl('mg.g.note', note),
      h('div', {}, btn(t('mg.rc.confirmResolve'), async () => {
        try {
          await api(`/api/admin/issues/${issue.id}/resolve`, { method: 'POST', body: { write_off: writeOff.checked, charge: Number(charge.value || 0), note: note.value } });
          flash(t('mg.saved'));
          d.close();
          onDone();
        } catch (err) { flash(errText(err), 'err'); }
      }, 'primary')));
  });
}

/** Open problems across all rooms (dashboard card). */
export async function openIssuesList(onChange) {
  let rows = [];
  try { rows = await api('/api/admin/issues'); } catch (err) { fail(err); }
  if (!rows.length) return empty('mg.rc.noIssues');
  return h('div', {},
    h('ul', { class: 'grid gap-1.5' }, ...rows.slice(0, 8).map((i) => issueRow(i, onChange))),
    rows.length > 8 ? h('p', { class: 'mt-2 text-xs text-ink-muted' }, t('mg.rc.moreIssues', { n: rows.length - 8 })) : null);
}
