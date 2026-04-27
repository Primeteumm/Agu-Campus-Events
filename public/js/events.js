const EVENTS_API = '/api/events';

const eventsContainer = document.getElementById('eventsContainer');
const listViewBtn = document.getElementById('listViewBtn');
const gridViewBtn = document.getElementById('gridViewBtn');
const showPassedCheckbox = document.getElementById('showPassedCheckbox');
const eventTitleFilter = document.getElementById('eventTitleFilter');
const eventDateFilter = document.getElementById('eventDateFilter');
const eventLocationFilter = document.getElementById('eventLocationFilter');

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
let loadEventsPromise = null;
let activeRequestId = 0;
let filterDebounceTimer = null;

// Restore checkbox state from localStorage
showPassedCheckbox.checked = localStorage.getItem('showPassedEvents') === 'true';

showPassedCheckbox.addEventListener('change', () => {
    localStorage.setItem('showPassedEvents', showPassedCheckbox.checked);
    loadEvents();
});

function scheduleLoadEvents() {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
        loadEvents();
    }, 250);
}

if (eventTitleFilter) {
    eventTitleFilter.addEventListener('input', () => {
        if (typeof renderCurrentView === 'function') renderCurrentView();
    });
}

if (eventLocationFilter) {
    eventLocationFilter.addEventListener('change', () => {
        if (typeof renderCurrentView === 'function') renderCurrentView();
    });
}

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

// --- Organizer rating helpers ---------------------------------------------
// Round UP to 1 decimal (e.g. 4.11 -> 4.2).
function ratingCeil1(v) {
    if (v == null || isNaN(v)) return null;
    return Math.ceil(v * 10) / 10;
}

// Color tier by rating value (0..5).
function ratingTierClass(v) {
    if (v == null) return 'rating-none';
    if (v >= 4.0) return 'rating-green';
    if (v >= 3.0) return 'rating-yellow';
    if (v >= 2.0) return 'rating-orange';
    return 'rating-red';
}

function organizerRatingPill(avg, count) {
    if (avg == null || !count) {
        return `<span class="organizer-rating rating-none" title="No ratings yet">
            <i data-lucide="star" class="rating-icon"></i>
            <span class="rating-value">—</span>
        </span>`;
    }
    const rounded = ratingCeil1(avg);
    const tier = ratingTierClass(rounded);
    return `<span class="organizer-rating ${tier}" title="${count} rating${count === 1 ? '' : 's'}">
        <i data-lucide="star" class="rating-icon"></i>
        <span class="rating-value">${rounded.toFixed(1)}</span>
    </span>`;
}

// 5-star interactive widget (clickable). Disabled if user cannot rate.
function starWidget(event, opts) {
    const current = event.my_rating || 0;
    const disabled = !!opts?.disabled;
    const reason = opts?.reason || '';
    const wrapperClass = `star-rate${disabled ? ' disabled' : ''}`;
    const stars = [1, 2, 3, 4, 5]
        .map((n) => {
            const filled = n <= current ? ' filled' : '';
            const clickAttr = disabled
                ? ''
                : `onclick="event.stopPropagation(); rateOrganizer('${event.id}', ${n}, this)"`;
            return `<button type="button" class="star-btn${filled}" data-value="${n}" ${clickAttr} ${disabled ? 'disabled' : ''} aria-label="${n} star${n === 1 ? '' : 's'}">
                <i data-lucide="star" class="star-icon"></i>
            </button>`;
        })
        .join('');
    const hint = disabled
        ? `<span class="star-hint">${esc(reason)}</span>`
        : current
            ? `<span class="star-hint">Your rating: ${current}/5</span>`
            : `<span class="star-hint">Rate the organizer</span>`;
    return `<div class="${wrapperClass}" onclick="event.stopPropagation()">
        <div class="star-row">
            ${stars}
            <span class="star-spinner" aria-hidden="true"></span>
        </div>
        ${hint}
    </div>`;
}

function canUserRate(event, joinedIds) {
    const token = localStorage.getItem('token');
    if (!token) return { ok: false, reason: 'Sign in to rate' };
    if (!isPassed(event.date)) return { ok: false, reason: '' };
    if (!joinedIds || !joinedIds.has(String(event.id))) return { ok: false, reason: 'Only attendees can rate' };

    let myId = null;
    try {
        const raw = localStorage.getItem('user');
        const u = raw ? JSON.parse(raw) : null;
        myId = u?.id || null;
    } catch { /* ignore */ }
    if (myId && event.organizer_id === myId) return { ok: false, reason: "You can't rate yourself" };

    return { ok: true };
}

async function rateOrganizer(eventId, value, btn) {
    const token = localStorage.getItem('token');
    if (!token) { document.getElementById('openAuthModal')?.click(); return; }

    const widget = btn.closest('.star-rate');
    if (!widget || widget.classList.contains('disabled')) return;
    widget.classList.add('pending');

    try {
        const res = await fetch(`${EVENTS_API}/${eventId}/rate`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rating: value }),
        });
        const data = await res.json();
        if (!res.ok) {
            widget.classList.remove('pending');
            const hint = widget.querySelector('.star-hint');
            if (hint) hint.textContent = data.message || 'Failed to save rating';
            return;
        }

        // Update cache: my_rating + organizer avg across all their events.
        if (cachedEventsData?.events) {
            const target = cachedEventsData.events.find((e) => String(e.id) === String(eventId));
            const orgId = target?.organizer_id;
            for (const e of cachedEventsData.events) {
                if (String(e.id) === String(eventId)) e.my_rating = value;
                if (orgId && e.organizer_id === orgId) {
                    e.organizer_rating_avg = data.organizer_rating_avg;
                    e.organizer_rating_count = data.organizer_rating_count;
                }
            }
        }
        renderCurrentView();
    } catch (err) {
        console.error('rate error:', err);
        widget.classList.remove('pending');
    }
}

