/**
 * Sidebar profile: syncs with auth state from localStorage and /api/users/me.
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
    const first = u.firstName || u.first_name || '';
    const last = u.lastName || u.last_name || '';
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

function getInitials(first, last) {
    const f = (first || '')[0] || '';
    const l = (last || '')[0] || '';
    return (f + l).toUpperCase() || 'GU';
}

function renderProfileSidebar(user) {
    const u = normalizeStoredUser(user);
    if (!u) return;

    const avatar = document.getElementById('profileAvatar');
    const nameEl = document.getElementById('profileDisplayName');
    const rolesEl = document.getElementById('profileRoles');
    if (!avatar || !nameEl || !rolesEl) return;

    const first = u.firstName || '';
    const last = u.lastName || '';
    const displayName = `${first} ${last}`.trim() || u.name || 'User';

    nameEl.innerHTML = '';
    const line1 = document.createElement('div');
    line1.className = 'profile-name-line';
    line1.textContent = first || displayName.split(' ')[0] || 'User';
    nameEl.appendChild(line1);
    if (last) {
        const line2 = document.createElement('div');
        line2.className = 'profile-name-line';
        line2.textContent = last;
        nameEl.appendChild(line2);
    }

    avatar.alt = displayName;
    avatar.src =
        u.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1565c0&color=fff&size=128`;

    rolesEl.innerHTML = '';
    const labels = u.roleLabels && u.roleLabels.length ? u.roleLabels : [];
    if (labels.length) {
        labels.forEach((label) => {
            const span = document.createElement('span');
            span.className = 'role-pill';
            span.textContent = label;
            rolesEl.appendChild(span);
        });
    } else if (u.roles && u.roles.length) {
        u.roles.forEach((r) => {
            const span = document.createElement('span');
            span.className = 'role-pill';
            span.textContent = r.charAt(0).toUpperCase() + r.slice(1);
            rolesEl.appendChild(span);
        });
    } else {
        const span = document.createElement('span');
        span.className = 'role-pill';
        span.textContent = 'Student';
        rolesEl.appendChild(span);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showGuestSidebar() {
    const guestEl = document.getElementById('profileCardGuest');
    const userEl = document.getElementById('profileCardUser');
    if (guestEl) guestEl.classList.remove('hidden');
    if (userEl) userEl.classList.add('hidden');
    const adminLink = document.getElementById('sidebarAdminLink');
    if (adminLink) adminLink.classList.add('hidden');
}

function updateAdminLinkVisibility(user) {
    const link = document.getElementById('sidebarAdminLink');
    if (!link) return;
    const role = user?.role || (user?.roles && user.roles[0]) || '';
    const canSee = role === 'Teacher' || role === 'Club President';
    if (canSee) {
        link.classList.remove('hidden');
    } else {
        link.classList.add('hidden');
    }
}

function showUserSidebar(user) {
    const guestEl = document.getElementById('profileCardGuest');
    const userEl = document.getElementById('profileCardUser');
    if (!guestEl || !userEl) return;
    renderProfileSidebar(user);
    updateAdminLinkVisibility(user);
    guestEl.classList.add('hidden');
    userEl.classList.remove('hidden');
}

/**
 * Sync sidebar from localStorage instantly (no network).
 * Called after login/register and on page load.
 */
function syncSidebarFromStorage() {
    const token = localStorage.getItem('token');
    if (!token) {
        showGuestSidebar();
        return false;
    }
    const raw = localStorage.getItem('user');
    if (raw) {
        try {
            showUserSidebar(JSON.parse(raw));
            return true;
        } catch { /* corrupt data, fall through */ }
    }
    return false;
}

/**
 * Fetches fresh profile from API, updates localStorage + sidebar.
 */
async function refreshProfileFromServer() {
    const token = localStorage.getItem('token');

    if (!token) {
        showGuestSidebar();
        return;
    }

    // Show cached data immediately so sidebar never stays on "Guest"
    syncSidebarFromStorage();

    try {
        const res = await fetch(`${USER_API}/users/me`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('me failed');
        const data = await res.json();
        persistUser(data.user);
        showUserSidebar(data.user);
    } catch {
        // API failed — keep whatever syncSidebarFromStorage already rendered
        if (!syncSidebarFromStorage()) {
            showGuestSidebar();
        }
    }
}

// Re-sync when auth.js fires user-updated
window.addEventListener('user-updated', () => {
    syncSidebarFromStorage();
    refreshProfileFromServer();
});

// ── Page load ──
// Don't default to Guest right away; check auth state first.
syncSidebarFromStorage();
refreshProfileFromServer();

window.refreshProfileFromServer = refreshProfileFromServer;
window.syncSidebarFromStorage = syncSidebarFromStorage;
window.persistUser = persistUser;
window.dispatchUserUpdated = dispatchUserUpdated;
