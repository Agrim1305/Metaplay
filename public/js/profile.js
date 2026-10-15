// Player profile: a player card built from your shelves, reviews and friends.
// ?view=reviews shows every review with inline edit and delete (replaces my_reviews.html).
import './ui/nav.js';
import { api, me, library, myReviews, batch } from './ui/api.js';
import { html, el, icon, initials, params, ago } from './ui/dom.js';
import { coverImg, covStyle } from './ui/art.js';
import { gameHref } from './ui/gameCard.js';
import { scorePips } from './ui/scorePips.js';
import { toast } from './ui/toast.js';
import { loaded } from './ui/skeleton.js';
import { xpFor, levelFor, badgesFor, genreCounts } from './ui/progress.js';

const root = document.getElementById('profile');
const V = [
  'linear-gradient(135deg,#3b1d4a,#c2416b 60%,#ffb47a)', 'linear-gradient(160deg,#0f2b3d,#1f7a8c 55%,#bfe3c0)',
  'linear-gradient(140deg,#1a1a2e,#4b3f8f 50%,#e0a3ff)', 'linear-gradient(150deg,#2d1606,#a2471a 55%,#f6c667)',
  'linear-gradient(135deg,#071d14,#1f6f4a 55%,#d4f59b)', 'linear-gradient(160deg,#1d0b0b,#7d1d2a 50%,#ff7a59)',
  'linear-gradient(140deg,#0b1430,#2b5bb8 55%,#9fd3ff)',
];
const GENRE_COLORS = ['#FF4D6D', '#FFB547', '#C79BFF', '#5AB8FF', '#5BE3A8', '#8CEBE6'];
const GENRE_ICONS = {
  action: 'bolt', indie: 'auto_awesome', 'role-playing-games-rpg': 'swords', adventure: 'explore', platformer: 'sports_esports',
  strategy: 'chess', shooter: 'target', puzzle: 'extension', racing: 'sports_motorsports', sports: 'sports_soccer',
  simulation: 'precision_manufacturing', arcade: 'joystick', casual: 'mood', fighting: 'sports_mma',
  'massively-multiplayer': 'groups', family: 'family_restroom', 'board-games': 'casino', card: 'playing_cards', educational: 'school',
};
// Profile score colours (board 05): 1-4 red, 5-7 amber, 8-10 green.
const band = (n) => (n >= 8 ? '#5BE3A8' : n >= 5 ? '#FFB547' : '#FF4D6D');
const tint = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function fail(err) {
  loaded(root);
  root.innerHTML = html`<main class="page"><div class="empty boxed" role="alert"><span>Couldn’t load your profile. ${err.message}</span>
    <button type="button" class="btn btn-secondary btn-sm" id="retry">Try again</button></div></main>`;
  root.querySelector('#retry').addEventListener('click', () => location.reload());
}

