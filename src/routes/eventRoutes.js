/**
 * Events API — backed by Supabase tables `events` and `event_participants` (+ `profiles` for organizer names).
 */
const express = require('express');
const router = express.Router();
const { createEvent, getAllEvents, getEventById, joinEvent, leaveEvent, getMyJoinedEvents, rateEventOrganizer } = require('../controllers/eventController');
const { verifyToken, attachUserIfPresent } = require('../middleware/authMiddleware');

// GET /api/events — Get all events (public; attaches viewer if logged in so my_rating is populated)
router.get('/', attachUserIfPresent, getAllEvents);

// GET /api/events/my-joins — Get joined event IDs (auth required) — must be before /:id
router.get('/my-joins', verifyToken, getMyJoinedEvents);

// GET /api/events/:id — Get event details (public)
router.get('/:id', attachUserIfPresent, getEventById);

// PUT /api/events/:id/rate — Rate organizer for a past event (auth + attendance required)
router.put('/:id/rate', verifyToken, rateEventOrganizer);

// POST /api/events — Create event (auth required)
router.post('/', verifyToken, createEvent);

// POST /api/events/:id/join — Join event (auth required)
router.post('/:id/join', verifyToken, joinEvent);

// DELETE /api/events/:id/join — Leave event (auth required)
router.delete('/:id/join', verifyToken, leaveEvent);

module.exports = router;
