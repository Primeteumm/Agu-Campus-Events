const { supabase } = require('../supabase');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }

        req.user = { id: data.user.id, email: data.user.email };
        req.accessToken = token;
        next();
    } catch (err) {
        console.error('verifyToken:', err);
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

/** Attaches req.user / req.accessToken if a valid Bearer token is present; never rejects. */
const attachUserIfPresent = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return next();

        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) {
            req.user = { id: data.user.id, email: data.user.email };
            req.accessToken = token;
        }
    } catch (err) {
        console.error('attachUserIfPresent:', err);
    }
    next();
};

module.exports = { verifyToken, attachUserIfPresent };
