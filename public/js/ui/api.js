// Fetch helpers plus the two pieces of per-user state most pages share:
// the signed-in user and the library (game id -> status).

// The DB keeps the original status names; the UI uses the shelf names.
export const STATUS = {
  wishlist: { db: 'wishlist', label: 'Wishlist', icon: 'bookmark', cls: 'c-wish' },
  playing: { db: 'collection', label: 'Playing', icon: 'play_arrow', cls: 'c-play' },
  completed: { db: 'played', label: 'Completed', icon: 'check_circle', cls: 'c-done' },
};
export const fromDb = { wishlist: 'wishlist', collection: 'playing', played: 'completed' };

export async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    location.href = '/pages/login.html';
    throw Object.assign(new Error('Not logged in'), { status: 401 });
  }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error; } catch { /* not JSON */ }
    throw Object.assign(new Error(msg || `Request failed (${res.status})`), { status: res.status });
  }
  return res.json();
}

let mePromise;
export const me = () => (mePromise ||= api('/get-user'));

let libPromise;
export const library = () => (libPromise ||= api('/user-games')
  .then((rows) => new Map(rows.map((r) => [r.gameId, fromDb[r.status]]))));

// game id -> { rating, review, updatedAt }
let reviewsPromise;
export const myReviews = () => (reviewsPromise ||= api('/user-review')
  .then((rows) => new Map(rows.map((r) => [r.gameId, r])))
  .catch(() => new Map()));

// RAWG details for many games in one request. Returns { [id]: game }, missing ids dropped.
// ponytail: capped at 40 ids per call so the server's parallel RAWG fan-out stays polite.
export async function batch(ids) {
  const unique = [...new Set(ids)].slice(0, 40);
  if (!unique.length) return {};
  const data = await api('/rawg/games/batch', { method: 'POST', body: { ids: unique } });
  for (const k of Object.keys(data)) if (!data[k] || !data[k].id) delete data[k];
  return data;
}

// RAWG list endpoint through the proxy. Throws with .status 429/504 on upstream trouble.
export const rawg = (query) => api(`/rawg/games?${new URLSearchParams(query)}`);

export const isoDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const genreOf = (g) => (g.genres && g.genres[0] ? g.genres[0].name : '');
export const yearOf = (g) => (g.released ? g.released.slice(0, 4) : '');
export const platformsOf = (g, max = 4) => (g.parent_platforms || g.platforms || [])
  .map((p) => p.platform.name).slice(0, max).join(', ');

export const upstreamMessage = (err) => (err && err.status === 429
  ? 'RAWG is rate-limiting us right now.'
  : err && (err.status === 504 || err.status === 502) ? 'RAWG is slow to respond.' : 'Couldn’t load games.');