window.rateOrganizer = rateOrganizer;

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

    if (btn.disabled) return;

    const isListBtn = btn.classList.contains('list-join');
    btn.disabled = true;
    btn.classList.add('btn-loading');

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
    } finally {
        btn.classList.remove('btn-loading');
    }
}

async function leaveEvent(eventId, btn) {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (btn.disabled) return;

    btn.disabled = true;
    btn.classList.add('btn-loading');

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
    } finally {
        btn.classList.remove('btn-loading');
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

window.toggleEventListAccordion = function (row, ev) {
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
                        ${organizerRatingPill(event.organizer_rating_avg, event.organizer_rating_count)}
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
                    ${passed ? `
                        <p class="event-list-desc-title" style="margin-top:16px;">Rate the organizer</p>
                        ${starWidget(event, canUserRate(event, joinedIds).ok ? {} : { disabled: true, reason: canUserRate(event, joinedIds).reason })}
                    ` : ''}
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
                    <span><i data-lucide="user" class="meta-icon"></i> ${esc(event.organizer_name)} ${organizerRatingPill(event.organizer_rating_avg, event.organizer_rating_count)}</span>
                    <span class="${isFull ? 'full' : ''}"><i data-lucide="users" class="meta-icon"></i> ${event.participant_count}/${event.capacity}</span>
                </div>
                ${passed ? `
                    <div class="event-card-rate">
                        <p class="event-card-rate-title">Rate the organizer</p>
                        ${starWidget(event, canUserRate(event, joinedIds).ok ? {} : { disabled: true, reason: canUserRate(event, joinedIds).reason })}
                    </div>
                ` : ''}
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

    const titleQuery = (eventTitleFilter?.value || '').trim().toLocaleLowerCase('tr');
    const locationQuery = eventLocationFilter?.value || '';

    const filtered = cachedEventsData.events.filter((e) => {
        const titleMatch = !titleQuery ||
            (e.title && e.title.toLocaleLowerCase('tr').includes(titleQuery));
        const locationMatch = !locationQuery || e.location === locationQuery;
        return titleMatch && locationMatch;
    });

    if (filtered.length === 0) {
        const hasFilter = titleQuery || locationQuery;
        eventsContainer.innerHTML = hasFilter
            ? '<p class="no-events">The event you are looking for could not be found.</p>'
            : '<p class="no-events">No events found.</p>';
        return;
    }

    const isGrid = localStorage.getItem('eventsView') === 'grid';

    if (isGrid) {
        eventsContainer.classList.remove('list-view');
        eventsContainer.classList.add('grid-view');
        eventsContainer.innerHTML = filtered.map((e) => renderGridCard(e, cachedJoinedIdsData)).join('');
    } else {
        eventsContainer.classList.remove('grid-view');
        eventsContainer.classList.add('list-view');
        eventsContainer.innerHTML = `
        <div class="event-list-header">
            <span>Event</span>
            <span>Details</span>
            <span></span>
        </div>
        ${filtered.map((e) => renderListItem(e, cachedJoinedIdsData)).join('')}
        `;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateLocationFilterOptions(events) {
    if (!eventLocationFilter) return;

    const previousValue = eventLocationFilter.value;
    const uniqueLocations = [...new Set(
        (events || [])
            .map((event) => (event.location || '').trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'tr'));

    const options = ['<option value="">All locations</option>'];
    for (const location of uniqueLocations) {
        const selectedAttr = location === previousValue ? ' selected' : '';
        options.push(`<option value="${esc(location)}"${selectedAttr}>${esc(location)}</option>`);
    }

    if (previousValue && !uniqueLocations.includes(previousValue)) {
        options.push(`<option value="${esc(previousValue)}" selected>${esc(previousValue)}</option>`);
    }

    eventLocationFilter.innerHTML = options.join('');
}

async function loadEvents() {
    if (loadEventsPromise) {
        return loadEventsPromise;
    }

    const requestId = ++activeRequestId;
    loadEventsPromise = (async () => {
        try {
            const includePassed = showPassedCheckbox.checked;
            const titleFilter = eventTitleFilter?.value?.trim() || '';
            const dateFilter = eventDateFilter?.value || '';
            const locationFilter = eventLocationFilter?.value || '';
            const token = localStorage.getItem('token');
            const eventsHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
            const queryParams = new URLSearchParams({
                includePassed: String(includePassed),
            });

            if (titleFilter) {
                queryParams.set('title', titleFilter);
                queryParams.set('search', titleFilter);
            }
            if (dateFilter) {
                queryParams.set('fromDate', dateFilter);
                queryParams.set('dateFrom', dateFilter);
            }
            if (locationFilter) {
                queryParams.set('location', locationFilter);
            }

            eventsContainer.classList.add('events-container-updating');
            const [eventsRes, joinedIds] = await Promise.all([
                fetch(`${EVENTS_API}?${queryParams.toString()}`, { headers: eventsHeaders }).then((r) => r.json()),
                fetchJoinedIds(),
            ]);

            if (requestId !== activeRequestId) return;
            cachedEventsData = eventsRes;
            cachedJoinedIdsData = joinedIds;
            updateLocationFilterOptions(eventsRes?.events || []);

            renderCurrentView();
        } catch (err) {
            eventsContainer.innerHTML = '<p class="no-events">Failed to load events. Please try again.</p>';
            console.error('Load events error:', err);
        } finally {
            eventsContainer.classList.remove('events-container-updating');
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
