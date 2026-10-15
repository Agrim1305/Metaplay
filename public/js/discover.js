// Discover: search, scope list, genre/platform chips, sort, grid/list, load more.
// State lives in the URL (?scope=&q=&genres=&platforms=&sort=&view=) so links and the
// nav search land on the right view.
import './ui/nav.js';
import { library, myReviews, batch, rawg, isoDay, addDays, genreOf, yearOf, STATUS, upstreamMessage } from './ui/api.js';
import { html, icon, params } from './ui/dom.js';
import { coverImg, covStyle } from './ui/art.js';
import { gameCard, gameHref, metaBadge } from './ui/gameCard.js';
import { changeStatus, onStatus } from './ui/statusControl.js';
import { skeletonCards, skeletonRows, loaded } from './ui/skeleton.js';

const $ = (s) => document.querySelector(s);

const SCOPES = [
  { key: 'all', label: 'All games', icon: 'apps' },
  { key: 'trending', label: 'Trending', icon: 'trending_up' },
  { key: 'soon', label: 'Coming soon', icon: 'event' },
  { key: 'playing', label: 'My Playing', icon: 'play_arrow', cls: 'c-play', mine: true },
  { key: 'wishlist', label: 'My Wishlist', icon: 'bookmark', cls: 'c-wish', mine: true },
  { key: 'completed', label: 'My Completed', icon: 'check_circle', cls: 'c-done', mine: true },
];
const GENRES = [['Action', 'action'], ['RPG', 'role-playing-games-rpg'], ['Adventure', 'adventure'], ['Indie', 'indie'],
  ['Platformer', 'platformer'], ['Strategy', 'strategy'], ['Shooter', 'shooter'], ['Puzzle', 'puzzle']];
const PLATFORMS = [['PC', '1'], ['PlayStation', '2'], ['Xbox', '3'], ['Switch', '7']];
const PAGE = 40;

const p = params();
const listParam = (k) => (p.get(k) ? p.get(k).split(',').filter(Boolean) : []);
const S = {
  scope: SCOPES.some((s) => s.key === p.get('scope')) ? p.get('scope') : 'all',
  q: p.get('q') || '',
  genres: new Set(listParam('genres')),
  platforms: new Set(listParam('platforms')),
  sort: p.get('sort') || '',
  view: p.get('view') === 'list' ? 'list' : 'grid',
};
let page = 1;
let shown = [];      // games currently rendered
let token = 0;       // latest request wins
let lib = new Map();
let reviews = new Map();
let libGames = null; // { ids, loaded: game[] } for "My" scopes

function syncUrl() {
  const u = new URLSearchParams();
  if (S.scope !== 'all') u.set('scope', S.scope);
  if (S.q) u.set('q', S.q);
  if (S.genres.size) u.set('genres', [...S.genres].join(','));
  if (S.platforms.size) u.set('platforms', [...S.platforms].join(','));
  if (S.sort) u.set('sort', S.sort);
  if (S.view === 'list') u.set('view', 'list');
  const qs = u.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
}

// ---------- Controls ----------
function renderScopes() {
  const count = (key) => [...lib.values()].filter((s) => s === key).length;
  $('#scopes').innerHTML = html`${SCOPES.map((s) => html`
    <button type="button" class="scope" data-scope="${s.key}" aria-pressed="${s.key === S.scope}">
      ${icon(s.icon, { cls: s.cls || '' })}<span class="label">${s.label}</span>${s.mine ? html`<span class="count">${count(s.key)}</span>` : ''}
    </button>`)}`;
}

const chip = (label, value, set) => html`<button type="button" class="chip" data-v="${value}" aria-pressed="${set.has(value)}">${label}</button>`;
function renderChips() {
  $('#genres').innerHTML = html`${GENRES.map(([l, v]) => chip(l, v, S.genres))}`;
  $('#platforms').innerHTML = html`${PLATFORMS.map(([l, v]) => chip(l, v, S.platforms))}`;
  $('#sort').value = S.sort;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
}

