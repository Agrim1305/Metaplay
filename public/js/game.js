// Game page: replaces the old game modal on every page.
import './ui/nav.js';
import { api, rawg, myReviews, fromDb, STATUS, upstreamMessage } from './ui/api.js';
import { html, icon, params, ago, initials } from './ui/dom.js';
import { coverImg, covStyle } from './ui/art.js';
import { statusControl, onStatus } from './ui/statusControl.js';
import { scorePips, SCORE_WORDS } from './ui/scorePips.js';
import { gameCard } from './ui/gameCard.js';
import { skeletonCards, loaded } from './ui/skeleton.js';
import { toast } from './ui/toast.js';

const root = document.getElementById('game');
const id = Number(params().get('id'));

const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const band = (m) => (m >= 90 ? 'hi' : m >= 75 ? 'mid' : 'lo');
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
const HINT = { wishlist: 'On your wishlist', playing: 'On your Playing shelf', completed: 'On your Completed shelf' };
const RATING_COLORS = { exceptional: 'var(--meta-high)', recommended: 'var(--completed)', meh: 'var(--wishlist)', skip: 'var(--brand)' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function fail(err) {
  loaded(root);
  const notFound = !err || err.status === 404 || err.status === 400;
  root.innerHTML = html`<main class="page"><div class="empty boxed" role="alert">
    <span>${notFound ? 'We couldn’t find that game.' : upstreamMessage(err)}</span>
    ${notFound
    ? html`<a class="btn btn-secondary" href="/pages/discover.html">Browse games</a>`
    : html`<button type="button" class="btn btn-secondary" id="retry">Try again</button>`}
  </div></main>`;
  const retry = root.querySelector('#retry');
  if (retry) retry.addEventListener('click', () => location.reload());
}

function factsLine(g) {
  const released = g.released ? new Date(`${g.released}T00:00:00`) : null;
  const when = g.tba || !released
    ? 'Release date TBA'
    : `${released > new Date() ? 'Releases' : 'Released'} ${fmtDate(g.released)}`;
  return [
    g.developers && g.developers[0] && g.developers[0].name,
    when,
    (g.platforms || []).map((p) => p.platform.name).slice(0, 6).join(', '),
  ].filter(Boolean).map((s) => `${s}.`).join(' ');
}

function render(g) {
  const upcoming = !g.released || new Date(`${g.released}T00:00:00`) > new Date();
  const paras = (g.description_raw || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const lead = paras[0] && paras[0].length < 220 ? 2 : 1;
  const ratings = (g.ratings || []).slice().sort((a, b) => b.id - a.id);
  const genre = g.genres && g.genres[0];
  const website = safeUrl(g.website);
  const details = [
    ['Developer', (g.developers || []).map((d) => d.name).join(', ')],
    ['Publisher', (g.publishers || []).map((d) => d.name).join(', ')],
    ['Released', g.released ? fmtDate(g.released) : 'TBA'],
    ['Average playtime', g.playtime ? `${g.playtime} hours` : ''],
    ['ESRB', g.esrb_rating && g.esrb_rating.name],
  ].filter(([, v]) => v);

  loaded(root);
  root.innerHTML = html`
  <section class="g-hero" aria-label="Game header">
    <div class="g-backdrop cov" aria-hidden="true" style="${covStyle(g.id)}">${coverImg(g.background_image, 1280, true)}</div>
    <div class="g-hero-in">
      <a class="g-back" href="/pages/dashboard.html">${icon('arrow_back')}Back</a>
      <div class="g-head">
        <div class="g-title-block">
          ${g.genres && g.genres.length ? html`<div class="g-genres">${g.genres.map((x) => x.name).join(', ')}</div>` : ''}
          <h1>${g.name}</h1>
          <div class="g-facts">${factsLine(g)}</div>
        </div>
        <dl class="g-scores">
          <div><dt>Metacritic</dt><dd class="${g.metacritic ? band(g.metacritic) : 'lo'}">${g.metacritic || '–'}</dd></div>
          <div><dt>RAWG</dt><dd>${g.rating ? g.rating.toFixed(1) : '–'}<small>/5</small></dd></div>
          <div><dt>You</dt><dd><span id="you-score">–</span><small>/10</small></dd></div>
        </dl>
      </div>
      <div class="g-actions">
        <span id="status-slot"></span>
        <span class="g-hint" id="status-hint" aria-live="polite"></span>
        ${upcoming ? '' : html`<a class="btn btn-primary push" href="#review" id="write-review">Write a review</a>`}
        <button type="button" class="btn btn-secondary btn-icon ${upcoming ? 'push' : ''}" id="share" aria-label="Share game">${icon('ios_share')}</button>
      </div>
    </div>
  </section>
  <main class="g-main">
    <div class="g-primary">
      <section class="shots" aria-labelledby="shots-h" hidden>
        <h2 id="shots-h">Screenshots</h2>
        <div class="cov shot-main" style="${covStyle(g.id)}"></div>
        <div class="shot-thumbs rail" role="group" aria-label="Pick a screenshot"></div>
      </section>
      <section class="about" aria-labelledby="about-h">
        <h2 id="about-h">About</h2>
        ${paras.length ? paras.slice(0, lead).map((p) => html`<p>${p}</p>`) : html`<p class="muted">RAWG doesn’t have a description for this game yet.</p>`}
        ${paras.length > lead ? html`
          <div id="about-more" hidden>${paras.slice(lead).map((p) => html`<p>${p}</p>`)}</div>
          <button type="button" class="linkbtn" aria-expanded="false" aria-controls="about-more" id="about-toggle">Read more</button>` : ''}
      </section>
      <section class="review-form" id="review" aria-labelledby="review-h">
        <div class="head"><h2 id="review-h">Your review</h2><span class="faint" id="edited"></span></div>
        ${upcoming ? html`<p class="muted">You can review this once it’s out. Add it to your wishlist to see it on your release schedule.</p>` : html`
        <div class="stack-sm">
          <span class="score-line" id="score-line">Pick a score out of 10</span>
          <div id="pips-slot"></div>
        </div>
        <label class="field">Review
          <textarea class="input" id="review-text" rows="4" maxlength="1000" placeholder="What did you think? (optional)"></textarea>
        </label>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="save-review">Save review</button>
          <button type="button" class="btn btn-secondary" id="delete-review" hidden>Delete</button>
          <span class="form-msg err" id="review-msg" role="alert"></span>
        </div>`}
      </section>
    </div>
    <aside class="g-aside">
      <section aria-labelledby="dist-h">
        <h2 id="dist-h">RAWG player ratings</h2>
        ${ratings.length ? html`
          <div class="dist" aria-hidden="true">${ratings.map((r) => html`<span style="width:${r.percent}%;background:${RATING_COLORS[r.title] || 'var(--ink-3)'}"></span>`)}</div>
          <dl class="kv">${ratings.map((r) => html`<dt>${cap(r.title)}</dt><dd>${Math.round(r.percent)}%</dd>`)}</dl>
          <p class="faint small">${g.ratings_count.toLocaleString()} ratings</p>`
    : html`<p class="muted small">No RAWG ratings yet.</p>`}
      </section>
      <section aria-labelledby="circle-h">
        <h2 id="circle-h">In your circle</h2>
        <div id="circle"><div class="sk sk-line"></div></div>
      </section>
      <section aria-labelledby="details-h">
        <h2 id="details-h">Details</h2>
        <dl class="details">
          ${details.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}
          ${website ? html`<dt>Website</dt><dd><a class="ulink" href="${website}" target="_blank" rel="noopener noreferrer">${new URL(website).hostname.replace(/^www\./, '')}</a></dd>` : ''}
        </dl>
      </section>
    </aside>
    ${genre ? html`
    <section class="g-similar sec" aria-labelledby="similar-h">
      <h2 id="similar-h">More in ${genre.name}</h2>
      <div class="grid-cards" id="similar" aria-busy="true">${skeletonCards(5)}</div>
    </section>` : ''}
  </main>`;

  // Status control + hint
  root.querySelector('#status-slot').replaceWith(statusControl(g));
  const hint = root.querySelector('#status-hint');
  onStatus(g.id, (s) => { hint.textContent = s ? HINT[s] : 'Not in your library'; }, hint);

  // Back goes back when we came from inside the app
  root.querySelector('.g-back').addEventListener('click', (e) => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  });

  // Share
  root.querySelector('#share').addEventListener('click', async () => {
    const data = { title: `${g.name} on MetaPlay`, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
    } catch { /* user cancelled */ }
  });

  // About toggle
  const toggle = root.querySelector('#about-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const more = root.querySelector('#about-more');
      more.hidden = !more.hidden;
      toggle.setAttribute('aria-expanded', String(!more.hidden));
      toggle.textContent = more.hidden ? 'Read more' : 'Show less';
    });
  }

  if (!upcoming) setUpReview(g);
  loadShots(g);
  loadCircle(g);
  if (genre) loadSimilar(g, genre);
}

