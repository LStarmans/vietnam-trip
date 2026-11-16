'use strict';

(() => {
  const STORE = 'vn27';
  const VIEWS = ['trip', 'todo', 'budget'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // ---------- saved state (per phone) ----------

  const state = Object.assign(
    { booked: {}, done: {}, cleared: {}, custom: [], plan: 'month', hint: false },
    read()
  );

  function read() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  // ---------- helpers ----------

  const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((b - a) / 864e5);
  const nightsOf = (s) => daysBetween(toDate(s.from), toDate(s.to));
  const slug = (s) => String(s).toLowerCase().replace(/\s+/g, '-');

  function today() {
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

  function money(n) {
    return '$' + Number(n).toLocaleString('en-AU', {
      minimumFractionDigits: n % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    });
  }

  const icon = (paths, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

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
    check: icon('<path d="M20 6 9 17l-5-5"/>'),
    share: icon('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>'),
    out: icon('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    x: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
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

  // ---------- Trip ----------

  function countdownHTML() {
    const trip = DATA.trip;
    const t = today();
    const start = toDate(trip.start);
    const end = toDate(trip.end);
    const until = daysBetween(t, start);

    if (until > 0) {
      return `<span class="count-num">${until}</span>
        <span class="count-label">${until === 1 ? 'day' : 'days'} until<br>we land in Sài Gòn</span>`;
    }
    if (t <= end) {
      const day = daysBetween(start, t) + 1;
      const total = daysBetween(start, end) + 1;
      const here = currentStop();
      return `<span class="count-num">${day}</span>
        <span class="count-label">day ${day} of ${total}<br>${here ? 'in ' + esc(here.name) : 'on the move'}</span>`;
    }
    return `<span class="count-num">${daysBetween(start, end) + 1}</span>
      <span class="count-label">days in Vietnam.<br>Not bad.</span>`;
  }

  function stopHTML(s, i) {
    const n = nightsOf(s);
    const booked = isBooked(s);
    const here = currentStop() === s;
    const events = (DATA.trip.events || []).filter((e) => {
      const d = toDate(e.from);
      return d >= toDate(s.from) && d < toDate(s.to);
    });

    const stay = s.stay ? `
      <div class="stay">
        <div class="stay-label">${I.bed}Stay</div>
        <div class="stay-name">${esc(s.stay.name)}</div>
        ${s.stay.detail ? `<div class="stay-detail">${esc(s.stay.detail)}</div>` : ''}
        ${s.stay.link ? `<a class="stay-link" href="${esc(s.stay.link)}" target="_blank" rel="noopener">See the place ${I.out}</a>` : ''}
        <button class="booked" type="button" data-book="${esc(s.id)}" aria-pressed="${booked}">
          <span class="tick">${I.check}</span><span class="booked-text">${booked ? 'Booked' : 'Not booked'}</span>
        </button>
      </div>` : '';

    const plan = s.plan && s.plan.length
      ? `<ul class="chips">${s.plan.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';

    const eventCards = events.map((e) => `
      <div class="event">
        <span class="eyebrow">${e.from === e.to ? dayLabel(e.from) : range(e.from, e.to)}</span>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.note)}</p>
      </div>`).join('');

    const cost = s.cost ? `
      <div class="cost">
        <span><b>${money(s.cost.total)}</b>total</span>
        <span><b>${money(s.cost.each)}</b>each</span>
      </div>` : '';

    const showLocal = s.local && s.local !== s.name;

    return `
      <article class="stop${here ? ' now' : ''}" data-region="${slug(s.region)}">
        <div class="rail"><span class="dot"></span></div>
        <div class="stop-body" id="stop-${esc(s.id)}">
          <div class="stop-head">
            <span class="stop-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="eyebrow">${esc(s.region)}</span>
            ${here ? '<span class="here">You’re here</span>' : ''}
          </div>
          <h2>${esc(s.name)}</h2>
          ${showLocal ? `<p class="local">${esc(s.local)}</p>` : ''}
          <p class="facts">
            <span>${I.cal}${range(s.from, s.to)}</span>
            <span>${I.moon}${n} ${n === 1 ? 'night' : 'nights'}</span>
            <span>${I.users}${s.people}</span>
          </p>
          ${eventCards}
          ${stay}
          ${plan}
          ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
          ${cost}
        </div>
      </article>`;
  }

  function legHTML(leg) {
    if (!leg) return '';
    const sub = [leg.when, leg.detail].filter(Boolean).map(esc).join(' · ');
    return `
      <div class="leg">
        <div class="rail"></div>
        <div class="leg-card">
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

    const install = isIOS && !standalone && !state.hint ? `
      <div class="install">
        <p>Tap <b>Share</b>, then <b>Add to Home Screen</b> to keep this on your phone. Works offline too.</p>
        <button class="icon-btn" type="button" data-hint-close aria-label="Dismiss">${I.x}</button>
      </div>` : '';

    $('#view-trip').innerHTML = `
      <header class="hero">
        <div class="hero-top">
          <span class="eyebrow">${range(trip.start, trip.end)} 2027</span>
          <button class="icon-btn" type="button" data-share aria-label="Share with the group">${I.share}</button>
        </div>
        <h1>Việt <em>Nam</em></h1>
        <p class="hero-sub">Sài Gòn to Hà Nội, the long way round.</p>
        <div class="countdown">${countdownHTML()}</div>
        ${install}
      </header>

      <div class="stats">
        <div class="stat"><b>${daysBetween(toDate(trip.start), toDate(trip.end))}</b><span>nights</span></div>
        <div class="stat"><b>${stops.length}</b><span>stops</span></div>
        <div class="stat"><b data-booked-count>${booked}/${total}</b><span>stays booked</span></div>
      </div>

      <nav class="route" aria-label="Jump to a stop">
        ${stops.map((s) => `<button type="button" data-jump="${esc(s.id)}" data-region="${slug(s.region)}"><i></i>${esc(s.id === 'saigon' ? 'Sài Gòn' : s.name)}</button>`).join('')}
      </nav>

      <div class="timeline">
        ${stops.map((s, i) => stopHTML(s, i) + legHTML(s.next)).join('')}
        <div class="finish"><div class="rail"><span class="dot"></span></div><p>Home, ${dayLabel(trip.end)}</p></div>
      </div>

      <p class="foot">Prices in AUD</p>`;
  }

  // ---------- To-do ----------

  function todoGroups() {
    const groups = DATA.checklist.groups.map((g) => ({ name: g.name, items: g.items }));
    if (state.custom.length) {
      groups.unshift({ name: 'Your own', items: state.custom.map((c) => Object.assign({ custom: true }, c)) });
    }
    return groups;
  }

  function todoCounts() {
    let total = 0;
    let done = 0;
    let ready = 0;
    todoGroups().forEach((g) => g.items.forEach((it) => {
      total += 1;
      if (state.cleared[it.id]) done += 1;
      else if (state.done[it.id]) { done += 1; ready += 1; }
    }));
    return { total, done, ready, left: total - done };
  }

  function itemHTML(it) {
    const checked = !!state.done[it.id];
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

  function renderTodo() {
    const c = todoCounts();
    const stays = bookedCount();
    const groups = todoGroups();
    const clearedItems = [];
    groups.forEach((g) => g.items.forEach((it) => { if (state.cleared[it.id]) clearedItems.push(it); }));

    const groupsHTML = groups.map((g) => {
      const open = g.items.filter((it) => !state.cleared[it.id]);
      return `
        <section class="group">
          <h2>${esc(g.name)}</h2>
          <ul class="list">${open.length ? open.map(itemHTML).join('') : '<li class="all-done">All sorted.</li>'}</ul>
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

    $('#view-todo').innerHTML = `
      <header class="page-head">
        <span class="eyebrow">Before we go</span>
        <h1>To-do</h1>
        <p data-todo-summary>${summaryText(c)}</p>
        <div class="progress"><span data-todo-bar style="width:${c.total ? (c.done / c.total) * 100 : 0}%"></span></div>
      </header>

      <div class="todo-tools">
        <button class="btn" type="button" data-clear-done${c.ready ? '' : ' disabled'}>Clear done${c.ready ? ` (${c.ready})` : ''}</button>
      </div>

      <a class="stays-link" href="#trip">
        ${I.bed}
        <span>Stays booked <b>${stays.booked} of ${stays.total}</b></span>
        <span class="chev" aria-hidden="true">›</span>
      </a>

      <form class="add" data-add autocomplete="off">
        <input type="text" name="text" maxlength="90" placeholder="Add something" aria-label="Add a to-do">
        <button class="btn" type="submit">Add</button>
      </form>

      ${groupsHTML}
      ${clearedHTML}

      <p class="foot">Ticks are saved on your phone.</p>`;
  }

  function summaryText(c) {
    if (!c.total) return 'Nothing on the list.';
    if (c.left === 0) return 'Everything’s done. Pack the bag.';
    return `${c.done} of ${c.total} done, ${c.left} to go`;
  }

  function updateTodoMeta() {
    const c = todoCounts();
    const sum = $('[data-todo-summary]');
    const bar = $('[data-todo-bar]');
    const btn = $('[data-clear-done]');
    if (sum) sum.textContent = summaryText(c);
    if (bar) bar.style.width = `${c.total ? (c.done / c.total) * 100 : 0}%`;
    if (btn) {
      btn.disabled = !c.ready;
      btn.textContent = c.ready ? `Clear done (${c.ready})` : 'Clear done';
    }
    const badge = $('.tab-badge');
    badge.hidden = c.left === 0;
    badge.textContent = c.left;
  }

  // ---------- Budget ----------

  function renderBudget() {
    const plans = DATA.budget.plans;
    const p = plans.find((x) => x.id === state.plan) || plans[0];
    const total = p.items.reduce((sum, it) => sum + it.amount, 0);
    const max = Math.max(...p.items.map((it) => it.amount));
    const stops = DATA.trip.stops.filter((s) => s.cost);

    $('#view-budget').innerHTML = `
      <header class="page-head">
        <span class="eyebrow">Per person, AUD</span>
        <h1>Budget</h1>
      </header>

      <div class="seg" role="group" aria-label="Which trip">
        ${plans.map((x) => `<button type="button" data-plan="${esc(x.id)}" aria-pressed="${x.id === p.id}">${esc(x.label)} · ${x.people}</button>`).join('')}
      </div>

      <div class="total">
        <span class="eyebrow">Each, ${esc(p.dates)}</span>
        <b>${money(total)}</b>
        <span>${money(total * p.people)} across the ${p.people} of us</span>
      </div>

      <section class="group">
        <h2>Where it goes</h2>
        <div class="list">
          <ul class="rows">
            ${p.items.map((it) => `
              <li>
                <div class="row-top"><span>${esc(it.name)}</span><b>${money(it.amount)}</b></div>
                <div class="bar"><span style="width:${(it.amount / max) * 100}%"></span></div>
              </li>`).join('')}
          </ul>
        </div>
      </section>

      <section class="group">
        <h2>By stop</h2>
        <div class="list">
          <ul class="rows by-stop">
            ${stops.map((s) => `
              <li data-region="${slug(s.region)}">
                <span><i></i>${esc(s.name)}</span>
                <span><b>${money(s.cost.each)}</b><small>each</small></span>
              </li>`).join('')}
          </ul>
        </div>
      </section>

      <p class="foot">Hà Giang includes the loop tour, not just beds.</p>`;
  }

  // ---------- routing ----------

  function route() {
    const name = location.hash.slice(1);
    const view = VIEWS.includes(name) ? name : 'trip';
    VIEWS.forEach((v) => {
      $(`#view-${v}`).hidden = v !== view;
      const tab = $(`.tab[data-tab="${v}"]`);
      if (v === view) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    if (view === 'todo') renderTodo();
    if (view === 'budget') renderBudget();
    if (view === 'trip') renderTrip();
    window.scrollTo(0, 0);
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

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-book],[data-jump],[data-share],[data-hint-close],[data-clear-done],[data-restore],[data-restore-all],[data-remove],[data-plan]');
    if (!t) return;

    if (t.dataset.book) {
      const stop = DATA.trip.stops.find((s) => s.id === t.dataset.book);
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

    if (t.dataset.jump) {
      const el = document.getElementById(`stop-${t.dataset.jump}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      let n = 0;
      Object.keys(state.done).forEach((id) => {
        if (state.done[id] && !state.cleared[id]) { state.cleared[id] = true; n += 1; }
      });
      save();
      renderTodo();
      updateTodoMeta();
      if (n) toast(`Cleared ${n}`);
      return;
    }

    if (t.dataset.restore) {
      delete state.cleared[t.dataset.restore];
      delete state.done[t.dataset.restore];
      save();
      renderTodo();
      updateTodoMeta();
      $('.cleared') && ($('.cleared').open = true);
      return;
    }

    if (t.hasAttribute('data-restore-all')) {
      Object.keys(state.cleared).forEach((id) => { delete state.done[id]; });
      state.cleared = {};
      save();
      renderTodo();
      updateTodoMeta();
      return;
    }

    if (t.dataset.remove) {
      const id = t.dataset.remove;
      state.custom = state.custom.filter((c) => c.id !== id);
      delete state.done[id];
      delete state.cleared[id];
      save();
      renderTodo();
      updateTodoMeta();
      return;
    }

    if (t.dataset.plan) {
      state.plan = t.dataset.plan;
      save();
      renderBudget();
    }
  });

  document.addEventListener('change', (e) => {
    const box = e.target.closest('input[data-item]');
    if (!box) return;
    if (box.checked) state.done[box.dataset.item] = true;
    else delete state.done[box.dataset.item];
    save();
    updateTodoMeta();
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-add]');
    if (!form) return;
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    state.custom.push({ id: `c${Date.now().toString(36)}`, text });
    save();
    renderTodo();
    updateTodoMeta();
    const input = $('[data-add] input');
    if (input) input.focus();
  });

  window.addEventListener('hashchange', route);

  // ---------- boot ----------

  const get = (url) => fetch(url, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(url);
    return r.json();
  });

  Promise.all([get('data/trip.json'), get('data/checklist.json'), get('data/budget.json')])
    .then(([trip, checklist, budget]) => {
      DATA = { trip, checklist, budget };
      route();
      updateTodoMeta();
    })
    .catch(() => {
      $('#view-trip').innerHTML = '<p class="foot">Couldn’t load the plan. Check your connection and try again.</p>';
    });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
