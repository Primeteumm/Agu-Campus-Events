/**
 * Full-page create event (Club President / Vice President only).
 */
(function () {
    const EVENTS_API = '/api/events';

    const gateAuth = document.getElementById('createEventGateAuth');
    const gateRole = document.getElementById('createEventGateRole');
    const content = document.getElementById('createEventContent');
    const form = document.getElementById('createEventForm');
    const errEl = document.getElementById('createEventError');
    const successEl = document.getElementById('createEventSuccess');

    async function applyGates() {
        gateAuth?.classList.add('hidden');
        gateRole?.classList.add('hidden');
        content?.classList.add('hidden');

        const token = localStorage.getItem('token');
        if (!token) {
            gateAuth?.classList.remove('hidden');
            return;
        }

        let user = null;
        try {
            const raw = localStorage.getItem('user');
            user = raw ? JSON.parse(raw) : null;
        } catch {
            user = null;
        }
        const role = user?.role || (user?.roles && user.roles[0]) || '';
        const canCreate = role === 'Organizer' || role === 'Club President' || role === 'Club Vice President';
        if (!canCreate) {
            gateRole?.classList.remove('hidden');
            return;
        }

        content?.classList.remove('hidden');
    }

    async function boot() {
        applyGates();
        if (typeof refreshProfileFromServer === 'function') {
            await refreshProfileFromServer({ force: false });
        }
        applyGates();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => boot());
    } else {
        boot();
    }

    window.addEventListener('user-updated', async () => {
        if (typeof refreshProfileFromServer === 'function') {
            await refreshProfileFromServer({ force: true });
        }
        applyGates();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errEl.textContent = '';
        successEl.textContent = '';

        const token = localStorage.getItem('token');
        if (!token) {
            errEl.textContent = 'You must be logged in to create an event.';
            return;
        }

        const title = document.getElementById('eventTitle').value.trim();
        const description = document.getElementById('eventDescription').value.trim();
        const dateRaw = document.getElementById('eventDate').value;
        const date = dateRaw ? new Date(dateRaw).toISOString() : '';
        const locationVal = document.getElementById('eventLocation').value.trim();
        const capacity = document.getElementById('eventCapacity').value;

        if (!title || !date || !locationVal) {
            errEl.textContent = 'Title, date, and location are required.';
            return;
        }

        const submitBtn = form.querySelector('.btn-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            const res = await fetch(EVENTS_API, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    description: description || null,
                    date,
                    location: locationVal,
                    capacity: capacity ? Number(capacity) : 50,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                errEl.textContent = data.message || 'Failed to create event.';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Event';
                return;
            }

            successEl.textContent = 'Event created! Redirecting to home…';
            submitBtn.textContent = 'Create Event';
            submitBtn.disabled = false;
            setTimeout(() => {
                window.location.href = '/';
            }, 1200);
        } catch {
            errEl.textContent = 'Connection error. Please try again.';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Event';
        }
    });
})();
