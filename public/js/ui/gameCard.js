// Game tile: 16:10 cover, Metacritic badge, quick actions on hover/focus, title, one meta line.
import { STATUS, genreOf, yearOf } from './api.js';
import { html, el, icon } from './dom.js';
import { coverImg, covStyle } from './art.js';
import { changeStatus, onStatus } from './statusControl.js';

export const gameHref = (id) => `/pages/game.html?id=${id}`;

export const metaBadge = (m) => (m
  ? html`<span class="meta-badge ${m >= 90 ? 'hi' : m >= 75 ? 'mid' : ''}" title="Metacritic ${m}"><span class="sr-only">Metacritic </span>${m}</span>`
  : '');

const QA = [
  ['wishlist', 'bookmark', 'c-wish'],
  ['playing', 'play_arrow', 'c-play'],
  ['completed', 'check', 'c-done'],
];

// What the right side of the meta line says about the game in your library.
function mine(status, rating) {
  if (!status) return '';
  const s = STATUS[status];
  const ic = icon(s.icon, { fill: true, cls: s.cls, label: s.label });
  if (rating) return html`<span class="card-mine scored">${ic}${rating}/10</span>`;
  if (status === 'completed') return html`<span class="card-mine rate">${ic}Rate it</span>`;
  return html`<span class="card-mine">${ic}</span>`;
}

// opts.reviews: Map id -> review (for "8/10"), opts.year: show year after genre
export function gameCard(game, { reviews, year = false } = {}) {
  const sub = [genreOf(game), year && yearOf(game)].filter(Boolean).join(', ') || (game.released ? '' : 'TBA');
  const card = el(html`
    <article class="card">
      <div class="cov" style="${covStyle(game.id)}">
        ${coverImg(game.background_image, 640)}
        ${metaBadge(game.metacritic)}
        <div class="qa">
          ${QA.map(([key, ic, cls]) => html`<button type="button" data-status="${key}" aria-pressed="false" aria-label="Add ${game.name} to ${STATUS[key].label}">${icon(ic, { cls })}</button>`)}
        </div>
      </div>
      <div>
        <a class="card-title" href="${gameHref(game.id)}">${game.name}</a>
        <div class="card-meta"><span>${sub}</span><span class="mine-slot"></span></div>
      </div>
    </article>`);

  let current = null;
  card.querySelector('.qa').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) changeStatus(game, current === b.dataset.status ? null : b.dataset.status);
  });
  onStatus(game.id, (status) => {
    current = status;
    const r = reviews && reviews.get(game.id);
    card.querySelector('.mine-slot').innerHTML = mine(status, r && r.rating);
    card.querySelectorAll('.qa button').forEach((b) => {
      const on = b.dataset.status === status;
      const label = STATUS[b.dataset.status].label;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? `Remove ${game.name} from ${label}` : `Move ${game.name} to ${label}`);
    });
  }, card);
  return card;
}
