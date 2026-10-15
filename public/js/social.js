// Social: friend activity, one-tap requests, friends with "now playing", groups.
import './ui/nav.js';
import { api, me, batch } from './ui/api.js';
import { html, icon, initials, ago } from './ui/dom.js';
import { coverImg, covStyle, artFor } from './ui/art.js';
import { gameHref } from './ui/gameCard.js';
import { skeletonRows, loaded } from './ui/skeleton.js';
import { toast } from './ui/toast.js';

const $ = (s) => document.querySelector(s);
const VERB = { review: 'reviewed', playing: 'started playing', completed: 'completed' };
let user = null;
let friends = [];
let sent = new Set();  // user ids with a pending request from me
let groups = [];       // mine plus suggestions, with isMember / isOwner

// ---------- Activity ----------
async function loadFeed() {
  const box = $('#feed');
  box.innerHTML = skeletonRows(4);
  let events;
  try {
    events = await api('/api/feed?limit=20');
  } catch (err) {
    loaded(box);
    box.innerHTML = html`<div class="empty"><span>Couldn’t load activity. ${err.message}</span><button type="button" class="btn btn-secondary btn-sm" id="feed-retry">Try again</button></div>`;
    $('#feed-retry').addEventListener('click', loadFeed);
    return;
  }
  let games = {};
  try { games = await batch(events.map((e) => e.gameId)); } catch { /* titles from DB, gradient covers */ }
  loaded(box);
  if (!events.length) {
    box.innerHTML = html`<div class="empty"><span>${friends.length
      ? 'Your friends haven’t logged anything yet.'
      : 'Add friends to see what they’re playing and how they rate it.'}</span>
      ${friends.length ? '' : html`<button type="button" class="btn btn-secondary btn-sm" id="find-friends">Find players</button>`}</div>`;
    const b = $('#find-friends');
    if (b) b.addEventListener('click', () => $('#find').focus());
    return;
  }
  box.innerHTML = html`${events.map((e) => {
    const g = games[e.gameId];
    const title = (g && g.name) || e.title || 'a game';
    return html`<article class="feed-item">
      <span class="ava" aria-hidden="true">${initials(e.username)}</span>
      <div class="feed-body">
        <div class="feed-line"><b>${e.username}</b> ${VERB[e.kind] || 'updated'} <a href="${gameHref(e.gameId)}">${title}</a></div>
        ${e.kind === 'review' ? html`<span class="mono feed-score">${e.rating}/10</span>` : ''}
        ${e.review ? html`<p>${e.review}</p>` : ''}
        <span class="faint small">${ago(e.at)}</span>
      </div>
      <a class="cov feed-cov" href="${gameHref(e.gameId)}" tabindex="-1" aria-hidden="true" style="${covStyle(e.gameId)}">${coverImg(g && g.background_image, 420)}</a>
    </article>`;
  })}`;
}

// ---------- Requests ----------
async function loadRequests() {
  const box = $('#requests');
  let reqs = [];
  try { reqs = await api('/api/friends/requests'); } catch { /* shown as empty */ }
  const badge = $('#req-count');
  badge.hidden = !reqs.length;
  badge.textContent = reqs.length;
  box.innerHTML = reqs.length
    ? html`${reqs.map((r) => html`<div class="req-row" data-req="${r.Request_ID}" data-name="${r.Username}">
        <span class="ava" aria-hidden="true">${initials(r.Username)}</span>
        <div class="req-text"><div class="req-name">${r.Username}</div><div class="faint small">Sent ${ago(r.Timestamp).toLowerCase()}</div></div>
        <button type="button" class="btn btn-primary btn-sm" data-act="accept">Accept</button>
        <button type="button" class="btn btn-secondary btn-sm btn-icon" data-act="reject" aria-label="Decline ${r.Username}">${icon('close')}</button>
      </div>`)}`
    : html`<p class="faint small pad-y">No pending requests.</p>`;
}

$('#requests').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const row = b.closest('.req-row');
  const name = row.dataset.name;
  const action = b.dataset.act;
  row.hidden = true; // optimistic
  try {
    await api(`/api/friends/request/${row.dataset.req}`, { method: 'POST', body: { action } });
    toast(action === 'accept' ? `You and ${name} are now friends` : `Declined ${name}`);
    await loadRequests();
    if (action === 'accept') { await loadFriends(); loadFeed(); }
  } catch (err) {
    row.hidden = false;
    toast(`Couldn’t ${action === 'accept' ? 'accept' : 'decline'}: ${err.message}`);
  }
});

