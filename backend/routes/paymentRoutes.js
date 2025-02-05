const express = require('express');
const { 
    createPaymentIntent, 
    handleWebhook, 
    processBookingRefund,
    createUpdatePaymentIntent,
    processPartialRefund
} = require('../controllers/paymentController');
const authenticateToken = require('../middleware/authenticateToken');
const router = express.Router();

// Create initial payment intent for new bookings
router.post('/create-payment-intent', authenticateToken, createPaymentIntent);

// Create payment intent for booking updates (additional charges)
router.post('/update-payment-intent', authenticateToken, createUpdatePaymentIntent);

// Process refunds for cancellations
router.post('/refund/:bookingId', authenticateToken, processBookingRefund);

// Process partial refunds for booking updates (shorter duration)
router.post('/partial-refund', authenticateToken, processPartialRefund);

// Handle Stripe webhooks
// Note: This should not use authenticateToken as it's called by Stripe
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
