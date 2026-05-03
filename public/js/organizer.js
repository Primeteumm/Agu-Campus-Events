(function () {
    const EVENTS_API = '/api/events';

    const directoryView = document.getElementById('organizerDirectoryView');
    const directoryGrid = document.getElementById('organizerDirectoryGrid');
    const searchInput = document.getElementById('organizerSearchInput');
    const searchClear = document.getElementById('organizerSearchClear');
    const detailView = document.getElementById('organizerDetailView');
    const detailBack = document.getElementById('organizerDetailBack');
    const detailName = document.getElementById('organizerDetailName');
    const detailMeta = document.getElementById('organizerDetailMeta');
    const listContainer = document.getElementById('organizerEventsContainer');

    const editModal = document.getElementById('editEventModal');
    const editForm = document.getElementById('editEventForm');
    const editId = document.getElementById('editEventId');
    const editTitle = document.getElementById('editEventTitle');
    const editDescription = document.getElementById('editEventDescription');
    const editDate = document.getElementById('editEventDate');
    const editLocation = document.getElementById('editEventLocation');
    const editCapacity = document.getElementById('editEventCapacity');
    const editError = document.getElementById('editEventError');
    const editSuccess = document.getElementById('editEventSuccess');
    const closeEditBtn = document.getElementById('closeEditEvent');

    let allEvents = [];
    let organizers = [];
    let selectedOrganizerId = null;
    let searchQuery = '';

    function escHtml(s) {
        const d = document.createElement('div');
        d.textContent = s ?? '';
        return d.innerHTML;
    }

    function authHeaders(json = true) {
        const token = localStorage.getItem('token');
        const h = {};
        if (token) h.Authorization = `Bearer ${token}`;
        if (json) h['Content-Type'] = 'application/json';
        return h;
    }

    function getViewerId() {
        try {
            const raw = localStorage.getItem('user');
            const user = raw ? JSON.parse(raw) : null;
            return user?.id || null;
        } catch { return null; }
    }

    function isPassed(dateStr) {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    function toLocalInputValue(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function avatarUrl(name) {
        const safe = encodeURIComponent(name || 'Organizer');
        return `https://ui-avatars.com/api/?name=${safe}&background=00f2ff&color=1A1C1E&size=128&bold=true`;
    }

    function buildOrganizers(events) {
        const byId = new Map();
        for (const ev of events) {
            const id = ev.organizer_id;
            if (!id) continue;
            const cur = byId.get(id) || {
                id,
                name: ev.organizer_name || 'Unknown',
                eventCount: 0,
                upcomingCount: 0,
                ratingAvg: ev.organizer_rating_avg ?? null,
                ratingCount: ev.organizer_rating_count ?? 0,
            };
            cur.eventCount += 1;
            if (!isPassed(ev.date)) cur.upcomingCount += 1;
            if (ev.organizer_rating_avg != null) {
                cur.ratingAvg = ev.organizer_rating_avg;
                cur.ratingCount = ev.organizer_rating_count ?? cur.ratingCount;
            }
            byId.set(id, cur);
        }
        return [...byId.values()].sort((a, b) => {
            if (b.upcomingCount !== a.upcomingCount) return b.upcomingCount - a.upcomingCount;
            return b.eventCount - a.eventCount;
        });
    }

    function normalize(str) {
        return (str || '')
            .toLocaleLowerCase('tr-TR')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '');
    }

    function getFilteredOrganizers() {
        const q = normalize(searchQuery.trim());
        if (!q) return organizers;
        return organizers.filter((o) => normalize(o.name).includes(q));
    }

    function renderDirectory() {
        if (!organizers.length) {
            directoryGrid.innerHTML = '<p class="no-events">No organizers have created events yet.</p>';
            return;
        }
        const filtered = getFilteredOrganizers();
        if (!filtered.length) {
            directoryGrid.innerHTML = `<p class="no-events">No organizers match "${escHtml(searchQuery.trim())}".</p>`;
            return;
        }
        const viewerId = getViewerId();
        directoryGrid.innerHTML = filtered.map((o) => {
            const isYou = viewerId && String(viewerId) === String(o.id);
            const ratingHtml = o.ratingAvg
                ? `<span class="organizer-card-rating"><i data-lucide="star" class="meta-icon"></i> ${o.ratingAvg.toFixed(1)} <span class="organizer-card-rating-count">(${o.ratingCount})</span></span>`
                : '<span class="organizer-card-rating organizer-card-rating--empty">No ratings yet</span>';
            return `
                <button type="button" class="organizer-card" data-id="${escHtml(o.id)}">
                    <span class="organizer-card-avatar" aria-hidden="true">
                        <img src="${avatarUrl(o.name)}" alt="">
                    </span>
                    <span class="organizer-card-body">
                        <span class="organizer-card-name">
                            ${escHtml(o.name)}
                            ${isYou ? '<span class="organizer-card-you">You</span>' : ''}
                        </span>
                        <span class="organizer-card-stats">
                            <span><i data-lucide="calendar" class="meta-icon"></i> ${o.eventCount} events</span>
                            <span><i data-lucide="sparkles" class="meta-icon"></i> ${o.upcomingCount} upcoming</span>
                        </span>
                        ${ratingHtml}
                    </span>
                </button>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();

        directoryGrid.querySelectorAll('.organizer-card').forEach((btn) => {
            btn.addEventListener('click', () => openOrganizer(btn.dataset.id));
        });
    }

    function openOrganizer(organizerId) {
        const org = organizers.find((o) => String(o.id) === String(organizerId));
        if (!org) return;
        selectedOrganizerId = org.id;

        directoryView.classList.add('hidden');
        detailView.classList.remove('hidden');

        detailName.textContent = org.name;
        const ratingPart = org.ratingAvg
            ? ` • ${org.ratingAvg.toFixed(1)}★ (${org.ratingCount} votes)`
            : '';
        detailMeta.textContent = `${org.eventCount} events • ${org.upcomingCount} upcoming${ratingPart}`;

        renderEvents();
    }

    function backToDirectory() {
        selectedOrganizerId = null;
        detailView.classList.add('hidden');
        directoryView.classList.remove('hidden');
    }

    function renderEvents() {
        const events = allEvents
            .filter((e) => String(e.organizer_id) === String(selectedOrganizerId))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (!events.length) {
            listContainer.innerHTML = '<p class="no-events">This organizer has no events yet.</p>';
            return;
        }

        const viewerId = getViewerId();
        const isOwner = viewerId && String(viewerId) === String(selectedOrganizerId);

        listContainer.innerHTML = events.map((ev) => {
            const passed = isPassed(ev.date);
            const passedBadge = passed
                ? '<span class="organizer-event-badge organizer-event-badge--past">Past</span>'
                : '<span class="organizer-event-badge organizer-event-badge--upcoming">Upcoming</span>';

            let actions = '';
            if (isOwner) {
                actions = passed
                    ? '<span class="organizer-event-locked">Past events cannot be modified</span>'
                    : `
                        <button type="button" class="btn-join organizer-event-edit" data-id="${escHtml(ev.id)}">
                            <i data-lucide="pencil" class="icon" style="width:16px;height:16px;"></i> Edit
                        </button>
                        <button type="button" class="btn-join organizer-event-delete" data-id="${escHtml(ev.id)}">
                            <i data-lucide="trash-2" class="icon" style="width:16px;height:16px;"></i> Delete
                        </button>
                    `;
            }

            return `
                <article class="organizer-event-card ${passed ? 'is-past' : ''}">
                    <div class="organizer-event-head">
                        <h3 class="organizer-event-title">${escHtml(ev.title)}</h3>
                        ${passedBadge}
                    </div>
                    <p class="organizer-event-desc">${escHtml(ev.description || 'No description.')}</p>
                    <div class="organizer-event-meta">
                        <span><i data-lucide="calendar" class="meta-icon"></i> ${escHtml(formatDate(ev.date))}</span>
                        <span><i data-lucide="map-pin" class="meta-icon"></i> ${escHtml(ev.location || '—')}</span>
                        <span><i data-lucide="users" class="meta-icon"></i> ${ev.participant_count ?? 0}/${ev.capacity ?? '—'}</span>
                    </div>
                    ${actions ? `<div class="organizer-event-actions">${actions}</div>` : ''}
                </article>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (isOwner) {
            listContainer.querySelectorAll('.organizer-event-edit').forEach((btn) => {
                btn.addEventListener('click', () => openEditModal(btn.dataset.id));
            });
            listContainer.querySelectorAll('.organizer-event-delete').forEach((btn) => {
                btn.addEventListener('click', () => confirmAndDelete(btn.dataset.id, btn));
            });
        }
    }

    async function loadAll() {
        directoryGrid.innerHTML = '<p class="loading-text">Loading organizers...</p>';
        try {
            const res = await fetch(`${EVENTS_API}?includePassed=true`, { headers: authHeaders(false) });
            if (!res.ok) {
                directoryGrid.innerHTML = '<p class="no-events">Failed to load organizers.</p>';
                return;
            }
            const data = await res.json();
            allEvents = data.events || [];
            organizers = buildOrganizers(allEvents);
            renderDirectory();

            if (selectedOrganizerId) {
                const stillExists = organizers.some((o) => String(o.id) === String(selectedOrganizerId));
                if (stillExists) {
                    renderEvents();
                } else {
                    backToDirectory();
                }
            }
        } catch (err) {
            console.error('Load organizers error:', err);
            directoryGrid.innerHTML = '<p class="no-events">Connection error.</p>';
        }
    }

    function openEditModal(id) {
        const ev = allEvents.find((e) => String(e.id) === String(id));
        if (!ev) return;
        if (isPassed(ev.date)) return;

        editId.value = ev.id;
        editTitle.value = ev.title || '';
        editDescription.value = ev.description || '';
        editDate.value = toLocalInputValue(ev.date);
        editLocation.value = ev.location || '';
        editCapacity.value = ev.capacity ?? '';
        editError.textContent = '';
        editSuccess.textContent = '';

        editModal.classList.add('active');
    }

    function closeEditModal() {
        editModal.classList.remove('active');
    }

    closeEditBtn?.addEventListener('click', closeEditModal);
    editModal?.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    detailBack?.addEventListener('click', backToDirectory);

    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        searchClear?.classList.toggle('hidden', !searchQuery);
        renderDirectory();
    });

    searchClear?.addEventListener('click', () => {
        if (!searchInput) return;
        searchInput.value = '';
        searchQuery = '';
        searchClear.classList.add('hidden');
        renderDirectory();
        searchInput.focus();
    });

    editForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        editError.textContent = '';
        editSuccess.textContent = '';

        const id = editId.value;
        const dateRaw = editDate.value;
        const isoDate = dateRaw ? new Date(dateRaw).toISOString() : null;

        if (!isoDate || new Date(isoDate) < new Date()) {
            editError.textContent = 'Date must be in the future.';
            return;
        }

        const submitBtn = editForm.querySelector('.btn-submit');
        submitBtn.disabled = true;
        const originalLabel = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';

        try {
            const res = await fetch(`${EVENTS_API}/${id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({
                    title: editTitle.value.trim(),
                    description: editDescription.value.trim() || null,
                    date: isoDate,
                    location: editLocation.value.trim(),
                    capacity: editCapacity.value ? Number(editCapacity.value) : undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                editError.textContent = data.message || 'Could not update event.';
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel;
                return;
            }

            editSuccess.textContent = 'Saved.';
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
            setTimeout(() => {
                closeEditModal();
                loadAll();
            }, 600);
        } catch (err) {
            editError.textContent = 'Connection error.';
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
        }
    });

    async function confirmAndDelete(id, btn) {
        const ev = allEvents.find((e) => String(e.id) === String(id));
        if (!ev) return;
        const ok = confirm(`Delete event "${ev.title}"? This cannot be undone.`);
        if (!ok) return;

        btn.disabled = true;
        const originalHtml = btn.innerHTML;
        btn.textContent = 'Deleting...';

        try {
            const res = await fetch(`${EVENTS_API}/${id}`, {
                method: 'DELETE',
                headers: authHeaders(false),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.message || 'Could not delete event.');
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                return;
            }
            allEvents = allEvents.filter((e) => String(e.id) !== String(id));
            organizers = buildOrganizers(allEvents);
            renderEvents();
        } catch (err) {
            alert('Connection error.');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    async function boot() {
        if (typeof refreshProfileFromServer === 'function') {
            await refreshProfileFromServer({ force: false });
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        loadAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('user-updated', () => {
        renderDirectory();
        if (selectedOrganizerId) renderEvents();
    });
})();