// ---------- Player card ----------
function renderCard({ user, stats, lib, reviews, games }) {
  const idsOn = (s) => [...lib].filter(([, st]) => st === s).map(([id]) => id);
  const known = (ids) => ids.map((id) => games[id]).filter(Boolean);
  const tracked = known([...lib.keys()]);
  const genres = genreCounts(tracked);
  const doneGenres = genreCounts(known(idsOn('completed')));
  const specialist = doneGenres[0] ? { genre: doneGenres[0].name, count: doneGenres[0].count } : null;
  const title = specialist && specialist.count >= 5 ? `${specialist.genre} specialist`
    : genres[0] ? `${genres[0].name} fan` : 'New player';
  const c = stats.counts;
  const lv = levelFor(xpFor({ completed: c.completed, reviews: stats.reviews, tracked: stats.tracked }));
  const hint = lv.toNext <= 50 ? 'One more review gets you there.'
    : lv.toNext <= 100 ? 'One more completed game gets you there.'
      : `About ${Math.ceil(lv.toNext / 100)} more completed games.`;
  const badges = badgesFor({ completed: c.completed, reviews: stats.reviews, tracked: stats.tracked, friends: stats.friends, ownsGroup: stats.ownsGroup, specialist })
    .sort((a, b) => b.on - a.on);
  const banner = known([...idsOn('completed'), ...idsOn('playing'), ...reviews.keys(), ...idsOn('wishlist')]).filter((g) => g.background_image);
  const uniqueBanner = [...new Map(banner.map((g) => [g.id, g])).values()].slice(0, 7);
  const playing = known(idsOn('playing')).slice(0, 4);
  const top = genres.slice(0, 6).map((g, i) => ({ ...g, color: GENRE_COLORS[i] }));
  const hist = stats.histogram;
  const max = Math.max(1, ...hist);
  const rated = [...reviews.values()];
  const vsRawg = rated.filter((r) => games[r.gameId] && games[r.gameId].rating);
  const diff = vsRawg.length
    ? vsRawg.reduce((a, r) => a + r.rating - games[r.gameId].rating * 2, 0) / vsRawg.length : null;
  const fame = rated.filter((r) => r.rating >= 9).sort((a, b) => b.rating - a.rating).slice(0, 10);
  const recent = rated.slice(0, 3);
  const name = (r) => (games[r.gameId] && games[r.gameId].name) || r.gameName || 'Game';
  const img = (id) => games[id] && games[id].background_image;
  const tiles = [
    ['Playing now', c.playing, 'play_arrow', '#FF4D6D', '/pages/discover.html?scope=playing'],
    ['On the wishlist', c.wishlist, 'bookmark', '#FFB547', '/pages/discover.html?scope=wishlist'],
    ['Games beaten', c.completed, 'emoji_events', '#5AB8FF', '/pages/discover.html?scope=completed'],
    ['Reviews written', stats.reviews, 'rate_review', '#5BE3A8', '/pages/profile.html?view=reviews'],
  ];

  loaded(root);
  root.innerHTML = html`
  <section class="pc" aria-label="Player card">
    <div class="pc-banner" aria-hidden="true">
      ${V.map((grad, i) => html`<span class="pc-tile" style="background-image:${grad}">${uniqueBanner[i] ? coverImg(uniqueBanner[i].background_image, 420, true) : ''}</span>`)}
    </div>
    <div class="pc-shade" aria-hidden="true"></div>
    <div class="pc-in">
      <span class="pc-ava" aria-hidden="true"><span>${initials(user.username)}</span></span>
      <div class="pc-id">
        <div class="pc-chips">
          <span class="title-chip">${icon('swords', { fill: true })}${title}</span>
          ${user.role === 'admin' ? html`<span class="role-chip">Admin</span>` : ''}
        </div>
        <h1>${user.username}</h1>
        ${user.bio ? html`<p class="pc-bio">${user.bio}</p>` : html`<p class="pc-bio faint">No bio yet. <a class="ulink" href="/pages/edit_profile.html">Add one</a></p>`}
      </div>
      <div class="lvl">
        <div class="lvl-top">
          <div class="lvl-n"><span>Level</span><span class="num lvl-num" style="background:linear-gradient(135deg,#FFD27A,#FF4D6D);-webkit-background-clip:text;background-clip:text;color:transparent">${lv.level}</span></div>
          <span class="lvl-xp">${lv.xp.toLocaleString()} XP</span>
        </div>
        <div class="xpbar" role="progressbar" aria-label="Progress to level ${lv.level + 1}" aria-valuenow="${lv.pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${lv.pct}%"></div></div>
        <div class="lvl-hint">${lv.toNext.toLocaleString()} XP to level ${lv.level + 1}. ${hint}</div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="share">Share profile</button>
          <a class="btn btn-secondary" href="/pages/edit_profile.html">Edit profile</a>
        </div>
      </div>
    </div>
  </section>
  <main class="p-main">
    <section class="tiles" aria-label="Shelves">
      ${tiles.map(([label, n, ic, color, href]) => html`
        <a class="tile pcard" href="${href}" style="--c:${color};background:${tint(color, 0.1)};border:1px solid ${tint(color, 0.28)}">
          <span class="tile-ic">${icon(ic, { fill: true })}</span>
          <span class="tile-text"><span class="num">${n}</span><span class="tile-l">${label}</span></span>
        </a>`)}
    </section>

    <div class="two">
      <section class="p-sec" aria-labelledby="ach">
        <div class="p-head"><h2 id="ach">Achievements</h2><span class="aside"><b class="gold">${badges.filter((b) => b.on).length}</b> of ${badges.length} unlocked</span></div>
        <ul class="badges">
          ${badges.map((b) => html`
            <li class="badge ${b.on ? '' : 'locked'}">
              <span class="hex" style="${b.on ? `background:${b.bg}` : ''}">${icon(b.icon, { fill: true })}</span>
              <b>${b.name}</b><span class="d">${b.on ? '' : html`<span class="sr-only">Locked. </span>`}${b.desc}</span>
            </li>`)}
        </ul>
      </section>
      <section class="p-sec" aria-labelledby="now">
        <div class="p-head"><h2 id="now">Now playing</h2>${c.playing ? html`<a href="/pages/discover.html?scope=playing">All ${c.playing}</a>` : ''}</div>
        ${playing.length ? html`<div class="now">${playing.map((g) => html`
          <a class="pcard" href="${gameHref(g.id)}">
            <span class="cov shade" style="${covStyle(g.id)}">${coverImg(g.background_image, 640)}
              <span class="play-tag">${icon('play_arrow', { fill: true })}Playing</span>
              <span class="now-name">${g.name}</span>
            </span>
          </a>`)}</div>`
    : html`<div class="empty boxed"><span>Nothing on the go.</span><a class="btn btn-secondary btn-sm" href="/pages/discover.html?scope=wishlist">Pick from your wishlist</a></div>`}
      </section>
    </div>

    <div class="two">
      <section class="p-sec" aria-labelledby="genres">
        <div class="p-head"><div><h2 id="genres">What you play</h2><p>Genres across ${plural(tracked.length, 'game')}</p></div></div>
        ${top.length ? html`
          <div class="gbar" aria-hidden="true">${top.map((g) => html`<span style="flex:${g.count};background:${g.color}"></span>`)}</div>
          <ul class="chips gchips">${top.map((g) => html`
            <li class="gchip" style="background:${tint(g.color, 0.14)}">
              <i style="background:${g.color}">${icon(GENRE_ICONS[g.slug] || 'sports_esports', { fill: true })}</i>${g.name}<span class="mono">${g.count}</span>
            </li>`)}</ul>`
    : html`<div class="empty boxed"><span>Add games to your shelves to see what you play.</span></div>`}
      </section>
      <section class="p-sec" aria-labelledby="dist">
        <div class="p-head">
          <div><h2 id="dist">How you score</h2>
            <p>${stats.reviews ? `${plural(stats.reviews, 'review')}.` : 'No reviews yet.'}${diff !== null && Math.abs(diff) >= 0.1 ? ` You rate ${Math.abs(diff).toFixed(1)} ${diff > 0 ? 'higher' : 'lower'} than RAWG players.` : ''}</p></div>
          ${stats.averageScore !== null ? html`<span class="avg"><span class="num" style="color:${band(Math.round(stats.averageScore))}">${stats.averageScore.toFixed(1)}</span><span>avg</span></span>` : ''}
        </div>
        <div class="hist" role="img" aria-label="Score distribution: ${hist.map((n, i) => `${i + 1}: ${n}`).join(', ')}">
          ${hist.map((n, i) => html`<div><span class="c">${n || ''}</span><span class="b" style="height:${n ? Math.round((n / max) * 116) : 3}px;background:${n ? band(i + 1) : '#24262B'}"></span></div>`)}
        </div>
        <div class="hist-n" aria-hidden="true">${hist.map((_, i) => html`<span class="num" style="color:${band(i + 1)}">${i + 1}</span>`)}</div>
      </section>
    </div>

    <section class="p-sec" aria-labelledby="fame">
      <div class="p-head"><h2 id="fame">Hall of fame</h2><span class="aside">Every game you scored 9 or 10</span></div>
      ${fame.length ? html`<div class="fame">${fame.map((r) => html`
        <a class="pcard" href="${gameHref(r.gameId)}">
          <span class="cov shade" style="${covStyle(r.gameId)}">${coverImg(img(r.gameId), 640)}
            <span class="medal ${r.rating === 10 ? 'gold' : 'silver'}" aria-label="Scored ${r.rating}"><span class="num">${r.rating}</span></span>
            <span class="fame-name">${name(r)}</span>
          </span>
        </a>`)}</div>`
    : html`<div class="empty boxed"><span>Score a game 9 or 10 and it lands here.</span></div>`}
    </section>

    <section class="p-sec" aria-labelledby="recent">
      <div class="p-head"><h2 id="recent">Recent reviews</h2>${stats.reviews ? html`<a href="/pages/profile.html?view=reviews">All ${plural(stats.reviews, 'review')}</a>` : ''}</div>
      ${recent.length ? html`<div class="recent">${recent.map((r) => html`
        <article class="rcard">
          <span class="cov" style="${covStyle(r.gameId)}">${coverImg(img(r.gameId), 420)}</span>
          <div class="rcard-body">
            <div class="rcard-top"><a href="${gameHref(r.gameId)}">${name(r)}</a><span class="num schip" style="background:${band(r.rating)}" aria-label="Scored ${r.rating} out of 10">${r.rating}</span></div>
            ${r.review ? html`<p>${r.review}</p>` : html`<p class="faint">No written review.</p>`}
            <span class="when">${ago(r.updatedAt || r.createdAt)}</span>
          </div>
        </article>`)}</div>`
    : html`<div class="empty boxed"><span>You haven’t reviewed anything yet.</span><a class="btn btn-secondary btn-sm" href="/pages/discover.html?scope=completed">Rate a completed game</a></div>`}
    </section>
  </main>`;

  root.querySelector('#share').addEventListener('click', async () => {
    const text = `${user.username} on MetaPlay: level ${lv.level}, ${plural(c.completed, 'game')} beaten, ${plural(stats.reviews, 'review')}.`;
    try {
      if (navigator.share) await navigator.share({ title: 'MetaPlay', text });
      else { await navigator.clipboard.writeText(text); toast('Copied a summary of your profile'); }
    } catch { /* cancelled */ }
  });
}