async function loadShots(g) {
  let images = [];
  try {
    images = (await api(`/rawg/games/${g.id}/screenshots`)).results.map((s) => s.image);
  } catch { /* fall back to the backdrops below */ }
  if (!images.length) images = [g.background_image, g.background_image_additional].filter(Boolean);
  if (!images.length) return;
  const sec = root.querySelector('.shots');
  const main = sec.querySelector('.shot-main');
  const thumbs = sec.querySelector('.shot-thumbs');
  const show = (i) => {
    main.innerHTML = coverImg(images[i], 1280, true);
    thumbs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
  };
  if (images.length > 1) {
    thumbs.innerHTML = images.slice(0, 6).map((src, i) => html`
      <button type="button" class="cov" style="${covStyle(g.id)}" aria-label="Screenshot ${i + 1}" aria-pressed="false">${coverImg(src, 420)}</button>`).join('');
    thumbs.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) show([...thumbs.children].indexOf(b));
    });
  } else thumbs.remove();
  sec.hidden = false;
  show(0);
}

async function loadCircle(g) {
  const box = root.querySelector('#circle');
  try {
    const friends = await api(`/api/games/${g.id}/friends`);
    box.innerHTML = friends.length
      ? friends.map((f) => {
        const s = STATUS[fromDb[f.status]];
        return html`<div class="circle-row">
          <span class="ava sm" aria-hidden="true">${initials(f.username)}</span>
          <span class="name">${f.username}</span>
          ${s ? html`<span class="st">${icon(s.icon, { fill: true, cls: s.cls })}${s.label}</span>` : html`<span class="st">Reviewed</span>`}
          <span class="sc">${f.rating ? `${f.rating}/10` : '–'}</span>
        </div>`;
      }).join('')
      : html`<p class="muted small">None of your friends have this one yet. <a class="ulink" href="/pages/social.html">Find friends</a></p>`;
  } catch {
    box.innerHTML = html`<p class="muted small">Couldn’t load friends right now.</p>`;
  }
}

