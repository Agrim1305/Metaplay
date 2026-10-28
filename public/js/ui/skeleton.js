// Shimmer placeholders while RAWG loads, so a grid is never empty.
import { html } from './dom.js';

export const skeletonCards = (n = 5) => html`${Array.from({ length: n }, () => html`
  <div class="sk-card" aria-hidden="true"><div class="sk sk-cov"></div><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>`)}`;

export const skeletonRows = (n = 4) => html`${Array.from({ length: n }, () => html`
  <div class="sk-row" aria-hidden="true"><div class="sk sk-thumb"></div><div><div class="sk sk-line"></div><div class="sk sk-line short" style="margin-top:8px"></div></div></div>`)}`;

// Put a container into its loading state.
export function loading(container, markup) {
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = markup;
}
export const loaded = (container) => container.removeAttribute('aria-busy');
