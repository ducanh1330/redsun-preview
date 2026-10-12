import { t, errorText } from './i18n.js';
import { api, money, fmtDate, h, unitName, todayIso, addDays, diffDays, fill } from './api.js';
import { attachRangePicker } from './datepicker.js';

const ICON_CHECK = '<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 10 3.5 3.5L15 7"/></svg>';

export function initBooking(root, config) {
  const state = {
    mode: 'room', checkIn: '', checkOut: '', adults: 2, children: 0, units: new Set(),
    promo: '', step: 1, payMode: 'deposit', provider: config.providers.find((p) => p.enabled)?.id ?? null,
    quote: null, quoteError: null, loading: false, avail: null, submitting: false, submitError: null,
  };
  const unitsById = Object.fromEntries(config.units.map((u) => [u.id, u]));
  let quoteSeq = 0;
  let quoteTimer;

  // ── static structure ───────────────────────────────────────────────────
  const stepBadge = (n) => h('span', { class: 'grid h-8 w-8 shrink-0 place-items-center rounded-full bg-oxblood font-display text-sm font-semibold text-paper', 'aria-hidden': 'true' }, String(n));
  const label = (key, extra) => h('span', { class: 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted' }, t(key), extra ?? null);

  const modeSeg = h('div', { class: 'seg w-full sm:w-auto', role: 'group', 'aria-label': t('search.mode') });
  const inInput = h('input', { type: 'date', class: 'field', name: 'bkIn', min: todayIso() });
  const outInput = h('input', { type: 'date', class: 'field', name: 'bkOut', min: addDays(todayIso(), 1) });
  // Wrappers persist across language re-renders so the picker's buttons survive.
  const inWrap = h('div', {}, inInput);
  const outWrap = h('div', {}, outInput);
  const picker = attachRangePicker({ inEl: inInput, outEl: outInput, mode: () => state.mode });
  const adultsSel = h('select', { class: 'field', name: 'bkAdults' });
  const childrenSel = h('select', { class: 'field', name: 'bkChildren' });
  for (let i = 1; i <= 14; i += 1) adultsSel.append(h('option', { value: i }, i));
  for (let i = 0; i <= 8; i += 1) childrenSel.append(h('option', { value: i }, i));

  const unitsBox = h('div', { class: 'mt-6' });
  const promoInput = h('input', { class: 'field uppercase tracking-wider', name: 'promo', autocomplete: 'off', maxlength: 30 });
  const promoBtn = h('button', { type: 'button', class: 'btn shrink-0 rounded-xl border border-clay bg-paper-card px-4 font-semibold hover:border-clay-2 hover:bg-paper-2' });
  const promoMsg = h('p', { class: 'mt-2 min-h-[1.25rem] text-sm', 'aria-live': 'polite' });

  const step1 = h('fieldset', { class: 'rounded-3xl border border-clay/70 bg-paper-card p-5 elevated sm:p-7' });
  const step2 = h('fieldset', { class: 'rounded-3xl border border-clay/70 bg-paper-card p-5 elevated sm:p-7' });
  const step1Collapsed = h('button', { type: 'button', class: 'btn flex w-full items-center gap-3 rounded-3xl border border-clay/70 bg-paper-card p-5 text-left elevated hover:border-clay-2' });

  const fields = {
    name: h('input', { class: 'field', name: 'name', autocomplete: 'name', maxlength: 80 }),
    phone: h('input', { class: 'field', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', maxlength: 20 }),
    email: h('input', { class: 'field', name: 'email', type: 'email', autocomplete: 'email', maxlength: 120 }),
    note: h('textarea', { class: 'field min-h-[5.5rem]', name: 'note', rows: 3, maxlength: 500 }),
  };
  const fieldErr = Object.fromEntries(Object.keys(fields).map((k) => [k, h('p', { class: 'mt-1.5 hidden text-sm text-[#B3261E]', id: `err-${k}` })]));
  const agree = h('input', { type: 'checkbox', class: 'mt-1 h-5 w-5 shrink-0 accent-[#A3401E] focus-ring', id: 'bk-agree' });
  const payModeBox = h('div', { class: 'grid gap-3 sm:grid-cols-2', role: 'radiogroup' });
  const providerBox = h('div', { class: 'grid gap-3 sm:grid-cols-2', role: 'radiogroup' });

  const summary = h('aside', { class: 'rounded-3xl border border-clay/60 bg-paper-card p-5 floating sm:p-7', 'aria-live': 'polite' });
  const summaryWrap = h('div', { class: 'lg:col-span-5' }, h('div', { class: 'lg:sticky lg:top-28' }, summary));
  const formCol = h('div', { class: 'flex flex-col gap-4 lg:col-span-7' }, step1Collapsed, step1, step2);
  root.append(formCol, summaryWrap);

  // ── builders that depend on language ───────────────────────────────────
  function buildStep1() {
    fill(step1, 
      h('legend', { class: 'sr-only' }, t('book.step1')),
      h('div', { class: 'flex items-center gap-3' }, stepBadge(1), h('h3', { class: 'font-display text-2xl font-semibold display-tight' }, t('book.step1'))),
      h('div', { class: 'mt-6' }, modeSeg),
      h('div', { class: 'mt-5 grid grid-cols-2 gap-3' },
        h('label', { class: 'block' }, label('search.checkin'), inWrap),
        h('label', { class: 'block' }, label('search.checkout'), outWrap)),
      h('div', { class: 'mt-3 grid grid-cols-2 gap-3' },
        h('label', { class: 'block' }, label('search.adults'), adultsSel),
        h('label', { class: 'block' }, label('search.children'), childrenSel)),
      unitsBox,
      h('div', { class: 'mt-6 border-t border-clay/70 pt-5' },
        h('label', { class: 'block', for: 'promo-input' }, label('book.promo')),
        h('div', { class: 'flex gap-2' }, promoInput, promoBtn),
        promoMsg),
    );
    promoInput.id = 'promo-input';
    promoInput.placeholder = t('book.promoPh');
    modeSeg.setAttribute('aria-label', t('search.mode'));
    fill(modeSeg, 
      h('button', { type: 'button', 'data-mode': 'room', 'aria-pressed': String(state.mode === 'room') }, t('search.mode.room')),
      h('button', { type: 'button', 'data-mode': 'villa', 'aria-pressed': String(state.mode === 'villa') }, t('search.mode.villa')),
    );
  }

  function radioCard({ name, value, checked, disabled, title, desc, badge, onSelect }) {
    const input = h('input', { type: 'radio', name, value, class: 'peer sr-only', checked: checked || null, disabled: disabled || null });
    input.addEventListener('change', onSelect);
    return h('label', { class: `relative block ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}` },
      input,
      h('span', { class: 'btn flex h-full items-start gap-3 rounded-2xl border border-clay bg-paper p-4 peer-checked:border-terra peer-checked:bg-terra-100/60 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#A3401E] hover:border-clay-2' },
        h('span', { class: `mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-terra bg-terra text-paper' : 'border-clay-2'}`, html: checked ? ICON_CHECK.replace('h-4 w-4', 'h-3 w-3') : '' }),
        h('span', { class: 'min-w-0' },
          h('span', { class: 'flex flex-wrap items-center gap-2 font-semibold' }, title, badge ? h('span', { class: 'rounded-full bg-sun-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sun-600' }, badge) : null),
          desc ? h('span', { class: 'mt-0.5 block text-sm text-ink-muted' }, desc) : null)));
  }

  function buildStep2() {
    const fl = (key, input, err, optional) => h('label', { class: 'block' },
      label(key, optional ? h('span', { class: 'ml-1 normal-case tracking-normal font-normal' }, `(${t('book.optional')})`) : null), input, err);
    fill(step2, 
      h('legend', { class: 'sr-only' }, t('book.step2')),
      h('div', { class: 'flex items-center gap-3' }, stepBadge(2), h('h3', { class: 'font-display text-2xl font-semibold display-tight' }, t('book.step2'))),
      h('div', { class: 'mt-6 grid gap-4 sm:grid-cols-2' },
        fl('book.name', fields.name, fieldErr.name),
        fl('book.phone', fields.phone, fieldErr.phone),
        h('div', { class: 'sm:col-span-2' }, fl('book.email', fields.email, fieldErr.email, true)),
        h('div', { class: 'sm:col-span-2' }, fl('book.note', fields.note, fieldErr.note, true))),
      h('div', { class: 'mt-7' }, h('p', { class: 'mb-3 text-sm font-semibold' }, t('book.payMode')), payModeBox),
      h('div', { class: 'mt-7' }, h('p', { class: 'mb-3 text-sm font-semibold' }, t('book.method')), providerBox),
      h('label', { class: 'mt-7 flex cursor-pointer items-start gap-3 text-sm', for: 'bk-agree' }, agree, h('span', { class: 'copy' }, t('book.agree'))),
    );
    for (const [k, el] of Object.entries(fields)) el.setAttribute('aria-describedby', `err-${k}`);
    renderPayOptions();
  }

  function renderPayOptions() {
    const q = state.quote;
    payModeBox.setAttribute('aria-label', t('book.payMode'));
    providerBox.setAttribute('aria-label', t('book.method'));
    fill(payModeBox, 
      radioCard({ name: 'payMode', value: 'deposit', checked: state.payMode === 'deposit', title: `${t('book.deposit', { pct: config.depositPercent })}${q ? ` · ${money(q.deposit)}` : ''}`, desc: t('book.depositHint'), onSelect: () => { state.payMode = 'deposit'; renderPayOptions(); renderSummary(); } }),
      radioCard({ name: 'payMode', value: 'full', checked: state.payMode === 'full', title: `${t('book.full')}${q ? ` · ${money(q.total)}` : ''}`, desc: t('book.fullHint'), onSelect: () => { state.payMode = 'full'; renderPayOptions(); renderSummary(); } }),
    );
    fill(providerBox, ...config.providers.map((p) => radioCard({
      name: 'provider', value: p.id, checked: state.provider === p.id, disabled: !p.enabled,
      title: t(`pay.${p.id}`), desc: t(`pay.${p.id}.d`), badge: !p.enabled ? t('pay.off') : p.demo ? t('pay.demo') : null,
      onSelect: () => { state.provider = p.id; renderPayOptions(); renderSummary(); },
    })));
  }

  // ── units / villa info ─────────────────────────────────────────────────
  function unitFree(id) {
    if (!state.avail) return null;
    return state.avail.days.every((d) => d.units[id] === 'free');
  }
  function villaFree() {
    if (!state.avail) return null;
    return state.avail.days.every((d) => d.villa === 'free');
  }

  function renderUnits() {
    if (state.mode === 'villa') {
      const free = villaFree();
      fill(unitsBox, h('div', { class: 'rounded-2xl border border-palm-200 bg-palm-100 p-4' },
        h('p', { class: 'copy text-sm text-palm' }, t('book.villaInfo')),
        free === false ? h('p', { class: 'mt-2 text-sm font-semibold text-oxblood' }, t('err.unavailable')) : null));
      return;
    }
    const hasDates = state.checkIn && state.checkOut && state.checkOut > state.checkIn;
    fill(unitsBox, 
      h('p', { class: 'mb-3 text-sm font-semibold' }, t('book.rooms')),
      hasDates ? null : h('p', { class: 'mb-3 text-sm text-ink-muted' }, t('book.pickDates')),
      h('div', { class: 'grid gap-2' }, ...config.units.map((u) => {
        const free = hasDates ? unitFree(u.id) : null;
        const checked = state.units.has(u.id);
        const input = h('input', { type: 'checkbox', class: 'h-5 w-5 shrink-0 accent-[#A3401E] focus-ring', value: u.id, checked: checked || null, disabled: free === false || null });
        input.addEventListener('change', () => {
          if (input.checked) state.units.add(u.id); else state.units.delete(u.id);
          renderUnits();
          scheduleQuote();
          emitSelection();
        });
        const cap = u.kind === 'dorm' ? t('unit.capDorm', { adults: u.adults }) : t('unit.cap', { adults: u.adults, children: u.children });
        return h('label', { class: `btn flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4 ${checked ? 'border-terra bg-terra-100/50' : 'border-clay bg-paper hover:border-clay-2'} ${free === false ? '!cursor-not-allowed opacity-60' : ''}` },
          input,
          h('span', { class: 'min-w-0 flex-1' },
            h('span', { class: 'block font-semibold' }, unitName(u)),
            h('span', { class: 'block text-sm text-ink-muted' }, `${cap} · ${t('unit.from', { price: money(u.fromPrice) })}`)),
          free == null ? null : h('span', { class: `shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${free ? 'bg-palm-100 text-palm' : 'bg-oxblood/10 text-oxblood'}` }, free ? t('book.unitFree') : t('book.unitTaken')));
      })),
    );
  }

  // ── summary ────────────────────────────────────────────────────────────
  function row(labelText, value, cls = '') {
    return h('div', { class: `flex items-baseline justify-between gap-4 ${cls}` }, h('dt', { class: 'min-w-0' }, labelText), h('dd', { class: 'tabular shrink-0 text-right' }, value));
  }

  function renderSummary() {
    const q = state.quote;
    const children = [h('h3', { class: 'font-display text-2xl font-semibold display-tight' }, t('sum.title'))];

    if (state.checkIn && state.checkOut && state.checkOut > state.checkIn) {
      const nights = diffDays(state.checkIn, state.checkOut);
      children.push(h('div', { class: 'mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-clay/70 bg-clay/70 text-sm' },
        h('div', { class: 'bg-paper p-3' }, h('span', { class: 'block text-xs text-ink-muted' }, t('search.checkin')), h('span', { class: 'font-semibold' }, fmtDate(state.checkIn))),
        h('div', { class: 'bg-paper p-3' }, h('span', { class: 'block text-xs text-ink-muted' }, t('search.checkout')), h('span', { class: 'font-semibold' }, fmtDate(state.checkOut))),
        h('div', { class: 'col-span-2 bg-paper px-3 py-2 text-ink-muted' }, `${t('sum.nights', { n: nights })} · ${t('sum.guests', { a: state.adults, c: state.children })}`)));
    }

    if (state.loading && !q) children.push(h('p', { class: 'mt-5 text-sm text-ink-muted' }, t('sum.loading')));
    else if (state.quoteError) children.push(h('p', { class: 'mt-5 rounded-2xl bg-oxblood/10 p-3 text-sm font-medium text-oxblood', role: 'alert' }, state.quoteError));
    else if (!q) children.push(h('p', { class: 'copy mt-5 text-sm text-ink-muted' }, t('sum.empty')));
    else {
      const lines = q.lines.map((l) => {
        const name = l.target === 'VILLA' ? t('sum.villa') : unitName(unitsById[l.target]);
        const avg = Math.round(l.subtotal / l.nights.length);
        return row(h('span', {}, h('span', { class: 'block font-medium' }, name), h('span', { class: 'block text-xs text-ink-muted' }, t('sum.perNight', { n: l.nights.length, avg: money(avg) }))), money(l.subtotal));
      });
      const notes = [];
      if (q.lines.some((l) => l.nights.some((n) => n.kind === 'weekend'))) notes.push(t('sum.weekendNote'));
      if (q.lines.some((l) => l.nights.some((n) => n.kind === 'special'))) notes.push(t('sum.special'));
      const dueNow = state.payMode === 'full' ? q.total : q.deposit;
      const lang = document.documentElement.lang;
      children.push(
        h('dl', { class: 'mt-5 grid gap-3 text-sm' }, ...lines),
        notes.length ? h('p', { class: 'mt-3 text-xs text-ink-muted' }, notes.join(' ')) : null,
        h('dl', { class: 'mt-4 grid gap-2 border-t border-clay/70 pt-4 text-sm' },
          row(t('sum.subtotal'), money(q.subtotal)),
          q.autoDiscount ? row(lang === 'en' ? q.autoDiscount.label_en : q.autoDiscount.label_vi, `−${money(q.autoDiscount.amount)}`, 'text-palm') : null,
          q.promo ? row(t('sum.promo', { code: q.promo.code }), `−${money(q.promo.amount)}`, 'text-palm') : null,
          row(h('span', { class: 'font-display text-lg font-semibold' }, t('sum.total')), h('span', { class: 'font-display text-2xl font-semibold' }, money(q.total)), 'pt-2')),
        h('dl', { class: 'mt-4 grid gap-2 rounded-2xl bg-paper-2 p-4 text-sm' },
          row(h('span', { class: 'font-semibold' }, t('sum.dueNow')), h('span', { class: 'font-semibold text-terra' }, money(dueNow))),
          q.total - dueNow > 0 ? row(t('sum.dueLater'), money(q.total - dueNow), 'text-ink-muted') : null),
      );
    }

    const canContinue = Boolean(q) && !state.quoteError && !state.loading;
    const cta = h('button', {
      type: 'button',
      class: 'btn mt-5 inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-terra px-6 font-semibold text-paper hover:bg-terra-700',
      disabled: !canContinue || state.submitting || null,
      onclick: () => (state.step === 1 ? goStep(2) : submit()),
    }, state.submitting ? t('book.paying') : state.step === 1 ? t('book.continue') : t('book.pay', { amount: q ? money(state.payMode === 'full' ? q.total : q.deposit) : '' }));
    children.push(cta);
    if (state.submitError) children.push(h('p', { class: 'mt-3 rounded-2xl bg-oxblood/10 p-3 text-sm font-medium text-oxblood', role: 'alert' }, state.submitError));
    children.push(h('p', { class: 'mt-3 text-center text-xs text-ink-muted' }, t('sum.hold', { min: state.provider === 'vietqr' ? config.vietqrHoldMinutes : config.holdMinutes })));
    fill(summary, ...children);
  }

  function renderStep() {
    step1.classList.toggle('hidden', state.step !== 1);
    step2.classList.toggle('hidden', state.step !== 2);
    step1Collapsed.classList.toggle('hidden', state.step !== 2);
    if (state.step === 2 && state.checkIn) {
      const what = state.mode === 'villa' ? t('sum.villa') : [...state.units].map((id) => unitName(unitsById[id])).join(', ');
      fill(step1Collapsed, 
        stepBadge(1),
        h('span', { class: 'min-w-0 flex-1' }, h('span', { class: 'block font-semibold' }, t('book.step1')), h('span', { class: 'block truncate text-sm text-ink-muted' }, `${fmtDate(state.checkIn)} → ${fmtDate(state.checkOut)} · ${what}`)),
        h('span', { class: 'shrink-0 text-sm font-semibold text-terra underline underline-offset-4' }, t('book.back')),
      );
    }
  }

  function goStep(n) {
    state.step = n;
    state.submitError = null;
    renderStep();
    renderSummary();
    if (n === 2) {
      renderPayOptions();
      (window.matchMedia('(min-width: 1024px)').matches ? fields.name : step2).focus({ preventScroll: true });
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  step1Collapsed.addEventListener('click', () => goStep(1));

  // ── data ───────────────────────────────────────────────────────────────
  async function loadAvailability() {
    state.avail = null;
    if (!(state.checkIn && state.checkOut && state.checkOut > state.checkIn)) return renderUnits();
    try {
      state.avail = await api(`/api/availability?from=${state.checkIn}&to=${state.checkOut}`);
    } catch { /* quote will still report conflicts at submit */ }
    renderUnits();
  }

  function scheduleQuote() {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(runQuote, 200);
  }

  async function runQuote() {
    const seq = ++quoteSeq;
    state.quoteError = null;
    if (!(state.checkIn && state.checkOut) || (state.mode === 'room' && state.units.size === 0)) {
      state.quote = null;
      renderSummary();
      return;
    }
    state.loading = true;
    renderSummary();
    try {
      const q = await api('/api/quote', { method: 'POST', body: payload() });
      if (seq !== quoteSeq) return;
      state.quote = q;
      if (q.promoError) {
        promoMsg.className = 'mt-2 min-h-[1.25rem] text-sm text-[#B3261E]';
        promoMsg.textContent = errorText(q.promoError, q.promoErrorDetails);
      } else if (q.promo) {
        promoMsg.className = 'mt-2 min-h-[1.25rem] text-sm font-medium text-palm';
        promoMsg.textContent = `${t('sum.promo', { code: q.promo.code })} · −${money(q.promo.amount)}`;
      } else promoMsg.textContent = '';
      // Unavailable rooms are not an error in the quote; surface it here.
      if (state.avail && (state.mode === 'villa' ? villaFree() === false : [...state.units].some((id) => unitFree(id) === false))) {
        state.quoteError = t('err.unavailable');
      }
    } catch (err) {
      if (seq !== quoteSeq) return;
      state.quote = null;
      state.quoteError = errorText(err.code, err.details);
    } finally {
      if (seq === quoteSeq) {
        state.loading = false;
        renderSummary();
        renderPayOptions();
      }
    }
  }

  function payload() {
    return {
      type: state.mode, units: [...state.units], checkIn: state.checkIn, checkOut: state.checkOut,
      adults: state.adults, children: state.children, promo: state.quote?.promoError ? '' : state.promo,
    };
  }

  function showFieldError(key, message) {
    if (!fields[key]) return;
    fields[key].setAttribute('aria-invalid', message ? 'true' : 'false');
    fieldErr[key].textContent = message ?? '';
    fieldErr[key].classList.toggle('hidden', !message);
  }

  async function submit() {
    state.submitError = null;
    for (const k of Object.keys(fields)) showFieldError(k, null);
    let firstBad = null;
    if (fields.name.value.trim().length < 2) { showFieldError('name', t('err.invalid_name')); firstBad ??= fields.name; }
    if (!/^[0-9+()\s.-]{8,20}$/.test(fields.phone.value.trim())) { showFieldError('phone', t('err.invalid_phone')); firstBad ??= fields.phone; }
    if (fields.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim())) { showFieldError('email', t('err.invalid_email')); firstBad ??= fields.email; }
    if (firstBad) { firstBad.focus(); return; }
    if (!agree.checked) { state.submitError = t('err.agree'); renderSummary(); agree.focus(); return; }
    if (!state.provider) { state.submitError = t('err.invalid_provider'); renderSummary(); return; }

    state.submitting = true;
    renderSummary();
    try {
      const res = await api('/api/bookings', {
        method: 'POST',
        body: {
          ...payload(), name: fields.name.value, phone: fields.phone.value, email: fields.email.value, note: fields.note.value,
          payMode: state.payMode, provider: state.provider, lang: document.documentElement.lang,
        },
      });
      window.location.href = res.next?.kind === 'redirect' ? res.next.url : `booking.html?ref=${encodeURIComponent(res.ref)}`;
    } catch (err) {
      state.submitting = false;
      if (err.code === 'provider_unavailable') {
        // Booking exists and is held; let the status page offer other methods.
        window.location.href = `booking.html?ref=${encodeURIComponent(err.data?.ref ?? '')}`;
        return;
      }
      const fieldMap = { invalid_name: 'name', invalid_phone: 'phone', invalid_email: 'email', note_too_long: 'note' };
      if (fieldMap[err.code]) { showFieldError(fieldMap[err.code], errorText(err.code)); fields[fieldMap[err.code]].focus(); }
      else state.submitError = errorText(err.code, err.details);
      if (err.code === 'unavailable') { picker.refresh(); await loadAvailability(); document.dispatchEvent(new CustomEvent('availability:refresh')); }
      renderSummary();
    }
  }

  // ── events ─────────────────────────────────────────────────────────────
  modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn) api_.setMode(btn.dataset.mode);
  });
  inInput.addEventListener('change', () => api_.setRange(inInput.value, outInput.value));
  outInput.addEventListener('change', () => api_.setRange(inInput.value, outInput.value));
  adultsSel.addEventListener('change', () => { state.adults = Number(adultsSel.value); scheduleQuote(); });
  childrenSel.addEventListener('change', () => { state.children = Number(childrenSel.value); scheduleQuote(); });
  promoBtn.addEventListener('click', () => {
    if (state.promo && promoInput.value.trim().toUpperCase() === state.promo) {
      state.promo = '';
      promoInput.value = '';
    } else state.promo = promoInput.value.trim().toUpperCase();
    promoBtn.textContent = state.promo ? t('book.remove') : t('book.apply');
    scheduleQuote();
  });
  promoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); promoBtn.click(); } });

  function syncInputs() {
    inInput.value = state.checkIn;
    outInput.value = state.checkOut;
    picker.sync();
    adultsSel.value = String(state.adults);
    childrenSel.value = String(state.children);
    modeSeg.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
    promoBtn.textContent = state.promo ? t('book.remove') : t('book.apply');
  }

  function renderAll() {
    buildStep1();
    buildStep2();
    syncInputs();
    renderUnits();
    renderStep();
    renderSummary();
  }

  const emitSelection = () => document.dispatchEvent(new CustomEvent('booking:selection', { detail: { mode: state.mode, units: [...state.units] } }));

  const api_ = {
    setRange(checkIn, checkOut) {
      state.checkIn = checkIn || '';
      state.checkOut = checkOut || '';
      if (state.checkIn && state.checkOut && state.checkOut <= state.checkIn) state.checkOut = addDays(state.checkIn, 1);
      if (state.checkIn && !state.checkOut) state.checkOut = addDays(state.checkIn, 1);
      syncInputs();
      document.dispatchEvent(new CustomEvent('booking:range', { detail: { checkIn: state.checkIn, checkOut: state.checkOut } }));
      loadAvailability().then(scheduleQuote);
    },
    setMode(mode) {
      state.mode = mode === 'villa' ? 'villa' : 'room';
      syncInputs();
      renderUnits();
      scheduleQuote();
      emitSelection();
    },
    setGuests(adults, children) {
      state.adults = adults;
      state.children = children;
      syncInputs();
      scheduleQuote();
    },
    pickUnit(id) {
      state.mode = 'room';
      state.units.add(id);
      syncInputs();
      renderUnits();
      scheduleQuote();
      emitSelection();
    },
    goToForm() {
      if (state.step !== 1) goStep(1);
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    /** Forget the dates and rooms picked so far (the calendar's "Clear"). */
    clear() {
      state.units.clear();
      state.mode = 'room';
      api_.setRange('', '');
      syncInputs();
      renderUnits();
      emitSelection();
    },
    get range() { return { checkIn: state.checkIn, checkOut: state.checkOut }; },
    get selection() { return { mode: state.mode, units: [...state.units] }; },
  };

  document.addEventListener('langchange', renderAll);
  renderAll();
  return api_;
}
