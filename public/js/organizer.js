(function () {
    const EVENTS_API = '/api/events';

    const gateAuth = document.getElementById('organizerGateAuth');
    const gateRole = document.getElementById('organizerGateRole');
    const content = document.getElementById('organizerContent');
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

    let cachedEvents = [];

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

    function renderList() {
        if (!cachedEvents.length) {
            listContainer.innerHTML = '<p class="no-events">You have not organized any events yet.</p>';
            return;
        }

        listContainer.innerHTML = cachedEvents.map((ev) => {
            const passed = isPassed(ev.date);
            const passedBadge = passed
                ? '<span class="organizer-event-badge organizer-event-badge--past">Past</span>'
                : '<span class="organizer-event-badge organizer-event-badge--upcoming">Upcoming</span>';
            const actions = passed
                ? '<span class="organizer-event-locked">Past events cannot be modified</span>'
                : `
                    <button type="button" class="btn-join organizer-event-edit" data-id="${escHtml(ev.id)}">
                        <i data-lucide="pencil" class="icon" style="width:16px;height:16px;"></i> Edit
                    </button>
                    <button type="button" class="btn-join organizer-event-delete" data-id="${escHtml(ev.id)}">
                        <i data-lucide="trash-2" class="icon" style="width:16px;height:16px;"></i> Delete
                    </button>
                `;

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
                    <div class="organizer-event-actions">${actions}</div>
                </article>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();

        listContainer.querySelectorAll('.organizer-event-edit').forEach((btn) => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });
        listContainer.querySelectorAll('.organizer-event-delete').forEach((btn) => {
            btn.addEventListener('click', () => confirmAndDelete(btn.dataset.id, btn));
        });
    }

    async function loadMyEvents() {
        listContainer.innerHTML = '<p class="loading-text">Loading your events...</p>';
        try {
            const res = await fetch(`${EVENTS_API}/mine`, { headers: authHeaders(false) });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    listContainer.innerHTML = '<p class="no-events">Please sign in again.</p>';
                    return;
                }
                listContainer.innerHTML = '<p class="no-events">Failed to load your events.</p>';
                return;
            }
            const data = await res.json();
            cachedEvents = data.events || [];
            renderList();
        } catch (err) {
            console.error('Load my events error:', err);
            listContainer.innerHTML = '<p class="no-events">Connection error.</p>';
        }
    }

    function openEditModal(id) {
        const ev = cachedEvents.find((e) => String(e.id) === String(id));
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
                loadMyEvents();
            }, 600);
        } catch (err) {
            editError.textContent = 'Connection error.';
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
        }
    });

    async function confirmAndDelete(id, btn) {
        const ev = cachedEvents.find((e) => String(e.id) === String(id));
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
            cachedEvents = cachedEvents.filter((e) => String(e.id) !== String(id));
            renderList();
        } catch (err) {
            alert('Connection error.');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    function applyGates() {
        gateAuth?.classList.add('hidden');
        gateRole?.classList.add('hidden');
        content?.classList.add('hidden');

        const token = localStorage.getItem('token');
        if (!token) {
            gateAuth?.classList.remove('hidden');
            return false;
        }

        let user = null;
        try {
            const raw = localStorage.getItem('user');
            user = raw ? JSON.parse(raw) : null;
        } catch { user = null; }
        const role = user?.role || (user?.roles && user.roles[0]) || '';
        const isOrganizer = role === 'Organizer' || role === 'Club President' || role === 'Club Vice President';
        if (!isOrganizer) {
            gateRole?.classList.remove('hidden');
            return false;
        }

        content?.classList.remove('hidden');
        return true;
    }

    async function boot() {
        const ok = applyGates();
        if (typeof refreshProfileFromServer === 'function') {
            await refreshProfileFromServer({ force: false });
        }
        const okAfter = applyGates();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (okAfter) loadMyEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('user-updated', async () => {
        if (typeof refreshProfileFromServer === 'function') {
            await refreshProfileFromServer({ force: true });
        }
        const ok = applyGates();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (ok) loadMyEvents();
    });
})();