// ---------- Friends ----------
async function loadFriends() {
  const box = $('#friends');
  try {
    friends = await api('/api/friends');
  } catch (err) {
    loaded(box);
    box.innerHTML = html`<p class="faint small pad-y">Couldn’t load friends.</p>`;
    return;
  }
  let games = {};
  const missing = friends.filter((f) => f.nowPlayingId && !f.nowPlayingTitle).map((f) => f.nowPlayingId);
  try { games = await batch(missing); } catch { /* fall back to "Playing" */ }
  loaded(box);
  $('#friend-count').textContent = friends.length || '';
  box.innerHTML = friends.length
    ? html`${friends.map((f) => {
      const playing = f.nowPlayingId && (f.nowPlayingTitle || (games[f.nowPlayingId] && games[f.nowPlayingId].name) || 'a game');
      return html`<div class="row friend-row">
        <span class="ava sm" aria-hidden="true">${initials(f.Username)}</span>
        <span class="friend-name">${f.Username}</span>
        <span class="friend-now">${playing
    ? html`${icon('play_arrow', { fill: true, cls: 'c-play', label: 'Playing' })}<a href="${gameHref(f.nowPlayingId)}">${playing}</a>`
    : 'Not playing anything'}</span>
        <button type="button" class="btn btn-secondary btn-sm btn-icon friend-remove" data-remove="${f.User_ID}" data-name="${f.Username}" aria-label="Remove ${f.Username} from friends">${icon('person_remove')}</button>
      </div>`;
    })}`
    : html`<p class="faint small pad-y">No friends yet. Search for players above.</p>`;
}

$('#friends').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  if (!confirm(`Remove ${b.dataset.name} from your friends?`)) return;
  try {
    await api(`/api/friends/${b.dataset.remove}`, { method: 'DELETE' });
    toast(`Removed ${b.dataset.name}`);
    await loadFriends();
    loadFeed();
  } catch (err) {
    toast(`Couldn’t remove: ${err.message}`);
  }
});

// ---------- Groups ----------
const groupCard = (g) => html`<article class="grp">
  <div class="grp-head">
    <span class="cov grp-ini" style="background-image:${artFor(`g${g.id}`)}" aria-hidden="true">${initials(g.name)}</span>
    <div class="grp-id"><div class="grp-name">${g.name || 'Unnamed group'}</div>
      <div class="faint small">${[g.groupType, `${g.memberCount} member${g.memberCount === 1 ? '' : 's'}`].filter(Boolean).join(', ')}${g.isOwner ? ', yours' : ''}</div></div>
  </div>
  <p class="grp-bio">${g.description || 'No description yet.'}</p>
  <button type="button" class="btn btn-sm ${g.isMember ? 'btn-secondary' : 'btn-primary'}" data-group="${g.id}" aria-pressed="${g.isMember}">
    ${g.isMember ? (g.isOwner ? 'Owner' : 'Joined') : 'Join'}
  </button>
</article>`;

function renderGroups() {
  const box = $('#groups');
  loaded(box);
  box.innerHTML = groups.length
    ? html`${groups.map(groupCard)}`
    : html`<div class="empty boxed"><span>No groups yet. Start one for your co-op crew or backlog club.</span><a class="btn btn-secondary btn-sm" href="/pages/group_create.html">New group</a></div>`;
}

async function loadGroups() {
  try {
    const [mine, popular] = await Promise.all([api('/api/groups'), api('/api/groups/search?q=')]);
    const byId = new Map([...mine, ...popular].map((g) => [g.id, g]));
    groups = [...byId.values()].sort((a, b) => (b.isMember - a.isMember) || (b.memberCount - a.memberCount));
  } catch {
    groups = [];
  }
  renderGroups();
}

