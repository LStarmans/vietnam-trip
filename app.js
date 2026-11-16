'use strict';

(() => {
  const STORE = 'vn27';
  const VIEWS = ['trip', 'guide', 'todo', 'budget', 'wallet'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // ---------- saved state (per phone) ----------

  const state = Object.assign({
    booked: {},
    people: {},
    me: null,
    plan: 'month',
    hint: false,
    saved: {},
    guideStop: null,
    guideCat: 'all',
    guideMode: 'places',
    rate: null,
  }, read());

  function read() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ }
    queueSync();
  }

  function mine() {
    if (!state.people[state.me]) state.people[state.me] = { done: {}, cleared: {}, custom: [] };
    return state.people[state.me];
  }

  function person() {
    return (DATA.checklist.people || []).find((p) => p.name === state.me) || null;
  }

  // ---------- helpers ----------

  const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((b - a) / 864e5);
  const nightsOf = (s) => daysBetween(toDate(s.from), toDate(s.to));
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ?today=2027-01-21 previews what the app looks like on that day of the trip.
  const fakeToday = new URLSearchParams(location.search).get('today');

  function today() {
    if (fakeToday && /^\d{4}-\d\d-\d\d$/.test(fakeToday)) return toDate(fakeToday);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }

  function dayLabel(s) {
    const d = toDate(s);
    return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
  }

  function range(a, b) {
    const A = toDate(a);
    const B = toDate(b);
    const sameMonth = A.getMonth() === B.getMonth();
    return `${DOW[A.getDay()]} ${A.getDate()}${sameMonth ? '' : ' ' + MON[A.getMonth()]} – ${DOW[B.getDay()]} ${B.getDate()} ${MON[B.getMonth()]}`;
  }

  function shortRange(a, b) {
    const A = toDate(a);
    const B = toDate(b);
    return A.getMonth() === B.getMonth()
      ? `${A.getDate()}–${B.getDate()} ${MON[B.getMonth()]}`
      : `${A.getDate()} ${MON[A.getMonth()]} – ${B.getDate()} ${MON[B.getMonth()]}`;
  }

  function money(n) {
    return '$' + Number(n).toLocaleString('en-AU', {
      minimumFractionDigits: n % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    });
  }

  function dong(n) {
    if (n >= 1e6) return `₫${+(n / 1e6).toFixed(2)}m`;
    if (n >= 1e3) return `₫${+(n / 1e3).toFixed(1)}k`;
    return `₫${n}`;
  }

  function rate() {
    return (state.rate && state.rate.v) || (DATA && DATA.guide && DATA.guide.rate) || 17400;
  }

  function toAud(vnd) {
    const a = vnd / rate();
    return a < 10 ? `A$${a.toFixed(a < 1 ? 2 : 1).replace(/\.0$/, '')}` : `A$${Math.round(a)}`;
  }

  const mapsUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  const icon = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const I = {
    bus: icon('<path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2s-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3M9 18h5"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>'),
    van: icon('<path d="M4 6 2 7M10 6h4M22 7l-2-1"/><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16M8 15h.01M16 15h.01M6 19v2M18 21v-2"/>'),
    overnight: icon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
    plane: icon('<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'),
    car: icon('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
    bed: icon('<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>'),
    moon: icon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
    users: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
    cal: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    temp: icon('<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>'),
    check: icon('<path d="M20 6 9 17l-5-5"/>'),
    share: icon('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>'),
    out: icon('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h11"/>'),
    x: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
    pin: icon('<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'),
    heart: icon('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>'),
    clock: icon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    arrow: icon('<path d="M5 12h14M12 5l7 7-7 7"/>'),
    download: icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    ticket: icon('<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>'),
    car2: icon('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
    edit: icon('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    cloud: icon('<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>'),
    swap: icon('<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>'),
  };

  // ---------- data ----------

  let DATA = null;

  function isBooked(stop) {
    return Object.prototype.hasOwnProperty.call(state.booked, stop.id)
      ? !!state.booked[stop.id]
      : !!(stop.stay && stop.stay.booked);
  }

  function bookedCount() {
    const stops = DATA.trip.stops;
    return { booked: stops.filter(isBooked).length, total: stops.length };
  }

  function currentStop() {
    const t = today();
    return DATA.trip.stops.find((s) => t >= toDate(s.from) && t < toDate(s.to));
  }

  // The stop that's happening now, or the next one coming up.
  function focusStop() {
    const t = today();
    return currentStop()
      || DATA.trip.stops.find((s) => toDate(s.from) >= t)
      || DATA.trip.stops[0];
  }

  function guideFor(id) {
    return (DATA.guide.stops || []).find((g) => g.id === id) || { picks: [], tips: [] };
  }

  function stopById(id) {
    return DATA.trip.stops.find((s) => s.id === id);
  }

  const pickKey = (stopId, p) => `${stopId}:${slug(p.name)}`;

  // ---------- Trip ----------

  const photo = (id, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
  const srcset = (id) => [640, 1080, 1600, 2200].map((w) => `${photo(id, w)} ${w}w`).join(', ');

  function countdownParts(target) {
    const ms = new Date(target).getTime() - Date.now();
    if (ms <= 0) return null;
    return {
      d: Math.floor(ms / 864e5),
      h: Math.floor((ms % 864e5) / 36e5),
      m: Math.floor((ms % 36e5) / 6e4),
      s: Math.floor((ms % 6e4) / 1e3),
    };
  }

  const pad = (n) => String(n).padStart(2, '0');
  const TET_EVE = '2027-02-06T00:00:00+07:00';

  function clockHTML() {
    const trip = DATA.trip;
    const t = today();
    const start = toDate(trip.start);
    const end = toDate(trip.end);
    const p = countdownParts(trip.arrive || trip.start);

    if (p) {
      return `
        <div class="clock" aria-label="Countdown to landing">
          <div><b data-cd="d">${p.d}</b><span>days</span></div>
          <div><b data-cd="h">${pad(p.h)}</b><span>hours</span></div>
          <div><b data-cd="m">${pad(p.m)}</b><span>mins</span></div>
          <div><b data-cd="s">${pad(p.s)}</b><span>secs</span></div>
        </div>
        <p class="clock-cap">until we land in Sài Gòn, 10:05am Sat 16 Jan</p>`;
    }
    if (t <= end) {
      const day = daysBetween(start, t) + 1;
      const total = daysBetween(start, end) + 1;
      const here = currentStop();
      return `
        <div class="clock single"><div><b>${day}</b><span>of ${total} days</span></div></div>
        <p class="clock-cap">${here ? `In ${esc(here.name)} right now` : 'On the move today'}</p>`;
    }
    return `<p class="clock-cap">${daysBetween(start, end) + 1} days in Vietnam</p>`;
  }

  function tick() {
    if ($('#view-trip').hidden) return;
    const p = countdownParts(DATA.trip.arrive || DATA.trip.start);
    if (p) {
      const set = (k, v) => {
        const el = $(`[data-cd="${k}"]`);
        if (!el || el.textContent === v) return;
        el.textContent = v;
        el.classList.remove('roll');
        void el.offsetWidth;
        el.classList.add('roll');
      };
      set('d', String(p.d)); set('h', pad(p.h)); set('m', pad(p.m)); set('s', pad(p.s));
    }
    const tp = countdownParts(TET_EVE);
    const tel = $('[data-tet-cd]');
    if (tel && tp) tel.textContent = tp.d;
  }

  // Rough outline of Vietnam, [lat, lon], clockwise from Móng Cái.
  const OUTLINE = [
    [21.52, 107.97], [21.0, 107.35], [20.95, 107.08], [20.85, 106.75], [20.45, 106.6], [20.15, 106.4],
    [19.85, 105.95], [19.25, 105.78], [18.75, 105.75], [18.3, 106.1], [17.9, 106.45], [17.47, 106.65],
    [16.95, 107.1], [16.55, 107.6], [16.2, 108.05], [16.1, 108.3], [15.88, 108.42], [15.4, 108.8],
    [15.1, 108.9], [14.4, 109.05], [13.77, 109.25], [13.1, 109.32], [12.65, 109.45], [12.25, 109.2],
    [11.9, 109.17], [11.55, 109.02], [11.25, 108.75], [10.93, 108.12], [10.55, 107.5], [10.35, 107.08],
    [10.05, 106.75], [9.6, 106.55], [9.25, 106.0], [9.1, 105.7], [8.6, 104.75], [9.0, 104.8],
    [9.6, 104.85], [10.0, 105.08], [10.38, 104.48], [10.75, 105.05], [10.95, 105.5], [11.0, 106.1],
    [11.45, 105.9], [11.75, 106.4], [11.95, 106.95], [12.25, 107.45], [12.7, 107.55], [13.2, 107.45],
    [14.0, 107.5], [14.7, 107.55], [15.3, 107.45], [15.9, 107.2], [16.3, 107.0], [16.65, 106.6],
    [17.2, 106.2], [17.7, 105.8], [18.2, 105.3], [18.6, 104.9], [19.0, 104.4], [19.3, 104.05],
    [19.6, 104.15], [20.15, 104.4], [20.5, 104.15], [20.85, 103.75], [21.35, 103.0], [21.7, 102.9],
    [22.4, 102.15], [22.6, 102.7], [22.75, 103.35], [22.5, 103.97], [22.85, 104.4], [23.15, 104.85],
    [23.39, 105.32], [23.0, 105.8], [22.95, 106.6], [22.55, 106.75], [22.3, 106.65], [21.95, 106.75],
    [21.6, 107.4],
  ];

  const LABEL = {
    saigon: { dx: -11, dy: 5, a: 'end' },
    dalat: { dx: -11, dy: 10, a: 'end' },
    nhatrang: { dx: 11, dy: 4, a: 'start' },
    hoian: { dx: 11, dy: 13, a: 'start' },
    danang: { dx: 11, dy: -3, a: 'start' },
    hanoi: { dx: -10, dy: -6, a: 'end' },
    ninhbinh: { dx: -10, dy: 15, a: 'end' },
    hagiang: { dx: 11, dy: 4, a: 'start' },
    halong: { dx: 11, dy: 5, a: 'start' },
  };

  const px = (lon) => (lon - 102) * 28.8;
  const py = (lat) => (23.7 - lat) * 30;
  const shortName = (s) => (s.id === 'saigon' ? 'Sài Gòn' : s.name.replace(' Loop', '').replace(' Bay', ''));

  function mapSVG() {
    const stops = DATA.trip.stops;
    const f = (n) => n.toFixed(1);
    const outline = OUTLINE.map(([la, lo], i) => `${i ? 'L' : 'M'}${f(px(lo))} ${f(py(la))}`).join('') + 'Z';
    const pt = (s) => [px(s.at[1]), py(s.at[0])];

    // One path per leg, so the route can light up a leg at a time.
    const legs = stops.slice(0, -1).map((s, i) => {
      const a = pt(s);
      const b = pt(stops[i + 1]);
      if (s.next && s.next.mode === 'plane') {
        const cx = Math.max(a[0], b[0]) + 70;
        return `<path class="m-leg air" data-leg="${i}" d="M${f(a[0])} ${f(a[1])}Q${f(cx)} ${f((a[1] + b[1]) / 2)} ${f(b[0])} ${f(b[1])}"/>`;
      }
      return `<path class="m-leg" data-leg="${i}" pathLength="1" d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}"/>`;
    }).join('');

    const seen = new Map();
    stops.forEach((s, i) => {
      const k = s.at.join(',');
      if (!seen.has(k)) seen.set(k, { s, idx: [i] });
      else seen.get(k).idx.push(i);
    });

    const dots = Array.from(seen.values()).map(({ s, idx }) => {
      const [x, y] = pt(s);
      const l = LABEL[s.id] || { dx: 11, dy: 4, a: 'start' };
      return `
        <g class="m-stop" data-region="${slug(s.region)}" data-idx="${idx.join(' ')}" data-jump="${esc(s.id)}" tabindex="0" role="button" aria-label="${esc(s.name)}">
          <circle class="m-pulse" cx="${f(x)}" cy="${f(y)}" r="9"/>
          <circle class="m-hit" cx="${f(x)}" cy="${f(y)}" r="16"/>
          <circle class="m-dot" cx="${f(x)}" cy="${f(y)}" r="5.5"/>
          <text x="${f(x + l.dx)}" y="${f(y + l.dy)}" text-anchor="${l.a}">${esc(shortName(s))}</text>
        </g>`;
    }).join('');

    return `
      <svg viewBox="-80 -4 360 470" role="img" aria-label="Map of the route through Vietnam">
        <path class="m-land" d="${outline}"/>
        ${legs}
        ${dots}
      </svg>`;
  }

  function storyHTML() {
    const stops = DATA.trip.stops;
    return `
      <section class="story">
        <header class="section-head" data-reveal>
          <h2>Route</h2>
        </header>
        <div class="story-grid">
          <div class="story-map"><div class="story-map-inner card">${mapSVG()}
            <div class="map-key"><span><i class="k-ground"></i>Road &amp; rail</span><span><i class="k-air"></i>Flight</span></div>
          </div></div>
          <ol class="story-steps">
            ${stops.map((s, i) => {
              const g = guideFor(s.id);
              const n = nightsOf(s);
              return `
                <li class="step" data-step="${i}" data-region="${slug(s.region)}">
                  <span class="step-n">${pad(i + 1)}</span>
                  <h3>${esc(s.id === 'hanoi-last' ? 'Hà Nội, again' : s.name)}</h3>
                  <p class="step-when">${shortRange(s.from, s.to)} · ${n} ${n === 1 ? 'night' : 'nights'}</p>
                  ${g.intro ? `<p>${esc(g.intro)}</p>` : ''}
                </li>`;
            }).join('')}
          </ol>
        </div>
      </section>`;
  }

  // Each letter in its own mask so they can rise in one after another.
  function letters(word, start, cls = '') {
    return `<span class="word${cls ? ' ' + cls : ''}" aria-hidden="true">${Array.from(word).map((ch, i) =>
      `<span class="ltr" style="--i:${start + i}"><span>${esc(ch)}</span></span>`).join('')}</span>`;
  }

  function marqueeHTML() {
    const names = DATA.trip.stops
      .filter((s, i, all) => all.findIndex((x) => x.at.join() === s.at.join()) === i)
      .map((s) => s.local && s.id !== 'halong' ? s.local : shortName(s));
    const run = names.map((n, i) => `<span class="mq-item${i % 2 ? ' outline' : ''}">${esc(n)}</span><span class="mq-dot" aria-hidden="true"></span>`).join('');
    return `
      <div class="marquee" data-marquee aria-hidden="true">
        <div class="mq-track">${run}${run}</div>
      </div>`;
  }

  function highlightsHTML() {
    const cards = DATA.trip.stops.filter((s) => s.photo && s.id !== 'hanoi-last').map((s) => {
      const top = (guideFor(s.id).picks || []).find((p) => p.top);
      return `
        <a class="hl-card" href="#guide" data-guide-stop="${esc(s.id)}" data-region="${slug(s.region)}">
          <img alt="" loading="lazy" src="${photo(s.photo, 900)}" srcset="${photo(s.photo, 600)} 600w, ${photo(s.photo, 900)} 900w, ${photo(s.photo, 1300)} 1300w" sizes="(min-width: 1000px) 380px, 78vw">
          <span class="hl-shade"></span>
          <span class="hl-text">
            <span class="eyebrow light">${esc(shortName(s))}</span>
            <b>${esc(top ? top.name : s.name)}</b>
          </span>
          <span class="hl-plus" aria-hidden="true">+</span>
        </a>`;
    }).join('');
    return `
      <section class="highlights" data-hpin>
        <div class="hl-sticky">
          <header class="section-head" data-reveal>
            <h2>Highlights</h2>
          </header>
          <div class="hl-window">
            <div class="hl-scroll">${cards}</div>
          </div>
          <div class="hl-progress" aria-hidden="true"><span></span></div>
        </div>
      </section>`;
  }

  function tetHTML() {
    const tp = countdownParts(TET_EVE);
    return `
      <section class="tet" data-parallax>
        <img class="tet-img" alt="" loading="lazy" src="${photo(DATA.trip.photos.tet, 1600)}" srcset="${srcset(DATA.trip.photos.tet)}" sizes="100vw">
        <div class="tet-shade"></div>
        <div class="tet-inner" data-reveal>
          <span class="eyebrow light">Tết Nguyên Đán · Year of the Goat</span>
          <h2>New Year’s Eve<br>on Hoàn Kiếm Lake.</h2>
          <p>The holiday runs Thu 4 to Wed 10 Feb. Fireworks at midnight on Friday 5 Feb, then the city goes quiet and everyone heads to the pagodas.</p>
          ${tp ? `<div class="tet-count"><b data-tet-cd>${tp.d}</b><span>days until<br>the fireworks</span></div>` : ''}
        </div>
      </section>`;
  }

  function chapterHTML(s, i) {
    const n = nightsOf(s);
    const booked = isBooked(s);
    const here = currentStop() === s;
    const g = guideFor(s.id);
    const top = (g.picks || []).find((p) => p.top);
    const events = (DATA.trip.events || []).filter((e) => {
      const d = toDate(e.from);
      return d >= toDate(s.from) && d < toDate(s.to);
    });

    return `
      <article class="chapter${here ? ' now' : ''}" id="stop-${esc(s.id)}" data-region="${slug(s.region)}">
        <div class="ch-photo" data-parallax>
          ${s.photo ? `<img alt="" loading="lazy" src="${photo(s.photo, 1600)}" srcset="${srcset(s.photo)}" sizes="(min-width: 760px) 1100px, 100vw">` : ''}
          <div class="ch-shade"></div>
          <div class="ch-title" data-reveal>
            <span class="eyebrow light">${pad(i + 1)} · ${esc(s.region)}${here ? ' · You’re here' : ''}</span>
            <h2>${esc(s.id === 'hanoi-last' ? 'Hà Nội' : s.name)}</h2>
            ${s.local && s.local !== s.name ? `<p class="ch-local">${esc(s.local)}</p>` : ''}
          </div>
        </div>
        <div class="ch-body">
          <div class="ch-facts" data-reveal>
            <div><span>Dates</span><b>${shortRange(s.from, s.to)}</b></div>
            <div><span>Nights</span><b>${n}</b></div>
            <div><span>People</span><b>${s.people}</b></div>
            ${s.temp ? `<div><span>Usually</span><b>${s.temp[0]}°<small>/${s.temp[1]}°</small></b></div>` : ''}
          </div>

          ${events.map((e) => `
            <div class="event" data-reveal>
              <span class="eyebrow">${e.from === e.to ? dayLabel(e.from) : range(e.from, e.to)}</span>
              <h3>${esc(e.title)}</h3>
              <p>${esc(e.note)}</p>
            </div>`).join('')}

          ${s.stay ? `
            <div class="stay card" data-reveal>
              <div class="stay-label">${I.bed}Stay</div>
              <div class="stay-name">${esc(s.stay.name)}</div>
              ${s.stay.detail ? `<div class="stay-detail">${esc(s.stay.detail)}</div>` : ''}
              ${s.stay.link ? `<a class="stay-link" href="${esc(s.stay.link)}" target="_blank" rel="noopener">See the place ${I.out}</a>` : ''}
              <button class="booked" type="button" data-book="${esc(s.id)}" aria-pressed="${booked}">
                <span class="tick">${I.check}</span><span class="booked-text">${booked ? 'Booked' : 'Not booked'}</span>
              </button>
            </div>` : ''}

          ${s.plan && s.plan.length ? `<ul class="chips" data-reveal>${s.plan.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
          ${s.note ? `<p class="note" data-reveal>${esc(s.note)}</p>` : ''}

          ${seeHTML(s)}

          <div class="ch-tools" data-reveal>
            <button class="mini" type="button" data-offline="${esc(s.id)}">${I.download}Offline map</button>
            ${walletFor(s.id).length ? `<a class="mini" href="#wallet">${I.ticket}${walletFor(s.id).length} in wallet</a>` : ''}
          </div>

          ${top ? `
            <a class="to-guide" href="#guide" data-guide-stop="${esc(s.id)}" data-reveal>
              <span><small>Don’t miss</small>${esc(top.name)}</span>
              <span class="to-guide-n">${g.picks.length} picks ${I.arrow}</span>
            </a>` : ''}

          ${s.cost ? `
            <div class="cost" data-reveal>
              <span><b>${money(costOf(s).total)}</b>total</span>
              <span><b>${money(costOf(s).each)}</b>each</span>
            </div>` : ''}
        </div>
      </article>`;
  }

  // What we're going to see here: anything saved in the Guide, then the must-dos.
  function seeHTML(s) {
    const picks = guideFor(s.id).picks || [];
    const cats = DATA.guide.cats || {};
    const saved = picks.filter((p) => state.saved[pickKey(s.id, p)]);
    const must = picks.filter((p) => !state.saved[pickKey(s.id, p)] && (p.top || (p.tags || []).includes('must')));
    const list = saved.concat(must);
    if (!list.length) return '';
    return `
      <div class="see card" data-reveal>
        <div class="see-head">
          <span class="eyebrow">What we’ll see</span>
          ${saved.length ? `<span class="see-count">${I.heart}${saved.length} saved</span>` : ''}
        </div>
        <ul>
          ${list.map((p) => {
            const isSaved = !!state.saved[pickKey(s.id, p)];
            return `
              <li>
                <span class="see-cat">${esc(cats[p.cat] || p.cat)}</span>
                <span class="see-name">${esc(p.name)}${isSaved ? `<span class="see-heart" title="Saved">${I.heart}</span>` : ''}</span>
                ${p.map ? `<a class="see-map" href="${mapsUrl(p.map)}" target="_blank" rel="noopener" aria-label="Map for ${esc(p.name)}">${I.pin}</a>` : ''}
              </li>`;
          }).join('')}
        </ul>
      </div>`;
  }

  function legBand(leg) {
    if (!leg) return '';
    const sub = [leg.when, leg.detail].filter(Boolean).map(esc).join(' · ');
    return `
      <div class="leg-band" data-mode="${esc(leg.mode)}" data-reveal>
        <span class="leg-line"></span>
        <div class="leg-pill">
          <span class="leg-icon">${I[leg.mode] || I.bus}</span>
          <span class="leg-text"><b>${esc(leg.title)}</b><span>${sub}</span></span>
        </div>
      </div>`;
  }

  function renderTrip() {
    const trip = DATA.trip;
    const stops = trip.stops;
    const { booked, total } = bookedCount();
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    const tp = todayPlan();
    const tpStop = tp && stopById(tp.g.id);

    const install = isIOS && !standalone && !state.hint ? `
      <div class="install">
        <p>Tap <b>Share</b>, then <b>Add to Home Screen</b> to keep this on your phone. Works offline too.</p>
        <button class="icon-btn" type="button" data-hint-close aria-label="Dismiss">${I.x}</button>
      </div>` : '';

    const todayCard = tp ? `
      <section class="today-plan" data-region="${tpStop ? slug(tpStop.region) : ''}">
        ${dayCard(tp.dy, tp.n, { label: `Today in ${tpStop ? tpStop.name : ''}` })}
        <a class="to-guide" href="#guide" data-guide-stop="${esc(tp.g.id)}"><span><small>More ideas</small>Open the guide for ${esc(tpStop ? tpStop.name : 'here')}</span><span class="to-guide-n">${I.arrow}</span></a>
      </section>` : '';

    const hanoiIdx = stops.findIndex((s) => s.id === 'hanoi');
    const onTrip = today() >= toDate(trip.start) && today() <= toDate(trip.end);

    if (onTrip) {
      $('#view-trip').innerHTML = todayModeHTML() + install + tripBodyHTML(stops, booked, total, hanoiIdx);
      setupTripFx();
      return;
    }

    $('#view-trip').innerHTML = `
      <section class="hero" data-hero>
        <div class="hero-media">
          <img alt="" fetchpriority="high" src="${photo(trip.photos.hero, 1600)}" srcset="${srcset(trip.photos.hero)}" sizes="100vw">
        </div>
        <div class="hero-shade"></div>
        <div class="hero-inner">
          <div class="hero-top">
            <span class="eyebrow light">${range(trip.start, trip.end)} 2027</span>
            <button class="icon-btn glass" type="button" data-share aria-label="Share with the group">${I.share}</button>
          </div>
          <div class="hero-copy">
            <h1 class="hero-title" aria-label="Việt Nam">${letters('Việt', 0)} ${letters('Nam', 4, 'grad')}</h1>
            ${clockHTML()}
          </div>
          <button class="scroll-cue" type="button" data-scroll-cue aria-label="Scroll down">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
      </section>

      ${todayCard}
      ${install}
      ${tripBodyHTML(stops, booked, total, hanoiIdx)}`;

    setupTripFx();
  }

  function tripBodyHTML(stops, booked, total, hanoiIdx) {
    const trip = DATA.trip;
    return `
      ${marqueeHTML()}

      <section class="numbers">
        <div class="num" data-reveal><b data-count="${daysBetween(toDate(trip.start), toDate(trip.end))}">0</b><span>nights</span></div>
        <div class="num" data-reveal><b data-count="${stops.length}">0</b><span>stops</span></div>
        <div class="num" data-reveal><b data-count="${trip.km || 3000}" data-suffix="+">0</b><span>kilometres</span></div>
        <div class="num" data-reveal><b data-booked-count>${booked}/${total}</b><span>stays booked</span></div>
      </section>

      ${highlightsHTML()}

      ${storyHTML()}

      <section class="chapters">
        <header class="section-head" data-reveal>
          <h2>Stops</h2>
        </header>
        <nav class="route" aria-label="Jump to a stop">
          ${stops.map((s) => `<button type="button" data-jump="${esc(s.id)}" data-region="${slug(s.region)}"><i></i>${esc(s.id === 'saigon' ? 'Sài Gòn' : s.id === 'hanoi-last' ? 'Hà Nội, last night' : s.name)}</button>`).join('')}
        </nav>
        ${stops.map((s, i) => (i === hanoiIdx ? tetHTML() : '') + chapterHTML(s, i) + legBand(s.next)).join('')}
      </section>

      <section class="outro" data-reveal>
        <span class="eyebrow">${dayLabel(trip.end)}</span>
        <h2>Home</h2>
        <div class="outro-actions">
          <a class="btn" href="#guide">Open the guide</a>
          <button class="btn ghost" type="button" data-share>Share with the group</button>
        </div>
        <p class="foot">Prices in AUD · temperatures are the usual high and low · ${esc(trip.photos.credit || '')}</p>
      </section>`;
  }

  // ---------- Guide ----------

  function pickHTML(stopId, p, opts = {}) {
    const key = pickKey(stopId, p);
    const saved = !!state.saved[key];
    const tags = p.tags || [];
    const cats = DATA.guide.cats || {};
    const meta = [];
    if (p.vnd) meta.push(`<span class="price"><b>${dong(p.vnd)}</b>&nbsp;≈&nbsp;${toAud(p.vnd)}</span>`);
    else if (p.price) meta.push(`<span class="price">${esc(p.price)}</span>`);
    if (p.when) meta.push(`<span>${I.clock}${esc(p.when)}</span>`);
    if (p.vnd && p.price) meta.push(`<span class="price-note">${esc(p.price)}</span>`);

    return `
      <article class="pick${opts.top ? ' top' : ''}" data-cat="${esc(p.cat)}" data-reveal>
        <div class="pick-top">
          ${opts.top ? '<span class="pick-flag">Don’t miss</span>' : `<span class="pick-cat">${esc(cats[p.cat] || p.cat)}</span>`}
          ${opts.stopName ? `<span class="pick-where">${esc(opts.stopName)}</span>` : ''}
          ${tags.includes('must') && !opts.top ? '<span class="badge must">Must</span>' : ''}
          ${tags.includes('free') ? '<span class="badge free">Free</span>' : ''}
        </div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.what)}</p>
        ${meta.length ? `<div class="pick-meta">${meta.join('')}</div>` : ''}
        <div class="pick-actions">
          ${p.map ? `<a class="mini" href="${mapsUrl(p.map)}" target="_blank" rel="noopener">${I.pin}Map</a>` : ''}
          <button class="mini save" type="button" data-save="${esc(key)}" aria-pressed="${saved}">${I.heart}<span>${saved ? 'Saved' : 'Save'}</span></button>
        </div>
      </article>`;
  }

  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function dayCard(dy, n, opts = {}) {
    const isToday = dy.date === iso(today());
    return `
      <article class="day${isToday ? ' today' : ''}">
        <div class="day-head">
          <span class="day-n">${opts.label || `Day ${n}`}</span>
          <span class="day-date">${dayLabel(dy.date)}</span>
        </div>
        <h4>${esc(dy.title)}</h4>
        <ol>${dy.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ol>
      </article>`;
  }

  function daysHTML(g) {
    if (!g.days || !g.days.length) return '';
    return `
      <section class="days" data-reveal>
        <div class="days-top">
          <span class="eyebrow">How we’d do it</span>
          <span class="days-hint">${g.days.length} ${g.days.length === 1 ? 'day' : 'days'}${g.days.length > 1 ? ' · swipe' : ''}</span>
        </div>
        <div class="days-scroll">${g.days.map((dy, i) => dayCard(dy, i + 1)).join('')}</div>
      </section>`;
  }

  // During the trip, whatever's planned for today.
  function todayPlan() {
    const t = iso(today());
    for (const g of DATA.guide.stops || []) {
      const i = (g.days || []).findIndex((dy) => dy.date === t);
      if (i >= 0) return { g, dy: g.days[i], n: i + 1 };
    }
    return null;
  }

  function savedList() {
    const out = [];
    DATA.trip.stops.forEach((s) => {
      (guideFor(s.id).picks || []).forEach((p) => {
        if (state.saved[pickKey(s.id, p)]) out.push({ s, p });
      });
    });
    return out;
  }

  function renderGuide() {
    const stops = DATA.trip.stops;
    if (!state.guideStop || !stopById(state.guideStop)) state.guideStop = focusStop().id;
    const s = stopById(state.guideStop);
    const g = guideFor(s.id);
    const cats = DATA.guide.cats || {};
    const nSaved = savedList().length;
    const mode = state.guideMode;

    const modes = `
      <div class="seg seg-3" role="group" aria-label="Guide sections">
        <button type="button" data-gmode="places" aria-pressed="${mode === 'places'}">Places</button>
        <button type="button" data-gmode="saved" aria-pressed="${mode === 'saved'}">Saved${nSaved ? ` · ${nSaved}` : ''}</button>
        <button type="button" data-gmode="talk" aria-pressed="${mode === 'talk'}">Phrases</button>
      </div>`;

    let body = '';

    if (mode === 'places') {
      const top = g.picks.find((p) => p.top);
      const rest = g.picks.filter((p) => !p.top);
      const present = Object.keys(cats).filter((c) => rest.some((p) => p.cat === c));
      if (state.guideCat !== 'all' && !present.includes(state.guideCat)) state.guideCat = 'all';
      const shown = state.guideCat === 'all' ? rest : rest.filter((p) => p.cat === state.guideCat);

      body = `<div data-region="${slug(s.region)}">
        <nav class="route guide-stops" aria-label="Pick a stop">
          ${stops.map((x) => `<button type="button" data-gstop="${esc(x.id)}" data-region="${slug(x.region)}" aria-pressed="${x.id === s.id}"><i></i>${esc(x.id === 'saigon' ? 'Sài Gòn' : x.id === 'hanoi-last' ? 'Hà Nội, last night' : x.name)}</button>`).join('')}
        </nav>

        <section class="g-hero${s.photo ? ' has-photo' : ''}" data-region="${slug(s.region)}">
          ${s.photo ? `<img alt="" src="${photo(s.photo, 1080)}" srcset="${srcset(s.photo)}" sizes="(min-width: 760px) 1100px, 100vw">` : ''}
          <div class="g-hero-text">
            <span class="eyebrow">${shortRange(s.from, s.to)} · ${nightsOf(s)} ${nightsOf(s) === 1 ? 'night' : 'nights'}${s.temp ? ` · ${s.temp[0]}°/${s.temp[1]}°` : ''}</span>
            <h2>${esc(s.id === 'hanoi-last' ? 'Hà Nội, last night' : s.name)}</h2>
          </div>
        </section>
        ${g.intro ? `<p class="g-intro">${esc(g.intro)}</p>` : ''}

        ${daysHTML(g)}

        ${top ? pickHTML(s.id, top, { top: true }) : ''}

        ${present.length > 1 ? `
          <div class="filters" role="group" aria-label="Filter">
            <button type="button" data-gcat="all" aria-pressed="${state.guideCat === 'all'}">All <span>${rest.length}</span></button>
            ${present.map((c) => `<button type="button" data-gcat="${c}" aria-pressed="${state.guideCat === c}">${esc(cats[c])} <span>${rest.filter((p) => p.cat === c).length}</span></button>`).join('')}
          </div>` : ''}

        <div class="picks">${shown.map((p) => pickHTML(s.id, p)).join('')}</div>

        ${g.tips && g.tips.length ? `
          <aside class="tips card" data-reveal>
            <span class="eyebrow">Good to know</span>
            <ul>${g.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          </aside>` : ''}
      </div>`;
    }

    if (mode === 'saved') {
      const list = savedList();
      body = list.length
        ? `<div class="picks">${list.map(({ s: st, p }) => pickHTML(st.id, p, { stopName: st.id === 'saigon' ? 'Sài Gòn' : st.name })).join('')}</div>`
        : `<div class="empty card">
            <span class="empty-icon">${I.heart}</span>
            <p><b>Nothing saved yet.</b> Tap Save on a place to add it here.</p>
          </div>`;
    }

    if (mode === 'talk') {
      body = `
        <section class="group">
          <h2>Say it like a local</h2>
          <div class="phrases">
            ${(DATA.guide.phrases || []).map((p) => `
              <div class="phrase" data-reveal>
                <b lang="vi">${esc(p.vi)}</b>
                <span class="say">${esc(p.say)}</span>
                <span class="en">${esc(p.en)}</span>
              </div>`).join('')}
          </div>
        </section>
        <section class="group">
          <h2>House rules</h2>
          <div class="rules">
            ${(DATA.guide.rules || []).map((r) => `
              <div class="rule card" data-reveal>
                <h3>${esc(r.title)}</h3>
                <p>${esc(r.text)}</p>
              </div>`).join('')}
          </div>
        </section>`;
    }

    $('#view-guide').innerHTML = `
      <header class="page-head">
        <h1>Guide</h1>
      </header>
      ${modes}
      ${body}
      <p class="foot">Prices are rough and change. ≈ A$ uses ₫${Math.round(rate()).toLocaleString('en-AU')} to the dollar.</p>`;
  }

  // ---------- To-do ----------

  function todoGroups() {
    const p = person();
    const trip = p && p.trip;
    const groups = DATA.checklist.groups
      .map((g) => ({ name: g.name, items: g.items.filter((it) => !it.for || !trip || it.for === trip) }))
      .filter((g) => g.items.length);
    const own = mine().custom;
    if (own.length) {
      groups.unshift({ name: 'Your own', items: own.map((c) => Object.assign({ custom: true }, c)) });
    }
    return groups;
  }

  function todoCounts() {
    let total = 0;
    let done = 0;
    let ready = 0;
    if (!state.me) return { total, done, ready, left: 0 };
    const m = mine();
    todoGroups().forEach((g) => g.items.forEach((it) => {
      total += 1;
      if (m.cleared[it.id]) done += 1;
      else if (m.done[it.id]) { done += 1; ready += 1; }
    }));
    return { total, done, ready, left: total - done };
  }

  function peopleHTML() {
    return `
      <div class="people" role="group" aria-label="Whose list">
        ${(DATA.checklist.people || []).map((p) => `
          <button type="button" data-person="${esc(p.name)}" aria-pressed="${p.name === state.me}">
            <span class="initial" aria-hidden="true">${esc(p.name.charAt(0))}</span>${esc(p.name)}
          </button>`).join('')}
      </div>`;
  }

  function itemHTML(it) {
    const checked = !!mine().done[it.id];
    return `
      <li class="item">
        <label>
          <input type="checkbox" data-item="${esc(it.id)}"${checked ? ' checked' : ''}>
          <span class="box">${I.check}</span>
          <span class="item-text">
            <span class="t">${esc(it.text)}</span>
            ${it.detail ? `<small>${esc(it.detail)}</small>` : ''}
          </span>
        </label>
        ${it.custom ? `<button class="remove" type="button" data-remove="${esc(it.id)}" aria-label="Delete">${I.x}</button>` : ''}
      </li>`;
  }

  function ringHTML(c) {
    const pct = c.total ? c.done / c.total : 0;
    const r = 26;
    const len = 2 * Math.PI * r;
    return `
      <div class="ring" aria-hidden="true">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg" data-ring stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${(len * (1 - pct)).toFixed(1)}"/></svg>
        <span data-ring-pct>${Math.round(pct * 100)}%</span>
      </div>`;
  }

  function renderTodo() {
    if (!state.me) {
      $('#view-todo').innerHTML = `
        <header class="page-head">
          <span class="eyebrow">Before we go</span>
          <h1>To-do</h1>
          <p>Tap your name to open your list.</p>
        </header>
        ${peopleHTML()}`;
      return;
    }

    const c = todoCounts();
    const m = mine();
    const p = person();
    const stays = bookedCount();
    const groups = todoGroups();
    const clearedItems = [];
    groups.forEach((g) => g.items.forEach((it) => { if (m.cleared[it.id]) clearedItems.push(it); }));

    const groupsHTML = groups.map((g) => {
      const open = g.items.filter((it) => !m.cleared[it.id]);
      return `
        <section class="group">
          <h2>${esc(g.name)}</h2>
          <ul class="list">${open.length ? open.map(itemHTML).join('') : '<li class="all-done">Done</li>'}</ul>
        </section>`;
    }).join('');

    const clearedHTML = clearedItems.length ? `
      <details class="cleared">
        <summary>Cleared · ${clearedItems.length}</summary>
        <ul class="list">
          ${clearedItems.map((it) => `<li><span>${esc(it.text)}</span><button type="button" data-restore="${esc(it.id)}">Put back</button></li>`).join('')}
        </ul>
        <button class="btn ghost" type="button" data-restore-all>Put them all back</button>
      </details>` : '';

    const tripNote = p && p.trip
      ? (DATA.budget.plans.find((x) => x.id === p.trip) || {}).label
      : null;

    $('#view-todo').innerHTML = `
      <header class="page-head">
        <span class="eyebrow">Before we go</span>
        <h1>To-do</h1>
      </header>

      ${peopleHTML()}

      <div class="mine card">
        ${ringHTML(c)}
        <div>
          <p class="mine-name">${esc(state.me)}${tripNote ? ` <span>· ${esc(tripNote)}</span>` : ''}</p>
          <p data-todo-summary>${summaryText(c)}</p>
        </div>
      </div>

      <div class="todo-tools">
        <button class="btn" type="button" data-clear-done${c.ready ? '' : ' disabled'}>Clear done${c.ready ? ` (${c.ready})` : ''}</button>
        <a class="btn ghost" href="#trip">Stays booked ${stays.booked}/${stays.total}</a>
      </div>

      <form class="add" data-add autocomplete="off">
        <input type="text" name="text" maxlength="90" placeholder="Add something" aria-label="Add a to-do">
        <button class="btn" type="submit">Add</button>
      </form>

      ${groupsHTML}
      ${clearedHTML}

      <p class="foot sync-foot"><span data-sync></span></p>`;
  }

  function summaryText(c) {
    if (!c.total) return 'Nothing on the list.';
    if (c.left === 0) return 'All done';
    return `${c.done} of ${c.total} done, ${c.left} to go`;
  }

  function updateTodoMeta() {
    const c = todoCounts();
    const sum = $('[data-todo-summary]');
    const ring = $('[data-ring]');
    const pctEl = $('[data-ring-pct]');
    const btn = $('[data-clear-done]');
    if (sum) sum.textContent = summaryText(c);
    if (ring) {
      const len = parseFloat(ring.getAttribute('stroke-dasharray'));
      ring.setAttribute('stroke-dashoffset', (len * (1 - (c.total ? c.done / c.total : 0))).toFixed(1));
    }
    if (pctEl) pctEl.textContent = `${Math.round((c.total ? c.done / c.total : 0) * 100)}%`;
    if (btn) {
      btn.disabled = !c.ready;
      btn.textContent = c.ready ? `Clear done (${c.ready})` : 'Clear done';
    }
    const badge = $('.tab-badge');
    badge.hidden = !state.me || c.left === 0;
    badge.textContent = c.left;
  }

  // ---------- Money ----------

  function converterHTML() {
    const r = rate();
    const live = state.rate && state.rate.v;
    const when = live ? new Date(state.rate.t) : null;
    return `
      <section class="convert card" data-reveal>
        <div class="convert-head">
          <span class="eyebrow">Price check</span>
          <button class="icon-btn small" type="button" data-conv-flip aria-label="Swap currencies">${I.swap}</button>
        </div>
        <label class="conv-in">
          <span data-conv-from>${state.convFlip ? 'A$' : '₫'}</span>
          <input type="text" inputmode="decimal" data-conv value="${state.convFlip ? '20' : '100,000'}" aria-label="Amount">
        </label>
        <div class="conv-out"><span data-conv-to>${state.convFlip ? '₫' : 'A$'}</span><b data-conv-result></b></div>
        <div class="quick">
          ${(state.convFlip ? [5, 10, 20, 50, 100] : [20000, 50000, 100000, 200000, 500000])
            .map((v) => `<button type="button" data-quick="${v}">+${state.convFlip ? 'A$' + v : dong(v).replace('.0k', 'k')}</button>`).join('')}
          <button type="button" class="q-clear" data-conv-clear>Clear</button>
        </div>
        <small>₫${Math.round(r).toLocaleString('en-AU')} to A$1${live ? ` · live rate, ${when.getDate()} ${MON[when.getMonth()]}` : ' · rough rate'}</small>
      </section>`;
  }

  function convValue(v) {
    const raw = String(v).toLowerCase().replace(/,/g, '').trim();
    let n = parseFloat(raw);
    if (/k$/.test(raw)) n *= 1e3;
    if (/m$/.test(raw)) n *= 1e6;
    return isFinite(n) ? n : 0;
  }

  function runConvert() {
    const input = $('[data-conv]');
    const out = $('[data-conv-result]');
    if (!input || !out) return;
    const raw = input.value.toLowerCase().replace(/,/g, '').trim();
    let n = parseFloat(raw);
    if (/k$/.test(raw)) n *= 1e3;
    if (/m$/.test(raw)) n *= 1e6;
    if (!isFinite(n)) { out.textContent = '–'; return; }
    out.textContent = state.convFlip
      ? Math.round(n * rate()).toLocaleString('en-AU')
      : (n / rate()).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Budget lines, with any edits made on this phone.
  function planItems(p) {
    const own = state.budgets && state.budgets[p.id];
    return own || p.items.map((it) => ({ name: it.name, amount: it.amount }));
  }

  function editItems(p) {
    if (!state.budgets) state.budgets = {};
    if (!state.budgets[p.id]) state.budgets[p.id] = planItems(p);
    return state.budgets[p.id];
  }

  function currentPlan() {
    const plans = DATA.budget.plans;
    return plans.find((x) => x.id === state.plan) || plans[0];
  }

  // Stop costs, with any edits made on this phone.
  function costOf(s) {
    const each = state.stopCosts && state.stopCosts[s.id];
    if (each == null) return s.cost;
    return { each, total: Math.round(each * s.people * 100) / 100 };
  }

  const toNum = (v) => {
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  };

  function budgetTotals() {
    const p = currentPlan();
    const total = planItems(p).reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    const t = $('[data-btotal]');
    const all = $('[data-ball]');
    if (t) t.textContent = money(total);
    if (all) all.textContent = `${money(total * p.people)} across the ${p.people} of us`;
  }

  function renderBudget() {
    const plans = DATA.budget.plans;
    const p = currentPlan();
    const items = planItems(p);
    const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    const max = Math.max(1, ...items.map((it) => Number(it.amount) || 0));
    const stops = DATA.trip.stops.filter((s) => s.cost);
    const edit = !!state.budgetEdit;
    const edited = !!(state.budgets && state.budgets[p.id]) || !!(state.stopCosts && Object.keys(state.stopCosts).length);

    const itemRows = edit
      ? `<ul class="rows edit">
          ${items.map((it, i) => `
            <li class="erow">
              <input class="e-name" type="text" data-bname="${i}" value="${esc(it.name)}" aria-label="Expense name" maxlength="40">
              <label class="e-amt"><span>$</span><input type="text" inputmode="decimal" data-bamt="${i}" value="${esc(it.amount)}" aria-label="Amount for ${esc(it.name)}"></label>
              <button class="e-del" type="button" data-bdel="${i}" aria-label="Remove ${esc(it.name)}">${I.x}</button>
            </li>`).join('')}
          <li class="erow add-row"><button class="e-add" type="button" data-badd>+ Add an expense</button></li>
        </ul>`
      : `<ul class="rows">
          ${items.map((it) => `
            <li>
              <div class="row-top"><span>${esc(it.name)}</span><b>${money(Number(it.amount) || 0)}</b></div>
              <div class="bar"><span style="--w:${((Number(it.amount) || 0) / max) * 100}%"></span></div>
            </li>`).join('')}
        </ul>`;

    const stopRows = stops.map((s) => {
      const c = costOf(s);
      return edit
        ? `<li class="erow" data-region="${slug(s.region)}">
            <span class="e-label"><i></i>${esc(s.name)}</span>
            <label class="e-amt"><span>$</span><input type="text" inputmode="decimal" data-scost="${esc(s.id)}" value="${esc(c.each)}" aria-label="Cost each for ${esc(s.name)}"></label>
            <small class="e-each">each</small>
          </li>`
        : `<li data-region="${slug(s.region)}">
            <span><i></i>${esc(s.name)}</span>
            <span><b>${money(c.each)}</b><small>each</small></span>
          </li>`;
    }).join('');

    $('#view-budget').innerHTML = `
      <header class="page-head">
        <span class="eyebrow">Per person, AUD</span>
        <h1>Money</h1>
      </header>

      ${converterHTML()}

      <section class="group">
        <h2>Budget</h2>
        <div class="seg" role="group" aria-label="Which trip">
          ${plans.map((x) => `<button type="button" data-plan="${esc(x.id)}" aria-pressed="${x.id === p.id}">${esc(x.label)} · ${x.people}</button>`).join('')}
        </div>

        <div class="total">
          <span class="eyebrow">Each, ${esc(p.dates)}</span>
          <b data-btotal>${money(total)}</b>
          <span data-ball>${money(total * p.people)} across the ${p.people} of us</span>
        </div>
      </section>

      <section class="group">
        <div class="group-head">
          <h2>Where it goes</h2>
          <button class="link-btn" type="button" data-bedit>${edit ? 'Done' : 'Edit'}</button>
        </div>
        <div class="list">${itemRows}</div>
      </section>

      <section class="group">
        <div class="group-head">
          <h2>By stop</h2>
          ${edit ? '' : '<button class="link-btn" type="button" data-bedit>Edit</button>'}
        </div>
        <div class="list">
          <ul class="rows by-stop${edit ? ' edit' : ''}">${stopRows}</ul>
        </div>
      </section>

      ${edit ? '<button class="btn wide" type="button" data-bedit>Done</button>' : ''}
      ${edited ? `
        <div class="edited-note">
          <span data-sync></span>
          <button class="link-btn" type="button" data-breset>Reset to the plan</button>
        </div>` : ''}

      <p class="foot">Hà Giang includes the loop tour, not just beds.</p>`;
    runConvert();
  }

  function fetchRate() {
    const fresh = state.rate && Date.now() - state.rate.t < 6 * 36e5;
    if (fresh) return;
    fetch('https://open.er-api.com/v6/latest/AUD')
      .then((r) => r.json())
      .then((d) => {
        const v = d && d.rates && d.rates.VND;
        if (!v) return;
        state.rate = { v, t: Date.now() };
        save();
        if (!$('#view-budget').hidden) renderBudget();
        if (!$('#view-guide').hidden) renderGuide();
      })
      .catch(() => {});
  }

  // ---------- motion ----------

  let io = null;
  function reveal() {
    const els = $$('[data-reveal]:not(.in)');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px' });
    }
    els.forEach((el) => io.observe(el));
  }

  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  let stepIO = null;
  let countIO = null;
  let words = [];

  // Light up the map up to stop k.
  function setStep(k) {
    $$('.step').forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === k));
    $$('.m-leg').forEach((el) => el.classList.toggle('on', Number(el.dataset.leg) < k));
    $$('.m-stop').forEach((el) => {
      const idx = el.dataset.idx.split(' ').map(Number);
      el.classList.toggle('active', idx.includes(k));
      el.classList.toggle('past', !idx.includes(k) && Math.min(...idx) < k);
    });
  }

  function countUp(el) {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = target.toLocaleString('en-AU') + suffix; return; }
    const t0 = performance.now();
    const dur = 1400;
    const step = (now) => {
      const p = clamp((now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e).toLocaleString('en-AU') + (p === 1 ? suffix : '');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setupTripFx() {
    words = $$('[data-words] .w');
    if (stepIO) stepIO.disconnect();
    if (countIO) countIO.disconnect();

    if ('IntersectionObserver' in window) {
      stepIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) setStep(Number(en.target.dataset.step)); });
      }, { rootMargin: '-48% 0px -42% 0px' });
      $$('.step').forEach((el) => stepIO.observe(el));

      countIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { countUp(en.target); countIO.unobserve(en.target); }
        });
      }, { threshold: 0.6 });
      $$('[data-count]').forEach((el) => countIO.observe(el));
    } else {
      $$('[data-count]').forEach((el) => { el.textContent = el.dataset.count + (el.dataset.suffix || ''); });
    }
    setStep(0);
    sizePin();
    startMarquee();
    scrollFx();
  }

  // The highlights gallery pins in place and slides sideways as you scroll down.
  let pinOver = 0;
  function sizePin() {
    const sec = $('[data-hpin]');
    if (!sec) return;
    const track = $('.hl-scroll', sec);
    const pinned = !reduceMotion && window.innerWidth < 1600;
    sec.classList.toggle('pinned', pinned);
    if (!pinned) { sec.style.height = ''; track.style.transform = ''; return; }
    sec.style.height = '';
    pinOver = Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
    sec.style.height = `${pinOver + window.innerHeight}px`;
  }

  // Place names drifting across the screen. Scrolling speeds them up and sets the direction.
  let mq = { x: 0, v: 0, dir: 1, raf: 0, on: false, io: null };
  function startMarquee() {
    const el = $('[data-marquee]');
    if (mq.io) mq.io.disconnect();
    cancelAnimationFrame(mq.raf);
    if (!el || reduceMotion) return;
    const track = $('.mq-track', el);
    mq.io = new IntersectionObserver(([en]) => { mq.on = en.isIntersecting; }, { rootMargin: '100px 0px' });
    mq.io.observe(el);
    const loop = () => {
      if (mq.on && !$('#view-trip').hidden) {
        const half = track.scrollWidth / 2;
        mq.x -= (0.6 + Math.min(mq.v, 40) * 0.35) * mq.dir;
        if (mq.x <= -half) mq.x += half;
        if (mq.x > 0) mq.x -= half;
        const skew = clamp(mq.v * 0.25, 0, 8) * -mq.dir;
        track.style.transform = `translate3d(${mq.x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
      }
      mq.v *= 0.92;
      mq.raf = requestAnimationFrame(loop);
    };
    mq.raf = requestAnimationFrame(loop);
  }

  // Scroll-linked effects: hero zoom and fade, words lighting up, photo parallax.
  let lastY = window.scrollY;
  function scrollFx() {
    const vh = window.innerHeight;
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;

    // Tab bar tucks itself away while you scroll down, comes back when you scroll up.
    const bar = $('.tabbar');
    if (bar) {
      if (dy > 6 && y > 240) bar.classList.add('min');
      else if (dy < -6 || y < 120) bar.classList.remove('min');
    }
    mq.v = Math.abs(dy);
    if (dy) mq.dir = dy > 0 ? 1 : -1;

    const line = $('.scroll-line');
    const docH = document.documentElement.scrollHeight - vh;
    if (line) line.style.transform = `scaleX(${docH > 0 ? clamp(y / docH).toFixed(4) : 0})`;

    if ($('#view-trip').hidden) return;

    const hero = $('[data-hero]');
    if (hero) hero.style.setProperty('--p', clamp(y / (hero.offsetHeight * 0.85)).toFixed(3));

    const pin = $('[data-hpin].pinned');
    if (pin && pinOver) {
      const r = pin.getBoundingClientRect();
      const prog = clamp(-r.top / Math.max(1, r.height - vh));
      $('.hl-scroll', pin).style.transform = `translate3d(${(-prog * pinOver).toFixed(1)}px,0,0)`;
      const bar2 = $('.hl-progress span', pin);
      if (bar2) bar2.style.transform = `scaleX(${prog.toFixed(3)})`;
    }

    if (!reduceMotion) {
      $$('.ch-photo').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top > vh + 50 || r.bottom < -50) return;
        el.style.setProperty('--rev', clamp((vh - r.top) / (vh * 0.75)).toFixed(3));
      });
    }

    const st = $('[data-words]');
    if (st && words.length) {
      const r = st.getBoundingClientRect();
      const prog = reduceMotion ? 1 : clamp((vh * 0.82 - r.top) / (r.height + vh * 0.25));
      const lit = Math.round(prog * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < lit));
    }

    if (!reduceMotion) {
      $$('[data-parallax]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        el.style.setProperty('--py', ((r.top + r.height / 2 - vh / 2) / vh).toFixed(3));
      });
    }
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; scrollFx(); });
  }, { passive: true });
  window.addEventListener('resize', () => { sizePin(); scrollFx(); }, { passive: true });

  // ---------- Today mode (during the trip) ----------

  function wordsLetters(text) {
    let n = 0;
    return text.split(' ').map((w) => {
      const out = letters(w, n);
      n += Array.from(w).length;
      return out;
    }).join(' ');
  }

  function whenLabel(days) {
    if (days <= 0) return 'today';
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
  }

  function todayModeHTML() {
    const trip = DATA.trip;
    const stops = trip.stops;
    const t = today();
    const start = toDate(trip.start);
    const end = toDate(trip.end);
    const day = daysBetween(start, t) + 1;
    const total = daysBetween(start, end) + 1;
    const here = currentStop();

    // Overnight legs fall between stops.
    let moving = null;
    if (!here) {
      const i = stops.findIndex((s, k) => stops[k + 1] && toDate(s.to) <= t && t < toDate(stops[k + 1].from));
      if (i >= 0) moving = { leg: stops[i].next, to: stops[i + 1] };
    }
    const focus = here || (moving && moving.to) || focusStop();
    const idx = stops.indexOf(focus);
    const tp = todayPlan();
    const g = guideFor(focus.id);
    const stays = walletFor(focus.id).filter((w) => w.type === 'Stay');
    const addr = stays.find((w) => w.address);
    const leaveIn = here ? daysBetween(t, toDate(here.to)) : null;
    const name = focus.id === 'hanoi-last' ? 'Hà Nội' : (focus.id === 'saigon' ? 'Sài Gòn' : focus.name.replace(' Loop', ''));

    return `
      <section class="hero today-hero" data-hero data-region="${slug(focus.region)}">
        <div class="hero-media">
          ${focus.photo ? `<img alt="" fetchpriority="high" src="${photo(focus.photo, 1600)}" srcset="${srcset(focus.photo)}" sizes="100vw">` : ''}
        </div>
        <div class="hero-shade"></div>
        <div class="hero-inner">
          <div class="hero-top">
            <span class="eyebrow light">Day ${day} of ${total} · ${dayLabel(iso(t))}</span>
            <button class="icon-btn glass" type="button" data-share aria-label="Share with the group">${I.share}</button>
          </div>
          <div class="hero-copy">
            <span class="eyebrow light">${moving ? 'On the move' : 'Today in'}</span>
            <h1 class="hero-title today-title" aria-label="${esc(name)}">${wordsLetters(name)}</h1>
          </div>
        </div>
      </section>

      <section class="today-panel" data-region="${slug(focus.region)}">
        ${moving && moving.leg ? `
          <div class="tcard move">
            <span class="leg-icon">${I[moving.leg.mode] || I.bus}</span>
            <div><span class="eyebrow">Travelling</span><b>${esc(moving.leg.title)}</b><small>${esc([moving.leg.when, moving.leg.detail].filter(Boolean).join(' · '))}</small></div>
          </div>` : ''}

        ${tp ? dayCard(tp.dy, tp.n, { label: 'The plan' }) : ''}

        ${focus.stay ? `
          <div class="tcard stay-now">
            <div class="tcard-head"><span class="eyebrow">${I.bed}Staying</span>${isBooked(focus) ? '<span class="pill ok">Booked</span>' : '<span class="pill">Not booked</span>'}</div>
            <b>${esc(addr ? addr.title : focus.stay.name)}</b>
            ${addr ? `<p class="addr" lang="vi">${esc(addr.address)}</p>` : '<p class="muted">No address saved yet. Add it in the Wallet so you can show a driver.</p>'}
            <div class="tcard-actions">
              ${addr ? `<button class="btn" type="button" data-driver="${esc(addr.id)}">${I.car2}Show driver</button>
                <a class="btn ghost" href="${mapsUrl(addr.address)}" target="_blank" rel="noopener">${I.pin}Map</a>`
                : `<a class="btn ghost" href="#wallet" data-wallet-new="${esc(focus.id)}">${I.ticket}Add address</a>`}
            </div>
          </div>` : ''}

        ${here && here.next ? `
          <div class="tcard next">
            <span class="leg-icon">${I[here.next.mode] || I.bus}</span>
            <div><span class="eyebrow">Next move · ${whenLabel(leaveIn)}</span><b>${esc(here.next.title)}</b><small>${esc([here.next.when, here.next.detail].filter(Boolean).join(' · '))}</small></div>
          </div>` : ''}

        <div class="today-actions">
          ${(g.picks || []).length ? `<a class="mini" href="#guide" data-guide-stop="${esc(focus.id)}">${I.pin}Guide for ${esc(name)}</a>` : ''}
          <button class="mini" type="button" data-offline="${esc(focus.id)}">${I.download}Offline map</button>
          <a class="mini" href="#wallet">${I.ticket}Wallet</a>
          <button class="mini" type="button" data-jump="${esc(focus.id)}">${I.arrow}Full plan</button>
        </div>
      </section>`;
  }

  // ---------- Sheet (pop-up card) ----------

  function openSheet(html, cls = '') {
    const sh = $('.sheet');
    sh.className = `sheet ${cls}`;
    $('.sheet-card', sh).innerHTML = `<button class="icon-btn small sheet-x" type="button" data-sheet-close aria-label="Close">${I.x}</button>${html}`;
    sh.hidden = false;
    requestAnimationFrame(() => sh.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    const sh = $('.sheet');
    sh.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { sh.hidden = true; }, 300);
  }

  function offlineSheet(id) {
    const s = stopById(id);
    if (!s) return;
    const [lat, lon] = s.at;
    const maps = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    openSheet(`
      <span class="eyebrow">Offline map</span>
      <h2>${esc(s.id === 'saigon' ? 'Sài Gòn' : s.name)}</h2>
      <p>Save this area in Google Maps so directions still work with no signal.</p>
      <ol class="steps">
        <li>Open Google Maps on this spot with the button below.</li>
        <li>Tap your profile picture, then <b>Offline maps</b>.</li>
        <li>Tap <b>Select your own map</b> and fit the box around ${esc(s.name)}.</li>
        <li>Tap <b>Download</b>. Do it on wifi before you go.</li>
      </ol>
      <a class="btn wide" href="${maps}" target="_blank" rel="noopener">${I.pin}Open Google Maps here</a>`);
  }

  // ---------- Wallet (this phone only, never synced) ----------

  const WALLET_TYPES = ['Flight', 'Stay', 'Transport', 'Booking', 'Other'];
  let walletEdit = null;

  function walletList() {
    if (!Array.isArray(state.wallet)) state.wallet = [];
    return state.wallet;
  }

  function walletFor(stopId) {
    return walletList().filter((w) => w.stop === stopId);
  }

  function walletFormHTML(w) {
    const stops = DATA.trip.stops;
    return `
      <form class="wform card" data-wallet-form autocomplete="off">
        <h3>${w.id ? 'Edit' : 'Add to wallet'}</h3>
        <div class="seg seg-types" role="group" aria-label="Type">
          ${WALLET_TYPES.map((t) => `<button type="button" data-wtype="${t}" aria-pressed="${w.type === t}">${t}</button>`).join('')}
        </div>
        <input type="hidden" name="type" value="${esc(w.type || 'Stay')}">
        <label class="field"><span>Name</span><input name="title" required maxlength="80" value="${esc(w.title || '')}" placeholder="e.g. Lan Anh Villas"></label>
        <label class="field"><span>Stop</span>
          <select name="stop">
            <option value="">None</option>
            ${stops.map((s) => `<option value="${esc(s.id)}"${w.stop === s.id ? ' selected' : ''}>${esc(s.id === 'hanoi-last' ? 'Hà Nội (last night)' : s.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>When</span><input name="when" maxlength="60" value="${esc(w.when || '')}" placeholder="e.g. 20 Jan, check-in 2pm"></label>
        <label class="field"><span>Booking ref</span><input name="ref" maxlength="40" value="${esc(w.ref || '')}" placeholder="Confirmation number"></label>
        <label class="field"><span>Address</span><textarea name="address" rows="2" maxlength="200" placeholder="Paste it in Vietnamese if you can">${esc(w.address || '')}</textarea></label>
        <label class="field"><span>Notes</span><textarea name="notes" rows="2" maxlength="300">${esc(w.notes || '')}</textarea></label>
        <input type="hidden" name="id" value="${esc(w.id || '')}">
        <div class="wform-actions">
          <button class="btn" type="submit">Save</button>
          <button class="btn ghost" type="button" data-wallet-cancel>Cancel</button>
        </div>
      </form>`;
  }

  function passHTML(w) {
    const s = w.stop ? stopById(w.stop) : null;
    return `
      <article class="pass" data-type="${esc(w.type)}" data-region="${s ? slug(s.region) : ''}" data-reveal>
        <div class="pass-top">
          <span class="pass-type">${esc(w.type)}${s ? ` · ${esc(s.id === 'saigon' ? 'Sài Gòn' : s.name)}` : ''}</span>
          ${w.when ? `<span class="pass-when">${esc(w.when)}</span>` : ''}
        </div>
        <h3>${esc(w.title)}</h3>
        ${w.ref ? `<div class="pass-ref"><span>Ref</span><b>${esc(w.ref)}</b></div>` : ''}
        ${w.address ? `<p class="addr" lang="vi">${esc(w.address)}</p>` : ''}
        ${w.notes ? `<p class="pass-notes">${esc(w.notes)}</p>` : ''}
        <div class="pass-actions">
          ${w.address ? `<button class="mini" type="button" data-driver="${esc(w.id)}">${I.car2}Show driver</button>
            <a class="mini" href="${mapsUrl(w.address)}" target="_blank" rel="noopener">${I.pin}Map</a>` : ''}
          <button class="mini" type="button" data-wallet-edit="${esc(w.id)}">${I.edit}Edit</button>
          <button class="mini danger" type="button" data-wallet-del="${esc(w.id)}" aria-label="Delete ${esc(w.title)}">${I.x}</button>
        </div>
      </article>`;
  }

  function renderWallet() {
    const list = walletList();
    const stops = DATA.trip.stops;
    const order = (w) => (w.stop ? stops.findIndex((s) => s.id === w.stop) : 99);
    const sorted = list.slice().sort((a, b) => order(a) - order(b));
    const missingStays = stops.filter((s) => s.stay && !list.some((w) => w.type === 'Stay' && w.stop === s.id));

    $('#view-wallet').innerHTML = `
      <header class="page-head">
        <span class="eyebrow">Only on this phone</span>
        <h1>Wallet</h1>
        <p>Flights, bookings and addresses. Stays on this phone and is never shared or uploaded.</p>
      </header>

      ${walletEdit ? walletFormHTML(walletEdit) : `
        <button class="btn wide" type="button" data-wallet-add>${I.ticket}Add something</button>
        ${missingStays.length ? `
          <section class="group">
            <h2>Add a stay address</h2>
            <div class="route quick-stays">
              ${missingStays.map((s) => `<button type="button" data-wallet-new="${esc(s.id)}" data-region="${slug(s.region)}"><i></i>${esc(s.id === 'saigon' ? 'Sài Gòn' : s.id === 'hanoi-last' ? 'Hà Nội, last night' : s.name)}</button>`).join('')}
            </div>
          </section>` : ''}`}

      ${sorted.length ? `
        <section class="group">
          <h2>Saved · ${sorted.length}</h2>
          <div class="passes">${sorted.map(passHTML).join('')}</div>
        </section>` : (walletEdit ? '' : `
        <div class="empty card">
          <span class="empty-icon">${I.ticket}</span>
          <p><b>Nothing here yet.</b> Add flight times, booking references and the address of each stay.</p>
        </div>`)}`;
  }

  function driverSheet(id) {
    const w = walletList().find((x) => x.id === id);
    if (!w || !w.address) return;
    openSheet(`
      <span class="eyebrow">Show the driver</span>
      <p class="driver-ask" lang="vi">Cho tôi đến địa chỉ này, cảm ơn!</p>
      <p class="driver-addr" lang="vi">${esc(w.address)}</p>
      <p class="driver-name">${esc(w.title)}</p>`, 'driver');
  }

  // ---------- Group sync (Supabase) ----------
  // Shared: stays booked, everyone's to-do lists, saved guide picks, budget edits, stop costs.
  // Never shared: the wallet, which person this phone is, and view settings.

  const sync = { cfg: null, last: {}, timer: 0, busy: false, ok: null, ready: false };

  function flat() {
    const o = {};
    Object.keys(state.booked || {}).forEach((k) => { o[`booked:${k}`] = !!state.booked[k]; });
    Object.keys(state.people || {}).forEach((k) => { if (k && k !== 'null') o[`todo:${k}`] = state.people[k]; });
    Object.keys(state.saved || {}).forEach((k) => { if (state.saved[k]) o[`saved:${k}`] = true; });
    Object.keys(state.budgets || {}).forEach((k) => { if (state.budgets[k]) o[`budget:${k}`] = state.budgets[k]; });
    Object.keys(state.stopCosts || {}).forEach((k) => { if (state.stopCosts[k] != null) o[`stopcost:${k}`] = state.stopCosts[k]; });
    const out = {};
    Object.keys(o).forEach((k) => { out[k] = JSON.stringify(o[k]); });
    return out;
  }

  function dirtyKeys() {
    const cur = flat();
    const keys = new Set([...Object.keys(cur), ...Object.keys(sync.last)]);
    return [...keys].filter((k) => (cur[k] || 'null') !== (sync.last[k] || 'null'));
  }

  function applyRow(key, value) {
    const i = key.indexOf(':');
    const kind = key.slice(0, i);
    const id = key.slice(i + 1);
    const gone = value === null || value === undefined;
    if (kind === 'booked') { if (gone) delete state.booked[id]; else state.booked[id] = !!value; }
    if (kind === 'todo') { if (gone) delete state.people[id]; else state.people[id] = value; }
    if (kind === 'saved') { if (gone || !value) delete state.saved[id]; else state.saved[id] = true; }
    if (kind === 'budget') { state.budgets = state.budgets || {}; if (gone) delete state.budgets[id]; else state.budgets[id] = value; }
    if (kind === 'stopcost') { state.stopCosts = state.stopCosts || {}; if (gone) delete state.stopCosts[id]; else state.stopCosts[id] = value; }
    sync.last[key] = JSON.stringify(gone ? null : value);
    return kind;
  }

  function headers(extra = {}) {
    const h = Object.assign({ apikey: sync.cfg.anonKey }, extra);
    if (/^eyJ/.test(sync.cfg.anonKey)) h.Authorization = `Bearer ${sync.cfg.anonKey}`;
    return h;
  }

  function queueSync() {
    if (!sync.cfg || !sync.ready) return;
    clearTimeout(sync.timer);
    sync.timer = setTimeout(push, 700);
  }

  async function push() {
    if (!sync.cfg || sync.busy) return;
    const cur = flat();
    const rows = dirtyKeys().map((k) => ({ key: k, value: JSON.parse(cur[k] || 'null') }));
    if (!rows.length) return;
    sync.busy = true;
    try {
      const r = await fetch(`${sync.cfg.url}/rest/v1/trip_state`, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(rows),
      });
      if (!r.ok) throw new Error(r.status);
      rows.forEach((row) => { sync.last[row.key] = JSON.stringify(row.value); });
      sync.ok = true;
    } catch (e) {
      sync.ok = false;
    } finally {
      sync.busy = false;
      syncBadge();
      if (dirtyKeys().length && sync.ok) queueSync();
    }
  }

  async function pull(first = false) {
    if (!sync.cfg || sync.busy) return;
    try {
      const r = await fetch(`${sync.cfg.url}/rest/v1/trip_state?select=key,value`, { headers: headers() });
      if (!r.ok) throw new Error(r.status);
      const rows = await r.json();
      const dirty = first ? new Set() : new Set(dirtyKeys());
      const kinds = new Set();
      rows.forEach((row) => {
        if (dirty.has(row.key)) return;
        if (!first && sync.last[row.key] === JSON.stringify(row.value)) return;
        kinds.add(applyRow(row.key, row.value));
      });
      try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ }
      sync.ok = true;
      sync.ready = true;
      if (kinds.size) refreshFor(kinds);
      if (first) push();
    } catch (e) {
      sync.ok = false;
    }
    syncBadge();
  }

  // Only redraw the screen a change affects, and never while someone is typing.
  function refreshFor(kinds) {
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
    const v = current();
    const hit = (v === 'trip' && (kinds.has('booked') || kinds.has('saved') || kinds.has('stopcost')))
      || (v === 'guide' && kinds.has('saved'))
      || (v === 'todo' && (kinds.has('todo') || kinds.has('booked')))
      || (v === 'budget' && (kinds.has('budget') || kinds.has('stopcost')));
    if (hit) { const y = window.scrollY; render(v); window.scrollTo(0, y); }
    updateTodoMeta();
  }

  function syncText() {
    if (!sync.cfg) return 'Saved on this phone';
    if (sync.ok === false) return 'Offline. Will sync when back online';
    if (sync.ok) return 'Synced with the group';
    return 'Connecting…';
  }

  function syncBadge() {
    $$('[data-sync]').forEach((el) => {
      el.textContent = syncText();
      el.dataset.state = !sync.cfg ? 'local' : (sync.ok ? 'ok' : 'off');
    });
  }

  function startSync(cfg) {
    if (!cfg || !cfg.url || !cfg.anonKey) { syncBadge(); return; }
    sync.cfg = { url: cfg.url.replace(/\/$/, ''), anonKey: cfg.anonKey };
    pull(true);
    setInterval(() => { if (!document.hidden) pull(); }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
    window.addEventListener('online', () => pull());
  }

  // ---------- routing ----------

  function current() {
    const name = location.hash.slice(1);
    return VIEWS.includes(name) ? name : 'trip';
  }

  function render(view) {
    if (view === 'trip') renderTrip();
    if (view === 'guide') renderGuide();
    if (view === 'todo') renderTodo();
    if (view === 'budget') renderBudget();
    if (view === 'wallet') renderWallet();
    syncBadge();
    reveal();
  }

  function route() {
    const view = current();
    VIEWS.forEach((v, i) => {
      $(`#view-${v}`).hidden = v !== view;
      const tab = $(`.tab[data-tab="${v}"]`);
      if (v === view) {
        tab.setAttribute('aria-current', 'page');
        $('.tabbar').style.setProperty('--i', i);
      } else tab.removeAttribute('aria-current');
    });
    render(view);
    window.scrollTo(0, 0);
  }

  function rerender() {
    render(current());
  }

  // ---------- toast ----------

  let toastTimer;
  function toast(msg) {
    const el = $('.toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- events ----------

  const ACTIONS = '[data-book],[data-jump],[data-share],[data-hint-close],[data-clear-done],[data-restore],[data-restore-all],[data-remove],[data-plan],[data-person],[data-gstop],[data-gcat],[data-gmode],[data-save],[data-guide-stop],[data-quick],[data-conv-clear],[data-conv-flip],[data-scroll-cue],[data-bedit],[data-bdel],[data-badd],[data-breset],[data-offline],[data-driver],[data-sheet-close],[data-wallet-add],[data-wallet-new],[data-wallet-edit],[data-wallet-del],[data-wallet-cancel],[data-wtype]';

  function jumpTo(id) {
    const el = document.getElementById(`stop-${id}`);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest(ACTIONS);
    if (!t) return;
    const d = t.dataset;

    if (d.person) {
      state.me = d.person;
      save();
      renderTodo();
      updateTodoMeta();
      reveal();
      return;
    }

    if (d.book) {
      const stop = stopById(d.book);
      const now = !isBooked(stop);
      state.booked[stop.id] = now;
      save();
      t.setAttribute('aria-pressed', now);
      t.querySelector('.booked-text').textContent = now ? 'Booked' : 'Not booked';
      const { booked, total } = bookedCount();
      const count = $('[data-booked-count]');
      if (count) count.textContent = `${booked}/${total}`;
      toast(now ? `${stop.name} booked` : `${stop.name} not booked`);
      return;
    }

    if (d.jump) { jumpTo(d.jump); return; }

    if (t.hasAttribute('data-sheet-close')) { closeSheet(); return; }
    if (d.offline) { offlineSheet(d.offline); return; }
    if (d.driver) { driverSheet(d.driver); return; }

    if (t.hasAttribute('data-wallet-add')) {
      walletEdit = { type: 'Stay' };
      renderWallet();
      reveal();
      return;
    }

    if (d.walletNew) {
      const s = stopById(d.walletNew);
      walletEdit = { type: 'Stay', stop: d.walletNew, title: s && s.stay ? s.stay.name : '' };
      if (current() !== 'wallet') { e.preventDefault(); location.hash = '#wallet'; return; }
      renderWallet();
      reveal();
      window.scrollTo(0, 0);
      return;
    }

    if (d.walletEdit) {
      walletEdit = Object.assign({}, walletList().find((w) => w.id === d.walletEdit));
      renderWallet();
      reveal();
      window.scrollTo(0, 0);
      return;
    }

    if (d.walletDel) {
      const w = walletList().find((x) => x.id === d.walletDel);
      if (!w || !window.confirm(`Delete "${w.title}" from this phone?`)) return;
      state.wallet = walletList().filter((x) => x.id !== d.walletDel);
      save();
      renderWallet();
      reveal();
      toast('Deleted');
      return;
    }

    if (t.hasAttribute('data-wallet-cancel')) {
      walletEdit = null;
      renderWallet();
      reveal();
      return;
    }

    if (d.wtype) {
      const form = t.closest('form');
      form.elements.type.value = d.wtype;
      $$('[data-wtype]', form).forEach((b) => b.setAttribute('aria-pressed', b === t));
      return;
    }

    if (t.hasAttribute('data-bedit')) {
      state.budgetEdit = !state.budgetEdit;
      save();
      renderBudget();
      reveal();
      return;
    }

    if (d.bdel) {
      editItems(currentPlan()).splice(Number(d.bdel), 1);
      save();
      renderBudget();
      reveal();
      return;
    }

    if (t.hasAttribute('data-badd')) {
      editItems(currentPlan()).push({ name: 'New expense', amount: 0 });
      save();
      renderBudget();
      reveal();
      const names = $$('[data-bname]');
      const last = names[names.length - 1];
      if (last) { last.focus(); last.select(); }
      return;
    }

    if (t.hasAttribute('data-breset')) {
      if (!window.confirm('Reset the budget and stop costs on this phone back to the plan?')) return;
      state.budgets = {};
      state.stopCosts = {};
      state.budgetEdit = false;
      save();
      renderBudget();
      reveal();
      toast('Back to the plan');
      return;
    }

    if (t.hasAttribute('data-scroll-cue')) {
      const next = $('.statement');
      if (next) next.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      return;
    }

    if (d.guideStop) {
      e.preventDefault();
      state.guideStop = d.guideStop;
      state.guideMode = 'places';
      state.guideCat = 'all';
      save();
      location.hash = '#guide';
      return;
    }

    if (d.gstop) {
      state.guideStop = d.gstop;
      state.guideCat = 'all';
      save();
      renderGuide();
      reveal();
      const chip = $(`[data-gstop="${d.gstop}"]`);
      if (chip) chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      return;
    }

    if (d.gcat) {
      state.guideCat = d.gcat;
      save();
      renderGuide();
      reveal();
      return;
    }

    if (d.gmode) {
      state.guideMode = d.gmode;
      save();
      renderGuide();
      reveal();
      return;
    }

    if (d.save) {
      const on = !state.saved[d.save];
      if (on) state.saved[d.save] = true;
      else delete state.saved[d.save];
      save();
      t.setAttribute('aria-pressed', on);
      t.querySelector('span').textContent = on ? 'Saved' : 'Save';
      const segBtn = $('[data-gmode="saved"]');
      const n = savedList().length;
      if (segBtn) segBtn.textContent = `Saved${n ? ` · ${n}` : ''}`;
      if (!on && state.guideMode === 'saved') { renderGuide(); reveal(); }
      toast(on ? 'Saved to your list' : 'Removed');
      return;
    }

    if (d.quick) {
      // Works like a calculator: each tap adds to what's already there.
      const input = $('[data-conv]');
      input.value = (convValue(input.value) + Number(d.quick)).toLocaleString('en-AU');
      runConvert();
      return;
    }

    if (t.hasAttribute('data-conv-clear')) {
      const input = $('[data-conv]');
      input.value = '0';
      runConvert();
    }

    if (t.hasAttribute('data-conv-flip')) {
      state.convFlip = !state.convFlip;
      save();
      renderBudget();
      reveal();
      return;
    }

    if (t.hasAttribute('data-share')) {
      const url = location.href.split('#')[0];
      const shareData = { title: 'Việt Nam ’27', text: 'The plan for Vietnam', url };
      try {
        if (navigator.share) await navigator.share(shareData);
        else { await navigator.clipboard.writeText(url); toast('Link copied'); }
      } catch (err) { /* share sheet closed */ }
      return;
    }

    if (t.hasAttribute('data-hint-close')) {
      state.hint = true;
      save();
      t.closest('.install').remove();
      return;
    }

    if (t.hasAttribute('data-clear-done')) {
      const m = mine();
      let n = 0;
      Object.keys(m.done).forEach((id) => {
        if (m.done[id] && !m.cleared[id]) { m.cleared[id] = true; n += 1; }
      });
      save();
      renderTodo();
      updateTodoMeta();
      if (n) toast(`Cleared ${n}`);
      return;
    }

    if (d.restore) {
      const m = mine();
      delete m.cleared[d.restore];
      delete m.done[d.restore];
      save();
      renderTodo();
      updateTodoMeta();
      const det = $('.cleared');
      if (det) det.open = true;
      return;
    }

    if (t.hasAttribute('data-restore-all')) {
      const m = mine();
      Object.keys(m.cleared).forEach((id) => { delete m.done[id]; });
      m.cleared = {};
      save();
      renderTodo();
      updateTodoMeta();
      return;
    }

    if (d.remove) {
      const m = mine();
      m.custom = m.custom.filter((c) => c.id !== d.remove);
      delete m.done[d.remove];
      delete m.cleared[d.remove];
      save();
      renderTodo();
      updateTodoMeta();
      return;
    }

    if (d.plan) {
      state.plan = d.plan;
      save();
      renderBudget();
      reveal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.m-stop')) {
      e.preventDefault();
      jumpTo(e.target.dataset.jump);
    }
  });

  document.addEventListener('change', (e) => {
    const box = e.target.closest('input[data-item]');
    if (!box) return;
    const m = mine();
    if (box.checked) m.done[box.dataset.item] = true;
    else delete m.done[box.dataset.item];
    save();
    updateTodoMeta();
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-conv]')) runConvert();
    if (el.matches('[data-bname]')) {
      editItems(currentPlan())[Number(el.dataset.bname)].name = el.value;
      save();
    }
    if (el.matches('[data-bamt]')) {
      editItems(currentPlan())[Number(el.dataset.bamt)].amount = toNum(el.value);
      save();
      budgetTotals();
    }
    if (el.matches('[data-scost]')) {
      if (!state.stopCosts) state.stopCosts = {};
      state.stopCosts[el.dataset.scost] = toNum(el.value);
      save();
    }
  });

  document.addEventListener('submit', (e) => {
    const wf = e.target.closest('[data-wallet-form]');
    if (wf) {
      e.preventDefault();
      const f = wf.elements;
      const entry = {
        id: f.id.value || `w${Date.now().toString(36)}`,
        type: f.type.value || 'Other',
        title: f.title.value.trim(),
        stop: f.stop.value,
        when: f.when.value.trim(),
        ref: f.ref.value.trim(),
        address: f.address.value.trim(),
        notes: f.notes.value.trim(),
      };
      if (!entry.title) return;
      const list = walletList();
      const i = list.findIndex((w) => w.id === entry.id);
      if (i >= 0) list[i] = entry; else list.push(entry);
      walletEdit = null;
      save();
      renderWallet();
      reveal();
      toast('Saved to wallet');
      return;
    }

    const form = e.target.closest('[data-add]');
    if (!form) return;
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    mine().custom.push({ id: `c${Date.now().toString(36)}`, text });
    save();
    renderTodo();
    updateTodoMeta();
    const input = $('[data-add] input');
    if (input) input.focus();
  });

  window.addEventListener('hashchange', route);

  // Tap outside the pop-up card to close it.
  document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('sheet')) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('.sheet').hidden) closeSheet();
  });

  // ---------- boot ----------

  const get = (url) => fetch(url, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(url);
    return r.json();
  });

  Promise.all([
    get('data/trip.json'),
    get('data/checklist.json'),
    get('data/budget.json'),
    get('data/guide.json'),
  ])
    .then(([trip, checklist, budget, guide]) => {
      DATA = { trip, checklist, budget, guide };
      route();
      updateTodoMeta();
      if (document.fonts) document.fonts.ready.then(() => { sizePin(); scrollFx(); });
      setInterval(tick, 1000);
      fetchRate();
      // Group sync switches on once data/sync.json has the Supabase details.
      fetch('data/sync.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((cfg) => startSync(cfg))
        .catch(() => startSync(null));
    })
    .catch((err) => {
      console.error(err);
      $('#view-trip').innerHTML = '<p class="foot">Couldn’t load the plan. Check your connection and try again.</p>';
    });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