// ---------- Queries ----------
function rawgQuery() {
  const today = new Date();
  const q = { page, page_size: PAGE };
  if (S.q) { q.search = S.q; q.search_precise = 'true'; }
  if (S.genres.size) q.genres = [...S.genres].join(',');
  if (S.platforms.size) q.parent_platforms = [...S.platforms].join(',');
  if (S.scope === 'trending') q.dates = `${isoDay(addDays(today, -30))},${isoDay(today)}`;
  if (S.scope === 'soon') q.dates = `${isoDay(addDays(today, 1))},${isoDay(addDays(today, 365))}`;
  // "Newest" would otherwise surface far-future placeholders; cap at today outside Coming soon.
  if (S.sort === '-released' && S.scope !== 'soon') q.dates = q.dates || `1970-01-01,${isoDay(today)}`;
  const fallback = S.scope === 'all' ? '' : '-added';
  if (S.sort || fallback) q.ordering = S.sort || fallback;
  return q;
}

// Library scopes filter and sort client-side over the games loaded so far.
function filterMine(games) {
  const needle = S.q.toLowerCase();
  const out = games.filter((g) => (!needle || g.name.toLowerCase().includes(needle))
    && (!S.genres.size || (g.genres || []).some((x) => S.genres.has(x.slug)))
    && (!S.platforms.size || (g.parent_platforms || []).some((x) => S.platforms.has(String(x.platform.id)))));
  const by = {
    '-added': (a, b) => (b.added || 0) - (a.added || 0),
    '-metacritic': (a, b) => (b.metacritic || 0) - (a.metacritic || 0),
    '-released': (a, b) => String(b.released || '').localeCompare(String(a.released || '')),
  }[S.sort];
  return by ? out.slice().sort(by) : out;
}

const filterNote = () => {
  const names = [...GENRES.filter(([, v]) => S.genres.has(v)), ...PLATFORMS.filter(([, v]) => S.platforms.has(v))].map(([l]) => l);
  return names.length ? ` in ${names.join(', ')}` : '';
};

function setCount(n, more) {
  const scope = SCOPES.find((s) => s.key === S.scope);
  const what = S.q ? html` for “${S.q}”` : (S.scope === 'all' ? '' : html` in ${scope.label}`);
  $('#count').innerHTML = html`<b>${n.toLocaleString()}</b>${more ? '+' : ''} ${n === 1 ? 'game' : 'games'}${what}${filterNote()}`;
}

// ---------- Rendering ----------
function listRow(g) {
  const row = document.createElement('div');
  row.className = 'row lrow';
  row.innerHTML = html`
    <span class="cov" style="${covStyle(g.id)}">${coverImg(g.background_image, 420)}</span>
    <div class="lrow-main">
      <a class="row-title" href="${gameHref(g.id)}">${g.name}</a>
      <div class="row-sub">${[genreOf(g), yearOf(g)].filter(Boolean).join(', ') || 'TBA'}</div>
    </div>
    <span class="lrow-meta">${metaBadge(g.metacritic)}</span>
    <span class="lrow-lib"></span>`;
  const slot = row.querySelector('.lrow-lib');
  onStatus(g.id, (st) => {
    slot.innerHTML = st
      ? html`<span class="lib-tag">${icon(STATUS[st].icon, { fill: true, cls: STATUS[st].cls })}${STATUS[st].label}</span>`
      : html`<button type="button" class="btn btn-secondary btn-sm">${icon('add')}Wishlist</button>`;
    const b = slot.querySelector('button');
    if (b) b.addEventListener('click', () => changeStatus(g, 'wishlist'));
  }, row);
  return row;
}

function paint(games, append) {
  const box = $('#results');
  box.className = S.view === 'grid' ? 'grid-cards' : 'list-rows';
  const nodes = games.map((g) => (S.view === 'grid' ? gameCard(g, { reviews, year: true }) : listRow(g)));
  if (append) box.append(...nodes); else box.replaceChildren(...nodes);
  loaded(box);
}

function showEmpty(msg, retry) {
  const box = $('#results');
  loaded(box);
  box.className = 'grid-cards';
  box.innerHTML = html`<div class="empty boxed"><span>${msg}</span>${retry ? html`<button type="button" class="btn btn-secondary btn-sm" id="retry">Try again</button>` : ''}</div>`;
  if (retry) $('#retry').addEventListener('click', () => load());
  $('#more').hidden = true;
}

