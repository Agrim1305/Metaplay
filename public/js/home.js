// Home dashboard: greeting + stats, library tabs, release schedule, trending.
import './ui/nav.js';
import { me, library, myReviews, batch, rawg, isoDay, addDays, genreOf, platformsOf, STATUS, upstreamMessage } from './ui/api.js';
import { html, icon } from './ui/dom.js';
import { coverImg, covStyle } from './ui/art.js';
import { gameCard, gameHref, metaBadge } from './ui/gameCard.js';
import { changeStatus, onStatus } from './ui/statusControl.js';
import { skeletonCards, skeletonRows, loaded } from './ui/skeleton.js';
import { releaseSchedule } from './ui/releaseSchedule.js';

const $ = (s) => document.querySelector(s);
const SHELVES = ['playing', 'wishlist', 'completed'];
const games = new Map(); // id -> RAWG game, collected from every list on the page
let lib = new Map();
let reviews = new Map();
let tab = null;
let batchError = null;

// ---------- Greeting ----------
const hour = new Date().getHours();
const greet = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening';
$('#hello').textContent = greet;
me().then((u) => { $('#hello').textContent = `${greet}, ${u.username}`; }).catch(() => {});

const idsOn = (shelf) => [...lib].filter(([, s]) => s === shelf).map(([id]) => id);

// ---------- Stats strip ----------
function renderStats() {
  const rated = [...reviews.values()];
  const avg = rated.length ? (rated.reduce((a, r) => a + r.rating, 0) / rated.length).toFixed(1) : '–';
  const unrated = idsOn('completed').find((id) => !reviews.has(id) && games.has(id));
  const stat = (value, label, ic, cls) => html`
    <div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${icon(ic, { fill: true, cls })}${label}</div></div>`;
  let nudge = '';
  if (!lib.size) nudge = html`<div class="nudge"><span>Your shelves are empty.</span><a class="ulink" href="/pages/discover.html">Find something to play</a></div>`;
  else if (unrated) nudge = html`<div class="nudge"><span>${games.get(unrated).name} is completed but unrated.</span><a class="ulink" href="${gameHref(unrated)}#review">Rate it</a></div>`;
  const box = $('#stats');
  box.innerHTML = html`
    ${SHELVES.map((s) => stat(idsOn(s).length, STATUS[s].label, STATUS[s].icon, STATUS[s].cls))}
    ${stat(avg, rated.length ? `Average of ${rated.length} review${rated.length === 1 ? '' : 's'}` : 'No reviews yet', 'star', 'muted')}
    ${nudge}`;
  loaded(box);
}

// ---------- Library tabs ----------
function renderTabs() {
  if (!tab) tab = SHELVES.find((s) => idsOn(s).length) || 'playing';
  $('#shelf-tabs').innerHTML = html`${SHELVES.map((s) => html`
    <button type="button" role="tab" class="tab" id="tab-${s}" data-shelf="${s}" aria-controls="shelf"
      aria-selected="${s === tab}" tabindex="${s === tab ? 0 : -1}">
      ${icon(STATUS[s].icon, { fill: true, cls: STATUS[s].cls })}${STATUS[s].label}<span class="count">${idsOn(s).length}</span>
    </button>`)}`;
  const n = idsOn(tab).length;
  const all = $('#view-all');
  all.hidden = !n;
  all.href = `/pages/discover.html?scope=${tab}`;
  all.textContent = `View all ${n}`;
  $('#shelf').setAttribute('aria-labelledby', `tab-${tab}`);
}

const EMPTY = {
  playing: 'Nothing on your Playing shelf yet.',
  wishlist: 'Your wishlist is empty.',
  completed: 'No completed games yet.',
};

function renderShelf() {
  const grid = $('#shelf');
  const ids = idsOn(tab);
  loaded(grid);
  if (!ids.length) {
    grid.innerHTML = html`<div class="empty boxed"><span>${EMPTY[tab]}</span><a class="btn btn-secondary btn-sm" href="/pages/discover.html">Browse games</a></div>`;
    return;
  }
  // A game RAWG couldn't return still gets a tile (gradient + link), never a blank slot.
  const cards = ids.slice(0, 10).map((id) => gameCard(games.get(id) || { id, name: 'Details unavailable' }, { reviews }));
  grid.replaceChildren(...cards);
  if (batchError && !games.size) {
    grid.insertAdjacentHTML('afterbegin', String(html`<p class="empty">${upstreamMessage(batchError)} Showing what we can.</p>`));
  }
}

