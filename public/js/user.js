/**
 * Shared user profile helpers: auth headers, /api/users/me, sidebar UI, sync events.
 */
const USER_API = '/api';

function getAuthHeaders(includeJson = true) {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (includeJson) headers['Content-Type'] = 'application/json';
    return headers;
}

function normalizeStoredUser(u) {
    if (!u) return null;
    const first = u.firstName || '';
    const last = u.lastName || '';
    const name = (u.name || `${first} ${last}`.trim() || 'User').trim();
    return {
        ...u,
        firstName: first || name.split(' ')[0] || 'User',
        lastName: last || name.split(' ').slice(1).join(' ') || '',
        name,
        roles: u.roles || [],
        roleLabels: u.roleLabels || [],
    };
}

function persistUser(user) {
    if (!user) {
        localStorage.removeItem('user');
        return;
    }
    localStorage.setItem('user', JSON.stringify(normalizeStoredUser(user)));
}

function dispatchUserUpdated() {
    window.dispatchEvent(new CustomEvent('user-updated'));
}

/**
 * Fetches current user from API and updates localStorage + sidebar.
 */
async function refreshProfileFromServer() {
    const token = localStorage.getItem('token');
    const guestEl = document.getElementById('profileCardGuest');
    const userEl = document.getElementById('profileCardUser');

    if (!guestEl || !userEl) return;

    if (!token) {
        guestEl.classList.remove('hidden');
        userEl.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`${USER_API}/users/me`, { headers: getAuthHeaders() });
        if (!res.ok) {
            throw new Error('me failed');
        }
        const data = await res.json();
        persistUser(data.user);
        renderProfileSidebar(data.user);
        guestEl.classList.add('hidden');
        userEl.classList.remove('hidden');
    } catch {
        const raw = localStorage.getItem('user');
        if (raw) {
            try {
                renderProfileSidebar(JSON.parse(raw));
                guestEl.classList.add('hidden');
                userEl.classList.remove('hidden');
            } catch {
                guestEl.classList.remove('hidden');
                userEl.classList.add('hidden');
            }
        } else {
            guestEl.classList.remove('hidden');
            userEl.classList.add('hidden');
        }
    }
}

function renderProfileSidebar(user) {
    const u = normalizeStoredUser(user);
    const avatar = document.getElementById('profileAvatar');
    const nameEl = document.getElementById('profileDisplayName');
    const rolesEl = document.getElementById('profileRoles');
    if (!avatar || !nameEl || !rolesEl) return;

    const first = u.firstName || '';
    const last = u.lastName || '';
    const displayName = `${first} ${last}`.trim() || u.name || 'User';
    const line1 = document.createElement('div');
    line1.className = 'profile-name-line';
    line1.textContent = first || displayName.split(' ')[0] || 'User';
    const line2 = document.createElement('div');
    line2.className = 'profile-name-line';
    line2.textContent = last || displayName.split(' ').slice(1).join(' ') || '';

    nameEl.innerHTML = '';
    nameEl.appendChild(line1);
    if (line2.textContent) nameEl.appendChild(line2);

    avatar.alt = displayName;
    avatar.src =
        u.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1565c0&color=fff&size=128`;

    rolesEl.innerHTML = '';
    const labels = u.roleLabels && u.roleLabels.length ? u.roleLabels : [];
    labels.forEach((label) => {
        const span = document.createElement('span');
        span.className = 'role-pill';
        span.textContent = label;
        rolesEl.appendChild(span);
    });
    if (labels.length === 0) {
        const span = document.createElement('span');
        span.className = 'role-pill role-pill--muted';
        span.textContent = 'No roles';
        rolesEl.appendChild(span);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.addEventListener('user-updated', () => {
    refreshProfileFromServer();
});

window.refreshProfileFromServer = refreshProfileFromServer;
window.persistUser = persistUser;
window.dispatchUserUpdated = dispatchUserUpdated;
