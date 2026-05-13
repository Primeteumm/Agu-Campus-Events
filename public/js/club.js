'use strict';

let currentClub = null;
let clubMembers = [];
let isFollowing = false;
let clubEvents = [];

function t(k) { return typeof i18nGet === 'function' ? i18nGet(k) : k; }
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

async function initClubPage() {
    const params = new URLSearchParams(window.location.search);
    const clubId = params.get('id');

    if (!clubId) {
        showError('No club ID specified.');
        return;
    }

    try {
        const [clubRes, membersRes] = await Promise.all([
            fetch(`/api/clubs/${clubId}`),
            fetch(`/api/clubs/${clubId}/members`),
        ]);

        if (!clubRes.ok) { showError('Club not found.'); return; }

        const clubData = await clubRes.json();
        const membersData = membersRes.ok ? await membersRes.json() : { members: [] };

        currentClub = clubData.club;
        clubMembers = membersData.members || [];

        renderClubHeader();
        initTabs();
        initFollowBtn();
        loadFeedEvents();
    } catch (e) {
        showError('Failed to load club.');
    }

    const saved = localStorage.getItem('theme');
    if (saved === 'light') document.body.classList.add('light-theme');
    lucide.createIcons();
}

function showError(msg) {
    setText('clubName', msg);
    document.getElementById('clubFeedContainer').innerHTML = `<div class="club-empty"><p>${esc(msg)}</p></div>`;
}

