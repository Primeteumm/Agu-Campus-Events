const API_URL = '/api';

let lookedUpUserId = null;

function authHeaders() {
    const token = localStorage.getItem('token');
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch {
        return '—';
    }
}

function fillReadOnly(user) {
    document.getElementById('roFirstName').textContent = user.firstName || '—';
    document.getElementById('roLastName').textContent = user.lastName || '—';
    document.getElementById('roEmail').textContent = user.email || '—';
    document.getElementById('roRoles').textContent =
        user.roleLabels && user.roleLabels.length ? user.roleLabels.join(', ') : '—';
    document.getElementById('roCreated').textContent = formatDate(user.createdAt);
}

async function loadProfile() {
    const token = localStorage.getItem('token');
    const gate = document.getElementById('profileGate');
    const content = document.getElementById('profileContent');

    if (!token) {
        gate.classList.remove('hidden');
        content.classList.add('hidden');
        return;
    }

    gate.classList.add('hidden');
    content.classList.remove('hidden');

    try {
        const res = await fetch(`${API_URL}/users/me`, { headers: authHeaders() });
        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            throw new Error('unauthorized');
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        const u = data.user;

        if (typeof persistUser === 'function') persistUser(u);
        else localStorage.setItem('user', JSON.stringify(u));

        fillReadOnly(u);
        document.getElementById('editUsername').value = u.username || '';
        document.getElementById('editEmail').value = u.email || '';

        const promote = document.getElementById('clubPromoteSection');
        if (u.canAssignClubMember) {
            promote.classList.remove('hidden');
        } else {
            promote.classList.add('hidden');
        }

        if (typeof refreshProfileFromServer === 'function') {
            await refreshProfileFromServer();
        }
    } catch {
        gate.classList.remove('hidden');
        content.classList.add('hidden');
    }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('profileFormError');
    const okEl = document.getElementById('profileFormSuccess');
    errEl.textContent = '';
    okEl.textContent = '';

    const username = document.getElementById('editUsername').value.trim();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    const body = { username };
    if (newPassword && newPassword.length > 0) {
        body.password = newPassword;
        body.currentPassword = currentPassword;
    }

    try {
        const res = await fetch(`${API_URL}/users/me`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.message || 'Could not save changes.';
            return;
        }
        okEl.textContent = data.message || 'Saved.';
        if (typeof persistUser === 'function') persistUser(data.user);
        else localStorage.setItem('user', JSON.stringify(data.user));
        fillReadOnly(data.user);
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        if (typeof refreshProfileFromServer === 'function') {
            await refreshProfileFromServer();
        }
        if (typeof dispatchUserUpdated === 'function') dispatchUserUpdated();
    } catch {
        errEl.textContent = 'Connection error. Please try again.';
    }
});

document.getElementById('lookupBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('lookupError');
    const resultEl = document.getElementById('lookupResult');
    const assignBtn = document.getElementById('assignClubMemberBtn');
    errEl.textContent = '';
    resultEl.classList.add('hidden');
    assignBtn.classList.add('hidden');
    lookedUpUserId = null;

    const email = document.getElementById('lookupEmail').value.trim();
    if (!email) {
        errEl.textContent = 'Enter an email address.';
        return;
    }

    try {
        const res = await fetch(
            `${API_URL}/users/lookup?q=${encodeURIComponent(email)}`,
            { headers: authHeaders() }
        );
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.message || 'Lookup failed.';
            return;
        }
        lookedUpUserId = data.user.id;
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `
            <strong>${data.user.firstName} ${data.user.lastName}</strong>
            <span class="lookup-email">${data.user.email}</span>
            <div class="lookup-roles">Roles: ${(data.user.roleLabels || []).join(', ') || '—'}</div>
        `;
        assignBtn.classList.remove('hidden');
        lucide.createIcons();
    } catch {
        errEl.textContent = 'Connection error.';
    }
});

document.getElementById('assignClubMemberBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('lookupError');
    errEl.textContent = '';
    if (!lookedUpUserId) {
        errEl.textContent = 'Find a user first.';
        return;
    }
    try {
        const res = await fetch(`${API_URL}/users/${lookedUpUserId}/roles/club-member`, {
            method: 'POST',
            headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.message || 'Could not assign role.';
            return;
        }
        errEl.textContent = '';
        const resultEl = document.getElementById('lookupResult');
        const prevOk = resultEl.querySelector('.assign-ok-msg');
        if (prevOk) prevOk.remove();
        const ok = document.createElement('p');
        ok.className = 'form-success assign-ok-msg';
        ok.textContent = data.message || 'Role assigned.';
        resultEl.appendChild(ok);
        if (typeof refreshProfileFromServer === 'function') {
            await refreshProfileFromServer();
        }
        if (typeof dispatchUserUpdated === 'function') dispatchUserUpdated();
    } catch {
        errEl.textContent = 'Connection error.';
    }
});

loadProfile();
