// Sticky top bar for every signed-in page. Importing this module renders it.
// <body data-page="home|discover|social|profile|admin|game"> picks the active link.
import { me } from './api.js';
import { html, el, icon, initials } from './dom.js';

export const LOGO = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path class="logo-body" d="M5.8 2.5H16.4L19 5.1V21.2L12 16.6L5 21.2V3.3C5 2.9 5.4 2.5 5.8 2.5Z"/><rect class="logo-label" x="7.6" y="5.4" width="8.8" height="6.2" rx="0.7"/><rect class="logo-grip" x="7.6" y="13" width="8.8" height="0.9"/></svg>`;

const LINKS = [
  ['home', '/pages/dashboard.html', 'Home'],
  ['discover', '/pages/discover.html', 'Discover'],
  ['social', '/pages/social.html', 'Social'],
  ['profile', '/pages/profile.html', 'Profile'],
];

const page = document.body.dataset.page;
// Discover has its own big search field, so the nav one would be a duplicate there.
const withSearch = page !== 'discover';

const links = (admin) => html`${[...LINKS, ...(admin ? [['admin', '/pages/admin.html', 'Admin']] : [])]
  .map(([key, href, label]) => html`<a href="${href}" ${key === page ? html`aria-current="page"` : ''}>${label}</a>`)}`;

const nav = el(html`
  <header class="nav">
    <div class="nav-in">
      <a class="brand" href="/pages/dashboard.html" aria-label="MetaPlay home">${LOGO}<span>MetaPlay</span></a>
      <nav class="nav-links" aria-label="Main">${links(false)}</nav>
      ${withSearch ? html`
      <form class="nav-search" role="search" action="/pages/discover.html">
        ${icon('search')}
        <label class="sr-only" for="nav-q">Search games</label>
        <input id="nav-q" name="q" type="search" placeholder="Search games" autocomplete="off">
        <kbd aria-hidden="true">/</kbd>
      </form>` : ''}
      <div class="nav-account">
        <button type="button" class="avatar-btn" aria-expanded="false" aria-label="Account menu">&nbsp;</button>
        <div class="menu" hidden>
          <div class="menu-head"><b class="who">&nbsp;</b><span class="role"></span></div>
          <a href="/pages/profile.html">${icon('person')}Profile</a>
          <a href="/pages/edit_profile.html">${icon('edit')}Edit profile</a>
          <a href="/auth/logout">${icon('logout')}Log out</a>
        </div>
      </div>
    </div>
  </header>`);
document.body.prepend(nav);

me().then((user) => {
  nav.querySelector('.nav-links').innerHTML = links(user.role === 'admin');
  nav.querySelector('.avatar-btn').textContent = initials(user.username);
  nav.querySelector('.who').textContent = user.username;
  nav.querySelector('.role').textContent = user.role === 'admin' ? 'Admin' : (user.email || '');
}).catch(() => { /* api() already redirects on 401 */ });

// Account menu: click to toggle, Esc or outside click closes.
const btn = nav.querySelector('.avatar-btn');
const menu = nav.querySelector('.menu');
const setOpen = (open) => {
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('a').focus();
};
btn.addEventListener('click', () => setOpen(menu.hidden));
document.addEventListener('click', (e) => { if (!menu.hidden && !nav.querySelector('.nav-account').contains(e.target)) setOpen(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
  // "/" focuses search (the page's own search field on Discover).
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
    const field = document.querySelector('[data-search]') || nav.querySelector('#nav-q');
    if (field) { e.preventDefault(); field.focus(); }
  }
});
