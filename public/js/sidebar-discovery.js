// sidebar-discovery.js
// Handles Smart Discovery Sidebar (Trending Events & Top Guilds)

document.addEventListener('DOMContentLoaded', () => {
    renderTopGuilds();
    // On pages without events.js (e.g. club.html), fetch events ourselves so
    // the Trending Events sidebar still populates.
    if (!document.getElementById('eventsContainer')) {
        fetch('/api/events')
            .then(r => r.json())
            .then(data => {
                const events = Array.isArray(data) ? data : (data && data.events) || [];
                if (typeof window.renderTrendingEvents === 'function') {
                    window.renderTrendingEvents(events);
                }
            })
            .catch(() => { /* silently ignore */ });
    }
});

function renderTopGuilds() {
    const container = document.getElementById('sidebarGuildsList');
    if (!container) return;

    let html = '';
    // Show top 3 clubs
    const topClubs = Object.values(CLUBS).slice(0, 3);
    
    topClubs.forEach(club => {
        html += `
            <a href="/club.html?id=${club.id}" class="sidebar-guild-item">
                <img src="${club.logo}" alt="${esc(club.name)}" class="sidebar-guild-logo">
                <div class="sidebar-guild-info">
                    <div class="sidebar-guild-name">${esc(club.name)}</div>
                    <div class="sidebar-guild-members">${club.memberCount} members</div>
                </div>
            </a>
        `;
    });

    container.innerHTML = html;
}

// Called from events.js when events are loaded
window.renderTrendingEvents = function(events) {
    const container = document.getElementById('sidebarTrendingList');
    if (!container || !events || events.length === 0) return;

    // Filter upcoming events and take top 3 (mocking trending logic)
    const upcoming = events.filter(e => new Date(e.date) >= new Date())
                           .sort((a, b) => b.participant_count - a.participant_count)
                           .slice(0, 3);

    if (upcoming.length === 0) {
        container.innerHTML = '<div class="sidebar-empty">No trending events</div>';
        return;
    }

    let html = '';
    upcoming.forEach(ev => {
        const d = new Date(ev.date);
        const dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
        
        html += `
            <div class="sidebar-trending-item" onclick="scrollToEvent('${ev.id}')">
                <div class="sidebar-trending-date">${dateStr}</div>
                <div class="sidebar-trending-info">
                    <div class="sidebar-trending-title">${esc(ev.title)}</div>
                    <div class="sidebar-trending-org">${esc(ev.organizer_name)}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

window.scrollToEvent = function(eventId) {
    // If we're not on the home/events page, redirect to home with a hash so
    // the home page can scroll + glow the card after it loads.
    if (!document.getElementById('eventsContainer')) {
        window.location.href = `/#event-${eventId}`;
        return;
    }
    const el = document.getElementById(`event-card-${eventId}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('glow-highlight');
        setTimeout(() => {
            el.classList.remove('glow-highlight');
        }, 2000);
    }
};

// On the home page, if the URL hash points to an event (e.g. "#event-123"),
// trigger the same scroll + glow effect once events are rendered.
(function handleEventHashOnHome() {
    if (!document.getElementById('eventsContainer')) return;

    function tryHighlightFromHash() {
        const m = (window.location.hash || '').match(/^#event-(.+)$/);
        if (!m) return false;
        const el = document.getElementById(`event-card-${m[1]}`);
        if (!el) return false;
        // Defer slightly so layout settles after render.
        setTimeout(() => window.scrollToEvent(m[1]), 60);
        return true;
    }

    // Poll briefly because events.js renders asynchronously after fetch.
    let attempts = 0;
    const iv = setInterval(() => {
        attempts++;
        if (tryHighlightFromHash() || attempts > 40) clearInterval(iv);
    }, 150);

    window.addEventListener('hashchange', tryHighlightFromHash);
})();