async function loadSimilar(g, genre) {
  const grid = root.querySelector('#similar');
  try {
    const [data, reviews] = await Promise.all([
      rawg({ genres: genre.slug, ordering: '-added', page_size: 8 }),
      myReviews(),
    ]);
    const games = data.results.filter((x) => x.id !== g.id).slice(0, 5);
    grid.replaceChildren(...games.map((x) => gameCard(x, { reviews })));
    if (!games.length) grid.innerHTML = html`<p class="empty">Nothing else in ${genre.name} right now.</p>`;
  } catch (err) {
    grid.innerHTML = html`<p class="empty">${upstreamMessage(err)}</p>`;
  }
  loaded(grid);
}

async function setUpReview(g) {
  const sec = root.querySelector('#review');
  const text = sec.querySelector('#review-text');
  const save = sec.querySelector('#save-review');
  const del = sec.querySelector('#delete-review');
  const msg = sec.querySelector('#review-msg');
  const edited = sec.querySelector('#edited');
  const line = sec.querySelector('#score-line');
  const you = root.querySelector('#you-score');
  let score = 0;
  let saved = null; // { rating, review }

  const setLine = () => {
    line.innerHTML = score
      ? html`Score: <b>${score}/10</b>, ${SCORE_WORDS[score]}`
      : html`Pick a score out of 10`;
  };
  const pips = scorePips(0, (n) => { score = n; msg.textContent = ''; setLine(); });
  sec.querySelector('#pips-slot').replaceWith(pips);

  const show = (r) => {
    saved = r;
    score = r ? r.rating : 0;
    pips.setValue(score);
    text.value = r ? r.review || '' : '';
    you.textContent = r ? r.rating : '–';
    edited.textContent = r && r.updatedAt ? `Edited ${ago(r.updatedAt).toLowerCase()}` : '';
    del.hidden = !r;
    save.textContent = r ? 'Update review' : 'Save review';
    setLine();
  };

  const post = (r) => api('/user-review', {
    method: 'POST',
    body: { gameId: g.id, rating: r.rating, review: r.review || null, gameName: g.name, releaseDate: g.released, metaRating: g.rating },
  });

  save.addEventListener('click', async () => {
    if (!score) { msg.textContent = 'Pick a score first.'; pips.querySelector('button').focus(); return; }
    save.disabled = true;
    const r = { rating: score, review: text.value.trim(), updatedAt: new Date().toISOString() };
    try {
      await post(r);
      show(r);
      toast('Review saved');
    } catch (err) {
      msg.textContent = `Couldn’t save: ${err.message}`;
    } finally {
      save.disabled = false;
    }
  });

  del.addEventListener('click', async () => {
    const prev = saved;
    try {
      await api(`/user-review/${g.id}`, { method: 'DELETE' });
      show(null);
      toast('Review deleted', { undo: () => post(prev).then(() => show(prev)).catch(() => toast('Couldn’t restore the review.')) });
    } catch (err) {
      msg.textContent = `Couldn’t delete: ${err.message}`;
    }
  });

  // "Write a review" and #review links land on the first pip
  const focusReview = () => { sec.scrollIntoView({ block: 'start' }); pips.querySelector('button').focus({ preventScroll: true }); };
  const write = root.querySelector('#write-review');
  if (write) write.addEventListener('click', (e) => { e.preventDefault(); focusReview(); });

  try {
    show(await api(`/user-review/${g.id}`));
  } catch {
    show(null);
  }
  if (location.hash === '#review') focusReview();
}

(async () => {
  if (!id) { fail(null); return; }
  try {
    const game = await api(`/rawg/games/${id}`);
    document.title = `${game.name} · MetaPlay`;
    render(game);
  } catch (err) {
    fail(err);
  }
})();

