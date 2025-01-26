const Stripe = require('stripe');
const pool = require('../config/db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = async (req, res) => {
   try {
       const userId = req.user.userId;
       const { amount, currency, bookingId } = req.body;

       if (!amount || !currency || !bookingId) {
           return res.status(400).json({ message: 'Missing required fields' });
       }

       const bookingCheck = await pool.query(
           `SELECT * FROM bookings 
            WHERE id = $1 AND user_id = $2 AND status = 'active'`,
           [bookingId, userId]
       );

       if (bookingCheck.rows.length === 0) {
           return res.status(404).json({ message: 'Booking not found or unauthorized' });
       }

       const paymentIntent = await stripe.paymentIntents.create({
           amount: Math.round(amount * 100),
           currency,
           metadata: {
               userId: String(userId),
               bookingId: String(bookingId),
           },
       });

       console.log('PaymentIntent created:', paymentIntent);
       console.log('PaymentIntent ID:', paymentIntent.id);
       console.log('PaymentIntent metadata:', paymentIntent.metadata);

       await pool.query(
           `INSERT INTO payments 
            (user_id, booking_id, stripe_payment_id, amount, currency, status)
            VALUES ($1, $2, $3, $4, $5, $6)`,
           [userId, bookingId, paymentIntent.id, amount, currency, 'pending']
       );

       res.status(200).json({
           clientSecret: paymentIntent.client_secret,
           message: 'Payment intent created successfully',
       });
   } catch (error) {
       console.error('Error creating payment intent:', error.message);
       res.status(500).json({ message: 'Failed to create payment intent' });
   }
};

const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
 
    try {
        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
 
        console.log('Received webhook event:', event.type);
 
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const { bookingId } = paymentIntent.metadata;
 
            if (!bookingId) {
                console.error('Missing bookingId in metadata');
                return res.status(400).json({ message: 'Missing bookingId in metadata' });
            }
 
            // Begin transaction
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
 
                // Get latest payment for this booking
                const payment = await client.query(
                    'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1',
                    [bookingId]
                );
 
                if (payment.rows.length === 0) {
                    throw new Error('No payment found for booking');
                }
 
                // Update payment status
                const updateResult = await client.query(
                    'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                    ['succeeded', payment.rows[0].id]
                );
                console.log('Payment update result:', updateResult.rows[0]);
 
                // Update booking payment status
                const bookingUpdateResult = await client.query(
                    `UPDATE bookings 
                     SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $1 RETURNING *`,
                    [bookingId]
                );
 
                if (bookingUpdateResult.rowCount === 0) {
                    throw new Error('No booking found to update');
                }
                console.log('Booking update result:', bookingUpdateResult.rows[0]);
 
                await client.query('COMMIT');
                console.log(`Payment and booking updated successfully for booking ID: ${bookingId}`);
 
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }
 
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook error: ${error.message}`);
    }
 };

module.exports = { createPaymentIntent, handleWebhook };