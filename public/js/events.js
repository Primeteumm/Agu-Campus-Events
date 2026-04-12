const EVENTS_API = '/api/events';

const eventsContainer  = document.getElementById('eventsContainer');
const listViewBtn      = document.getElementById('listViewBtn');
const gridViewBtn      = document.getElementById('gridViewBtn');
const eventsTitle      = document.getElementById('eventsTitle');

// Filter elements
const filterSearch      = document.getElementById('filterSearch');
const filterSearchClear = document.getElementById('filterSearchClear');
const filterDate        = document.getElementById('filterDate');
const filterStatus      = document.getElementById('filterStatus');
const showPassedCb      = document.getElementById('showPassed');
const filterReset       = document.getElementById('filterReset');
const filterResultsInfo = document.getElementById('filterResultsInfo');
const filterResultsText = document.getElementById('filterResultsText');

// ─── Global state ───────────────────────────────────────────────────────────
let allEvents  = [];   // raw list from last API call
let joinedIds  = new Set();
let showPassed = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
        day:    '2-digit',
        month:  'short',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit'
    });
}

// ─── View toggle ─────────────────────────────────────────────────────────────
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

const savedView = localStorage.getItem('eventsView');
if (savedView === 'grid') gridViewBtn.click();

// ─── Join / Leave ─────────────────────────────────────────────────────────────
async function joinEvent(eventId, btn) {
    const token = localStorage.getItem('token');
    if (!token) { document.getElementById('openAuthModal').click(); return; }

    const isListBtn = btn.classList.contains('list-join');
    btn.disabled = true;
    if (!isListBtn) btn.textContent = 'Joining…';

    try {
        const res  = await fetch(`${EVENTS_API}/${eventId}/join`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
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

        joinedIds.add(Number(eventId));
        btn.innerHTML = '<span class="join-text-default">Joined ✓</span><span class="join-text-leave">Leave</span>';
        btn.classList.add('joined');
        btn.disabled = false;
        btn.setAttribute('onclick', `leaveEvent('${eventId}', this)`);
        bumpCapacity(btn, +1);
    } catch {
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
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (!res.ok) { btn.disabled = false; return; }

        joinedIds.delete(Number(eventId));
        btn.textContent = btn.classList.contains('list-join') ? 'Join' : 'Join Event';
        btn.classList.remove('joined');
        btn.disabled = false;
        btn.setAttribute('onclick', `joinEvent('${eventId}', this)`);
        bumpCapacity(btn, -1);
    } catch {
        btn.disabled = false;
    }
}

function bumpCapacity(btn, delta) {
    const wrapper = btn.closest('.event-list-row') || btn.closest('.event-grid-wrapper');
    if (!wrapper) return;
    const el = wrapper.querySelector('.event-list-capacity') ||
               wrapper.querySelector('.event-card-meta span:last-child');
    if (!el) return;
    const match = el.textContent.trim().match(/(\d+)\/(\d+)/);
    if (match) {
        const next = Math.max(0, parseInt(match[1]) + delta);
        el.innerHTML = `<i data-lucide="users" class="meta-icon"></i> ${next}/${match[2]}`;
        lucide.createIcons();
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

// ─── Render helpers ───────────────────────────────────────────────────────────
function renderListItem(event) {
    const isFull   = event.participant_count >= event.capacity;
    const isJoined = joinedIds.has(event.id);
    const isPassed = new Date(event.date) < new Date();

    let btnClass = 'btn-join list-join';
    let btnText  = 'Join';
    let btnDisabled = '';
    let btnOnclick  = `joinEvent('${event.id}', this)`;

    if (isJoined) {
        btnClass  += ' joined';
        btnText    = '<span class="join-text-default">Joined ✓</span><span class="join-text-leave">Leave</span>';
        btnOnclick = `leaveEvent('${event.id}', this)`;
    } else if (isFull) {
        btnClass  += ' disabled';
        btnText    = 'Full';
        btnDisabled = 'disabled';
    }

    return `
        <div class="event-list-row${isPassed ? ' event-passed' : ''}">
            <div class="event-list-info">
                <span class="event-list-title">${esc(event.title)}</span>
                ${isPassed ? '<span class="badge-passed">Passed</span>' : ''}
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
            <button class="${btnClass}"
                    onclick="${btnOnclick}"
                    ${btnDisabled}>
                ${btnText}
            </button>
        </div>
    `;
}

function renderGridCard(event) {
    const isFull   = event.participant_count >= event.capacity;
    const isJoined = joinedIds.has(event.id);
    const isPassed = new Date(event.date) < new Date();

    let btnClass = 'btn-join grid-join';
    let btnText  = 'Join Event';
    let btnDisabled = '';
    let btnOnclick  = `joinEvent('${event.id}', this)`;

    if (isJoined) {
        btnClass  += ' joined';
        btnText    = '<span class="join-text-default">Joined ✓</span><span class="join-text-leave">Leave</span>';
        btnOnclick = `leaveEvent('${event.id}', this)`;
    } else if (isFull) {
        btnClass  += ' disabled';
        btnText    = 'Full';
        btnDisabled = 'disabled';
    }

    return `
        <div class="event-grid-wrapper${isPassed ? ' event-passed' : ''}">
            <div class="event-grid-card">
                ${isPassed ? '<span class="badge-passed">Passed</span>' : ''}
                <h3 class="event-card-title">${esc(event.title)}</h3>
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

// ─── Filter logic (SCRUM-33) ─────────────────────────────────────────────────
function getFilterValues() {
    return {
        search: filterSearch.value.trim().toLowerCase(),
        date:   filterDate.value,
        status: filterStatus.value,
    };
}

function isActiveFilter(f) {
    return f.search !== '' || f.date !== 'all' || f.status !== 'all';
}

function applyFilters() {
    const f = getFilterValues();
    const now = new Date();

    let filtered = allEvents.filter(ev => {
        const evDate = new Date(ev.date);

        // Search filter
        if (f.search) {
            const haystack = `${ev.title} ${ev.organizer_name}`.toLowerCase();
            if (!haystack.includes(f.search)) return false;
        }

        // Date range filter
        if (f.date === 'today') {
            const start = new Date(now); start.setHours(0,0,0,0);
            const end   = new Date(now); end.setHours(23,59,59,999);
            if (evDate < start || evDate > end) return false;
        } else if (f.date === 'week') {
            const day   = now.getDay();
            const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0,0,0,0);
            const end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
            if (evDate < start || evDate > end) return false;
        } else if (f.date === 'month') {
            if (evDate.getMonth() !== now.getMonth() || evDate.getFullYear() !== now.getFullYear()) return false;
        }

        // Status filter
        if (f.status === 'joined'    && !joinedIds.has(ev.id))                             return false;
        if (f.status === 'available' && ev.participant_count >= ev.capacity)               return false;
        if (f.status === 'full'      && ev.participant_count <  ev.capacity)               return false;

        return true;
    });

    renderEvents(filtered);

    // Results info
    const active = isActiveFilter(f);
    if (active) {
        filterResultsText.textContent = `${filtered.length} event${filtered.length !== 1 ? 's' : ''} found`;
        filterResultsInfo.classList.remove('hidden');
        filterReset.classList.remove('hidden');
    } else {
        filterResultsInfo.classList.add('hidden');
        filterReset.classList.add('hidden');
    }

    // Title reflects state
    eventsTitle.textContent = showPassed ? 'All Events' : 'Upcoming Events';
}

function renderEvents(events) {
    if (!events || events.length === 0) {
        eventsContainer.innerHTML = '<p class="no-events">No events match your filters.</p>';
        return;
    }

    const isGrid = eventsContainer.classList.contains('grid-view');
    if (isGrid) {
        eventsContainer.innerHTML = events.map(renderGridCard).join('');
    } else {
        eventsContainer.innerHTML = `
            <div class="event-list-header">
                <span>Event</span>
                <span>Details</span>
                <span></span>
            </div>
            ${events.map(renderListItem).join('')}
        `;
    }
    lucide.createIcons();
}

// ─── Fetch joined IDs ─────────────────────────────────────────────────────────
async function fetchJoinedIds() {
    const token = localStorage.getItem('token');
    if (!token) return new Set();
    try {
        const res  = await fetch(`${EVENTS_API}/my-joins`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return new Set();
        const data = await res.json();
        return new Set(data.joinedEventIds);
    } catch {
        return new Set();
    }
}

// ─── Load events (SCRUM-32 backend param) ────────────────────────────────────
let loadEventsPromise = null;

async function loadEvents() {
    if (loadEventsPromise) return loadEventsPromise;

    loadEventsPromise = (async () => {
        try {
            eventsContainer.innerHTML = '<p class="loading-text">Loading events…</p>';

            const params = new URLSearchParams();
            if (showPassed) params.set('showPassed', 'true');

            const [eventsRes, ids] = await Promise.all([
                fetch(`${EVENTS_API}?${params}`).then(r => r.json()),
                fetchJoinedIds(),
            ]);

            joinedIds = ids;
            allEvents = eventsRes.events || [];

            if (allEvents.length === 0) {
                eventsContainer.innerHTML = '<p class="no-events">No events found. Be the first to create one!</p>';
                return;
            }

            applyFilters();
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

// ─── Filter event listeners (SCRUM-31 + SCRUM-33) ────────────────────────────
// Debounced search
let searchDebounce = null;
filterSearch.addEventListener('input', () => {
    const hasVal = filterSearch.value.length > 0;
    filterSearchClear.classList.toggle('hidden', !hasVal);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(applyFilters, 250);
});

filterSearchClear.addEventListener('click', () => {
    filterSearch.value = '';
    filterSearchClear.classList.add('hidden');
    filterSearch.focus();
    applyFilters();
});

filterDate.addEventListener('change', applyFilters);
filterStatus.addEventListener('change', applyFilters);

// SCRUM-31: Show Passed checkbox — re-fetches from backend
showPassedCb.addEventListener('change', () => {
    showPassed = showPassedCb.checked;
    loadEvents();
});

// Reset all filters
filterReset.addEventListener('click', () => {
    filterSearch.value  = '';
    filterDate.value    = 'all';
    filterStatus.value  = 'all';
    filterSearchClear.classList.add('hidden');
    applyFilters();
});

// Re-render on view toggle (view buttons already call loadEvents or we just re-render)
listViewBtn.addEventListener('click', () => { if (allEvents.length) applyFilters(); else loadEvents(); });
gridViewBtn.addEventListener('click', () => { if (allEvents.length) applyFilters(); else loadEvents(); });

// ─── Init ─────────────────────────────────────────────────────────────────────
loadEvents();
