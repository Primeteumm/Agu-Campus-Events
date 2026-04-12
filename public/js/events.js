const EVENTS_API = '/api/events';

const eventsContainer = document.getElementById('eventsContainer');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');
const showPassedCheckbox = document.getElementById('showPassedCheckbox');

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function isPassed(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}

let cachedEventsData = null;
let cachedJoinedIdsData = null;

// Restore checkbox state from localStorage
showPassedCheckbox.checked = localStorage.getItem('showPassedEvents') === 'true';

showPassedCheckbox.addEventListener('change', () => {
    localStorage.setItem('showPassedEvents', showPassedCheckbox.checked);
    loadEvents();
});

listViewBtn.addEventListener('click', () => {
    if (localStorage.getItem('eventsView') === 'list') return;
    listViewBtn.classList.add('active');
    gridViewBtn.classList.remove('active');
    localStorage.setItem('eventsView', 'list');
    if (typeof renderCurrentView === 'function') renderCurrentView();
});

gridViewBtn.addEventListener('click', () => {
    if (localStorage.getItem('eventsView') === 'grid') return;
    gridViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
    localStorage.setItem('eventsView', 'grid');
    if (typeof renderCurrentView === 'function') renderCurrentView();
});

const savedView = localStorage.getItem('eventsView');
if (savedView === 'grid') {
    gridViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
} else {
    listViewBtn.classList.add('active');
    gridViewBtn.classList.remove('active');
}

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
        btn.setAttribute('onclick', `leaveEvent('${eventId}', this)`);

        if (cachedJoinedIdsData) cachedJoinedIdsData.add(String(eventId));
        if (cachedEventsData && cachedEventsData.events) {
            const ev = cachedEventsData.events.find(e => String(e.id) === String(eventId));
            if (ev) ev.participant_count++;
        }

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

        btn.textContent = btn.classList.contains('list-join') ? 'Join' : 'Join Event';
        btn.classList.remove('joined');
        btn.disabled = false;
        btn.setAttribute('onclick', `joinEvent('${eventId}', this)`);

        if (cachedJoinedIdsData) cachedJoinedIdsData.delete(String(eventId));
        if (cachedEventsData && cachedEventsData.events) {
            const ev = cachedEventsData.events.find(e => String(e.id) === String(eventId));
            if (ev) ev.participant_count = Math.max(0, ev.participant_count - 1);
        }

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

function showTooltip(btn, message) {
    const old = btn.parentElement.querySelector('.join-tooltip');
    if (old) old.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'join-tooltip';
    tooltip.textContent = message;
    btn.parentElement.style.position = 'relative';
    btn.parentElement.appendChild(tooltip);

    setTimeout(() => {
        tooltip.classList.add('fade-out');
        setTimeout(() => tooltip.remove(), 250);
    }, 2000);
}

window.toggleEventListAccordion = function(row, ev) {
    if (ev.target.closest('button')) return;
    row.classList.toggle('expanded');
};

function renderListItem(event, joinedIds) {
    const isFull = event.participant_count >= event.capacity;
    const isJoined = joinedIds.has(String(event.id));
    const passed = isPassed(event.date);

    let btnClass = 'btn-join list-join';
    let btnText = 'Join';
    let btnDisabled = '';

    let btnOnclick = `joinEvent('${event.id}', this)`;

    if (passed) {
        btnClass += ' disabled';
        btnText = 'Ended';
        btnDisabled = 'disabled';
    } else if (isJoined) {
        btnClass += ' joined';
        btnText = '<span class="join-text-default">Joined ✓</span><span class="join-text-leave">Leave</span>';
        btnOnclick = `leaveEvent('${event.id}', this)`;
    } else if (isFull) {
        btnClass += ' disabled';
        btnText = 'Full';
        btnDisabled = 'disabled';
    }

    const passedBadge = passed ? '<span class="passed-badge">Passed</span>' : '';
    const rowClass = `event-list-row${passed ? ' passed' : ''}`;

    return `
        <div class="${rowClass}" onclick="toggleEventListAccordion(this, event)">
            <div class="event-list-main">
                <div class="event-list-info">
                    <span class="event-list-title">${esc(event.title)}${passedBadge}</span>
                    <span class="event-list-meta">
                        <i data-lucide="user" class="meta-icon"></i>
                        ${esc(event.organizer_name)}
                    </span>
                </div>
                <div class="event-list-details">
                    <span class="event-list-date">
                        <i data-lucide="calendar" class="meta-icon"></i>
                        ${esc(formatDate(event.date))}
                    </span>
                    <span class="event-list-location">
                        <i data-lucide="map-pin" class="meta-icon"></i>
                        ${esc(event.location)}
                    </span>
                    <span class="event-list-capacity ${isFull ? 'full' : ''}">
                        <i data-lucide="users" class="meta-icon"></i>
                        ${event.participant_count}/${event.capacity}
                    </span>
                </div>
                <div class="event-list-actions">
                    <button class="${btnClass}" 
                            onclick="${btnOnclick}"
                            ${btnDisabled}>
                        ${btnText}
                    </button>
                    <div class="accordion-chevron">
                        <i data-lucide="chevron-down" style="width:20px;height:20px;"></i>
                    </div>
                </div>
            </div>
            <div class="event-list-expanded">
                <div class="event-list-expanded-inner">
                    <p class="event-list-desc-title">About this event</p>
                    <p class="event-list-desc">${esc(event.description || 'No description available.')}</p>
                </div>
            </div>
        </div>
    `;
}

