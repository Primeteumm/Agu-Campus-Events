const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireClubPromoter } = require('../middleware/rbacMiddleware');
const {
    getMe,
    updateMe,
    assignClubMemberRole,
    lookupUserByEmail,
} = require('../controllers/userController');

router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateMe);

router.get('/lookup', verifyToken, requireClubPromoter, lookupUserByEmail);
router.post('/:targetUserId/roles/club-member', verifyToken, requireClubPromoter, assignClubMemberRole);

module.exports = router;
