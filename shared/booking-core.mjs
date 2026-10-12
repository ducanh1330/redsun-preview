// Booking rules shared by the server and the static GitHub Pages preview:
// dates, stay validation and pricing. No Node or database dependencies, so the
// browser can import it too. The server feeds it rows from SQLite; the preview
// feeds it a snapshot taken at build time.

export const TIMEZONE = 'Asia/Ho_Chi_Minh';

/** An error whose `code` is safe to show the guest (the UI translates it). */
export class AppError extends Error {
  constructor(status, code, details = undefined) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── dates ──────────────────────────────────────────────────────────────────
// Stay dates are 'YYYY-MM-DD' strings. A date in a stay means the night that
// starts on that date, so check-out day itself is never occupied.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

export function weekday(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** Every night from checkIn up to (not including) checkOut. */
export function nightsBetween(checkIn, checkOut) {
  const out = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Today's date at the villa, regardless of the machine's timezone. */
export function todayAtVilla(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now);
}

// ── pricing ────────────────────────────────────────────────────────────────
const roundTo1000 = (n) => Math.round(n / 1000) * 1000;

/**
 * Validate and normalise a stay request. Throws AppError with a UI code.
 * settings: { maxNights, maxAdvanceDays }
 */
export function normalizeStay(allUnits, settings, input, now = new Date()) {
  const type = input?.type === 'villa' ? 'villa' : input?.type === 'room' ? 'room' : null;
  if (!type) throw new AppError(400, 'invalid_type');

  const { checkIn, checkOut } = input;
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) throw new AppError(400, 'invalid_dates');
  const today = todayAtVilla(now);
  if (checkIn < today) throw new AppError(400, 'date_in_past');
  if (checkOut <= checkIn) throw new AppError(400, 'checkout_before_checkin');
  const nights = diffDays(checkIn, checkOut);
  if (nights > settings.maxNights) throw new AppError(400, 'too_many_nights', { max: settings.maxNights });
  if (checkIn > addDays(today, settings.maxAdvanceDays)) throw new AppError(400, 'too_far_ahead', { max: settings.maxAdvanceDays });

  const adults = Number(input.adults);
  const children = Number(input.children ?? 0);
  if (!Number.isInteger(adults) || adults < 1 || adults > 50) throw new AppError(400, 'invalid_guests');
  if (!Number.isInteger(children) || children < 0 || children > 50) throw new AppError(400, 'invalid_guests');

  let units;
  if (type === 'villa') {
    units = allUnits;
  } else {
    const wanted = [...new Set(Array.isArray(input.units) ? input.units : [])];
    units = allUnits.filter((u) => wanted.includes(u.id));
    if (units.length === 0 || units.length !== wanted.length) throw new AppError(400, 'select_rooms');
  }

  const maxAdults = units.reduce((s, u) => s + u.adults, 0);
  const maxGuests = units.reduce((s, u) => s + u.adults + u.children, 0);
  if (adults > maxAdults || adults + children > maxGuests) {
    throw new AppError(400, 'over_capacity', { maxAdults, maxGuests });
  }

  return { type, checkIn, checkOut, nights, adults, children, unitIds: units.map((u) => u.id) };
}

/** Price of one night for one target ('VILLA' or a unit id). */
export function nightPrice(rate, specials, target, night, weekendNights) {
  // Only call it a weekend night when the weekend price actually differs.
  const isWeekend = weekendNights.includes(weekday(night)) && rate.weekend !== rate.base;
  const normal = isWeekend ? rate.weekend : rate.base;
  const covering = specials.filter((s) => s.start_date <= night && night <= s.end_date);
  const special = covering.find((s) => s.target === target) ?? covering.find((s) => s.target === 'ALL');
  if (special) {
    if (special.price != null) return { price: special.price, kind: 'special', label: special.label };
    if (special.multiplier != null) return { price: roundTo1000(normal * special.multiplier), kind: 'special', label: special.label };
  }
  return { price: normal, kind: isWeekend ? 'weekend' : 'base' };
}

function bestAutoDiscount(rules, stay, base, today) {
  const leadDays = diffDays(today, stay.checkIn);
  let best = null;
  for (const r of rules) {
    if (!r.active) continue;
    const qualifies = r.kind === 'long_stay' ? stay.nights >= r.threshold : leadDays >= r.threshold;
    if (!qualifies) continue;
    const amount = roundTo1000((base * r.percent) / 100);
    if (!best || amount > best.amount) best = { id: r.id, kind: r.kind, percent: r.percent, label_vi: r.label_vi, label_en: r.label_en, amount };
  }
  return best;
}

/** p: promo row or undefined; used: live bookings already using it. Returns { promo } or { error }. */
export function evaluatePromo(code, p, used, stay, base, today) {
  const clean = String(code ?? '').trim().toUpperCase();
  if (!clean) return {};
  if (!p || !p.active) return { error: 'promo_invalid' };
  if ((p.valid_from && today < p.valid_from) || (p.valid_to && today > p.valid_to)) return { error: 'promo_expired' };
  if (stay.nights < p.min_nights) return { error: 'promo_min_nights', details: { min: p.min_nights } };
  if (p.applies_to !== 'all' && p.applies_to !== stay.type) return { error: 'promo_not_applicable' };
  if (p.max_uses != null && used >= p.max_uses) return { error: 'promo_used_up' };
  const raw = p.type === 'percent' ? roundTo1000((base * p.value) / 100) : p.value;
  return { promo: { code: clean, type: p.type, value: p.value, amount: Math.min(raw, base) } };
}

/**
 * Full quote.
 * data: { units, rates: { [target]: { base, weekend } }, specials, rules,
 *         findPromo(code) → { promo, used }, settings: { depositPercent, maxNights, maxAdvanceDays, weekendNights } }
 */
export function quoteFrom(data, input, now = new Date()) {
  const { settings } = data;
  const stay = normalizeStay(data.units, settings, input, now);
  const today = todayAtVilla(now);
  const specials = data.specials.filter((s) => s.start_date < stay.checkOut && s.end_date >= stay.checkIn);
  const nights = nightsBetween(stay.checkIn, stay.checkOut);

  const targets = stay.type === 'villa' ? ['VILLA'] : stay.unitIds;
  const lines = targets.map((target) => {
    const perNight = nights.map((date) => ({ date, ...nightPrice(data.rates[target], specials, target, date, settings.weekendNights) }));
    return { target, nights: perNight, subtotal: perNight.reduce((s, n) => s + n.price, 0) };
  });
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);

