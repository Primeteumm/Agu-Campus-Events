/**
 * Club Profile Page — club.js
 * Handles: tab switching, follow toggle, event loading, animations
 */

'use strict';



/* ── State ──────────────────────────────────────────────────────── */
let currentClub = null;
let isFollowing  = false;
let clubEvents   = [];

/* ── Init ───────────────────────────────────────────────────────── */
function initClubPage() {
    const params  = new URLSearchParams(window.location.search);
    const clubId  = params.get('id') || 'agu-tech';

    currentClub = CLUBS[clubId] || CLUBS['agu-tech'];

    renderClubHeader();
    initTabs();
    initFollowBtn();
    loadFeedEvents();

    // Apply saved theme
    const saved = localStorage.getItem('theme');
    if (saved === 'light') document.body.classList.add('light-theme');

    lucide.createIcons();
}

// Wait until both DOM and lucide are ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClubPage);
} else {
    initClubPage();
}


/* ── Render Header ──────────────────────────────────────────────── */
function renderClubHeader() {
    const c = currentClub;

    document.title = `${c.name} — AGÜ Campus Events`;

    // Logo
    const logoImg = document.getElementById('clubLogoImg');
    if (logoImg) logoImg.src = c.logo;

    // Cover (optional bg override)
    if (c.cover) {
        const cover = document.getElementById('clubCover');
        if (cover) cover.style.backgroundImage = `url(${c.cover})`;
    }

    // Hero info
    setText('clubName', c.name);
    setText('clubTagline', c.tagline);
    setText('clubCategory', c.category);

    // Stats
    setText('clubMemberCount', c.memberCount);

    // Page nav link updates
    document.querySelectorAll('.club-back-link').forEach(el => {
        el.href = '/';
    });

    // Check for "Manage Club" Admin Access
    try {
        const token = localStorage.getItem('token');
        const rawUser = localStorage.getItem('user');
        if (token && rawUser) {
            const u = JSON.parse(rawUser);
            // Simple check: if user has 'organizer' role, or if their roles array contains 'organizer'
            const isManager = (u.roles && u.roles.includes('organizer')) || u.role === 'organizer';
            if (isManager) {
                const actionsContainer = document.querySelector('.club-actions');
                if (actionsContainer && !document.getElementById('clubManageBtn')) {
                    const manageBtn = document.createElement('button');
                    manageBtn.id = 'clubManageBtn';
                    manageBtn.className = 'club-btn-message'; // Reusing secondary button style
                    manageBtn.innerHTML = `<i data-lucide="settings" style="width:16px;height:16px;"></i> Manage Club`;
                    manageBtn.style.background = 'rgba(0, 242, 255, 0.1)';
                    manageBtn.style.color = 'var(--accent-cyan)';
                    manageBtn.style.borderColor = 'rgba(0, 242, 255, 0.3)';
                    manageBtn.onclick = () => window.location.href = '/admin.html';
                    actionsContainer.appendChild(manageBtn);
                }
            }
        }
    } catch(e) {}
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* ── Tabs ───────────────────────────────────────────────────────── */
function initTabs() {
    const tabs   = document.querySelectorAll('.club-tab');
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
                // Re-trigger animation
                panel.style.animation = 'none';
                panel.offsetHeight; // reflow
                panel.style.animation = '';
            }

            // Lazy render team on first visit
            if (target === 'team') renderTeam();
            if (target === 'about') renderAbout();
        });
    });
}

/* ── Follow Button ──────────────────────────────────────────────── */
function initFollowBtn() {
    const btn = document.getElementById('clubFollowBtn');
    if (!btn) return;

    const key = `following_${currentClub.id}`;
    isFollowing = localStorage.getItem(key) === 'true';
    updateFollowBtn(btn);

    btn.addEventListener('click', () => {
        const token = localStorage.getItem('token');
        if (!token) {
            // Prompt login
            document.getElementById('openAuthModal')?.click();
            return;
        }
        isFollowing = !isFollowing;
        localStorage.setItem(key, String(isFollowing));
        updateFollowBtn(btn);

        // Update member count visually
        const c = currentClub;
        const delta = isFollowing ? 1 : -1;
        const newCount = c.memberCount + delta;
        setText('clubMemberCount', newCount);
    });
}

function updateFollowBtn(btn) {
    if (isFollowing) {
        btn.classList.add('following');
        btn.innerHTML = `<i data-lucide="check" style="width:16px;height:16px;"></i> Following`;
    } else {
        btn.classList.remove('following');
        btn.innerHTML = `<i data-lucide="plus" style="width:16px;height:16px;"></i> Follow`;
    }
    lucide.createIcons();
}

