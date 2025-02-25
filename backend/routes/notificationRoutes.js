const express = require('express');
const {
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification
} = require('../controllers/notificationsController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// Get all notifications for the logged-in user
router.get('/', authenticateToken, getUserNotifications);

// Get unread notifications count
router.get('/unread', authenticateToken, getUnreadCount);

// Mark a notification as read
router.put('/:id/read', authenticateToken, markAsRead);

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, markAllAsRead);

// Delete a notification
router.delete('/:id', authenticateToken, deleteNotification);

module.exports = router;