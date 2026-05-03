/**
 * Club Profile Page — club.js
 * Handles: tab switching, follow toggle, event loading, animations
 */

'use strict';

/* ── Demo Club Data ─────────────────────────────────────────────── */
const CLUBS = {
    'agu-tech': {
        id: 'agu-tech',
        name: 'AGÜ Tech Club',
        tagline: "Building tomorrow's innovations, today.",
        category: '💻 Technology',
        memberCount: 142,
        cover: null,
        logo: 'https://ui-avatars.com/api/?name=TC&background=003344&color=00F2FF&size=256&bold=true',
        about: [
            'AGÜ Tech Club is the leading technology community at Abdullah Gül University. We bring together students passionate about software development, AI, hardware, and emerging technologies.',
            'Our weekly workshops, hackathons, and speaker sessions provide hands-on experience with cutting-edge tools. Whether you\'re a beginner or an expert, there\'s a place for you in our community.',
            'We collaborate with industry partners to offer internship opportunities, project mentoring, and career networking events throughout the academic year.',
        ],
        highlights: [
            { icon: '🏆', title: 'Hackathon Winners', desc: '3x national hackathon champions (2023–2025)' },
            { icon: '🤝', title: 'Industry Partners', desc: '12+ tech companies collaborate with us' },
            { icon: '📚', title: 'Weekly Workshops', desc: 'Hands-on sessions every Wednesday' },
            { icon: '🚀', title: 'Startup Incubation', desc: '5 startups founded by our members' },
        ],
        team: [
            { name: 'Muhammed Ali Bakır', role: 'President',      initials: 'MB', color: '003344&color=00F2FF' },
            { name: 'Enes Aydın',         role: 'Vice President', initials: 'EA', color: '1a0a0a&color=FF6B6B' },
            { name: 'Mustafa Ateş',       role: 'Tech Lead',      initials: 'MA', color: '0d1a00&color=66FF66' },
        ],
    },
    'agu-music': {
        id: 'agu-music',
        name: 'AGÜ Music Society',
        tagline: 'Where every note tells a story.',
        category: '🎵 Music & Arts',
        memberCount: 98,
        cover: null,
        logo: 'https://ui-avatars.com/api/?name=MS&background=1a0a1a&color=FF6B6B&size=256&bold=true',
        about: [
            'The AGÜ Music Society is a vibrant community of musicians, composers, and music enthusiasts at Abdullah Gül University. We welcome all genres and skill levels.',
            'From classical concerts to jazz nights and electronic music production workshops, we create diverse musical experiences for the entire campus.',
        ],
        highlights: [
            { icon: '🎸', title: 'Live Concerts', desc: 'Monthly campus performances' },
            { icon: '🎹', title: 'Rehearsal Rooms', desc: 'Dedicated practice spaces' },
            { icon: '🎤', title: 'Open Mic Nights', desc: 'Every Friday evening' },
            { icon: '🎼', title: 'Composition Lab', desc: 'Music production workshops' },
        ],
        team: [
            { name: 'Muhammed Ali Bakır', role: 'President',      initials: 'MB', color: '1a0a1a&color=FF6B6B' },
            { name: 'Enes Aydın',         role: 'Conductor',      initials: 'EA', color: '0a001a&color=CC88FF' },
            { name: 'Mustafa Ateş',       role: 'Events Lead',    initials: 'MA', color: '001a0a&color=00FFAA' },
        ],
    },
};

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
