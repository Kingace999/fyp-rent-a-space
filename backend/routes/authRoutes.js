const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const {
    signup,
    login,
    refresh,
    logout,
    getUserProfile
} = require('../controllers/authController');

// Auth routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/user/profile', authenticateToken, getUserProfile);

module.exports = router;