// ---------- All reviews ----------
function renderReviews({ reviews, games }) {
  const list = [...reviews.values()];
  const name = (r) => (games[r.gameId] && games[r.gameId].name) || r.gameName || 'Game';
  loaded(root);
  root.innerHTML = html`
    <main class="page rv">
      <div class="rv-head">
        <a class="g-back" href="/pages/profile.html">${icon('arrow_back')}Profile</a>
        <h1 class="page-title">All reviews</h1>
        <p class="muted" id="rv-count"></p>
      </div>
      <div class="rv-list" id="rv-list"></div>
    </main>`;
  const box = root.querySelector('#rv-list');
  const count = () => {
    root.querySelector('#rv-count').textContent = list.length ? plural(list.length, 'review') : '';
    if (!list.length) box.innerHTML = html`<div class="empty boxed"><span>You haven’t reviewed anything yet.</span><a class="btn btn-secondary btn-sm" href="/pages/discover.html?scope=completed">Rate a completed game</a></div>`;
  };

  const item = (r) => {
    const node = el(html`<article class="rv-item">
      <a class="cov" href="${gameHref(r.gameId)}" style="${covStyle(r.gameId)}" tabindex="-1" aria-hidden="true">${coverImg(games[r.gameId] && games[r.gameId].background_image, 420)}</a>
      <div class="rv-body"></div>
    </article>`);
    const body = node.querySelector('.rv-body');
    const view = () => {
      body.innerHTML = html`
        <div class="rv-top"><a class="rv-name" href="${gameHref(r.gameId)}">${name(r)}</a><span class="mono rv-score">${r.rating}/10</span></div>
        ${r.review ? html`<p class="rv-text">${r.review}</p>` : html`<p class="rv-text faint">No written review.</p>`}
        <div class="rv-foot"><span class="faint small">${ago(r.updatedAt || r.createdAt)}</span>
          <span class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-act="edit">Edit</button><button type="button" class="btn btn-secondary btn-sm" data-act="delete">Delete</button></span></div>`;
    };
    const edit = () => {
      let score = r.rating;
      body.innerHTML = html`
        <div class="rv-top"><span class="rv-name">${name(r)}</span></div>
        <div class="pips-slot"></div>
        <label class="field">Review<textarea class="input" rows="3" maxlength="1000">${r.review || ''}</textarea></label>
        <div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-act="save">Save</button><button type="button" class="btn btn-secondary btn-sm" data-act="cancel">Cancel</button></div>`;
      const pips = scorePips(score, (n) => { score = n; }, `Score for ${name(r)}`);
      body.querySelector('.pips-slot').replaceWith(pips);
      pips.querySelectorAll('button')[score - 1].focus();
      body.getScore = () => score;
    };
    body.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
      if (act === 'edit') edit();
      if (act === 'cancel') { view(); body.querySelector('[data-act="edit"]').focus(); }
      if (act === 'save') {
        const next = { rating: body.getScore(), review: body.querySelector('textarea').value.trim() };
        try {
          await api(`/user-review/${r.gameId}`, { method: 'PUT', body: next });
          Object.assign(r, next, { updatedAt: new Date().toISOString() });
          view();
          toast('Review saved');
        } catch (err) { toast(`Couldn’t save: ${err.message}`); }
      }
      if (act === 'delete') {
        try {
          await api(`/user-review/${r.gameId}`, { method: 'DELETE' });
          const at = list.indexOf(r);
          list.splice(at, 1);
          const next = node.nextElementSibling;
          node.remove();
          count();
          toast(`Deleted your review of ${name(r)}`, {
            undo: async () => {
              try {
                await api('/user-review', { method: 'POST', body: { gameId: r.gameId, rating: r.rating, review: r.review, gameName: name(r) } });
                list.splice(at, 0, r);
                if (!list.length || box.querySelector('.empty')) box.replaceChildren();
                box.insertBefore(node, next && next.isConnected ? next : null);
                count();
              } catch { toast('Couldn’t restore the review.'); }
            },
          });
        } catch (err) { toast(`Couldn’t delete: ${err.message}`); }
      }
    });
    view();
    return node;
  };

  box.replaceChildren(...list.map(item));
  count();
}

