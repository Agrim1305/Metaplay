/* global showToast */
function customConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const confirmText = document.getElementById('confirmText');
        const ok = document.getElementById('confirmOk');
        const cancel = document.getElementById('confirmCancel');

        // Fallback if any element is missing
        if (!modal || !confirmText || !ok || !cancel) {
            showToast('Confirmation dialog unavailable');
            resolve(false);
            return;
        }

        confirmText.textContent = message;
        modal.style.display = 'flex';

        let onOk;
        let onCancel;
        const cleanup = () => {
            modal.style.display = 'none';
            ok.removeEventListener('click', onOk);
            cancel.removeEventListener('click', onCancel);
        };
        onOk = () => {
            cleanup();
            resolve(true);
        };
        onCancel = () => {
            cleanup();
            resolve(false);
        };

        ok.addEventListener('click', onOk);
        cancel.addEventListener('click', onCancel);
    });
}

const loadUsers = async () => {
    const container = document.getElementById('userTable');
    if (!container) return;

    container.innerHTML = '<p class="loading-text"><em>Loading…</em></p>';

    try {
        const res = await fetch('/admin/users', { credentials: 'include' });
        if (!res.ok) throw new Error(`Load failed (${res.status})`);

        const users = await res.json();
        if (!Array.isArray(users) || users.length === 0) {
            container.innerHTML = '<p class="no-users-text">No users found.</p>';
            return;
        }

        let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th><th>Username</th><th>Email</th>
            <th>Bio</th><th>Role</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

        users.forEach((u) => {
            html += `
        <tr data-id="${u.id}">
          <td>${u.id}</td>
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>${u.bio || ''}</td>
          <td>${u.role}</td>
          <td class="action-btns">
            <button class="btn-primary" data-edit-id="${u.id}">Edit</button>
            <button class="btn-secondary" data-delete-id="${u.id}">Delete</button>
          </td>
        </tr>
      `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (err) {
        showToast(err.message);
    }
};

const deleteUser = async (id) => {
    if (!await customConfirm('Delete this user?')) return;

    try {
        const res = await fetch(`/admin/users/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const txt = await res.text();

        if (!res.ok) {
            let msg;
            try { msg = JSON.parse(txt).error; } catch (error) { msg = txt; }
            throw new Error(msg);
        }

        showToast('User deleted.');
        await loadUsers();

    } catch (err) {
        showToast(err.message);
    }
};

const openEditModal = (id) => {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const editModal = document.getElementById('editModal');
    const editUserId = document.getElementById('editUserId');
    const editUsername = document.getElementById('editUsername');
    const editEmail = document.getElementById('editEmail');
    const editBio = document.getElementById('editBio');
    const editRole = document.getElementById('editRole');
    const editOriginalRole = document.getElementById('editOriginalRole');

    if (!row || !editModal || !editUserId || !editUsername
        || !editEmail || !editBio || !editRole || !editOriginalRole) {
        showToast('Edit form elements not found.');
        return;
    }

    const uname = row.children[1].textContent;
    const origRole = row.children[4].textContent;

    editUserId.value = id;
    editUsername.value = uname;
    editEmail.value = row.children[2].textContent;
    editBio.value = row.children[3].textContent;

    if (uname === 'Admin') {
        editRole.value = 'admin';
        editRole.disabled = true;
    } else {
        editRole.value = origRole;
        editRole.disabled = false;
    }

    editOriginalRole.value = origRole;
    editModal.style.display = 'flex';
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Populate the user table
    loadUsers();

    // 2. Logout button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('/auth/logout', { credentials: 'include' });
            window.location.replace('/pages/index.html');
        });
    }

    // 3. Delegate Edit/Delete clicks
    const userTable = document.getElementById('userTable');
    if (userTable) {
        userTable.addEventListener('click', (e) => {
            const editId = e.target.getAttribute('data-edit-id');
            const deleteId = e.target.getAttribute('data-delete-id');

            if (editId) {
                openEditModal(Number(editId));
            } else if (deleteId) {
                deleteUser(Number(deleteId));
            }
        });
    }

    // 4. Cancel edit modal
    const editCancel = document.getElementById('editCancel');
    if (editCancel) {
        editCancel.addEventListener('click', () => {
            const editModal = document.getElementById('editModal');
            if (editModal) editModal.style.display = 'none';
        });
    }

    // 5. Submit edit form
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = Number(document.getElementById('editUserId').value);
            const username = document.getElementById('editUsername').value.trim();
            const email = document.getElementById('editEmail').value.trim();
            const bio = document.getElementById('editBio').value.trim();
            const role = document.getElementById('editRole').value;
            const origRole = document.getElementById('editOriginalRole').value;

            try {
                const res = await fetch(`/admin/users/${id}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
 username, email, bio, role
})
                });
                const txt = await res.text();
                if (!res.ok) {
                    let msg;
                    try { msg = JSON.parse(txt).error; } catch (error) { msg = txt; }
                    throw new Error(msg);
                }

                let msg = 'User updated.';
                if (role !== origRole && username !== 'Admin') {
                    msg += ' Role changes take effect after logout.';
                }
                showToast(msg);

                const editModal = document.getElementById('editModal');
                if (editModal) editModal.style.display = 'none';

                await loadUsers();

            } catch (err) {
                showToast(err.message);
            }
        });
    }
});