$('#shelf-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-shelf]');
  if (!b) return;
  tab = b.dataset.shelf;
  renderTabs();
  renderShelf();
  $(`#tab-${tab}`).focus();
});
$('#shelf-tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = SHELVES.indexOf(tab);
  tab = SHELVES[(i + (e.key === 'ArrowRight' ? 1 : SHELVES.length - 1)) % SHELVES.length];
  renderTabs();
  renderShelf();
  $(`#tab-${tab}`).focus();
});

document.addEventListener('library:change', (e) => {
  if (e.detail.game && e.detail.game.name) games.set(e.detail.gameId, e.detail.game);
  renderStats();
  renderTabs();
  renderShelf();
});

// ---------- Trending ----------
async function loadTrending() {
  const box = $('#trend');
  box.innerHTML = html`<div class="sk spot"></div><div>${skeletonRows(5)}</div>`;
  let list;
  try {
    const today = new Date();
    const d = await rawg({ dates: `${isoDay(addDays(today, -30))},${isoDay(today)}`, ordering: '-added', page_size: 5 });
    list = d.results.slice(0, 5);
  } catch (err) {
    loaded(box);
    box.innerHTML = html`<div class="empty boxed"><span>${upstreamMessage(err)}</span><button type="button" class="btn btn-secondary btn-sm" id="trend-retry">Try again</button></div>`;
    $('#trend-retry').addEventListener('click', loadTrending);
    return;
  }
  list.forEach((g) => games.set(g.id, g));
  loaded(box);
  box.innerHTML = html`
    <div class="cov shade spot" id="spot"></div>
    <ol class="trend-list">
      ${list.map((g, i) => html`<li>
        <button type="button" class="trend-row" data-i="${i}" aria-pressed="${i === 0}">
          <span class="trend-rank">${i + 1}</span>
          <span class="cov" style="${covStyle(g.id)}">${coverImg(g.background_image, 420)}</span>
          <span class="trend-text"><span class="trend-name">${g.name}</span><span class="trend-genre">${genreOf(g)}</span></span>
          ${metaBadge(g.metacritic)}
        </button>
      </li>`)}
    </ol>`;

  const spot = $('#spot');
  const show = (i) => {
    const g = list[i];
    spot.setAttribute('style', covStyle(g.id));
    spot.innerHTML = html`
      ${coverImg(g.background_image, 1280, true)}
      <div class="spot-body">
        <div class="spot-sub">${[genreOf(g), platformsOf(g)].filter(Boolean).join(', ')}</div>
        <div class="spot-name">${g.name}</div>
        <div class="btn-row">
          <a class="btn btn-primary btn-sm spot-btn" href="${gameHref(g.id)}">View game</a>
          <button type="button" class="btn btn-sm btn-glass spot-btn" id="spot-wish" aria-pressed="false">${icon('bookmark', { cls: 'c-wish' })}<span>Wishlist</span></button>
        </div>
      </div>`;
    const wish = spot.querySelector('#spot-wish');
    let status = null;
    onStatus(g.id, (s) => {
      status = s;
      wish.setAttribute('aria-pressed', String(s === 'wishlist'));
      wish.querySelector('.ms').classList.toggle('f', s === 'wishlist');
      wish.querySelector('span:last-child').textContent = s === 'wishlist' ? 'On your wishlist' : 'Wishlist';
    }, wish);
    wish.addEventListener('click', () => changeStatus(g, status === 'wishlist' ? null : 'wishlist'));
    box.querySelectorAll('.trend-row').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.i) === i)));
  };
  box.querySelector('.trend-list').addEventListener('click', (e) => {
    const b = e.target.closest('.trend-row');
    if (b) show(Number(b.dataset.i));
  });
  show(0);
}

// ---------- Boot ----------
$('#shelf').innerHTML = skeletonCards(5);
const libReady = Promise.all([library(), myReviews()]).then(async ([l, r]) => {
  lib = l;
  reviews = r;
  // ponytail: one batch of up to 40 (the batch cap): 10 Playing, 10 Completed, 20 Wishlist.
  const ids = [...idsOn('playing').slice(0, 10), ...idsOn('completed').slice(0, 10), ...idsOn('wishlist').slice(0, 20)];
  try {
    Object.values(await batch(ids)).forEach((g) => games.set(g.id, g));
  } catch (err) {
    batchError = err;
  }
  renderStats();
  renderTabs();
  renderShelf();
  return idsOn('wishlist').map((id) => games.get(id)).filter(Boolean);
});

releaseSchedule($('#schedule'), { extra: libReady });
loadTrending();
