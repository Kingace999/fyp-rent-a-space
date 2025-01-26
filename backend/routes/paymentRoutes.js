const express = require('express');
const { createPaymentIntent, handleWebhook } = require('../controllers/paymentController');
const authenticateToken = require('../middleware/authenticateToken');
const router = express.Router();

// Create a payment intent
router.post('/create-payment-intent', authenticateToken, createPaymentIntent);

// Handle Stripe webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
