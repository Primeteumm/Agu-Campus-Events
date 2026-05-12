const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/superadminController');

const guard = [verifyToken, requireSuperAdmin];

// Users
router.get('/users',             ...guard, ctrl.listUsers);
router.get('/users/lookup',      ...guard, ctrl.lookupUser);
router.put('/users/:id/role',    ...guard, ctrl.changeUserRole);

// Clubs
router.get('/clubs',             ...guard, ctrl.listClubs);
router.post('/clubs',            ...guard, ctrl.createClub);
router.put('/clubs/:id',         ...guard, ctrl.updateClub);
router.delete('/clubs/:id',      ...guard, ctrl.deleteClub);

// Club memberships
router.get('/clubs/:id/members',              ...guard, ctrl.listClubMembers);
router.post('/clubs/:id/members',             ...guard, ctrl.addClubMember);
router.put('/clubs/:id/members/:userId',      ...guard, ctrl.updateClubMember);
router.delete('/clubs/:id/members/:userId',   ...guard, ctrl.removeClubMember);

module.exports = router;
