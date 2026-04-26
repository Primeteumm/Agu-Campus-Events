(function () {
    const API = '/api';
    let allUsers = [];
    let myRole = null;

    function headers() {
        return {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
        };
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str ?? '';
        return d.innerHTML;
    }

    function toast(msg, isError) {
        const el = document.getElementById('adminToast');
        if (!el) return;
        el.textContent = msg;
        el.style.background = isError ? '#c62828' : '#2e7d32';
        el.style.color = '#fff';
        el.classList.add('visible');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('visible'), 3200);
    }

    function roleBadgeClass(role) {
        const map = {
            'Organizer': 'admin-badge--organizer',
            'Club President': 'admin-badge--president',
            'Club Vice President': 'admin-badge--vp',
            'Club Member': 'admin-badge--member',
            'Student': 'admin-badge--student',
        };
        return map[role] || 'admin-badge--student';
    }

    function buildActions(user) {
        if (user.id === getCurrentUserId()) return '<span class="admin-you">You</span>';

        const r = user.role;

        if (myRole === 'Organizer') {
            if (r === 'Organizer') return '<span class="admin-muted">No actions</span>';
            const btns = [];
            if (r !== 'Club President') {
                btns.push(`<button class="admin-btn admin-btn--promote" data-id="${esc(user.id)}" data-role="Club President">Make President</button>`);
            }
            if (r !== 'Student') {
                btns.push(`<button class="admin-btn admin-btn--demote" data-id="${esc(user.id)}" data-role="Student">Demote to Student</button>`);
            }
            return btns.join('') || '<span class="admin-muted">—</span>';
        }

        if (myRole === 'Club President') {
            if (r === 'Club President') {
                return '<span class="admin-muted">No actions</span>';
            }
            if (r === 'Student' || r === 'Club Member') {
                return `<button class="admin-btn admin-btn--promote" data-id="${esc(user.id)}" data-role="Club Vice President">Make Vice President</button>`;
            }
            if (r === 'Club Vice President') {
                return `<button class="admin-btn admin-btn--demote" data-id="${esc(user.id)}" data-role="Student">Demote to Student</button>`;
            }
            return '<span class="admin-muted">—</span>';
        }

        return '';
    }

    function getCurrentUserId() {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            return u.id || '';
        } catch { return ''; }
    }

    function renderTable(users) {
        const tbody = document.getElementById('adminTableBody');
        const countEl = document.getElementById('adminCount');

        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="admin-loading">No users found.</td></tr>';
            countEl.textContent = '';
            return;
        }

        tbody.innerHTML = users.map((u) => {
            const ini = ((u.firstName || '')[0] || '') + ((u.lastName || '')[0] || '') || 'U';
            return `
            <tr data-user-id="${esc(u.id)}">
                <td class="admin-cell-name">
                    <span class="admin-user-initials">${esc(ini)}</span>
                    <span>${esc(u.firstName)} ${esc(u.lastName)}</span>
                </td>
                <td class="admin-cell-email">${esc(u.email)}</td>
                <td><span class="admin-badge ${roleBadgeClass(u.role)}">${esc(u.roleLabel)}</span></td>
                <td class="admin-cell-actions">${buildActions(u)}</td>
            </tr>`;
        }).join('');

        countEl.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    document.getElementById('adminSearch')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        if (!q) { renderTable(allUsers); return; }
        renderTable(allUsers.filter((u) =>
            `${u.firstName} ${u.lastName} ${u.email} ${u.roleLabel}`.toLowerCase().includes(q)
        ));
    });

    document.getElementById('adminTableBody')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.admin-btn');
        if (!btn) return;

        const targetUserId = btn.dataset.id;
        const newRole = btn.dataset.role;
        if (!targetUserId || !newRole) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Updating...';

        try {
            const res = await fetch(`${API}/admin/role`, {
                method: 'PUT',
                headers: headers(),
                body: JSON.stringify({ targetUserId, newRole }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast(data.message || 'Action failed.', true);
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            toast(data.message, false);

            const idx = allUsers.findIndex((u) => u.id === targetUserId);
            if (idx !== -1) {
                allUsers[idx].role = data.newRole;
                allUsers[idx].roleLabel = data.newRoleLabel;
            }

            const searchVal = document.getElementById('adminSearch')?.value?.toLowerCase() || '';
            if (searchVal) {
                renderTable(allUsers.filter((u) =>
                    `${u.firstName} ${u.lastName} ${u.email} ${u.roleLabel}`.toLowerCase().includes(searchVal)
                ));
            } else {
                renderTable(allUsers);
            }
        } catch {
            toast('Connection error.', true);
            btn.disabled = false;
        }
    });

    async function load() {
        const gate = document.getElementById('adminGate');
        const content = document.getElementById('adminContent');
        const token = localStorage.getItem('token');

        if (!token) {
            gate.classList.remove('hidden');
            content.classList.add('hidden');
            return;
        }

        try {
            const res = await fetch(`${API}/admin/users`, { headers: headers() });

            if (res.status === 403 || res.status === 401) {
                gate.classList.remove('hidden');
                content.classList.add('hidden');
                return;
            }
            if (!res.ok) throw new Error();

            const data = await res.json();
            myRole = data.myRole;
            allUsers = data.users || [];

            gate.classList.add('hidden');
            content.classList.remove('hidden');

            const tag = document.getElementById('adminRoleTag');
            if (tag) {
                tag.textContent = myRole;
                tag.className = `admin-role-tag ${myRole === 'Organizer' ? 'admin-role-tag--organizer' : 'admin-role-tag--president'}`;
            }

            renderTable(allUsers);
        } catch {
            gate.classList.remove('hidden');
            content.classList.add('hidden');
        }
    }

    load();
})();
