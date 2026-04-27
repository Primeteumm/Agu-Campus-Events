const { supabase, createSupabaseForToken, getSupabaseAdmin } = require('../supabase');
const { ROLE } = require('../constants/roles');
const { getRoleForUser } = require('../utils/userRoles');

/** Prefer service role for public aggregates (organizer names, counts) when set. */
function dbReader() {
    return getSupabaseAdmin() || supabase;
}

/** Supports `date`, `event_date`, or `starts_at` column names in `events`. */
function eventDateValue(row) {
    return row.date ?? row.event_date ?? row.starts_at ?? null;
}

function buildInsertDatePayload(bodyDate) {
    return {
        date: bodyDate,
        event_date: bodyDate,
        starts_at: bodyDate,
    };
}

async function mapEventsWithMeta(rawEvents, viewerId = null) {
    if (!rawEvents?.length) return [];

    const reader = dbReader();
    const orgIds = [...new Set(rawEvents.map((e) => e.organizer_id).filter(Boolean))];
    const evIds = rawEvents.map((e) => e.id);

    const { data: profs } = await reader.from('profiles').select('id, first_name, last_name').in('id', orgIds);

    const orgMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));

    const { data: parts } = await reader.from('event_participants').select('event_id').in('event_id', evIds);

    const countMap = {};
    for (const p of parts || []) {
        countMap[p.event_id] = (countMap[p.event_id] || 0) + 1;
    }

    // Organizer average ratings (aggregate across all their events)
    const orgAvg = {};
    if (orgIds.length) {
        const { data: orgRatings } = await reader
            .from('organizer_ratings')
            .select('organizer_id, rating')
            .in('organizer_id', orgIds);
        const acc = {};
        for (const r of orgRatings || []) {
            const a = acc[r.organizer_id] || { sum: 0, n: 0 };
            a.sum += r.rating;
            a.n += 1;
            acc[r.organizer_id] = a;
        }
        for (const [id, a] of Object.entries(acc)) {
            orgAvg[id] = { avg: a.sum / a.n, count: a.n };
        }
    }

    // Viewer's own rating per event (optional)
    const myRatingMap = {};
    if (viewerId && evIds.length) {
        const { data: mine } = await reader
            .from('organizer_ratings')
            .select('event_id, rating')
            .eq('rater_id', viewerId)
            .in('event_id', evIds);
        for (const r of mine || []) myRatingMap[r.event_id] = r.rating;
    }

    return rawEvents.map((e) => {
        const o = orgMap[e.organizer_id];
        const oname = o ? `${o.first_name || ''} ${o.last_name || ''}`.trim() : 'Unknown';
        const dv = eventDateValue(e);
        const agg = orgAvg[e.organizer_id];
        return {
            ...e,
            date: dv,
            organizer_name: oname || 'Unknown',
            participant_count: countMap[e.id] || 0,
            organizer_rating_avg: agg ? agg.avg : null,
            organizer_rating_count: agg ? agg.count : 0,
            my_rating: viewerId ? (myRatingMap[e.id] || null) : null,
        };
    });
}

