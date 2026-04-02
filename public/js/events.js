const EVENTS_API = 'http://localhost:3000/api/events';

// ===========================
// DOM Elements
// ===========================
const eventsContainer = document.getElementById('eventsContainer');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');

// ===========================
// View Toggle
// ===========================
listViewBtn.addEventListener('click', () => {
    eventsContainer.classList.remove('grid-view');
    eventsContainer.classList.add('list-view');
    listViewBtn.classList.add('active');
    gridViewBtn.classList.remove('active');
    localStorage.setItem('eventsView', 'list');
});

gridViewBtn.addEventListener('click', () => {
    eventsContainer.classList.remove('list-view');
    eventsContainer.classList.add('grid-view');
    gridViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
    localStorage.setItem('eventsView', 'grid');
});

// Restore saved view
const savedView = localStorage.getItem('eventsView');
if (savedView === 'grid') {
    gridViewBtn.click();
}

// ===========================
// Format Date
// ===========================
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===========================
// Join Event
// ===========================
async function joinEvent(eventId, btn) {
    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('openAuthModal').click();
        return;
    }

    const isListBtn = btn.classList.contains('list-join');
    btn.disabled = true;

    if (!isListBtn) btn.textContent = 'Joining...';

    try {
        const res = await fetch(`${EVENTS_API}/${eventId}/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();

        if (!res.ok) {
            if (isListBtn) {
                showTooltip(btn, data.message || 'Failed');
                setTimeout(() => { btn.disabled = false; }, 2000);
            } else {
                btn.textContent = data.message || 'Failed';
                setTimeout(() => { btn.textContent = 'Join'; btn.disabled = false; }, 2000);
            }
            return;
        }

        btn.innerHTML = '<span class="join-text-default">Joined ✓</span><span class="join-text-leave">Leave</span>';
        btn.classList.add('joined');
        btn.disabled = false;
        btn.setAttribute('onclick', `leaveEvent(${eventId}, this)`);

        // Update participant count in the same card/row
        const wrapper = btn.closest('.event-list-row') || btn.closest('.event-grid-wrapper');
        if (wrapper) {
            const capacityEl = wrapper.querySelector('.event-list-capacity') ||
                               wrapper.querySelector('.event-card-meta span:last-child');
            if (capacityEl) {
                const text = capacityEl.textContent.trim();
                const match = text.match(/(\d+)\/(\d+)/);
                if (match) {
                    const newCount = parseInt(match[1]) + 1;
                    capacityEl.innerHTML = `<i data-lucide="users" class="meta-icon"></i> ${newCount}/${match[2]}`;
                    lucide.createIcons();
                }
            }
        }
    } catch (err) {
        if (isListBtn) {
            showTooltip(btn, 'Connection error');
            setTimeout(() => { btn.disabled = false; }, 2000);
        } else {
            btn.textContent = 'Error';
            setTimeout(() => { btn.textContent = 'Join'; btn.disabled = false; }, 2000);
        }
    }
}

// ===========================
// Leave Event
// ===========================
async function leaveEvent(eventId, btn) {
    const token = localStorage.getItem('token');
    if (!token) return;

    btn.disabled = true;

    try {
        const res = await fetch(`${EVENTS_API}/${eventId}/join`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            btn.disabled = false;
            return;
        }

        // Revert to Join button
        btn.textContent = btn.classList.contains('list-join') ? 'Join' : 'Join Event';
        btn.classList.remove('joined');
        btn.disabled = false;
        btn.setAttribute('onclick', `joinEvent(${eventId}, this)`);

        // Update participant count
        const wrapper = btn.closest('.event-list-row') || btn.closest('.event-grid-wrapper');
        if (wrapper) {
            const capacityEl = wrapper.querySelector('.event-list-capacity') ||
                               wrapper.querySelector('.event-card-meta span:last-child');
            if (capacityEl) {
                const text = capacityEl.textContent.trim();
                const match = text.match(/(\d+)\/(\d+)/);
                if (match) {
                    const newCount = Math.max(0, parseInt(match[1]) - 1);
                    capacityEl.innerHTML = `<i data-lucide="users" class="meta-icon"></i> ${newCount}/${match[2]}`;
                    lucide.createIcons();
                }
            }
        }
    } catch (err) {
        btn.disabled = false;
    }
}

// Show tooltip next to a button (list view)
function showTooltip(btn, message) {
    // Remove existing tooltip
    const old = btn.parentElement.querySelector('.join-tooltip');
    if (old) old.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'join-tooltip';
    tooltip.textContent = message;
    btn.parentElement.style.position = 'relative';
    btn.parentElement.appendChild(tooltip);

    // Fade out then remove
    setTimeout(() => {
        tooltip.classList.add('fade-out');
        setTimeout(() => tooltip.remove(), 250);
    }, 2000);
}

// ===========================
// Render Events - List View
// ===========================
function renderListItem(event, joinedIds) {
    const isFull = event.participant_count >= event.capacity;
    const isJoined = joinedIds.has(event.id);

    let btnClass = 'btn-join list-join';
    let btnText = 'Join';
    let btnDisabled = '';

    let btnOnclick = `joinEvent(${event.id}, this)`;

    if (isJoined) {
        btnClass += ' joined';
        btnText = '<span class="join-text-default">Joined ✓</span><span class="join-text-leave">Leave</span>';
        btnOnclick = `leaveEvent(${event.id}, this)`;
    } else if (isFull) {
        btnClass += ' disabled';
        btnText = 'Full';
        btnDisabled = 'disabled';
    }

    return `
        <div class="event-list-row">
            <div class="event-list-info">
                <span class="event-list-title">${event.title}</span>
                <span class="event-list-meta">
                    <i data-lucide="user" class="meta-icon"></i>
                    ${event.organizer_name}
                </span>
            </div>
            <div class="event-list-details">
                <span class="event-list-date">
                    <i data-lucide="calendar" class="meta-icon"></i>
                    ${formatDate(event.date)}
                </span>
                <span class="event-list-location">
                    <i data-lucide="map-pin" class="meta-icon"></i>
                    ${event.location}
                </span>
                <span class="event-list-capacity ${isFull ? 'full' : ''}">
                    <i data-lucide="users" class="meta-icon"></i>
                    ${event.participant_count}/${event.capacity}
                </span>
            </div>
            <button class="${btnClass}" 
                    onclick="${btnOnclick}"
                    ${btnDisabled}>
                ${btnText}
            </button>
        </div>
    `;
}

// ===========================
// Render Events - Grid View
// ===========================
function renderGridCard(event, joinedIds) {
    const isFull = event.participant_count >= event.capacity;
    const isJoined = joinedIds.has(event.id);

    let btnClass = 'btn-join grid-join';
    let btnText = 'Join Event';
    let btnDisabled = '';

    let btnOnclick = `joinEvent(${event.id}, this)`;

    if (isJoined) {
        btnClass += ' joined';
        btnText = '<span class="join-text-default">Joined ✓</span><span class="join-text-leave">Leave</span>';
        btnOnclick = `leaveEvent(${event.id}, this)`;
    } else if (isFull) {
        btnClass += ' disabled';
        btnText = 'Full';
        btnDisabled = 'disabled';
    }

    return `
        <div class="event-grid-wrapper">
            <div class="event-grid-card">
                <h3 class="event-card-title">${event.title}</h3>
                <p class="event-card-desc">${event.description || 'No description available.'}</p>
                <div class="event-card-meta">
                    <span><i data-lucide="calendar" class="meta-icon"></i> ${formatDate(event.date)}</span>
                    <span><i data-lucide="map-pin" class="meta-icon"></i> ${event.location}</span>
                    <span><i data-lucide="user" class="meta-icon"></i> ${event.organizer_name}</span>
                    <span class="${isFull ? 'full' : ''}"><i data-lucide="users" class="meta-icon"></i> ${event.participant_count}/${event.capacity}</span>
                </div>
            </div>
            <button class="${btnClass}" 
                    onclick="${btnOnclick}"
                    ${btnDisabled}>
                ${btnText}
            </button>
        </div>
    `;
}

// ===========================
// Fetch Joined Event IDs
// ===========================
async function fetchJoinedIds() {
    const token = localStorage.getItem('token');
    if (!token) return new Set();

    try {
        const res = await fetch(`${EVENTS_API}/my-joins`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return new Set();
        const data = await res.json();
        return new Set(data.joinedEventIds);
    } catch {
        return new Set();
    }
}

// ===========================
// Load & Render Events
// ===========================
async function loadEvents() {
    try {
        const [eventsRes, joinedIds] = await Promise.all([
            fetch(EVENTS_API).then(r => r.json()),
            fetchJoinedIds()
        ]);

        const data = eventsRes;

        if (!data.events || data.events.length === 0) {
            eventsContainer.innerHTML = '<p class="no-events">No events found. Be the first to create one!</p>';
            return;
        }

        const isGrid = eventsContainer.classList.contains('grid-view');

        if (isGrid) {
            eventsContainer.innerHTML = data.events.map(e => renderGridCard(e, joinedIds)).join('');
        } else {
            eventsContainer.innerHTML = `
                <div class="event-list-header">
                    <span>Event</span>
                    <span>Details</span>
                    <span></span>
                </div>
                ${data.events.map(e => renderListItem(e, joinedIds)).join('')}
            `;
        }

        lucide.createIcons();
    } catch (err) {
        eventsContainer.innerHTML = '<p class="no-events">Failed to load events. Please try again.</p>';
        console.error('Load events error:', err);
    }
}

// Re-render on view change
listViewBtn.addEventListener('click', loadEvents);
gridViewBtn.addEventListener('click', loadEvents);

// Load on page ready
loadEvents();

