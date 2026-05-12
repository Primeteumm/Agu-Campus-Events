const SA_API = '/api/superadmin';

// ── State ─────────────────────────────────────────────────────────────────────
let saAllUsers = [];
let saAllClubs = [];
let saSelectedClubId = null;
let saSelectedUserId = null;
let saEditingClubId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function t(key) {
    return typeof i18nGet === 'function' ? i18nGet(key) : key;
}

function authHeaders() {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, isError = false) {
    const el = document.getElementById('saToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'ps-toast' + (isError ? ' ps-toast--error' : ' ps-toast--success');
    el.classList.add('ps-toast--visible');
    clearTimeout(el._tid);
    el._tid = setTimeout(() => el.classList.remove('ps-toast--visible'), 3000);
}

function clubRoleLabel(role) {
    const map = { president: 'superadmin.clubRolePresident', vice_president: 'superadmin.clubRoleVicePresident', member: 'superadmin.clubRoleMember' };
    return t(map[role] || role);
}

function globalRoleBadge(roleLabel) {
    const colorMap = {
        'Super Admin': 'var(--accent-coral)',
        'Organizer': 'var(--accent-cyan)',
        'Club President': '#a78bfa',
        'Club Vice President': '#7dd3fc',
        'Club Member': '#86efac',
        'Student': '#9ca3af',
    };
    const color = colorMap[roleLabel] || '#9ca3af';
    return `<span class="role-pill" style="background:${color}20;color:${color};border:1px solid ${color}40;">${esc(t('roles.' + roleLabel) || roleLabel)}</span>`;
}

// Modal open/close using display:flex (avoids card-flip CSS issues)
function openModal(el) {
    el.classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function closeModal(el) {
    el.classList.remove('active');
}

// ── Access gate ───────────────────────────────────────────────────────────────
async function saCheckAccess() {
    const token = localStorage.getItem('token');
    if (!token) { showGate(); return; }

    const res = await fetch(`${SA_API}/users`, { headers: authHeaders() }).catch(() => null);
    if (!res || !res.ok) { showGate(); return; }

    document.getElementById('saGate').classList.add('hidden');
    document.getElementById('saContent').classList.remove('hidden');

    const data = await res.json();
    saAllUsers = data.users || [];
    renderUsersTable(saAllUsers);
    loadClubs();
}

function showGate() {
    document.getElementById('saGate').classList.remove('hidden');
    document.getElementById('saContent').classList.add('hidden');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.sa-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sa-tab').forEach(b => b.classList.remove('sa-tab--active'));
            btn.classList.add('sa-tab--active');
            const tab = btn.dataset.tab;
            document.getElementById('panelUsers').classList.toggle('hidden', tab !== 'users');
            document.getElementById('panelClubs').classList.toggle('hidden', tab !== 'clubs');
        });
    });
}

// ── Users ─────────────────────────────────────────────────────────────────────
const ALL_ROLES = ['Student', 'Organizer', 'Club Member', 'Club Vice President', 'Club President'];

