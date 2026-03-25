const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/db');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'Campus Event Organizer API is running! 🎉' });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    await testConnection();
});