function renderClubHeader() {
    const c = currentClub;
    document.title = `${c.name} — AGÜ Campus Events`;

    const logoImg = document.getElementById('clubLogoImg');
    if (logoImg) {
        logoImg.src = c.logo_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=25282C&color=00F2FF&size=128&bold=true`;
    }

    setText('clubName', c.name);
    setText('clubTagline', c.description || '');
    setText('clubCategory', '');
    setText('clubMemberCount', c.member_count ?? clubMembers.length);

    // Update team tab badge
    const teamBadge = document.querySelector('#tab-team .club-tab-count');
    if (teamBadge) teamBadge.textContent = clubMembers.length;

    document.querySelectorAll('.club-back-link').forEach(el => { el.href = '/'; });

}

function initTabs() {
    const tabs = document.querySelectorAll('.club-tab');
    const panels = document.querySelectorAll('.club-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById(`panel-${target}`);
            if (panel) {
                panel.classList.add('active');
                panel.style.animation = 'none';
                panel.offsetHeight;
                panel.style.animation = '';
            }
            if (target === 'team') renderTeam();
            if (target === 'about') renderAbout();
        });
    });
}

function initFollowBtn() {
    const btn = document.getElementById('clubFollowBtn');
    if (!btn || !currentClub) return;
    const key = `following_${currentClub.id}`;
    isFollowing = localStorage.getItem(key) === 'true';
    updateFollowBtn(btn);

    btn.addEventListener('click', () => {
        if (!localStorage.getItem('token')) {
            document.getElementById('openAuthModal')?.click();
            return;
        }
        isFollowing = !isFollowing;
        localStorage.setItem(key, String(isFollowing));
        updateFollowBtn(btn);
        const delta = isFollowing ? 1 : -1;
        const cur = parseInt(document.getElementById('clubMemberCount')?.textContent) || 0;
        setText('clubMemberCount', cur + delta);
    });
}

function updateFollowBtn(btn) {
    if (isFollowing) {
        btn.classList.add('following');
        btn.innerHTML = `<i data-lucide="check" style="width:16px;height:16px;"></i> ${t('club.following')}`;
    } else {
        btn.classList.remove('following');
        btn.innerHTML = `<i data-lucide="plus" style="width:16px;height:16px;"></i> ${t('club.follow')}`;
    }
    lucide.createIcons();
}

async function loadFeedEvents() {
    const container = document.getElementById('clubFeedContainer');
    if (!container) return;

    container.innerHTML = `<div class="club-loading"><div class="club-spinner"></div><span>${t('club.loadingEvents')}</span></div>`;

    try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/events?includePassed=true', { headers });
        if (!res.ok) throw new Error('fetch failed');

        const data = await res.json();
        const allEvents = data.events || [];

        const keyword = currentClub.name.replace(/ Club| Society| Kulübü/gi, '').toLowerCase().trim();
        clubEvents = allEvents.filter(e =>
            e.organizer_name?.toLowerCase().includes(keyword) ||
            e.title?.toLowerCase().includes(keyword)
        );

        const badge = document.getElementById('feedCountBadge');
        if (badge) badge.textContent = clubEvents.length;
        const evCount = document.getElementById('clubEventCount');
        if (evCount) evCount.textContent = clubEvents.length;

        renderFeedGrid(clubEvents, container);
    } catch (e) {
        container.innerHTML = `<div class="club-empty"><span class="club-empty-icon">📅</span><p>${t('club.failedLoad')}</p></div>`;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isPassed(dateStr) { return dateStr && new Date(dateStr) < new Date(); }

function renderFeedGrid(events, container) {
    if (events.length === 0) {
        container.innerHTML = `<div class="club-empty"><span class="club-empty-icon">🎉</span><p>${t('club.noEvents')}</p></div>`;
        return;
    }
    container.innerHTML = events.map((ev, i) => {
        const passed = isPassed(ev.date);
        return `
        <div class="event-grid-wrapper${passed ? ' passed' : ''}" style="animation-delay:${0.05 + i * 0.06}s">
            <div class="event-grid-card">
                ${passed ? `<span class="passed-badge">${t('events.passed')}</span>` : ''}
                <h3 class="event-card-title">${esc(ev.title)}</h3>
                <p class="event-card-desc">${esc(ev.description || t('events.noDescription'))}</p>
                <div class="event-card-meta">
                    <span><i data-lucide="calendar" class="meta-icon"></i> ${esc(formatDate(ev.date))}</span>
                    <span><i data-lucide="map-pin" class="meta-icon"></i> ${esc(ev.location)}</span>
                    <span><i data-lucide="users" class="meta-icon"></i> ${ev.participant_count}/${ev.capacity}</span>
                </div>
            </div>
            ${!passed ? `<button class="btn-join grid-join" onclick="joinFromClub('${ev.id}', this)">${t('club.joinEvent')}</button>` : ''}
        </div>`;
    }).join('');
    lucide.createIcons();
}

window.joinFromClub = async function(eventId, btn) {
    const token = localStorage.getItem('token');
    if (!token) { document.getElementById('openAuthModal')?.click(); return; }
    if (btn.disabled) return;

    btn.disabled = true;
    btn.classList.add('btn-loading');

    try {
        const isJoined = btn.classList.contains('joined');
        const res = await fetch(`/api/events/${eventId}/join`, {
            method: isJoined ? 'DELETE' : 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (!res.ok) {
            btn.textContent = data.message || 'Failed';
            setTimeout(() => { btn.textContent = t('club.joinEvent'); btn.disabled = false; }, 2000);
            return;
        }

        if (isJoined) {
            btn.textContent = t('club.joinEvent');
            btn.classList.remove('joined');
            btn.setAttribute('onclick', `joinFromClub('${eventId}', this)`);
        } else {
            btn.innerHTML = `<span class="join-text-default">${t('events.joinedCheck')}</span><span class="join-text-leave">${t('events.leave')}</span>`;
            btn.classList.add('joined');
            btn.setAttribute('onclick', `joinFromClub('${eventId}', this)`);
        }

        // Update participant count in UI
        const wrapper = btn.closest('.event-grid-wrapper');
        if (wrapper) {
            const capEl = wrapper.querySelector('.event-card-meta span:last-child');
            if (capEl) {
                const match = capEl.textContent.trim().match(/(\d+)\/(\d+)/);
                if (match) {
                    const delta = isJoined ? -1 : 1;
                    capEl.innerHTML = `<i data-lucide="users" class="meta-icon"></i> ${parseInt(match[1]) + delta}/${match[2]}`;
                    lucide.createIcons();
                }
            }
        }
    } catch (e) {
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = t('club.joinEvent'); btn.disabled = false; }, 2000);
    } finally {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
};

function renderAbout() {
    const container = document.getElementById('clubAboutContainer');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    const desc = currentClub?.description || '';
    container.innerHTML = `
        <div class="club-about-content">
            <h2>${t('club.aboutUs')}</h2>
            ${desc ? `<p>${esc(desc)}</p>` : `<p class="club-empty-text">${t('club.noDescription') || 'No description available.'}</p>`}
        </div>`;
}

function renderTeam() {
    const container = document.getElementById('clubTeamContainer');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    if (clubMembers.length === 0) {
        container.innerHTML = `<div class="club-empty"><p>${t('club.noMembers') || 'No team members yet.'}</p></div>`;
        return;
    }

    const roleOrder = { president: 0, vice_president: 1, member: 2 };
    const sorted = [...clubMembers].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

    const roleLabel = { president: 'President', vice_president: 'Vice President', member: 'Member' };
    const colors = ['25282C', '1a2a3a', '2a1a3a', '1a3a2a', '3a2a1a'];

    container.innerHTML = `
        <div class="team-grid">
            ${sorted.map((m, i) => `
            <div class="team-member">
                <div class="team-avatar">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || '?')}&background=${colors[i % colors.length]}&color=00F2FF&size=160&bold=true" alt="${esc(m.name)}">
                </div>
                <div class="team-name">${esc(m.name || 'Unknown')}</div>
                <div class="team-role">${esc(roleLabel[m.role] || m.role)}</div>
            </div>`).join('')}
        </div>`;
}

window.addEventListener('langchange', () => {
    const container = document.getElementById('clubFeedContainer');
    if (container && clubEvents.length > 0) renderFeedGrid(clubEvents, container);
    updateFollowBtn(document.getElementById('clubFollowBtn'));
    const aboutContainer = document.getElementById('clubAboutContainer');
    if (aboutContainer) delete aboutContainer.dataset.rendered;
    const teamContainer = document.getElementById('clubTeamContainer');
    if (teamContainer) delete teamContainer.dataset.rendered;
});

const themeInput = document.getElementById('themeToggle');
if (themeInput) {
    themeInput.checked = !document.body.classList.contains('light-theme');
    themeInput.addEventListener('change', () => {
        const isLight = !themeInput.checked;
        document.body.classList.toggle('light-theme', isLight);
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClubPage);
} else {
    initClubPage();
}
