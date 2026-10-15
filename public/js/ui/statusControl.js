// Library status: one shared optimistic setter (with Undo) and the segmented control.
import { STATUS, api, library } from './api.js';
import { html, el, icon } from './dom.js';
import { toast } from './toast.js';

const emit = (gameId, status) => document.dispatchEvent(new CustomEvent('library:change', { detail: { gameId, status } }));

async function apply(lib, game, status) {
  if (status) lib.set(game.id, status); else lib.delete(game.id);
  emit(game.id, status);
  if (status) await api('/user-games', { method: 'POST', body: { gameId: game.id, status: STATUS[status].db } });
  else await api(`/user-games/${game.id}`, { method: 'DELETE' });
}

// next = 'wishlist' | 'playing' | 'completed' | null (remove). game needs { id, name }.
export async function changeStatus(game, next) {
  const lib = await library();
  const prev = lib.get(game.id) || null;
  if (prev === next) return;
  const name = game.name || 'Game';
  try {
    await apply(lib, game, next);
  } catch (err) {
    await apply(lib, game, prev).catch(() => {});
    toast(`Couldn’t update ${name}. ${err.message}`);
    return;
  }
  toast(next ? `${name} moved to ${STATUS[next].label}` : `${name} removed from your library`, {
    undo: () => apply(lib, game, prev).catch(() => toast(`Couldn’t undo. Try again.`)),
  });
}

// Run fn(status) now and whenever this game's status changes on the page.
// Pass the owning node so the listener drops itself once that node leaves the DOM.
export function onStatus(gameId, fn, node) {
  library().then((lib) => fn(lib.get(gameId) || null)).catch(() => fn(null));
  const handler = (e) => {
    if (node && !node.isConnected) document.removeEventListener('library:change', handler);
    else if (e.detail.gameId === gameId) fn(e.detail.status);
  };
  document.addEventListener('library:change', handler);
}

// Segmented Wishlist / Playing / Completed. Clicking the active segment removes the game.
export function statusControl(game) {
  const root = el(html`<div class="seg" role="group" aria-label="Library status">
    ${Object.entries(STATUS).map(([key, s]) => html`
      <button type="button" data-status="${key}" aria-pressed="false">${icon(s.icon, { cls: s.cls })}${s.label}</button>`)}
  </div>`);
  let current = null;
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) changeStatus(game, current === b.dataset.status ? null : b.dataset.status);
  });
  onStatus(game.id, (status) => {
    current = status;
    root.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === status)));
  }, root);
  return root;
}