function renderGridCard(event, joinedIds) {
    const isFull = event.participant_count >= event.capacity;
    const isJoined = joinedIds.has(String(event.id));
    const passed = isPassed(event.date);

    let btnClass = 'btn-join grid-join';
    let btnText = 'Join Event';
    let btnDisabled = '';

    let btnOnclick = `joinEvent('${event.id}', this)`;

    if (passed) {
        btnClass += ' disabled';
        btnText = 'Ended';
        btnDisabled = 'disabled';
    } else if (isJoined) {
        btnClass += ' joined';
        btnText = '<span class="join-text-default">Joined ✓</span><span class="join-text-leave">Leave</span>';
        btnOnclick = `leaveEvent('${event.id}', this)`;
    } else if (isFull) {
        btnClass += ' disabled';
        btnText = 'Full';
        btnDisabled = 'disabled';
    }

    const passedBadge = passed ? '<span class="passed-badge">Passed</span>' : '';
    const wrapperClass = `event-grid-wrapper${passed ? ' passed' : ''}`;

    return `
        <div class="${wrapperClass}">
            <div class="event-grid-card">
                <h3 class="event-card-title">${esc(event.title)}${passedBadge}</h3>
                <p class="event-card-desc">${esc(event.description || 'No description available.')}</p>
                <div class="event-card-meta">
                    <span><i data-lucide="calendar" class="meta-icon"></i> ${esc(formatDate(event.date))}</span>
                    <span><i data-lucide="map-pin" class="meta-icon"></i> ${esc(event.location)}</span>
                    <span><i data-lucide="user" class="meta-icon"></i> ${esc(event.organizer_name)}</span>
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

async function fetchJoinedIds() {
    const token = localStorage.getItem('token');
    if (!token) return new Set();

    try {
        const res = await fetch(`${EVENTS_API}/my-joins`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return new Set();
        const data = await res.json();
        return new Set((data.joinedEventIds || []).map(String));
    } catch {
        return new Set();
    }
}

function renderCurrentView() {
    if (!cachedEventsData || !cachedEventsData.events) return;

    if (cachedEventsData.events.length === 0) {
        eventsContainer.innerHTML = '<p class="no-events">No events found. Be the first to create one!</p>';
        return;
    }

    const isGrid = localStorage.getItem('eventsView') === 'grid';

    if (isGrid) {
        eventsContainer.classList.remove('list-view');
        eventsContainer.classList.add('grid-view');
        eventsContainer.innerHTML = cachedEventsData.events.map((e) => renderGridCard(e, cachedJoinedIdsData)).join('');
    } else {
        eventsContainer.classList.remove('grid-view');
        eventsContainer.classList.add('list-view');
        eventsContainer.innerHTML = `
        <div class="event-list-header">
            <span>Event</span>
            <span>Details</span>
            <span></span>
        </div>
        ${cachedEventsData.events.map((e) => renderListItem(e, cachedJoinedIdsData)).join('')}
        `;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

let loadEventsPromise = null;

async function loadEvents() {
    if (loadEventsPromise) {
        return loadEventsPromise;
    }

    loadEventsPromise = (async () => {
        try {
            const includePassed = showPassedCheckbox.checked;
            const [eventsRes, joinedIds] = await Promise.all([
                fetch(`${EVENTS_API}?includePassed=${includePassed}`).then((r) => r.json()),
                fetchJoinedIds(),
            ]);

            cachedEventsData = eventsRes;
            cachedJoinedIdsData = joinedIds;

            renderCurrentView();
        } catch (err) {
            eventsContainer.innerHTML = '<p class="no-events">Failed to load events. Please try again.</p>';
            console.error('Load events error:', err);
        }
    })();

    try {
        await loadEventsPromise;
    } finally {
        loadEventsPromise = null;
    }
}

loadEvents();

window.addEventListener('auth-updated', () => {
    loadEvents();
});
