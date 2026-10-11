import { t, applyI18n, bindLangButtons, getLang } from './i18n.js';

const getLangSafe = () => (getLang() === 'en' ? 'en' : 'vi');
import { api, money, h, unitName, fill } from './api.js';
import { CONTACT, mapEmbedUrl, mapLinkUrl } from './site-config.js';
import { initBooking } from './booking.js';
import { initCalendar } from './calendar.js';
import { attachRangePicker } from './datepicker.js';

// Text colour matches the background so the placeholder reads as a plain colour field.
const FLOOR_PLACEHOLDER = (n) => `https://placehold.co/1600x1000/${['', 'EADCCB/EADCCB', 'E3C9A8/E3C9A8', 'C9D8D1/C9D8D1', 'F6E2D8/F6E2D8'][n]}`;

const ICONS = {
  bath: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z"/><path d="M6 12V5a2 2 0 0 1 3.5-1.3"/><path d="M6 19l-1 2M18 19l1 2"/>',
  kitchen: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="10" r="2"/><circle cx="15.5" cy="10" r="2"/><path d="M3 15h18"/>',
  group: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  living: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5H6V11a2 2 0 0 0-4 0Z"/>',
};
const icon = (name, cls = 'h-4 w-4') => `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

async function main() {
  applyI18n();
  bindLangButtons();
  document.getElementById('year').textContent = new Date().getFullYear();

  // mobile menu
  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('mobile-menu');
  const setMenu = (open) => { menu.classList.toggle('hidden', !open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  const config = await api('/api/config');

  // real brand assets win over placeholders
  if (config.assets.hero.length) document.getElementById('hero-img').src = config.assets.hero[0].src;
  // Full-bleed amenities photo (covers.json → amenities; sauna/ wins once added).
  document.querySelectorAll('img[data-chapter]').forEach((img) => {
    const photo = config.assets.chapters?.[img.dataset.chapter];
    if (!photo) return;
    img.src = photo.src;
    if (photo.thumb !== photo.src) {
      img.srcset = `${photo.thumb} 640w, ${photo.src} 2000w`;
      img.sizes = '100vw';
    }
  });
  if (config.assets.logo) {
    document.getElementById('brand-mark').replaceWith(h('img', { src: config.assets.logo, alt: '', class: 'h-8 w-auto' }));
  }

  const booking = initBooking(document.getElementById('booking-app'), config);
  initCalendar(document.getElementById('calendar'), config, booking);
  initFloors(config, booking);
  initHeroSearch(booking);
  initContact(config);
  initSurroundings(config);

  const villaFrom = document.getElementById('villa-from');
  const renderVillaFrom = () => { villaFrom.textContent = t('amen.villaFrom', { price: money(config.villaFromPrice) }); };
  renderVillaFrom();
  document.addEventListener('langchange', renderVillaFrom);
  document.querySelector('[data-goto-villa]').addEventListener('click', (e) => { e.preventDefault(); booking.setMode('villa'); booking.goToForm(); });
}

function initFloors(config, booking) {
  const tabs = document.getElementById('floor-tabs');
  const panel = document.getElementById('floor-panel');
  let current = 2;

  function renderTabs() {
    fill(tabs, ...[1, 2, 3, 4].map((n) => {
      const selected = n === current;
      return h('button', {
        type: 'button', role: 'tab', id: `floor-tab-${n}`, 'aria-selected': String(selected), 'aria-controls': 'floor-panel', tabindex: selected ? '0' : '-1',
        class: 'floor-tab flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border border-clay bg-paper-card p-2 text-center lg:min-h-[5.5rem] lg:flex-row lg:justify-start lg:gap-4 lg:rounded-md lg:border-transparent lg:px-5 lg:text-left',
        onclick: () => select(n),
        onkeydown: (e) => {
          const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
          if (step) { e.preventDefault(); select(Math.min(4, Math.max(1, current + step)), true); }
        },
      },
      h('span', { class: 'font-display text-2xl font-semibold leading-none tabular lg:w-14 lg:shrink-0 lg:text-4xl' }, `0${n}`),
      h('span', { class: 'min-w-0' },
        h('span', { class: 'block text-[11px] font-semibold uppercase tracking-wider lg:text-sm lg:normal-case lg:tracking-normal' }, t('floor.label', { n })),
        h('span', { class: 'muted hidden text-sm text-ink-muted lg:block' }, t(`floor.${n}.short`))));
    }));
  }

  const withIcon = (name, text, cls = 'flex items-center gap-2', iconCls) => h('li', { class: cls }, h('span', { class: 'shrink-0', html: icon(name, iconCls) }), h('span', {}, text));

  // Photos for the current floor: floor folder first, then each room's folder.
  let photos = [];
  let photoIndex = 0;
  let mainImg = null;
  let roomChip = null;
  let thumbs = [];

  const unitById = Object.fromEntries(config.units.map((u) => [u.id, u]));
  const chipText = (p) => (p.unit && config.units.filter((u) => u.floor === unitById[p.unit].floor).length > 1 ? unitName(unitById[p.unit]) : '');

  function showPhoto(i) {
    photoIndex = i;
    mainImg.src = photos[i].src;
    mainImg.alt = photos[i].alt;
    roomChip.textContent = chipText(photos[i]);
    roomChip.classList.toggle('hidden', !roomChip.textContent);
    thumbs.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  }

  function unitCard(u) {
    const feats = u.kind === 'dorm' ? [['group', 'unit.feat.group']] : u.kind === 'apartment' ? [['bath', 'unit.feat.bath'], ['kitchen', 'unit.feat.kitchen']] : [['bath', 'unit.feat.bath']];
    const cap = u.kind === 'dorm' ? t('unit.capDorm', { adults: u.adults }) : t('unit.cap', { adults: u.adults, children: u.children });
    // On single-room floors the gallery above already is this room's photos.
    const soleRoom = config.units.filter((x) => x.floor === u.floor).length === 1;
    const first = soleRoom ? -1 : photos.findIndex((p) => p.unit === u.id);
    return h('article', { class: 'flex flex-col overflow-hidden rounded-2xl border border-clay/70 bg-paper-card elevated' },
      first >= 0 ? h('button', {
        type: 'button', class: 'btn relative isolate block overflow-hidden', 'aria-label': t('gallery.label', { name: unitName(u) }),
        onclick: () => { showPhoto(first); mainImg.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
      },
      h('img', { src: photos[first].thumb, alt: '', class: 'aspect-[16/10] w-full object-cover', loading: 'lazy' }),
      h('span', { 'aria-hidden': 'true', class: 'absolute inset-0 bg-terra/15 mix-blend-multiply' }),
      h('span', { 'aria-hidden': 'true', class: 'absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent' }),
      h('span', { class: 'absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-paper' }, t('gallery.count', { n: photos.filter((p) => p.unit === u.id).length }))) : null,
      h('div', { class: 'flex flex-1 flex-col p-5' },
        h('p', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-terra' }, `${u.code} · ${t('floor.label', { n: u.floor })}`),
        h('h4', { class: 'mt-1 font-display text-xl font-semibold' }, t(`unit.kind.${u.kind}`)),
        h('ul', { class: 'mt-3 grid gap-1.5 text-sm text-ink-2' }, withIcon('user', cap), ...feats.map(([ic, key]) => withIcon(ic, t(key)))),
        h('div', { class: 'mt-auto flex flex-wrap items-center justify-between gap-3 pt-5' },
          h('p', { class: 'text-sm' }, h('span', { class: 'font-semibold' }, money(u.fromPrice)), h('span', { class: 'text-ink-muted' }, ` ${t('unit.perNight')}`)),
          h('button', { type: 'button', class: 'btn min-h-[2.75rem] rounded-full bg-ink px-5 text-sm font-semibold text-paper hover:bg-oxblood', onclick: () => { booking.pickUnit(u.id); booking.goToForm(); } }, t('unit.choose')))),
    );
  }

  function renderPanel(animate) {
    const n = current;
    const units = config.units.filter((u) => u.floor === n);
    const floorAlt = `${t('floor.label', { n })} — ${t(`floor.${n}.title`)}`;
    photos = [
      ...config.assets.floors[n].map((a) => ({ ...a, alt: floorAlt, unit: null })),
      ...units.flatMap((u) => (config.assets.rooms[u.id] ?? []).map((a) => ({ ...a, alt: unitName(u), unit: u.id }))),
    ];
    // Single-room floors (Dorm): floor photos are that room's photos.
    if (units.length === 1) photos.forEach((p) => { p.unit = units[0].id; });
    const hasPhotos = photos.length > 0;
    if (!hasPhotos) photos = [{ src: FLOOR_PLACEHOLDER(n), thumb: FLOOR_PLACEHOLDER(n), alt: floorAlt, unit: null }];
    photoIndex = 0;

    panel.setAttribute('aria-labelledby', `floor-tab-${n}`);
    mainImg = h('img', { src: photos[0].src, alt: photos[0].alt, class: 'aspect-[16/10] w-full object-cover', width: 1600, height: 1000 });
    // Which room the big photo shows, on floors with more than one room.
    roomChip = h('span', { class: `absolute left-4 top-4 z-10 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-paper backdrop-blur-sm sm:left-6 sm:top-6 ${chipText(photos[0]) ? '' : 'hidden'}`, 'aria-live': 'polite' }, chipText(photos[0]));
    thumbs = photos.length > 1 ? photos.map((p, i) => h('button', {
      type: 'button', 'aria-pressed': String(i === 0), 'aria-label': t('gallery.photo', { i: i + 1, n: photos.length }),
      class: 'btn relative h-16 w-24 shrink-0 overflow-hidden rounded-lg opacity-70 ring-terra hover:opacity-100 aria-pressed:opacity-100 aria-pressed:ring-2 sm:h-20 sm:w-28',
      onclick: () => showPhoto(i),
    }, h('img', { src: p.thumb, alt: '', class: 'h-full w-full object-cover', loading: 'lazy' }))) : [];

    const body = units.length
      ? h('div', { class: `mt-6 grid gap-4 ${units.length > 1 ? 'sm:grid-cols-2' : ''}` }, ...units.map(unitCard))
      : h('div', { class: 'mt-6 rounded-2xl border border-clay/70 bg-paper-2 p-5' },
        h('p', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-palm' }, t('floor.shared')),
        h('ul', { class: 'mt-3 grid gap-2 sm:grid-cols-2' },
          withIcon('living', t('floor.shared.living'), 'flex items-center gap-2 font-medium', 'h-5 w-5 text-terra'),
          withIcon('kitchen', t('floor.shared.kitchen'), 'flex items-center gap-2 font-medium', 'h-5 w-5 text-terra')));
    fill(panel, h('div', { class: animate ? 'panel-in' : '' },
      h('figure', { class: 'relative isolate overflow-hidden rounded-3xl floating' },
        mainImg,
        roomChip,
        h('span', { 'aria-hidden': 'true', class: 'absolute inset-0 bg-terra/20 mix-blend-multiply' }),
        h('span', { 'aria-hidden': 'true', class: 'absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent' }),
        h('figcaption', { class: 'absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-7' },
          h('span', {},
            h('span', { class: 'block text-xs font-semibold uppercase tracking-[0.16em] text-sun-200' }, t('floor.label', { n })),
            h('span', { class: 'mt-1 block font-display text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-tight text-paper display-tight' }, t(`floor.${n}.title`))),
          h('span', { class: 'font-display text-6xl font-semibold leading-none text-paper/25 sm:text-8xl', 'aria-hidden': 'true' }, `0${n}`))),
      thumbs.length ? h('div', { class: 'mt-3 flex gap-2 overflow-x-auto p-1', role: 'group', 'aria-label': t('gallery.label', { name: t('floor.label', { n }) }) }, ...thumbs) : null,
      h('p', { class: 'copy mt-6 max-w-2xl text-[1.0625rem] text-ink-2' }, t(`floor.${n}.desc`)),
      body));
  }

  function select(n, focus = false) {
    if (n === current) return;
    current = n;
    renderTabs();
    renderPanel(true);
    if (focus) document.getElementById(`floor-tab-${n}`).focus();
  }

  renderTabs();
  renderPanel(false);
  document.addEventListener('langchange', () => { renderTabs(); renderPanel(false); });
}

function initHeroSearch(booking) {
  const form = document.getElementById('hero-search');
  const inEl = form.elements.checkIn;
  const outEl = form.elements.checkOut;
  const adults = form.elements.adults;
  const children = form.elements.children;
  let mode = 'room';

  // ── guests: one segment with +/− steppers ──────────────────────────────
  const MAX_GUESTS = 18; // whole villa
  const guestsBtn = document.getElementById('guests-btn');
  const guestsPop = document.getElementById('guests-pop');
  const LIMITS = { adults: [1, 14], children: [0, 8] };

  function renderGuests() {
    const a = Number(adults.value);
    const c = Number(children.value);
    guestsBtn.textContent = t('sum.guests', { a, c });
    const row = (key, input) => {
      const v = Number(input.value);
      const [lo, hi] = LIMITS[key];
      const step = (d) => {
        input.value = String(v + d);
        renderGuests();
        guestsPop.querySelector(`[data-step="${key}${d}"]`)?.focus();
      };
      const btn = (d, label, path) => h('button', {
        type: 'button', 'data-step': `${key}${d}`,
        class: 'btn grid h-10 w-10 place-items-center rounded-full border border-clay-2 text-ink hover:border-ink',
        'aria-label': label,
        disabled: (d < 0 ? v <= lo : v >= hi || a + c >= MAX_GUESTS) ? true : null,
        onclick: () => step(d),
        html: `<svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="${path}"/></svg>`,
      });
      return h('div', { class: 'flex items-center justify-between gap-4 py-3' },
        h('span', { class: 'font-semibold' }, t(`search.${key}`)),
        h('div', { class: 'flex items-center gap-3' },
          btn(-1, `${t('guests.less')} ${t(`search.${key}`)}`, 'M5 10h10'),
          h('span', { class: 'w-6 text-center font-semibold tabular', 'aria-live': 'polite' }, String(v)),
          btn(1, `${t('guests.more')} ${t(`search.${key}`)}`, 'M10 5v10M5 10h10')));
    };
    fill(guestsPop,
      h('div', { class: 'divide-y divide-clay/70' }, row('adults', adults), row('children', children)),
      h('p', { class: 'mt-2 text-xs text-ink-muted' }, t('guests.note', { n: MAX_GUESTS })),
      h('button', { type: 'button', class: 'btn mt-4 min-h-[2.5rem] w-full rounded-full bg-ink text-sm font-semibold text-paper hover:bg-oxblood', onclick: () => closeGuests(true) }, t('dp.done')));
  }
  function openGuests() {
    guestsPop.classList.remove('hidden');
    guestsBtn.setAttribute('aria-expanded', 'true');
    renderGuests();
    guestsPop.querySelector('button:not([disabled])')?.focus();
  }
  function closeGuests(returnFocus = false) {
    if (guestsPop.classList.contains('hidden')) return;
    guestsPop.classList.add('hidden');
    guestsBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) guestsBtn.focus();
  }
  guestsBtn.addEventListener('click', () => (guestsPop.classList.contains('hidden') ? openGuests() : closeGuests()));
  guestsPop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeGuests(true); } });
  document.addEventListener('pointerdown', (e) => { if (!guestsPop.contains(e.target) && !guestsBtn.contains(e.target)) closeGuests(); });
  document.addEventListener('langchange', renderGuests);
  renderGuests();

  attachRangePicker({ inEl, outEl, mode: () => mode });

  form.querySelectorAll('[data-hero-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.heroMode;
    form.querySelectorAll('[data-hero-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    booking.setMode(mode);
    booking.setGuests(Number(adults.value), Number(children.value));
    if (inEl.value) booking.setRange(inEl.value, outEl.value);
    booking.goToForm();
  });
}

const AROUND_PLACEHOLDERS = ['6E1A12', '22403A', '84321A'].map((c) => {
  const src = `https://placehold.co/1920x1200/${c}/${c}`;
  return { src, thumb: src, vi: null, en: null };
});

