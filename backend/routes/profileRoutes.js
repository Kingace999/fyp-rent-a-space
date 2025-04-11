const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const upload = require('../middleware/uploadMiddleware');
const {
    getCurrentUserProfile,
    getUserProfile,
    updateUserProfile,
    uploadProfileImage
} = require('../controllers/profileController');

// GET: Fetch current user's profile
router.get('/', authenticateToken, getCurrentUserProfile);

// GET: Fetch another user's profile (public info only)
router.get('/:userId', authenticateToken, getUserProfile);

// PUT: Update user profile
router.put('/', authenticateToken, updateUserProfile);

// POST: Upload profile image
router.post('/upload-image', authenticateToken, upload.single('image'), uploadProfileImage);

// Error handling middleware for file uploads
router.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'Unexpected field' });
    }
    next(err);
});

module.exports = router;