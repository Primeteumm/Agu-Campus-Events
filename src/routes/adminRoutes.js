const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { listUsers, changeRole } = require('../controllers/adminController');

router.get('/users', verifyToken, listUsers);
router.put('/role', verifyToken, changeRole);

module.exports = router;
