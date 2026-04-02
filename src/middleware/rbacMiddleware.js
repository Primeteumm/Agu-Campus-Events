const { createSupabaseForToken } = require('../supabase');
const { canAssignClubMember } = require('../utils/userRoles');

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

module.exports = { requireClubPromoter };