function renderUsersTable(users) {
    const tbody = document.getElementById('saUserTableBody');
    const count = document.getElementById('saUserCount');
    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="admin-loading">${t('superadmin.noUsers')}</td></tr>`;
        if (count) count.textContent = '';
        return;
    }
    tbody.innerHTML = users.map(u => {
        const clubCell = u.clubName
            ? `<span style="font-size:.82rem;">${esc(u.clubName)}</span><br><span style="font-size:.75rem;color:#888;">${esc(clubRoleLabel(u.clubRole))}</span>`
            : `<span style="color:#555;font-size:.82rem;">—</span>`;

        return `
        <tr data-uid="${esc(u.id)}">
            <td>${esc(u.firstName)} ${esc(u.lastName)}</td>
            <td>${esc(u.email)}</td>
            <td>${clubCell}</td>
            <td class="sa-role-cell">
                <span class="sa-role-display">${globalRoleBadge(u.roleLabel)}</span>
                <select class="sa-role-select admin-search hidden" style="padding:4px 8px;font-size:.82rem;">
                    ${ALL_ROLES.map(r => `<option value="${r}"${r === u.role ? ' selected' : ''}>${esc(t('roles.' + r) || r)}</option>`).join('')}
                </select>
            </td>
            <td class="sa-actions-cell">
                <button class="btn-role-edit" data-uid="${esc(u.id)}" style="background:none;border:1px solid var(--accent-cyan);color:var(--accent-cyan);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.8rem;">
                    ${t('superadmin.changeRole')}
                </button>
                <button class="btn-role-save hidden" data-uid="${esc(u.id)}" style="background:var(--accent-cyan);border:none;color:#000;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.8rem;margin-left:4px;">
                    ${t('superadmin.saveRole')}
                </button>
                <button class="btn-role-cancel hidden" data-uid="${esc(u.id)}" style="background:none;border:1px solid #666;color:#aaa;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.8rem;margin-left:4px;">
                    ${t('superadmin.cancel')}
                </button>
            </td>
        </tr>`;
    }).join('');

    if (count) count.textContent = `${users.length} ${t('superadmin.userCount')}`;

    tbody.querySelectorAll('.btn-role-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('tr');
            row.querySelector('.sa-role-display').classList.add('hidden');
            row.querySelector('.sa-role-select').classList.remove('hidden');
            btn.classList.add('hidden');
            row.querySelector('.btn-role-save').classList.remove('hidden');
            row.querySelector('.btn-role-cancel').classList.remove('hidden');
        });
    });

    tbody.querySelectorAll('.btn-role-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('tr');
            row.querySelector('.sa-role-display').classList.remove('hidden');
            row.querySelector('.sa-role-select').classList.add('hidden');
            row.querySelector('.btn-role-edit').classList.remove('hidden');
            btn.classList.add('hidden');
            row.querySelector('.btn-role-save').classList.add('hidden');
        });
    });

    tbody.querySelectorAll('.btn-role-save').forEach(btn => {
        btn.addEventListener('click', () => saveUserRole(btn));
    });
}

async function saveUserRole(btn) {
    const uid = btn.dataset.uid;
    const row = btn.closest('tr');
    const select = row.querySelector('.sa-role-select');
    const newRole = select.value;

    btn.disabled = true;
    const res = await fetch(`${SA_API}/users/${uid}/role`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ newRole }),
    });
    btn.disabled = false;

    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Error', true); return; }

    showToast(t('superadmin.successRoleChanged'));
    // Refresh full user list to get updated club info
    const refreshRes = await fetch(`${SA_API}/users`, { headers: authHeaders() }).catch(() => null);
    if (refreshRes?.ok) {
        const refreshData = await refreshRes.json();
        saAllUsers = refreshData.users || [];
    } else {
        const idx = saAllUsers.findIndex(u => u.id === uid);
        if (idx !== -1) { saAllUsers[idx].role = newRole; saAllUsers[idx].roleLabel = newRole; }
    }
    renderUsersTable(filterUsers(document.getElementById('saUserSearch').value));
}

function filterUsers(q) {
    if (!q) return saAllUsers;
    const lower = q.toLowerCase();
    return saAllUsers.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(lower) ||
        u.email.toLowerCase().includes(lower)
    );
}

function initUserSearch() {
    const input = document.getElementById('saUserSearch');
    if (!input) return;
    input.addEventListener('input', () => renderUsersTable(filterUsers(input.value)));
}

// ── Clubs ─────────────────────────────────────────────────────────────────────
async function loadClubs() {
    const res = await fetch(`${SA_API}/clubs`, { headers: authHeaders() }).catch(() => null);
    if (!res || !res.ok) return;
    const data = await res.json();
    saAllClubs = data.clubs || [];
    renderClubList();
}

function renderClubList() {
    const ul = document.getElementById('saClubList');
    if (!saAllClubs.length) {
        ul.innerHTML = `<li class="admin-loading">${t('superadmin.noClubs')}</li>`;
        return;
    }
    ul.innerHTML = saAllClubs.map(c => `
        <li class="sa-club-item${saSelectedClubId === c.id ? ' sa-club-item--active' : ''}" data-cid="${esc(c.id)}">
            <span class="sa-club-item-name">${esc(c.name)}</span>
            <span class="sa-club-item-actions">
                <button class="sa-icon-btn btn-club-edit" data-cid="${esc(c.id)}" title="${t('superadmin.editClub')}">
                    <i data-lucide="pencil" style="width:14px;height:14px;"></i>
                </button>
                <button class="sa-icon-btn btn-club-delete" data-cid="${esc(c.id)}" title="${t('superadmin.deleteClub')}">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
            </span>
        </li>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    ul.querySelectorAll('.sa-club-item').forEach(li => {
        li.addEventListener('click', (e) => {
            if (e.target.closest('.sa-icon-btn')) return;
            saSelectedClubId = li.dataset.cid;
            renderClubList();
            loadClubMembers(saSelectedClubId);
        });
    });

    ul.querySelectorAll('.btn-club-edit').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openClubModal(btn.dataset.cid); });
    });

    ul.querySelectorAll('.btn-club-delete').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); deleteClub(btn.dataset.cid); });
    });
}

