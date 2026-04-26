/**
 * Auth routes — Supabase Auth (signup) + register/login via authController (profiles, JWT from Supabase session).
 */
const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { register, login } = require('../controllers/authController');

const handleSignUp = async (req, res) => {
    try {
        const { email, password, first_name, last_name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        if (first_name === undefined || first_name === null || String(first_name).trim() === '') {
            return res.status(400).json({ message: 'First name is required' });
        }

        const { data, error } = await supabase.auth.signUp({
            email: String(email).trim(),
            password,
            options: {
                data: {
                    first_name: String(first_name).trim(),
                    last_name: last_name != null ? String(last_name).trim() : '',
                },
            },
        });

        if (error) {
            return res.status(400).json({ message: error.message });
        }

        return res.status(201).json({
            message: 'Sign up successful',
            user: data.user,
            session: data.session,
        });
    } catch (err) {
        console.error('handleSignUp error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

router.post('/signup', handleSignUp);

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

module.exports = router;
