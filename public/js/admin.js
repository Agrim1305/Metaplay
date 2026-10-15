// Admin: list, edit and delete users. Restyled only; same endpoints and rules as before.
import './ui/nav.js';
import { api } from './ui/api.js';
import { html } from './ui/dom.js';
import { toast } from './ui/toast.js';
import { loaded } from './ui/skeleton.js';

const $ = (id) => document.getElementById(id);
let users = [];

function confirmDelete(message) {
  return new Promise((resolve) => {
    const dlg = $('confirmModal');
    $('confirmText').textContent = message;
    const done = (ok) => () => { dlg.close(); resolve(ok); };
    $('confirmOk').onclick = done(true);
    $('confirmCancel').onclick = done(false);
    dlg.onclose = () => resolve(false); // Esc
    dlg.showModal();
  });
}

async function loadUsers() {
  const box = $('userTable');
  try {
    users = await api('/admin/users');
  } catch (err) {
    if (err.status === 403) { location.replace('/pages/accessDenied.html'); return; }
    loaded(box);
    box.innerHTML = html`<div class="empty boxed"><span>Couldn’t load users. ${err.message}</span></div>`;
    return;
  }
  loaded(box);
  $('user-count').textContent = `${users.length} account${users.length === 1 ? '' : 's'}`;
  box.innerHTML = users.length ? html`
    <table class="table">
      <thead><tr><th scope="col">ID</th><th scope="col">Username</th><th scope="col">Email</th><th scope="col">Bio</th><th scope="col">Role</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${users.map((u) => html`
        <tr>
          <td class="mono faint">${u.id}</td>
          <td>${u.username}</td>
          <td class="muted">${u.email}</td>
          <td class="muted cell-clip">${u.bio || ''}</td>
          <td>${u.role === 'admin' ? html`<span class="role-pill">admin</span>` : 'user'}</td>
          <td class="cell-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-edit="${u.id}">Edit</button>
            <button type="button" class="btn btn-secondary btn-sm" data-delete="${u.id}" aria-label="Delete ${u.username}">Delete</button>
          </td>
        </tr>`)}</tbody>
    </table>` : html`<div class="empty boxed"><span>No users found.</span></div>`;
}

async function deleteUser(id) {
  const u = users.find((x) => x.id === id);
  if (!await confirmDelete(`Delete ${u ? u.username : 'this user'}?`)) return;
  try {
    await api(`/admin/users/${id}`, { method: 'DELETE' });
    toast('User deleted.');
    loadUsers();
  } catch (err) {
    toast(err.message);
  }
}

function openEdit(id) {
  const u = users.find((x) => x.id === id);
  if (!u) return;
  $('editUserId').value = u.id;
  $('editUsername').value = u.username;
  $('editEmail').value = u.email;
  $('editBio').value = u.bio || '';
  $('editRole').value = u.role;
  $('editRole').disabled = u.username === 'Admin';
  $('editOriginalRole').value = u.role;
  $('editModal').showModal();
}

$('userTable').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-delete]');
  if (edit) openEdit(Number(edit.dataset.edit));
  if (del) deleteUser(Number(del.dataset.delete));
});

$('editCancel').addEventListener('click', () => $('editModal').close());

$('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('editUsername').value.trim();
  const role = $('editRole').value;
  try {
    await api(`/admin/users/${$('editUserId').value}`, {
      method: 'PUT',
      body: { username, email: $('editEmail').value.trim(), bio: $('editBio').value.trim(), role },
    });
    let msg = 'User updated.';
    if (role !== $('editOriginalRole').value && username !== 'Admin') msg += ' Role changes take effect after logout.';
    toast(msg);
    $('editModal').close();
    loadUsers();
  } catch (err) {
    toast(err.message);
  }
});

loadUsers();
