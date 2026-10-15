// Bottom-right toast with an optional Undo action. One at a time, 5 seconds.
import { html, el } from './dom.js';

const region = document.createElement('div');
region.className = 'toast-region';
region.setAttribute('role', 'status');
region.setAttribute('aria-live', 'polite');
document.body.append(region);

export function toast(message, { undo } = {}) {
  const t = el(html`<div class="toast"><span>${message}</span>${undo ? html`<button type="button">Undo</button>` : ''}</div>`);
  region.replaceChildren(t);
  const timer = setTimeout(() => t.remove(), 5000);
  if (undo) {
    t.querySelector('button').addEventListener('click', () => {
      clearTimeout(timer);
      t.remove();
      undo();
    });
  }
}