/**
 * Full-screen scenery: the section pins while scrolling, and each featured
 * photo fades in over the last with its caption on the left. "See all" opens
 * every surroundings photo in the lightbox.
 */
function initSurroundings(config) {
  const dialog = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbCount = document.getElementById('lightbox-count');
  const track = document.getElementById('around-track');
  const pin = document.getElementById('around-pin');
  const stage = document.getElementById('around-stage');
  const textBox = document.getElementById('around-text');
  const counter = document.getElementById('around-count');
  const barsBox = document.getElementById('around-bars');
  const moreBtn = document.getElementById('around-more');

  const all = config.assets.surroundings;
  const featured = config.assets.scenery?.length ? config.assets.scenery : AROUND_PLACEHOLDERS;
  const n = featured.length;

  // ── lightbox over every surroundings photo ─────────────────────────────
  let lbIndex = 0;
  const showLb = (i) => {
    lbIndex = (i + all.length) % all.length;
    lbImg.src = all[lbIndex].src;
    lbImg.alt = `${t('around.title')} ${lbIndex + 1}/${all.length}`;
    lbCount.textContent = t('gallery.photo', { i: lbIndex + 1, n: all.length });
  };
  document.getElementById('lightbox-prev').addEventListener('click', () => showLb(lbIndex - 1));
  document.getElementById('lightbox-next').addEventListener('click', () => showLb(lbIndex + 1));
  document.getElementById('lightbox-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
    if (e.key === 'ArrowRight') showLb(lbIndex + 1);
  });
  const openFrom = (photo) => {
    const i = all.findIndex((p) => p.src === photo.src);
    showLb(i < 0 ? 0 : i);
    dialog.showModal();
  };
  moreBtn.addEventListener('click', () => openFrom(featured[active] ?? featured[0]));
  moreBtn.classList.toggle('hidden', all.length === 0);

  // ── slides ─────────────────────────────────────────────────────────────
  let imgs = [];
  let texts = [];
  let bars = [];
  let active = 0;

  function caption(p, i) {
    const c = p[getLangSafe()] ?? p.vi ?? p.en;
    return {
      title: c?.title || t('around.title'),
      text: c?.text || (i === 0 ? t('around.lead') : ''),
    };
  }

  function build() {
    imgs = featured.map((p, i) => h('img', {
      src: p.src,
      srcset: p.thumb && p.thumb !== p.src ? `${p.thumb} 640w, ${p.src} 2000w` : null,
      sizes: '100vw', alt: caption(p, i).title, decoding: 'async', loading: i < 2 ? 'eager' : 'lazy',
      class: 'absolute inset-0 h-full w-full object-cover',
      style: `opacity: ${i === 0 ? 1 : 0}; will-change: opacity, transform`,
    }));
    fill(stage, ...imgs);
    texts = featured.map((p, i) => {
      const c = caption(p, i);
      return h('div', { class: '[grid-area:1/1]', style: `opacity: ${i === 0 ? 1 : 0}`, 'aria-hidden': i === 0 ? null : 'true' },
        // Same type scale as the hero headline and lead.
        h('h2', { class: 'font-display display-tight max-w-3xl text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02] text-paper' }, c.title),
        c.text ? h('p', { class: 'copy mt-5 max-w-xl text-[1.0625rem] text-paper/85' }, c.text) : null);
    });
    fill(textBox, ...texts);
    bars = featured.map(() => h('span', { class: 'block h-full w-full origin-left bg-paper', style: 'transform: scaleX(0)' }));
    fill(barsBox, ...bars.map((b) => h('span', { class: 'h-[3px] flex-1 overflow-hidden rounded-full bg-paper/25' }, b)));
    moreBtn.textContent = t('around.more', { n: all.length });
    active = -1;
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth = (x) => x * x * (3 - 2 * x);
  const pad = (v) => String(v).padStart(2, '0');
  // Photo i fades in while f goes from i-0.65 to i-0.35, then holds.
  const arrive = (f, i) => (i === 0 ? 1 : smooth(clamp((f - (i - 1) - 0.35) / 0.3, 0, 1)));
  // Captions hand over in turn (old out by i-0.5, new in after) so two never overlap.
  const textIn = (f, i) => (i === 0 ? 1 : smooth(clamp((f - (i - 1) - 0.5) / 0.15, 0, 1)));
  const textOut = (f, i) => (i === n - 1 ? 1 : 1 - smooth(clamp((f - i - 0.35) / 0.15, 0, 1)));

  /** f: scroll position in photos (0 … n-1). */
  function paint(f) {
    let now = 0;
    for (let i = 0; i < n; i += 1) {
      const a = arrive(f, i);
      if (a >= 0.5) now = i;
      // Slow zoom-out over each photo's time on screen.
      const life = smooth(clamp((f - i + 0.65) / 1.65, 0, 1));
      imgs[i].style.opacity = a.toFixed(3);
      imgs[i].style.transform = `scale(${(1.08 - 0.08 * life).toFixed(4)})`;
      const o = textIn(f, i) * textOut(f, i);
      texts[i].style.opacity = o.toFixed(3);
      texts[i].style.transform = `translateY(${((1 - o) * 14).toFixed(1)}px)`;
      bars[i].style.transform = `scaleX(${clamp(f - i + 1, 0, 1).toFixed(3)})`;
    }
    if (now !== active) {
      texts.forEach((el, i) => el.setAttribute('aria-hidden', i === now ? 'false' : 'true'));
      counter.textContent = `${pad(now + 1)} / ${pad(n)}`;
      active = now;
    }
  }

  // ── scroll driving (eased toward the scroll position each frame) ───────
  let target = 0;
  let current = 0;
  let frame = 0;
  function measure() {
    const rect = track.getBoundingClientRect();
    const travel = rect.height - pin.offsetHeight;
    target = travel > 0 ? clamp(-rect.top / travel, 0, 1) * (n - 1) : 0;
  }
  function tick() {
    current += (target - current) * 0.14;
    if (Math.abs(target - current) < 0.001) current = target;
    paint(current);
    frame = current === target ? 0 : requestAnimationFrame(tick);
  }
  function onScroll() {
    measure();
    if (!frame) frame = requestAnimationFrame(tick);
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pinned = false;
  function setup() {
    build();
    const wantPin = !reduce.matches && n > 1;
    if (wantPin !== pinned) {
      pinned = wantPin;
      pin.classList.toggle('sticky', pinned);
      pin.classList.toggle('top-0', pinned);
      // One screen of scrolling per photo.
      track.style.height = pinned ? `${n * 100}svh` : '';
      const listen = pinned ? 'addEventListener' : 'removeEventListener';
      window[listen]('scroll', onScroll, { passive: true });
      window[listen]('resize', onScroll);
    }
    if (pinned) {
      measure();
      current = target;
      paint(current);
    } else {
      paint(0); // reduced motion: first photo + caption; the rest via "See all"
    }
  }
  setup();
  reduce.addEventListener('change', setup);
  document.addEventListener('langchange', setup);
}

function initContact(config) {
  const list = document.getElementById('contact-list');
  const times = document.getElementById('contact-times');
  const map = document.getElementById('map-frame');
  const caption = document.getElementById('map-caption');
  const mapLink = document.getElementById('map-link');
  map.src = mapEmbedUrl(CONTACT.mapQuery);
  mapLink.href = mapLinkUrl(CONTACT.mapQuery);

  function render() {
    const item = (key, value, href) => h('div', {},
      h('dt', { class: 'text-xs font-semibold uppercase tracking-[0.14em] text-sun' }, t(key)),
      h('dd', { class: 'mt-1 text-lg' }, href ? h('a', { href, class: 'btn inline-block rounded underline decoration-paper/30 underline-offset-4 hover:decoration-sun', rel: href.startsWith('http') ? 'noopener' : null, target: href.startsWith('http') ? '_blank' : null }, value) : value));
    fill(list, 
      item('contact.phone', CONTACT.phone, CONTACT.phoneHref),
      item('contact.facebook', CONTACT.facebookLabel, CONTACT.facebook),
      item('contact.email', CONTACT.email, `mailto:${CONTACT.email}`),
      item('contact.address', CONTACT.address, mapLinkUrl(CONTACT.mapQuery)));
    const pill = (text) => h('span', { class: 'rounded-full border border-paper/25 px-3 py-1.5' }, text);
    fill(times, pill(t('contact.checkin', { time: config.checkInTime })), pill(t('contact.checkout', { time: config.checkOutTime })));
    caption.textContent = CONTACT.address;
    map.title = `${t('contact.address')}: ${CONTACT.address}`;
    mapLink.textContent = t('contact.openMap');
  }
  render();
  document.addEventListener('langchange', render);
}

main().catch((err) => console.error(err));
