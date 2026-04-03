(function () {
    const API = '/api';
    let lookedUpUserId = null;

    function headers() {
        return {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
        };
    }

    /* ── Toast ── */
    function toast(msg, isError) {
        const el = document.getElementById('profileToast');
        if (!el) return;
        el.textContent = msg;
        el.style.background = isError ? '#c62828' : '#2e7d32';
        el.style.color = '#fff';
        el.classList.add('visible');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('visible'), 3200);
    }

    /* ── Helpers ── */
    function initials(first, last) {
        const a = (first || '')[0] || '';
        const b = (last || '')[0] || '';
        return (a + b).toUpperCase() || 'U';
    }

    function fmtRole(slug) {
        if (!slug) return 'Student';
        return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ');
    }

    function val(user, ...keys) {
        for (const k of keys) if (user[k]) return user[k];
        return '';
    }

    /* ── Populate form from user object ── */
    function populate(user) {
        const first = val(user, 'firstName', 'first_name');
        const last  = val(user, 'lastName', 'last_name');
        const name  = `${first} ${last}`.trim() || 'User';
        const role  = val(user, 'role') || (user.roleLabels || user.roles || ['student'])[0] || 'student';

        const avatarEl = document.getElementById('psAvatar');
        if (avatarEl) avatarEl.textContent = initials(first, last);

        const nameEl = document.getElementById('psDisplayName');
        if (nameEl) nameEl.textContent = name;

        const badgeEl = document.getElementById('psRoleBadge');
        if (badgeEl) badgeEl.textContent = fmtRole(role);

        const fn = document.getElementById('editFirstName');
        const ln = document.getElementById('editLastName');
        const un = document.getElementById('editUsername');
        const em = document.getElementById('editEmail');
        const rl = document.getElementById('editRole');

        if (fn) fn.value = first;
        if (ln) ln.value = last;
        if (un) un.value = val(user, 'username') || '';
        if (em) em.value = val(user, 'email');
        if (rl) rl.value = fmtRole(role);

        const promote = document.getElementById('clubPromoteSection');
        if (promote) {
            promote.classList.toggle('hidden', !user.canAssignClubMember);
        }
    }

    /* ── Auth check + load ── */
    async function load() {
        const gate    = document.getElementById('profileGate');
        const content = document.getElementById('profileContent');
        const token   = localStorage.getItem('token');

        if (!token) {
            gate.classList.remove('hidden');
            content.classList.add('hidden');
            return;
        }

        gate.classList.add('hidden');
        content.classList.remove('hidden');

        const cached = localStorage.getItem('user');
        if (cached) {
            try { populate(JSON.parse(cached)); } catch { /* ignore corrupt cache */ }
        }

        try {
            const res = await fetch(`${API}/users/me`, { headers: headers() });

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                gate.classList.remove('hidden');
                content.classList.add('hidden');
                return;
            }
            if (!res.ok) throw new Error();

            const { user } = await res.json();
            if (typeof persistUser === 'function') persistUser(user);
            else localStorage.setItem('user', JSON.stringify(user));

            populate(user);

            if (typeof refreshProfileFromServer === 'function') refreshProfileFromServer();
        } catch {
            // API failed — keep showing cached form data
        }
    }

    /* ── Save changes ── */
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('profileFormError');
        const okEl  = document.getElementById('profileFormSuccess');
        errEl.textContent = '';
        okEl.textContent  = '';

        const firstName = document.getElementById('editFirstName').value.trim();
        const lastName  = document.getElementById('editLastName').value.trim();
        const username  = document.getElementById('editUsername').value.trim();
        const curPwd    = document.getElementById('currentPassword').value;
        const newPwd    = document.getElementById('newPassword').value;

        if (!firstName) { errEl.textContent = 'First name is required.'; return; }

        const body = { first_name: firstName, last_name: lastName };

        if (username) body.username = username;

        if (newPwd) {
            if (!curPwd) { errEl.textContent = 'Current password is required to change your password.'; return; }
            if (newPwd.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; return; }
            body.password = newPwd;
            body.currentPassword = curPwd;
        }

        try {
            const res = await fetch(`${API}/users/me`, {
                method: 'PATCH',
                headers: headers(),
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (!res.ok) {
                errEl.textContent = data.message || 'Could not save changes.';
                toast(data.message || 'Save failed', true);
                return;
            }

            if (data.user) {
                if (typeof persistUser === 'function') persistUser(data.user);
                else localStorage.setItem('user', JSON.stringify(data.user));
                populate(data.user);
            }

            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            okEl.textContent = 'Profile updated successfully.';
            toast('Profile updated successfully.', false);

            if (typeof syncSidebarFromStorage === 'function') syncSidebarFromStorage();
            if (typeof refreshProfileFromServer === 'function') refreshProfileFromServer();
            if (typeof dispatchUserUpdated === 'function') dispatchUserUpdated();
        } catch {
            errEl.textContent = 'Connection error. Please try again.';
            toast('Connection error', true);
        }
    });

    /* ── Club member lookup ── */
    document.getElementById('lookupBtn')?.addEventListener('click', async () => {
        const errEl    = document.getElementById('lookupError');
        const resultEl = document.getElementById('lookupResult');
        const assignBtn = document.getElementById('assignClubMemberBtn');
        errEl.textContent = '';
        resultEl.classList.add('hidden');
        assignBtn.classList.add('hidden');
        lookedUpUserId = null;

        const email = document.getElementById('lookupEmail').value.trim();
        if (!email) { errEl.textContent = 'Enter an email address.'; return; }

        try {
            const res = await fetch(`${API}/users/lookup?q=${encodeURIComponent(email)}`, { headers: headers() });
            const data = await res.json();
            if (!res.ok) { errEl.textContent = data.message || 'Lookup failed.'; return; }

            lookedUpUserId = data.user.id;
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = `
                <strong>${data.user.firstName} ${data.user.lastName}</strong>
                <span class="lookup-email">${data.user.email}</span>
                <div class="lookup-roles">Role: ${(data.user.roleLabels || []).join(', ') || '—'}</div>
            `;
            assignBtn.classList.remove('hidden');
        } catch { errEl.textContent = 'Connection error.'; }
    });

    document.getElementById('assignClubMemberBtn')?.addEventListener('click', async () => {
        const errEl = document.getElementById('lookupError');
        errEl.textContent = '';
        if (!lookedUpUserId) { errEl.textContent = 'Find a user first.'; return; }
        try {
            const res = await fetch(`${API}/users/${lookedUpUserId}/roles/club-member`, { method: 'POST', headers: headers() });
            const data = await res.json();
            if (!res.ok) { errEl.textContent = data.message || 'Could not assign role.'; return; }
            toast(data.message || 'Role assigned.', false);
            if (typeof refreshProfileFromServer === 'function') refreshProfileFromServer();
            if (typeof dispatchUserUpdated === 'function') dispatchUserUpdated();
        } catch { errEl.textContent = 'Connection error.'; }
    });

    /* ── Boot ── */
    load();
})();
