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

async function mapEventsWithMeta(rawEvents) {
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

    return rawEvents.map((e) => {
        const o = orgMap[e.organizer_id];
        const oname = o ? `${o.first_name || ''} ${o.last_name || ''}`.trim() : 'Unknown';
        const dv = eventDateValue(e);
        return {
            ...e,
            date: dv,
            organizer_name: oname || 'Unknown',
            participant_count: countMap[e.id] || 0,
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
// Query params: showPassed=true|false, from=ISO8601, to=ISO8601
const getAllEvents = async (req, res) => {
    try {
        const reader = dbReader();

        // Parse filter params
        const showPassed = req.query.showPassed === 'true';
        const fromDate = req.query.from || null;
        const toDate = req.query.to || null;

        // Try ordering by 'date' column first, fall back to 'event_date'
        let raw = null;
        let usedCol = 'date';

        const tryFetch = async (col) => {
            let q = reader.from('events').select('*').order(col, { ascending: true });

            if (!showPassed) {
                const now = new Date().toISOString();
                q = q.gte(col, now);
            }
            if (fromDate) q = q.gte(col, fromDate);
            if (toDate)   q = q.lte(col, toDate);

            return q;
        };

        const { data: raw1, error: err1 } = await tryFetch('date');

        if (err1) {
            const { data: raw2, error: err2 } = await tryFetch('event_date');
            if (err2) {
                console.error('Get events error:', err1.message, err2.message);
                return res.status(500).json({ message: 'Server error' });
            }
            raw = raw2;
            usedCol = 'event_date';
        } else {
            raw = raw1;
        }

        const events = await mapEventsWithMeta(raw || []);
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

        const mapped = (await mapEventsWithMeta([ev]))[0];

        res.json({ event: mapped });
    } catch (error) {
        console.error('Get event error:', error);
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

module.exports = { createEvent, getAllEvents, getEventById, joinEvent, leaveEvent, getMyJoinedEvents };
