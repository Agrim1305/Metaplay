// Ten score buttons that fill up to the chosen value.
import { html, el } from './dom.js';

export const SCORE_WORDS = ['', 'awful', 'bad', 'poor', 'weak', 'average', 'decent', 'good', 'great', 'superb', 'a masterpiece'];

export function scorePips(value, onChange, label = 'Your score out of 10') {
  const root = el(html`<div class="pips" role="group" aria-label="${label}">
    ${Array.from({ length: 10 }, (_, i) => html`<button type="button" data-n="${i + 1}" aria-label="${i + 1} out of 10">${i + 1}</button>`)}
  </div>`);
  const set = (v) => {
    root.querySelectorAll('button').forEach((b) => {
      const n = Number(b.dataset.n);
      b.classList.toggle('on', n <= v);
      b.setAttribute('aria-pressed', String(n === v));
    });
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    set(Number(b.dataset.n));
    onChange(Number(b.dataset.n));
  });
  set(value || 0);
  root.setValue = set;
  return root;
}