async function toggleGroup(id) {
  const g = groups.find((x) => x.id === id) || searchGroups.find((x) => x.id === id);
  if (!g) return;
  if (g.isMember && g.isOwner
    && !confirm(`You own ${g.name}. Leaving deletes the group for all ${g.memberCount} member${g.memberCount === 1 ? '' : 's'}. Delete it?`)) return;
  const join = !g.isMember;
  try {
    if (join) await api(`/api/groups/${id}/join`, { method: 'POST' });
    else await api(`/api/groups/${id}/leave`, { method: 'DELETE' });
    toast(join ? `Joined ${g.name}` : (g.isOwner ? `Deleted ${g.name}` : `Left ${g.name}`));
    if (!join && g.isOwner) groups = groups.filter((x) => x.id !== id);
    for (const x of [...groups, ...searchGroups].filter((y) => y.id === id)) {
      x.isMember = join;
      x.memberCount += join ? 1 : -1;
    }
    if (!groups.some((x) => x.id === id) && join) groups.unshift(g);
    renderGroups();
    if (!$('#results').hidden) renderResults();
  } catch (err) {
    toast(`Couldn’t ${join ? 'join' : 'leave'}: ${err.message}`);
  }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-group]');
  if (b) toggleGroup(Number(b.dataset.group));
});

// ---------- Search (players and groups) ----------
let searchUsers = [];
let searchGroups = [];
let lastQ = '';

function userAction(u) {
  if (user && u.User_ID === user.userId) return html`<span class="faint small">You</span>`;
  if (friends.some((f) => f.User_ID === u.User_ID)) return html`<span class="faint small">Friends</span>`;
  if (sent.has(u.User_ID)) return html`<span class="faint small">Requested</span>`;
  return html`<button type="button" class="btn btn-primary btn-sm" data-add="${u.User_ID}" data-name="${u.Username}">Add friend</button>`;
}

function renderResults() {
  const box = $('#results');
  box.hidden = false;
  box.innerHTML = html`
    <div class="sec-head"><h2>Results for “${lastQ}”</h2><button type="button" class="linkbtn" id="clear-search">Clear</button></div>
    <div class="soc-res-cols">
      <div>
        <h3 class="small-h">Players</h3>
        ${searchUsers.length ? searchUsers.map((u) => html`<div class="req-row">
          <span class="ava" aria-hidden="true">${initials(u.Username)}</span>
          <div class="req-text"><div class="req-name">${u.Username}</div><div class="faint small clamp">${u.Bio || ''}</div></div>
          ${userAction(u)}
        </div>`) : html`<p class="faint small pad-y">No players match.</p>`}
      </div>
      <div>
        <h3 class="small-h">Groups</h3>
        ${searchGroups.length ? html`<div class="groups compact">${searchGroups.map(groupCard)}</div>` : html`<p class="faint small pad-y">No groups match.</p>`}
      </div>
    </div>`;
  $('#clear-search').addEventListener('click', () => {
    $('#find').value = '';
    box.hidden = true;
    $('#find').focus();
  });
}

let debounce;
$('#find').addEventListener('input', (e) => {
  clearTimeout(debounce);
  const q = e.target.value.trim();
  debounce = setTimeout(async () => {
    if (q.length < 2) { $('#results').hidden = true; return; }
    try {
      const [users, grps, pending] = await Promise.all([
        api(`/api/users/search?q=${encodeURIComponent(q)}`),
        api(`/api/groups/search?q=${encodeURIComponent(q)}`),
        api('/api/friends/requests/sent'),
      ]);
      if ($('#find').value.trim() !== q) return;
      lastQ = q;
      searchUsers = users;
      searchGroups = grps;
      sent = new Set(pending.map((r) => r.Receiver_ID));
      renderResults();
    } catch (err) {
      toast(`Search failed: ${err.message}`);
    }
  }, 300);
});

$('#results').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  b.disabled = true;
  try {
    await api('/api/friends/request', { method: 'POST', body: { receiverId: Number(b.dataset.add) } });
    sent.add(Number(b.dataset.add));
    toast(`Friend request sent to ${b.dataset.name}`);
    renderResults();
  } catch (err) {
    b.disabled = false;
    toast(`Couldn’t send request: ${err.message}`);
  }
});

// ---------- Boot ----------
$('#friends').innerHTML = skeletonRows(3);
$('#groups').innerHTML = skeletonRows(2);
me().then((u) => { user = u; }).catch(() => {});
loadRequests();
loadFriends().then(loadFeed);
loadGroups();
