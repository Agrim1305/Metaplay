// Release schedule: a week strip of day columns, then the selected day's releases.
// Loads RAWG in 4-week windows and fetches the next window only when you arrow into it.
import { rawg, library, isoDay, addDays, genreOf, platformsOf, upstreamMessage } from './api.js';
import { html, icon } from './dom.js';
import { coverImg, covStyle } from './art.js';
import { changeStatus } from './statusControl.js';
import { gameHref } from './gameCard.js';
import { skeletonRows } from './skeleton.js';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = 86400000;

const atMidnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fromIso = (iso) => new Date(`${iso}T00:00:00`);
const mondayOf = (d) => addDays(atMidnight(d), -((d.getDay() + 6) % 7));
const longDay = (d) => `${WDL[d.getDay()]} ${d.getDate()} ${MONL[d.getMonth()]}`;
const shortDay = (d) => `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;

// extra: games (or a promise of games) we already have details for, i.e. your wishlist,
// so they always show on their release day even when RAWG's top 40 misses them.
export function releaseSchedule(root, { extra = [] } = {}) {
  const extraP = Promise.resolve(extra).catch(() => []);
  const today = atMidnight(new Date());
  const todayIso = isoDay(today);
  const M0 = mondayOf(today);
  const S = { week: 0, sel: todayIso, filter: 'all', auto: false };
  const windows = new Map(); // window index -> { byDay: Map<iso, game[]>, error }
  const pending = new Map();
  let lib = new Map();

  const weekOf = (iso) => Math.floor(Math.round((fromIso(iso) - M0) / DAY) / 7);
  const winOf = (week) => Math.floor(week / 4);
  const isW = (g) => lib.get(g.id) === 'wishlist';

  function load(k) {
    if (windows.has(k) && !windows.get(k).error) return Promise.resolve();
    if (pending.has(k)) return pending.get(k);
    const start = isoDay(addDays(M0, k * 28));
    const end = isoDay(addDays(M0, k * 28 + 27));
    // ponytail: RAWG's 40 most-added games per 4 weeks (not ordering=released, which
    // would fill the 40 slots with the first day or two). Wishlist games are merged in.
    const p = Promise.all([rawg({ dates: `${start},${end}`, ordering: '-added', page_size: 40 }), extraP])
      .then(([d, more]) => {
        const byDay = new Map();
        const seen = new Set();
        const mine = more.filter((g) => g.released && g.released >= start && g.released <= end);
        for (const g of [...mine, ...d.results]) {
          if (!g.released || seen.has(g.id)) continue;
          seen.add(g.id);
          if (!byDay.has(g.released)) byDay.set(g.released, []);
          byDay.get(g.released).push(g);
        }
        windows.set(k, { byDay });
      })
      .catch((error) => windows.set(k, { byDay: new Map(), error }))
      .finally(() => pending.delete(k));
    pending.set(k, p);
    return p;
  }

  const dayGames = (iso) => {
    const w = windows.get(winOf(weekOf(iso)));
    const list = w ? w.byDay.get(iso) || [] : [];
    const shown = S.filter === 'wish' ? list.filter(isW) : list;
    return shown.slice().sort((a, b) => isW(b) - isW(a));
  };

  // First day after `iso` with releases, searching windows already loaded.
  function nextRelease(iso) {
    const days = [...windows.values()].flatMap((w) => [...w.byDay.keys()]).filter((d) => d > iso).sort();
    return days.find((d) => dayGames(d).length);
  }

  // After paging, select the week's first day that has releases (until the user picks a day).
  const autoPick = () => {
    if (!S.auto) return;
    const week = Array.from({ length: 7 }, (_, i) => isoDay(addDays(M0, S.week * 7 + i)));
    S.sel = week.find((d) => dayGames(d).length) || week[0];
  };

  async function goWeek(week) {
    S.week = week;
    S.auto = true;
    autoPick();
    render();
    await load(winOf(week));
    if (S.week === week) autoPick();
    render();
  }

  function rowHtml(g) {
    const w = isW(g);
    return html`
      <div class="rel-row">
        <span class="cov" style="${covStyle(g.id)}">${coverImg(g.background_image, 420)}</span>
        <div class="rel-main">
          <div class="rel-head">
            <a class="rel-title" href="${gameHref(g.id)}">${g.name}</a>
            ${w ? icon('bookmark', { fill: true, cls: 'c-wish', label: 'On your wishlist' }) : ''}
          </div>
          <div class="rel-sub">${[genreOf(g), platformsOf(g)].filter(Boolean).map((s, i) => html`${i ? html`<span class="sep"> / </span>` : ''}${s}`)}</div>
        </div>
        <div class="rel-actions">
          <button type="button" class="wish-toggle" data-k="wish-${g.id}" data-wish="${g.id}" aria-pressed="${w}"
            aria-label="${w ? `Remove ${g.name} from wishlist` : `Add ${g.name} to wishlist`}">${icon('bookmark', { fill: w })}</button>
          <a class="btn btn-quiet btn-pill view-pill" href="${gameHref(g.id)}">${icon('play_arrow', { fill: true })}View game</a>
        </div>
      </div>`;
  }

  function render() {
    const focusKey = root.contains(document.activeElement) && document.activeElement.dataset.k;
    const k = winOf(S.week);
    const win = windows.get(k);
    const days = Array.from({ length: 7 }, (_, i) => addDays(M0, S.week * 7 + i));
    const sel = fromIso(S.sel);
    const items = win ? dayGames(S.sel) : [];
    const tintSrc = items[0] || (win && days.map((d) => dayGames(isoDay(d))[0]).find(Boolean));
    const next = win && !items.length ? nextRelease(S.sel) : null;
    const nextGame = next && dayGames(next)[0];

    let list;
    if (!win) list = skeletonRows(2);
    else if (win.error) {
      list = html`<div class="empty"><span>${upstreamMessage(win.error)} The schedule will be back shortly.</span>
        <button type="button" class="btn btn-secondary btn-sm" data-k="retry">Try again</button></div>`;
    } else if (!items.length) {
      list = html`<div class="empty"><span>${S.filter === 'wish' ? 'Nothing from your wishlist on' : 'No releases on'} ${longDay(sel)}.</span>
        ${nextGame ? html`<button type="button" class="btn btn-quiet btn-pill" data-k="jump">Jump to ${nextGame.name}, ${shortDay(fromIso(next))}${icon('arrow_forward')}</button>` : ''}</div>`;
    } else list = items.map(rowHtml);

    root.innerHTML = html`
      <div class="sched-tint" aria-hidden="true">${tintSrc ? coverImg(tintSrc.background_image, 1280, true) : ''}</div>
      <div class="sched-top">
        <div class="sched-title">
          <h2 id="cal-h">Release schedule</h2>
          <span>Today is ${longDay(today)}</span>
        </div>
        <div class="sched-filter" role="group" aria-label="Show">
          <button type="button" data-k="f-all" aria-pressed="${S.filter === 'all'}">All releases</button>
          <button type="button" data-k="f-wish" aria-pressed="${S.filter === 'wish'}">My wishlist</button>
        </div>
        <div class="sched-week">
          <button type="button" class="sched-arrow" data-k="prev" aria-label="Previous week">${icon('chevron_left')}</button>
          <div class="sched-days-wrap rail">
            <div class="sched-days" role="tablist" aria-label="Days">
              ${days.map((d) => {
    const iso = isoDay(d);
    const ev = win ? dayGames(iso) : [];
    const cls = [iso === todayIso && 'today', d < today && 'past'].filter(Boolean).join(' ');
    return html`<button type="button" role="tab" class="dayb ${cls}" data-k="day-${iso}" data-day="${iso}" aria-selected="${iso === S.sel}"
                  aria-label="${longDay(d)}, ${ev.length ? `${ev.length} release${ev.length === 1 ? '' : 's'}` : 'no releases'}">
                  <span class="d-small">${iso === todayIso ? 'Today' : `${MON[d.getMonth()]} ${d.getDate()}`}</span>
                  <span class="d-big">${WD[d.getDay()]}</span>
                  <span class="d-dots">${ev.slice(0, 4).map((g) => html`<i class="${isW(g) ? 'w' : ''}"></i>`)}</span>
                  <span class="d-bar"></span>
                </button>`;
  })}
            </div>
          </div>
          <button type="button" class="sched-arrow" data-k="next" aria-label="Next week">${icon('chevron_right')}</button>
        </div>
      </div>
      <div class="sched-list" aria-live="polite" ${win ? '' : html`aria-busy="true"`}>${list}</div>`;

    if (focusKey) {
      const again = root.querySelector(`[data-k="${focusKey}"]`);
      if (again) again.focus({ preventScroll: true });
    }
    // On narrow screens the strip scrolls; keep the selected day in view.
    const wrap = root.querySelector('.sched-days-wrap');
    const on = root.querySelector('.dayb[aria-selected="true"]');
    if (on && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = on.offsetLeft - (wrap.clientWidth - on.offsetWidth) / 2;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const key = b.dataset.k;
    if (b.dataset.day) { S.sel = b.dataset.day; S.auto = false; render(); } else if (key === 'prev') goWeek(S.week - 1);
    else if (key === 'next') goWeek(S.week + 1);
    else if (key === 'f-all' || key === 'f-wish') { S.filter = key === 'f-all' ? 'all' : 'wish'; autoPick(); render(); } else if (key === 'jump') {
      const next = nextRelease(S.sel);
      if (next) { S.week = weekOf(next); S.sel = next; S.auto = false; render(); }
    } else if (key === 'retry') { windows.delete(winOf(S.week)); goWeek(S.week); } else if (b.dataset.wish) {
      const id = Number(b.dataset.wish);
      const g = [...windows.values()].flatMap((w) => [...w.byDay.values()].flat()).find((x) => x.id === id);
      if (g) changeStatus(g, isW(g) ? null : 'wishlist');
    }
  });

  document.addEventListener('library:change', (e) => {
    if (e.detail.status) lib.set(e.detail.gameId, e.detail.status); else lib.delete(e.detail.gameId);
    render();
  });

  render();
  library().then((m) => { lib = m; }).catch(() => {}).finally(() => load(0).then(render));
}
