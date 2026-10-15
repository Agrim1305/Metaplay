// Tiny DOM helpers. html`` escapes every interpolated value unless it is itself html``,
// so RAWG names, usernames and review text can never inject markup.

class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const fmt = (v) => {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(fmt).join('');
  if (v instanceof Safe) return v.s;
  return esc(v);
};

export const html = (strings, ...vals) => new Safe(strings.reduce((out, s, i) => out + s + (i < vals.length ? fmt(vals[i]) : ''), ''));

// First element of an html`` string.
export function el(markup) {
  const t = document.createElement('template');
  t.innerHTML = String(markup).trim();
  return t.content.firstElementChild;
}

export const icon = (name, { fill = false, cls = '', label = '' } = {}) => (label
  ? html`<span class="ms${fill ? ' f' : ''} ${cls}" role="img" aria-label="${label}" title="${label}">${name}</span>`
  : html`<span class="ms${fill ? ' f' : ''} ${cls}" aria-hidden="true">${name}</span>`);

export const initials = (name = '') => {
  const parts = String(name).split(/[\s._-]+/).filter(Boolean);
  return ((parts.length > 1 ? parts[0][0] + parts[1][0] : String(name).slice(0, 2)) || '?').toUpperCase();
};

export const params = () => new URLSearchParams(location.search);

// "3 hours ago", "Yesterday", "12 Oct"
export function ago(date) {
  const d = new Date(date);
  const s = (Date.now() - d) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hour${s < 7200 ? '' : 's'} ago`;
  if (s < 172800) return 'Yesterday';
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  if (s < 2419200) return `${Math.floor(s / 604800)} week${s < 1209600 ? '' : 's'} ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
