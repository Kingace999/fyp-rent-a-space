const express = require('express');
const {
    sendMessage,
    getConversation,
    getUserConversations,
    markMessageAsRead,
    initiateListingConversation,
    initiateBookingConversation
} = require('../controllers/messagesController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// Send a new message
router.post('/', authenticateToken, sendMessage);

// Get conversation between two users
router.get('/conversation/:receiverId', authenticateToken, getConversation);

// Get all conversations for the logged-in user
router.get('/conversations', authenticateToken, getUserConversations);

// Mark message as read
router.put('/:messageId/read', authenticateToken, markMessageAsRead);

// Start a conversation from a listing
router.post('/initiate-listing', authenticateToken, initiateListingConversation);

// Start a conversation from a booking
router.post('/initiate-booking', authenticateToken, initiateBookingConversation);

module.exports = router;