// ---------- Boot ----------
(async () => {
  let user; let stats; let lib; let reviews;
  try {
    [user, stats, lib, reviews] = await Promise.all([me(), api('/api/me/stats'), library(), myReviews()]);
  } catch (err) {
    fail(err);
    return;
  }
  // RAWG details: shelves and reviewed games, most relevant first.
  // ponytail: two batches (80 games); genre stats cover what we load, add paging if libraries outgrow it.
  const ids = [...new Set([
    ...[...lib].filter(([, s]) => s === 'playing').map(([id]) => id),
    ...[...lib].filter(([, s]) => s === 'completed').map(([id]) => id),
    ...reviews.keys(),
    ...[...lib].filter(([, s]) => s === 'wishlist').map(([id]) => id),
  ])].slice(0, 80);
  const games = {};
  try {
    const [a, b] = await Promise.all([batch(ids.slice(0, 40)), batch(ids.slice(40))]);
    Object.assign(games, a, b);
  } catch { /* cards fall back to gradients and stored names */ }

  if (params().get('view') === 'reviews') {
    document.title = 'Your reviews · MetaPlay';
    renderReviews({ reviews, games });
  } else {
    document.title = `${user.username} · MetaPlay`;
    renderCard({ user, stats, lib, reviews, games });
  }
})();