  const auto = bestAutoDiscount(data.rules, stay, subtotal, today);
  const afterAuto = subtotal - (auto?.amount ?? 0);
  const code = String(input.promo ?? '').trim().toUpperCase();
  const found = code ? data.findPromo(code) : {};
  const promoResult = evaluatePromo(code, found.promo, found.used ?? 0, stay, afterAuto, today);
  const promoAmount = promoResult.promo?.amount ?? 0;

  const discount = (auto?.amount ?? 0) + promoAmount;
  const total = Math.max(0, subtotal - discount);
  const deposit = Math.min(total, Math.ceil((total * settings.depositPercent) / 100 / 1000) * 1000);

  return {
    stay,
    lines,
    subtotal,
    autoDiscount: auto,
    promo: promoResult.promo ?? null,
    promoError: promoResult.error ?? null,
    promoErrorDetails: promoResult.details ?? null,
    discount,
    total,
    depositPercent: settings.depositPercent,
    deposit,
  };
}

/**
 * Nightly prices for the availability calendar: { [date]: { units: { [unitId]: price }, villa: price } }.
 * data: { units, rates, specials, settings: { weekendNights } } (as for quoteFrom).
 */
export function nightPrices(data, from, to) {
  const specials = data.specials.filter((s) => s.start_date < to && s.end_date >= from);
  const out = {};
  for (const night of nightsBetween(from, to)) {
    const units = {};
    for (const u of data.units) {
      if (data.rates[u.id]) units[u.id] = nightPrice(data.rates[u.id], specials, u.id, night, data.settings.weekendNights).price;
    }
    out[night] = { units, villa: data.rates.VILLA ? nightPrice(data.rates.VILLA, specials, 'VILLA', night, data.settings.weekendNights).price : null };
  }
  return out;
}
