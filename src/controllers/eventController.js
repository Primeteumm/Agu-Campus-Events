const { pool } = require('../config/db');

// POST /api/events — Create a new event (auth required)
const createEvent = async (req, res) => {
    try {
        const { title, description, date, location, capacity } = req.body;

        // Validate input
        if (!title || !date || !location) {
            return res.status(400).json({ message: 'Title, date, and location are required' });
        }

        // Insert event with organizer_id from JWT token
        const [result] = await pool.query(
            'INSERT INTO events (title, description, date, location, capacity, organizer_id) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description || null, date, location, capacity || 50, req.user.id]
        );

        res.status(201).json({
            message: 'Event created successfully!',
            event: {
                id: result.insertId,
                title,
                description,
                date,
                location,
                capacity: capacity || 50,
                organizer_id: req.user.id
            }
        });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/events — Get all events (public)
const getAllEvents = async (req, res) => {
    try {
        const [events] = await pool.query(`
            SELECT e.*, u.name AS organizer_name 
            FROM events e 
            JOIN users u ON e.organizer_id = u.id 
            ORDER BY e.date ASC
        `);

        res.json({ events });
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/events/:id — Get event details (public)
const getEventById = async (req, res) => {
    try {
        const { id } = req.params;

        // Get event with organizer name
        const [events] = await pool.query(`
            SELECT e.*, u.name AS organizer_name 
            FROM events e 
            JOIN users u ON e.organizer_id = u.id 
            WHERE e.id = ?
        `, [id]);

        if (events.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Get participant count
        const [participants] = await pool.query(
            'SELECT COUNT(*) AS participant_count FROM event_participants WHERE event_id = ?',
            [id]
        );

        res.json({
            event: {
                ...events[0],
                participant_count: participants[0].participant_count
            }
        });
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/events/:id/join — Join an event (auth required)
const joinEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check if event exists
        const [events] = await pool.query('SELECT * FROM events WHERE id = ?', [id]);
        if (events.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const event = events[0];

        // Check capacity
        const [participants] = await pool.query(
            'SELECT COUNT(*) AS count FROM event_participants WHERE event_id = ?',
            [id]
        );

        if (participants[0].count >= event.capacity) {
            return res.status(400).json({ message: 'Event is full. No more spots available.' });
        }

        // Check if user already joined
        const [existing] = await pool.query(
            'SELECT id FROM event_participants WHERE user_id = ? AND event_id = ?',
            [userId, id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'You have already joined this event' });
        }

        // Join event
        await pool.query(
            'INSERT INTO event_participants (user_id, event_id) VALUES (?, ?)',
            [userId, id]
        );

        res.status(201).json({ message: 'Successfully joined the event!' });
    } catch (error) {
        console.error('Join event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createEvent, getAllEvents, getEventById, joinEvent };
