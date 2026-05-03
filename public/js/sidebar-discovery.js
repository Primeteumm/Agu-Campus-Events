// sidebar-discovery.js
// Handles Smart Discovery Sidebar (Trending Events & Top Guilds)

document.addEventListener('DOMContentLoaded', () => {
    renderTopGuilds();
    // We will render trending events after events data is loaded in events.js
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
    // Find the event card in the main feed
    // In events.js, event wrappers don't have IDs. 
    // Let's find the card by searching for the join button which has the ID logic, or we'll add IDs to cards.
    // Assuming we add id="event-card-{id}" to the wrapper in events.js
    const el = document.getElementById(`event-card-${eventId}`);
    if (el) {
        // Smooth scroll
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add Cyan glow effect
        el.classList.add('glow-highlight');
        setTimeout(() => {
            el.classList.remove('glow-highlight');
        }, 2000);
    }
};
