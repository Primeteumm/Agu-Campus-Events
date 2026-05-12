const { createSupabaseForToken, getSupabaseAdmin } = require('../supabase');
const { canAssignClubMember, getRoleForUser } = require('../utils/userRoles');
const { ROLE } = require('../constants/roles');

/**
 * Requires authenticated user to be Club President or Club Vice President.
 * Must run after verifyToken.
 */
const requireClubPromoter = async (req, res, next) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const client = createSupabaseForToken(req.accessToken);
        const ok = await canAssignClubMember(req.user.id, client);
        if (!ok) {
            return res.status(403).json({
                message: 'Only Club President or Club Vice President can perform this action.',
            });
        }
        next();
    } catch (e) {
        console.error('requireClubPromoter:', e);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Requires authenticated user to have the Super Admin role.
 * Must run after verifyToken.
 */
const requireSuperAdmin = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const admin = getSupabaseAdmin();
        if (!admin) {
            return res.status(500).json({ message: 'Server configuration error.' });
        }
        const role = await getRoleForUser(req.user.id, admin);
        if (role !== ROLE.SUPER_ADMIN) {
            return res.status(403).json({ message: 'Access denied. Super Admin only.' });
        }
        next();
    } catch (e) {
        console.error('requireSuperAdmin:', e);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { requireClubPromoter, requireSuperAdmin };