// POST /api/events
const createEvent = async (req, res) => {
    try {
        const { title, description, date, location, capacity } = req.body;

        if (!title || !date || !location) {
            return res.status(400).json({ message: 'Title, date, and location are required' });
        }

        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const admin = getSupabaseAdmin();
        const myRole = await getRoleForUser(req.user.id, admin || supabase);
        const canCreate = myRole === ROLE.ORGANIZER || myRole === ROLE.CLUB_PRESIDENT || myRole === ROLE.CLUB_VICE_PRESIDENT;
        if (!canCreate) {
            return res.status(403).json({ message: 'Only Organizers, Club Presidents, and Vice Presidents can create events.' });
        }

        const sb = createSupabaseForToken(req.accessToken);

        const base = {
            title,
            description: description || null,
            location,
            capacity: Number(capacity) || 50,
            organizer_id: req.user.id,
        };

        let row = null;
        let lastError = null;

        for (const key of ['date', 'event_date', 'starts_at']) {
            const { data, error } = await sb
                .from('events')
                .insert({ ...base, [key]: date })
                .select()
                .single();
            if (!error && data) {
                row = data;
                break;
            }
            lastError = error;
        }

        if (!row) {
            console.error('Create event error:', lastError);
            return res.status(400).json({ message: lastError?.message || 'Could not create event' });
        }

        res.status(201).json({
            message: 'Event created successfully!',
            event: {
                id: row.id,
                title,
                description,
                date: eventDateValue(row),
                location,
                capacity: Number(capacity) || 50,
                organizer_id: req.user.id,
            },
        });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/events
const getAllEvents = async (req, res) => {
    try {
        const reader = dbReader();
        const includePassed = req.query.includePassed === 'true';
        const now = new Date().toISOString();
        const viewerId = req.user?.id || null;

        let query = reader.from('events').select('*');
        if (!includePassed) {
            query = query.gte('date', now);
        }
        const { data: raw, error } = await query.order('date', { ascending: true });

        if (error) {
            let query2 = reader.from('events').select('*');
            if (!includePassed) {
                query2 = query2.gte('event_date', now);
            }
            const { data: raw2, error: err2 } = await query2.order('event_date', { ascending: true });
            if (err2) {
                console.error('Get events error:', error.message, err2.message);
                return res.status(500).json({ message: 'Server error' });
            }
            const events = await mapEventsWithMeta(raw2 || [], viewerId);
            return res.json({ events });
        }

        const events = await mapEventsWithMeta(raw || [], viewerId);
        res.json({ events });
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/events/:id
const getEventById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: ev, error } = await dbReader().from('events').select('*').eq('id', id).maybeSingle();

        if (error || !ev) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const mapped = (await mapEventsWithMeta([ev], req.user?.id || null))[0];

        res.json({ event: mapped });
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/events/:id/rate  { rating: 1..5 }
const rateEventOrganizer = async (req, res) => {
    try {
        const { id } = req.params;
        const rating = Number(req.body?.rating);
        const userId = req.user?.id;

        if (!req.accessToken || !userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be an integer between 1 and 5.' });
        }

        const reader = dbReader();
        const { data: event, error: evErr } = await reader.from('events').select('*').eq('id', id).maybeSingle();
        if (evErr || !event) return res.status(404).json({ message: 'Event not found' });

        const evDate = eventDateValue(event);
        if (!evDate || new Date(evDate) > new Date()) {
            return res.status(400).json({ message: 'You can only rate events that have already ended.' });
        }
        if (event.organizer_id === userId) {
            return res.status(400).json({ message: 'You cannot rate yourself.' });
        }

        const { data: joined } = await reader
            .from('event_participants')
            .select('event_id')
            .eq('event_id', id)
            .eq('user_id', userId)
            .maybeSingle();
        if (!joined) {
            return res.status(403).json({ message: 'Only attendees can rate this event.' });
        }

        const sb = createSupabaseForToken(req.accessToken);
        const { error: upErr } = await sb
            .from('organizer_ratings')
            .upsert(
                {
                    event_id: id,
                    organizer_id: event.organizer_id,
                    rater_id: userId,
                    rating,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'event_id,rater_id' },
            );

        if (upErr) {
            console.error('Rate upsert error:', upErr);
            return res.status(400).json({ message: upErr.message || 'Could not save rating.' });
        }

        // Return refreshed organizer aggregate
        const { data: allRatings } = await reader
            .from('organizer_ratings')
            .select('rating')
            .eq('organizer_id', event.organizer_id);
        const n = allRatings?.length || 0;
        const avg = n ? allRatings.reduce((s, r) => s + r.rating, 0) / n : null;

        res.json({
            message: 'Rating saved.',
            my_rating: rating,
            organizer_rating_avg: avg,
            organizer_rating_count: n,
        });
    } catch (error) {
        console.error('Rate event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/events/:id/join
const joinEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const sb = createSupabaseForToken(req.accessToken);

        const { data: event, error: evErr } = await sb.from('events').select('*').eq('id', id).maybeSingle();

        if (evErr || !event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const { count, error: cntErr } = await sb
            .from('event_participants')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', id);

        if (cntErr) {
            console.error('Join count error:', cntErr);
            return res.status(500).json({ message: 'Server error' });
        }

        if ((count || 0) >= event.capacity) {
            return res.status(400).json({ message: 'Event is full. No more spots available.' });
        }

        const { data: existing } = await sb
            .from('event_participants')
            .select('event_id')
            .eq('event_id', id)
            .eq('user_id', userId)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ message: 'You have already joined this event' });
        }

        const { error: insErr } = await sb.from('event_participants').insert({
            user_id: userId,
            event_id: id,
        });

        if (insErr) {
            if (insErr.code === '23505') {
                return res.status(400).json({ message: 'You have already joined this event' });
            }
            console.error('Join insert error:', insErr);
            return res.status(400).json({ message: insErr.message });
        }

        res.status(201).json({ message: 'Successfully joined the event!' });
    } catch (error) {
        console.error('Join event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/events/my-joins
const getMyJoinedEvents = async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const sb = createSupabaseForToken(req.accessToken);

        const { data: rows, error } = await sb.from('event_participants').select('event_id').eq('user_id', req.user.id);

        if (error) {
            console.error('Get my joins error:', error);
            return res.status(500).json({ message: 'Server error' });
        }

        const eventIds = (rows || []).map((r) => r.event_id);
        res.json({ joinedEventIds: eventIds });
    } catch (error) {
        console.error('Get my joins error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/events/:id/join
const leaveEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const sb = createSupabaseForToken(req.accessToken);

        const { data, error } = await sb
            .from('event_participants')
            .delete()
            .eq('user_id', userId)
            .eq('event_id', id)
            .select();

        if (error) {
            console.error('Leave event error:', error);
            return res.status(500).json({ message: 'Server error' });
        }

        if (!data?.length) {
            return res.status(400).json({ message: 'You are not a participant of this event' });
        }

        res.json({ message: 'Successfully left the event' });
    } catch (error) {
        console.error('Leave event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/events/mine — events organized by the current user
const getMyOrganizedEvents = async (req, res) => {
    try {
        if (!req.accessToken || !req.user?.id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const reader = dbReader();

        let query = reader.from('events').select('*').eq('organizer_id', req.user.id);
        let { data: raw, error } = await query.order('date', { ascending: true });

        if (error) {
            const fallback = await reader
                .from('events')
                .select('*')
                .eq('organizer_id', req.user.id)
                .order('event_date', { ascending: true });
            if (fallback.error) {
                console.error('Get my organized events error:', error.message, fallback.error.message);
                return res.status(500).json({ message: 'Server error' });
            }
            raw = fallback.data;
        }

        const events = await mapEventsWithMeta(raw || [], req.user.id);
        res.json({ events });
    } catch (error) {
        console.error('Get my organized events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PUT /api/events/:id — owner-only, future events only
const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!req.accessToken || !userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const reader = dbReader();
        const { data: existing, error: fetchErr } = await reader
            .from('events')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchErr || !existing) {
            return res.status(404).json({ message: 'Event not found' });
        }
        if (existing.organizer_id !== userId) {
            return res.status(403).json({ message: 'You can only edit your own events.' });
        }

        const currentDate = eventDateValue(existing);
        if (currentDate && new Date(currentDate) < new Date()) {
            return res.status(400).json({ message: 'Past events cannot be edited.' });
        }

        const { title, description, date, location, capacity } = req.body || {};
        const patch = {};
        if (typeof title === 'string') patch.title = title;
        if (typeof description === 'string' || description === null) patch.description = description;
        if (typeof location === 'string') patch.location = location;
        if (capacity !== undefined && capacity !== null && capacity !== '') {
            const cap = Number(capacity);
            if (!Number.isFinite(cap) || cap < 1) {
                return res.status(400).json({ message: 'Capacity must be a positive number.' });
            }
            patch.capacity = cap;
        }

        if (date) {
            const newDate = new Date(date);
            if (isNaN(newDate.getTime())) {
                return res.status(400).json({ message: 'Invalid date.' });
            }
            if (newDate < new Date()) {
                return res.status(400).json({ message: 'New date cannot be in the past.' });
            }
            for (const key of ['date', 'event_date', 'starts_at']) {
                if (existing[key] !== undefined) patch[key] = newDate.toISOString();
            }
            if (!('date' in patch) && !('event_date' in patch) && !('starts_at' in patch)) {
                patch.date = newDate.toISOString();
            }
        }

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ message: 'No fields to update.' });
        }

        const sb = createSupabaseForToken(req.accessToken);
        const { data: updated, error: updErr } = await sb
            .from('events')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (updErr) {
            console.error('Update event error:', updErr);
            return res.status(400).json({ message: updErr.message || 'Could not update event.' });
        }

        const mapped = (await mapEventsWithMeta([updated], userId))[0];
        res.json({ message: 'Event updated.', event: mapped });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/events/:id — owner-only, future events only
const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!req.accessToken || !userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const reader = dbReader();
        const { data: existing, error: fetchErr } = await reader
            .from('events')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchErr || !existing) {
            return res.status(404).json({ message: 'Event not found' });
        }
        if (existing.organizer_id !== userId) {
            return res.status(403).json({ message: 'You can only delete your own events.' });
        }

        const currentDate = eventDateValue(existing);
        if (currentDate && new Date(currentDate) < new Date()) {
            return res.status(400).json({ message: 'Past events cannot be deleted.' });
        }

        const sb = createSupabaseForToken(req.accessToken);

        // Best-effort cleanup of dependent rows
        await sb.from('event_participants').delete().eq('event_id', id);
        await sb.from('organizer_ratings').delete().eq('event_id', id);

        const { error: delErr } = await sb.from('events').delete().eq('id', id);
        if (delErr) {
            console.error('Delete event error:', delErr);
            return res.status(400).json({ message: delErr.message || 'Could not delete event.' });
        }

        res.json({ message: 'Event deleted.' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createEvent,
    getAllEvents,
    getEventById,
    joinEvent,
    leaveEvent,
    getMyJoinedEvents,
    rateEventOrganizer,
    getMyOrganizedEvents,
    updateEvent,
    deleteEvent,
};
