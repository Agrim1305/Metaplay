// Cover art helpers. Every cover sits on a deterministic gradient, so a null
// background_image (or an image that fails to load) still shows a coloured tile.
import { html } from './dom.js';

const GRADIENTS = [
  'linear-gradient(160deg,#1C2630,#3E5568)', 'linear-gradient(160deg,#2A211C,#5E4636)',
  'linear-gradient(160deg,#1E2A24,#425C4C)', 'linear-gradient(160deg,#2A1E24,#5A3E4A)',
  'linear-gradient(160deg,#22222C,#474960)', 'linear-gradient(160deg,#2B281E,#5F5638)',
  'linear-gradient(160deg,#1A2A2D,#3A5B60)', 'linear-gradient(160deg,#2C2220,#64463E)',
  'linear-gradient(160deg,#24242A,#4E4E58)',
];

export function artFor(id) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 997;
  return GRADIENTS[h % GRADIENTS.length];
}

// RAWG serves resized copies; the originals are often 2-4 MB.
export const sized = (url, w = 640) => (url && url.includes('/media/') && !url.includes('/media/resize/')
  ? url.replace('/media/', `/media/resize/${w}/-/`)
  : url || '');

// <img> for inside a .cov (which carries the gradient underneath).
export const coverImg = (url, w = 640, eager = false) => (url
  ? html`<img src="${sized(url, w)}" alt="" ${eager ? '' : html`loading="lazy"`} decoding="async" onerror="this.remove()">`
  : '');

export const covStyle = (id) => `background-image:${artFor(id)}`;