/* ── Feed / Events ──────────────────────────────────────────────── */
async function loadFeedEvents() {
    const container = document.getElementById('clubFeedContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="club-loading">
            <div class="club-spinner"></div>
            <span>Loading events...</span>
        </div>`;

    try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/events?includePassed=true', { headers });
        if (!res.ok) throw new Error('fetch failed');

        const data = await res.json();
        const allEvents = data.events || [];

        // Filter by organizer name matching club name keywords
        const keyword = currentClub.name.replace(' Club', '').replace(' Society', '').toLowerCase();
        clubEvents = allEvents.filter(e =>
            e.organizer_name?.toLowerCase().includes(keyword) ||
            e.title?.toLowerCase().includes(keyword)
        );

        // Fallback: use first 4 events if none match (demo)
        if (clubEvents.length === 0) clubEvents = allEvents.slice(0, 4);

        // Update event count badge
        const badge = document.getElementById('feedCountBadge');
        if (badge) badge.textContent = clubEvents.length;

        // Update stats event count
        const evCount = document.getElementById('clubEventCount');
        if (evCount) evCount.textContent = clubEvents.length;




        renderFeedGrid(clubEvents, container);
    } catch (err) {
        container.innerHTML = `
            <div class="club-empty">
                <span class="club-empty-icon">📅</span>
                <p>Could not load events. Please try again.</p>
            </div>`;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isPassed(dateStr) {
    return dateStr && new Date(dateStr) < new Date();
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function renderFeedGrid(events, container) {
    if (events.length === 0) {
        container.innerHTML = `
            <div class="club-empty">
                <span class="club-empty-icon">🎉</span>
                <p>No events from this club yet. Check back soon!</p>
            </div>`;
        return;
    }

    container.innerHTML = events.map((ev, i) => {
        const passed = isPassed(ev.date);
        const wrapClass = `event-grid-wrapper${passed ? ' passed' : ''}`;
        return `
        <div class="${wrapClass}" style="animation-delay:${0.05 + i * 0.06}s">
            <div class="event-grid-card">
                ${passed ? '<span class="passed-badge">Passed</span>' : ''}
                <h3 class="event-card-title">${esc(ev.title)}</h3>
                <p class="event-card-desc">${esc(ev.description || 'No description available.')}</p>
                <div class="event-card-meta">
                    <span><i data-lucide="calendar" class="meta-icon"></i> ${esc(formatDate(ev.date))}</span>
                    <span><i data-lucide="map-pin" class="meta-icon"></i> ${esc(ev.location)}</span>
                    <span><i data-lucide="users" class="meta-icon"></i> ${ev.participant_count}/${ev.capacity}</span>
                </div>
            </div>
            ${!passed ? `<button class="btn-join grid-join" onclick="joinFromClub('${ev.id}', this)">Join Event</button>` : ''}
        </div>`;
    }).join('');

    lucide.createIcons();
}

window.joinFromClub = function(eventId, btn) {
    const token = localStorage.getItem('token');
    if (!token) { document.getElementById('openAuthModal')?.click(); return; }
    // Delegate to existing joinEvent if available
    if (typeof joinEvent === 'function') joinEvent(eventId, btn);
};

/* ── About ──────────────────────────────────────────────────────── */
function renderAbout() {
    const container = document.getElementById('clubAboutContainer');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    const c = currentClub;
    const paras = c.about.map(p => `<p>${esc(p)}</p>`).join('');
    const highlights = c.highlights.map(h => `
        <div class="club-highlight-card">
            <span class="club-highlight-icon">${h.icon}</span>
            <div class="club-highlight-title">${esc(h.title)}</div>
            <div class="club-highlight-desc">${esc(h.desc)}</div>
        </div>`).join('');

    container.innerHTML = `
        <div class="club-about-content">
            <h2>About Us</h2>
            ${paras}
            <div class="club-about-highlights">${highlights}</div>
        </div>`;
}

/* ── Team ───────────────────────────────────────────────────────── */
function renderTeam() {
    const container = document.getElementById('clubTeamContainer');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = 'true';

    const c = currentClub;
    container.innerHTML = `
        <div class="team-grid">
            ${c.team.map(m => `
            <div class="team-member">
                <div class="team-avatar">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=${m.color}&size=160&bold=true" alt="${esc(m.name)}">
                </div>
                <div class="team-name">${esc(m.name)}</div>
                <div class="team-role">${esc(m.role)}</div>
            </div>`).join('')}
        </div>`;
}

/* ── Theme Toggle ───────────────────────────────────────────────── */
const themeInput = document.getElementById('themeToggle');
if (themeInput) {
    themeInput.checked = !document.body.classList.contains('light-theme');
    themeInput.addEventListener('change', () => {
        const isLight = !themeInput.checked;
        document.body.classList.toggle('light-theme', isLight);
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}