async function deleteClub(cid) {
    if (!confirm(t('superadmin.confirmDeleteClub'))) return;
    const res = await fetch(`${SA_API}/clubs/${cid}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Error', true); return; }
    showToast(t('superadmin.successClubDeleted'));
    if (saSelectedClubId === cid) {
        saSelectedClubId = null;
        document.getElementById('saMembersPanel').classList.add('hidden');
    }
    loadClubs();
}

// Club modal
function openClubModal(cid) {
    saEditingClubId = cid || null;
    const modal = document.getElementById('saClubModal');
    const title = document.getElementById('saClubModalTitle');
    const nameInput = document.getElementById('saClubName');
    const descInput = document.getElementById('saClubDescription');
    const logoInput = document.getElementById('saClubLogoUrl');
    const err = document.getElementById('saClubFormError');

    err.textContent = '';
    if (cid) {
        const club = saAllClubs.find(c => c.id === cid);
        title.setAttribute('data-i18n', 'superadmin.editClub');
        title.textContent = t('superadmin.editClub');
        nameInput.value = club?.name || '';
        descInput.value = club?.description || '';
        logoInput.value = club?.logo_url || '';
    } else {
        title.setAttribute('data-i18n', 'superadmin.createClub');
        title.textContent = t('superadmin.createClub');
        nameInput.value = '';
        descInput.value = '';
        logoInput.value = '';
    }
    openModal(modal);
}

function initClubModal() {
    document.getElementById('saCreateClubBtn').addEventListener('click', () => openClubModal(null));

    document.getElementById('saClubModalClose').addEventListener('click', () => {
        closeModal(document.getElementById('saClubModal'));
    });
    document.getElementById('saClubModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal(e.currentTarget);
    });

    document.getElementById('saClubForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = document.getElementById('saClubFormError');
        err.textContent = '';
        const body = {
            name: document.getElementById('saClubName').value.trim(),
            description: document.getElementById('saClubDescription').value.trim() || null,
            logo_url: document.getElementById('saClubLogoUrl').value.trim() || null,
        };
        const url = saEditingClubId ? `${SA_API}/clubs/${saEditingClubId}` : `${SA_API}/clubs`;
        const method = saEditingClubId ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) { err.textContent = data.message || 'Error'; return; }
        closeModal(document.getElementById('saClubModal'));
        showToast(t('superadmin.successClubSaved'));
        loadClubs();
    });
}

// ── Club Members ──────────────────────────────────────────────────────────────
async function loadClubMembers(clubId) {
    const panel = document.getElementById('saMembersPanel');
    const tbody = document.getElementById('saMembersTableBody');
    const titleEl = document.getElementById('saMembersPanelTitle');
    const club = saAllClubs.find(c => c.id === clubId);

    panel.classList.remove('hidden');
    titleEl.textContent = club ? club.name : t('superadmin.members');
    tbody.innerHTML = `<tr><td colspan="4" class="admin-loading">${t('superadmin.loadingMembers')}</td></tr>`;

    const res = await fetch(`${SA_API}/clubs/${clubId}/members`, { headers: authHeaders() }).catch(() => null);
    if (!res || !res.ok) {
        tbody.innerHTML = `<tr><td colspan="4" class="admin-loading">Error</td></tr>`;
        return;
    }
    const data = await res.json();
    renderMembersTable(data.members || [], clubId);
}

function renderMembersTable(members, clubId) {
    const tbody = document.getElementById('saMembersTableBody');
    if (!members.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="admin-loading">${t('superadmin.noMembersYet')}</td></tr>`;
        return;
    }
    tbody.innerHTML = members.map(m => `
        <tr>
            <td>${esc(m.firstName)} ${esc(m.lastName)}</td>
            <td>${esc(m.email)}</td>
            <td>
                <select class="sa-member-role-select admin-search" data-uid="${esc(m.userId)}" data-cid="${esc(clubId)}" style="padding:3px 8px;font-size:.82rem;width:auto;">
                    <option value="member"${m.clubRole === 'member' ? ' selected' : ''}>${t('superadmin.clubRoleMember')}</option>
                    <option value="vice_president"${m.clubRole === 'vice_president' ? ' selected' : ''}>${t('superadmin.clubRoleVicePresident')}</option>
                    <option value="president"${m.clubRole === 'president' ? ' selected' : ''}>${t('superadmin.clubRolePresident')}</option>
                </select>
            </td>
            <td>
                <button class="btn-remove-member" data-uid="${esc(m.userId)}" data-cid="${esc(clubId)}" style="background:none;border:1px solid var(--accent-coral);color:var(--accent-coral);border-radius:6px;padding:3px 10px;cursor:pointer;font-size:.8rem;">
                    ${t('superadmin.removeMember')}
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.sa-member-role-select').forEach(sel => {
        sel.addEventListener('change', () => updateMemberRole(sel.dataset.cid, sel.dataset.uid, sel.value));
    });

    tbody.querySelectorAll('.btn-remove-member').forEach(btn => {
        btn.addEventListener('click', () => removeMember(btn.dataset.cid, btn.dataset.uid));
    });
}

async function updateMemberRole(clubId, userId, clubRole) {
    const res = await fetch(`${SA_API}/clubs/${clubId}/members/${userId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ clubRole }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Error', true); return; }
    showToast(t('superadmin.successRoleChanged'));
    // Refresh users list to reflect global role change
    const refreshRes = await fetch(`${SA_API}/users`, { headers: authHeaders() }).catch(() => null);
    if (refreshRes?.ok) {
        const refreshData = await refreshRes.json();
        saAllUsers = refreshData.users || [];
    }
}

async function removeMember(clubId, userId) {
    if (!confirm(t('superadmin.confirmRemoveMember'))) return;
    const res = await fetch(`${SA_API}/clubs/${clubId}/members/${userId}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Error', true); return; }
    showToast(t('superadmin.successMemberRemoved'));
    loadClubMembers(clubId);
    // Refresh users list
    const refreshRes = await fetch(`${SA_API}/users`, { headers: authHeaders() }).catch(() => null);
    if (refreshRes?.ok) {
        const refreshData = await refreshRes.json();
        saAllUsers = refreshData.users || [];
        renderUsersTable(filterUsers(document.getElementById('saUserSearch')?.value || ''));
    }
}

// Add member modal
function initAddMemberModal() {
    const modal = document.getElementById('saAddMemberModal');

    document.getElementById('saAddMemberBtn').addEventListener('click', () => {
        if (!saSelectedClubId) return;
        saSelectedUserId = null;
        document.getElementById('saMemberSearchInput').value = '';
        document.getElementById('saMemberSearchResults').classList.add('hidden');
        document.getElementById('saMemberSearchResults').innerHTML = '';
        document.getElementById('saMemberSelectedUser').classList.add('hidden');
        document.getElementById('saMemberAddError').textContent = '';
        openModal(modal);
    });

    document.getElementById('saAddMemberModalClose').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

    document.getElementById('saMemberSearchBtn').addEventListener('click', searchUsersForMember);
    document.getElementById('saMemberSearchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); searchUsersForMember(); }
    });

    document.getElementById('saMemberConfirmBtn').addEventListener('click', confirmAddMember);
}

async function searchUsersForMember() {
    const q = document.getElementById('saMemberSearchInput').value.trim();
    if (!q) return;

    const resultsEl = document.getElementById('saMemberSearchResults');
    resultsEl.innerHTML = '<div style="padding:8px;color:#888;">...</div>';
    resultsEl.classList.remove('hidden');
    resultsEl.style.display = 'block';

    const res = await fetch(`${SA_API}/users/lookup?q=${encodeURIComponent(q)}`, { headers: authHeaders() }).catch(() => null);
    if (!res || !res.ok) { resultsEl.innerHTML = '<div style="padding:8px;color:var(--accent-coral);">Error</div>'; return; }

    const data = await res.json();
    const users = data.users || [];

    if (!users.length) {
        resultsEl.innerHTML = `<div style="padding:8px;color:#888;">${t('superadmin.noUsers')}</div>`;
        return;
    }

    resultsEl.innerHTML = users.map(u => `
        <div class="sa-lookup-item" data-uid="${esc(u.id)}" data-name="${esc(u.firstName + ' ' + u.lastName)}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.06);">
            <strong>${esc(u.firstName)} ${esc(u.lastName)}</strong> <span style="color:#888;font-size:.85rem;">${esc(u.email)}</span>
        </div>
    `).join('');

    resultsEl.querySelectorAll('.sa-lookup-item').forEach(item => {
        item.addEventListener('click', () => {
            saSelectedUserId = item.dataset.uid;
            document.getElementById('saMemberSelectedName').textContent = item.dataset.name;
            document.getElementById('saMemberSelectedUser').classList.remove('hidden');
            resultsEl.classList.add('hidden');
        });
    });
}

async function confirmAddMember() {
    const err = document.getElementById('saMemberAddError');
    err.textContent = '';
    if (!saSelectedUserId || !saSelectedClubId) return;

    const clubRole = document.getElementById('saMemberRoleSelect').value;
    const btn = document.getElementById('saMemberConfirmBtn');
    btn.disabled = true;

    const res = await fetch(`${SA_API}/clubs/${saSelectedClubId}/members`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId: saSelectedUserId, clubRole }),
    });
    btn.disabled = false;

    const data = await res.json();
    if (!res.ok) { err.textContent = data.message || 'Error'; return; }

    closeModal(document.getElementById('saAddMemberModal'));
    showToast(t('superadmin.successMemberAdded'));
    loadClubMembers(saSelectedClubId);
    // Refresh users list to show updated club & global role
    const refreshRes = await fetch(`${SA_API}/users`, { headers: authHeaders() }).catch(() => null);
    if (refreshRes?.ok) {
        const refreshData = await refreshRes.json();
        saAllUsers = refreshData.users || [];
        renderUsersTable(filterUsers(document.getElementById('saUserSearch')?.value || ''));
    }
}

// ── Styles ────────────────────────────────────────────────────────────────────
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .sa-tabs { display:flex; gap:8px; margin-bottom:20px; }
        .sa-tab {
            display:flex; align-items:center; gap:6px;
            padding:8px 18px; border-radius:8px; border:1px solid rgba(255,255,255,.12);
            background:transparent; color:var(--text-secondary,#aaa); cursor:pointer; font-size:.9rem;
            transition:all .2s;
        }
        .sa-tab:hover { border-color:var(--accent-cyan); color:var(--accent-cyan); }
        .sa-tab--active { background:rgba(0,242,255,.1); border-color:var(--accent-cyan); color:var(--accent-cyan); }

        .sa-modal-box {
            background:var(--card-bg,#1e2124);
            border:1px solid rgba(255,255,255,.1);
            border-radius:16px;
            padding:32px;
            width:90%;
            max-width:440px;
            position:relative;
            box-shadow:0 24px 60px rgba(0,0,0,.5);
            margin:auto;
            align-self:center;
        }

        .sa-club-list { list-style:none; padding:0; margin:0; }
        .sa-club-item {
            display:flex; align-items:center; justify-content:space-between;
            padding:10px 14px; border-radius:8px; cursor:pointer;
            border-bottom:1px solid rgba(255,255,255,.06); transition:background .15s;
        }
        .sa-club-item:hover { background:rgba(255,255,255,.04); }
        .sa-club-item--active { background:rgba(0,242,255,.08); border-left:3px solid var(--accent-cyan); }
        .sa-club-item-name { font-weight:500; }
        .sa-club-item-actions { display:flex; gap:6px; opacity:0; transition:opacity .15s; }
        .sa-club-item:hover .sa-club-item-actions { opacity:1; }

        .sa-icon-btn {
            background:none; border:none; cursor:pointer;
            color:#aaa; padding:4px; border-radius:4px; display:flex; align-items:center;
            transition:color .15s;
        }
        .btn-club-edit:hover { color:var(--accent-cyan); }
        .btn-club-delete:hover { color:var(--accent-coral); }

        .sa-search-results {
            border:1px solid rgba(255,255,255,.1); border-radius:8px;
            max-height:200px; overflow-y:auto; margin-bottom:12px;
        }
        .sa-lookup-item:hover { background:rgba(255,255,255,.06); }
        .sa-selected-user { padding:10px; border:1px solid rgba(255,255,255,.1); border-radius:8px; }
        .sa-selected-label { font-weight:600; margin-bottom:8px; color:var(--accent-cyan); }

        body.light-theme .sa-tab { color:#555; border-color:rgba(0,0,0,.15); }
        body.light-theme .sa-tab--active { background:rgba(0,150,199,.1); border-color:#0096c7; color:#0096c7; }
        body.light-theme .sa-club-item:hover { background:rgba(0,0,0,.03); }
        body.light-theme .sa-club-item--active { background:rgba(0,150,199,.07); border-left-color:#0096c7; }
        body.light-theme .sa-modal-box { background:#fff; border-color:rgba(0,0,0,.1); }
    `;
    document.head.appendChild(style);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    initTabs();
    initUserSearch();
    initClubModal();
    initAddMemberModal();
    saCheckAccess();

    window.addEventListener('langchange', () => {
        renderUsersTable(filterUsers(document.getElementById('saUserSearch')?.value || ''));
        renderClubList();
        if (saSelectedClubId) loadClubMembers(saSelectedClubId);
    });
});
