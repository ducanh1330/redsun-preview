// GitHub Pages preview: there is no server, so the page answers its own API
// calls here. Prices come from a snapshot taken at build time (preview-data.js)
// and the same rules the server uses (booking-core.mjs). Demo bookings live
// only in this visitor's browser.
import data from './preview-data.js';
import { quoteFrom, nightsBetween, isIsoDate, diffDays, AppError } from './booking-core.mjs';
import { ApiError } from './api.js';

const KEY = 'rs_preview_bookings';
const LIVE = ['pending', 'deposit_paid', 'paid'];
let memory = [];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return memory; }
}
function save(list) {
  memory = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: keep in memory */ }
}
function sweep(list, now = Date.now()) {
  let changed = false;
  for (const b of list) {
    if (b.status === 'pending' && b.holdExpiresAt && Date.parse(b.holdExpiresAt) < now) { b.status = 'expired'; changed = true; }
  }
  if (changed) save(list);
  return list;
}

const pricing = {
  ...data.pricing,
  findPromo: (code) => ({ promo: data.pricing.promos.find((p) => p.code === code), used: 0 }),
};

/** unitId → night → 'held' | 'booked' from this browser's demo bookings. */
function occupancy() {
  const grid = new Map();
  for (const b of sweep(load())) {
    if (!LIVE.includes(b.status)) continue;
    for (const night of nightsBetween(b.checkIn, b.checkOut)) {
      for (const u of b.units) {
        if (!grid.has(u)) grid.set(u, new Map());
        grid.get(u).set(night, b.status === 'pending' ? 'held' : 'booked');
      }
    }
  }
  return grid;
}

function availability(from, to) {
  if (!isIsoDate(from) || !isIsoDate(to) || to <= from || diffDays(from, to) > 100) throw new AppError(400, 'invalid_dates');
  const grid = occupancy();
  const ids = data.pricing.units.map((u) => u.id);
  return {
    from, to, units: ids,
    days: nightsBetween(from, to).map((date) => {
      const units = Object.fromEntries(ids.map((id) => [id, grid.get(id)?.get(date) ?? 'free']));
      const free = ids.filter((id) => units[id] === 'free').length;
      return { date, units, free, villa: free === ids.length ? 'free' : free === 0 ? 'full' : 'partial' };
    }),
  };
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRef = () => `RS${Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => REF_ALPHABET[n % REF_ALPHABET.length]).join('')}`;

function nextStep(b, provider) {
  if (provider === 'vietqr') {
    return { kind: 'vietqr', demo: true, amount: b.amountDue, note: b.ref, bank: null, account: null, accountName: null, qrUrl: null };
  }
  return { kind: 'redirect', url: `demo-pay.html?ref=${encodeURIComponent(b.ref)}` };
}

function view(b) {
  const out = { ...b, balance: b.total - b.amountPaid, checkInTime: data.settings.checkInTime, checkOutTime: data.settings.checkOutTime };
  if (b.status === 'pending' && b.provider === 'vietqr') out.vietqr = nextStep(b, 'vietqr');
  return out;
}

function createBooking(input) {
  const q = quoteFrom(pricing, input);
  if (q.promoError) throw new AppError(400, q.promoError, q.promoErrorDetails);
  const name = String(input.name ?? '').trim();
  const phone = String(input.phone ?? '').trim();
  const email = String(input.email ?? '').trim();
  if (name.length < 2 || name.length > 80) throw new AppError(400, 'invalid_name');
  if (!/^[0-9+()\s.-]{8,20}$/.test(phone)) throw new AppError(400, 'invalid_phone');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'invalid_email');
  const provider = String(input.provider ?? '');
  if (!data.config.providers.some((p) => p.id === provider)) throw new AppError(400, 'invalid_provider');

  const grid = occupancy();
  for (const night of nightsBetween(q.stay.checkIn, q.stay.checkOut)) {
    if (q.stay.unitIds.some((u) => grid.get(u)?.has(night))) throw new AppError(409, 'unavailable');
  }

  const payMode = input.payMode === 'full' ? 'full' : 'deposit';
  const holdMin = provider === 'vietqr' ? data.config.vietqrHoldMinutes : data.config.holdMinutes;
  const b = {
    ref: newRef(), type: q.stay.type, units: q.stay.unitIds, checkIn: q.stay.checkIn, checkOut: q.stay.checkOut,
    nights: q.stay.nights, adults: q.stay.adults, children: q.stay.children, name,
    subtotal: q.subtotal, discount: q.discount, promoCode: q.promo?.code ?? null, autoDiscount: q.autoDiscount, promo: q.promo,
    total: q.total, payMode, amountDue: payMode === 'full' ? q.total : q.deposit, amountPaid: 0,
    status: 'pending', provider, holdExpiresAt: new Date(Date.now() + holdMin * 60_000).toISOString(), lang: input.lang === 'en' ? 'en' : 'vi',
  };
  save([...load(), b]);
  return { ref: b.ref, next: nextStep(b, provider) };
}

function find(ref) {
  const b = sweep(load()).find((x) => x.ref === String(ref).toUpperCase());
  if (!b) throw new AppError(404, 'not_found');
  return b;
}

/** Used by demo-pay.html. */
export function completeDemoPayment(ref, success) {
  const list = load();
  const b = list.find((x) => x.ref === ref);
  if (!b) return null;
  if (success && b.status === 'pending') {
    b.amountPaid += b.amountDue;
    b.status = b.amountPaid >= b.total ? 'paid' : 'deposit_paid';
    b.holdExpiresAt = null;
  }
  save(list);
  return b;
}
export const findDemoBooking = (ref) => load().find((x) => x.ref === ref) ?? null;

export async function previewApi(path, { method = 'GET', body } = {}) {
  const url = new URL(path, 'https://preview.local');
  const p = url.pathname;
  try {
    if (method === 'GET' && p === '/api/config') return structuredClone(data.config);
    if (method === 'GET' && p === '/api/availability') return availability(url.searchParams.get('from'), url.searchParams.get('to'));
    if (method === 'POST' && p === '/api/quote') return quoteFrom(pricing, body ?? {});
    if (method === 'POST' && p === '/api/bookings') return createBooking(body ?? {});
    const m = p.match(/^\/api\/bookings\/([A-Z0-9]+)(\/pay)?$/i);
    if (m && method === 'GET' && !m[2]) return view(find(m[1]));
    if (m && method === 'POST' && m[2]) {
      const list = load();
      const b = list.find((x) => x.ref === m[1].toUpperCase());
      if (!b) throw new AppError(404, 'not_found');
      if (b.status !== 'pending') throw new AppError(409, 'not_payable');
      b.provider = String(body?.provider ?? b.provider);
      save(list);
      return { ref: b.ref, next: nextStep(b, b.provider) };
    }
    throw new AppError(404, 'not_found');
  } catch (err) {
    if (err instanceof AppError) throw new ApiError(err.code, err.details, err.status, { error: err.code, ref: undefined });
    throw err;
  }
}
