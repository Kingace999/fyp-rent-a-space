const express = require('express');
const {
    createBooking,
    getUserBookings,
    getListingBookings,
    deleteBooking,
    updateBooking,
    getBooking
} = require('../controllers/bookingsController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// Create a new booking
router.post('/', authenticateToken, createBooking);

// Get all bookings for the logged-in user
router.get('/user', authenticateToken, getUserBookings);

// Get a specific booking by ID
router.get('/:id', authenticateToken, getBooking);

// Get all bookings for a specific listing
router.get('/listing/:listing_id', authenticateToken, getListingBookings);

// Cancel/delete a booking
router.delete('/:id', authenticateToken, deleteBooking);

// Update an existing booking
router.put('/:id', authenticateToken, updateBooking); 

module.exports = router;