async function load(append = false) {
  const my = ++token;
  const box = $('#results');
  const more = $('#more');
  if (!append) {
    page = 1;
    shown = [];
    box.className = S.view === 'grid' ? 'grid-cards' : 'list-rows';
    box.setAttribute('aria-busy', 'true');
    box.innerHTML = S.view === 'grid' ? skeletonCards(8) : skeletonRows(6);
    more.hidden = true;
  } else {
    more.disabled = true;
    more.textContent = 'Loading…';
  }

  try {
    if (SCOPES.find((s) => s.key === S.scope).mine) {
      if (!libGames || libGames.scope !== S.scope) {
        libGames = { scope: S.scope, ids: [...lib].filter(([, st]) => st === S.scope).map(([id]) => id), loaded: [] };
      }
      if (append || !libGames.loaded.length) {
        const next = libGames.ids.slice(libGames.loaded.length, libGames.loaded.length + PAGE);
        const data = await batch(next);
        libGames.loaded.push(...next.map((id) => data[id] || { id, name: 'Details unavailable' }));
      }
      if (my !== token) return;
      const games = filterMine(libGames.loaded);
      const hasMore = libGames.loaded.length < libGames.ids.length;
      if (!games.length) setCount(0, false);
      if (!libGames.ids.length) return showEmpty(`Nothing in ${SCOPES.find((s) => s.key === S.scope).label} yet. Add games from search or the cards’ quick actions.`);
      if (!games.length) return showEmpty('No games on this shelf match those filters.');
      shown = games;
      paint(games, false);
      setCount(games.length, hasMore);
      more.hidden = !hasMore;
    } else {
      const data = await rawg(rawgQuery());
      if (my !== token) return;
      if (!append && !data.results.length) {
        setCount(0, false);
        return showEmpty(S.q ? `No games found for “${S.q}”. Try fewer filters or a different spelling.` : 'No games match those filters.');
      }
      shown = shown.concat(data.results);
      paint(data.results, append);
      setCount(data.count, false);
      more.hidden = !data.next;
    }
  } catch (err) {
    if (my !== token) return;
    if (append) {
      more.textContent = 'Try again';
      more.disabled = false;
      return;
    }
    showEmpty(upstreamMessage(err), true);
    return;
  }
  more.disabled = false;
  more.textContent = 'Load more';
}

function refresh() {
  syncUrl();
  renderChips();
  load();
}

// ---------- Events ----------
$('#q').value = S.q;
let debounce;
$('#q').addEventListener('input', (e) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    S.q = e.target.value.trim();
    refresh();
  }, 300);
});
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

$('#scopes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-scope]');
  if (!b || b.dataset.scope === S.scope) return;
  S.scope = b.dataset.scope;
  renderScopes();
  refresh();
});

for (const [sel, set] of [['#genres', S.genres], ['#platforms', S.platforms]]) {
  $(sel).addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    if (set.has(b.dataset.v)) set.delete(b.dataset.v); else set.add(b.dataset.v);
    refresh();
  });
}

$('#sort').addEventListener('change', (e) => { S.sort = e.target.value; refresh(); });

document.querySelector('.seg.icons').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b || b.dataset.view === S.view) return;
  S.view = b.dataset.view;
  syncUrl();
  renderChips();
  paint(shown, false); // same results, new layout, no refetch
});

$('#more').addEventListener('click', () => {
  page += 1;
  load(true);
});

document.addEventListener('library:change', (e) => {
  renderScopes();
  // On a "My" shelf, a game that leaves the shelf leaves the list (Undo brings it back).
  if (libGames && libGames.scope === S.scope) {
    const g = e.detail.game;
    if (e.detail.status === S.scope && g && !libGames.ids.includes(g.id)) {
      libGames.ids.unshift(g.id);
      libGames.loaded.unshift(g);
    }
    libGames.ids = libGames.ids.filter((id) => lib.get(id) === S.scope);
    libGames.loaded = libGames.loaded.filter((x) => lib.get(x.id) === S.scope);
    load();
  }
});

// ---------- Boot ----------
renderScopes();
renderChips();
Promise.all([library(), myReviews()])
  .then(([l, r]) => { lib = l; reviews = r; })
  .catch(() => {})
  .finally(() => { renderScopes(); load(); });
