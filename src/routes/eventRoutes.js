const express = require('express');
const router = express.Router();
const { createEvent, getAllEvents, getEventById, joinEvent } = require('../controllers/eventController');
const { verifyToken } = require('../middleware/authMiddleware');

// GET /api/events — Get all events (public, no auth needed)
router.get('/', getAllEvents);

// GET /api/events/:id — Get event details (public, no auth needed)
router.get('/:id', getEventById);

// POST /api/events — Create event (auth required)
router.post('/', verifyToken, createEvent);

// POST /api/events/:id/join — Join event (auth required)
router.post('/:id/join', verifyToken, joinEvent);

module.exports = router;
