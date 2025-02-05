const Stripe = require('stripe');
const pool = require('../config/db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const calculateRefundAmount = (booking, cancellationDate) => {
    const bookingStart = new Date(booking.booking_start);
    const daysUntilBooking = Math.ceil((bookingStart - cancellationDate) / (1000 * 60 * 60 * 24));
    const originalAmount = parseFloat(booking.total_price);

    if (daysUntilBooking >= 7) {
        return originalAmount; // 100% refund
    } else if (daysUntilBooking >= 3) {
        return originalAmount * 0.5; // 50% refund
    }
    return 0; // No refund
};

const createPaymentIntent = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { 
            amount, 
            currency,
            listing_id,
            startDate,
            endDate,
            startTime,
            endTime,
            priceType,
            payment_purpose,    
            booking_id,        
            original_payment_id 
        } = req.body;

        if (!amount || !currency || (!listing_id && !booking_id) || !startDate) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId: String(userId),
                listing_id: listing_id ? String(listing_id) : null,
                booking_id: booking_id ? String(booking_id) : null,
                startDate,
                endDate: endDate || startDate,
                startTime: startTime || null,
                endTime: endTime || null,
                priceType,
                amount: String(amount),
                payment_purpose: payment_purpose || 'payment',
                original_payment_id: original_payment_id ? String(original_payment_id) : null
            },
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            message: 'Payment intent created successfully',
        });
    } catch (error) {
        console.error('Error creating payment intent:', error.message);
        res.status(500).json({ message: 'Failed to create payment intent' });
    }
};

const createUpdatePaymentIntent = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { 
            bookingId,
            additionalAmount,
            startDate,
            endDate,
            startTime,
            endTime,
            priceType
        } = req.body;

        console.log('Update payment request:', { 
            bookingId, 
            additionalAmount, 
            startDate, 
            endDate, 
            startTime, 
            endTime, 
            priceType 
        });

        if (!bookingId || !additionalAmount || additionalAmount <= 0) {
            return res.status(400).json({ message: 'Invalid request parameters' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(additionalAmount * 100),
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId: String(userId),
                booking_id: String(bookingId),
                payment_purpose: 'update_additional',
                startDate: startDate || null,
                endDate: endDate || startDate || null,
                startTime: startTime || null,
                endTime: endTime || null,
                priceType: priceType || null,
                amount: String(additionalAmount)
            }
        });

        console.log('Created update payment intent with metadata:', paymentIntent.metadata);

        // Mark booking as pending update
        await pool.query(
            `UPDATE bookings 
             SET status = 'pending_update'
             WHERE id = $1 AND user_id = $2`,
            [bookingId, userId]
        );

        res.json({
            clientSecret: paymentIntent.client_secret,
            message: 'Update payment intent created successfully'
        });

    } catch (error) {
        console.error('Error creating update payment intent:', error);
        res.status(500).json({ message: error.message });
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
        console.log('FULL EVENT:', JSON.stringify(event, null, 2));
 
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            switch (event.type) {
                case 'payment_intent.succeeded':
   const paymentIntent = event.data.object;
   const metadata = paymentIntent.metadata;

   console.log('Received payment intent metadata:', metadata);

   if (!metadata) {
       throw new Error('Missing metadata in payment intent');
   }

   // Normalize metadata keys
   if (metadata.bookingId && !metadata.booking_id) {
       metadata.booking_id = metadata.bookingId;
   }

   console.log('FULL METADATA:', JSON.stringify(metadata, null, 2));
   console.log('Metadata Keys:', Object.keys(metadata));
   console.log('Payment Intent ID:', paymentIntent.id);

   if (metadata.payment_purpose === 'update_additional') {
       console.log('Processing update additional payment');
       if (!metadata.booking_id || !metadata.amount) {
           console.error('MISSING REQUIRED METADATA:', {
               booking_id: metadata.booking_id,
               amount: metadata.amount
           });
           throw new Error('Missing required metadata for update payment');
       }

       let updateQuery = '';
       let queryParams = [];

                        if (metadata.startDate) {
                            let bookingStart, bookingEnd;

                            try {
                                if (metadata.priceType === 'hour' && metadata.startTime && metadata.endTime) {
                                    bookingStart = new Date(`${metadata.startDate}T${metadata.startTime}`);
                                    bookingEnd = new Date(`${metadata.startDate}T${metadata.endTime}`);
                                } else {
                                    bookingStart = new Date(`${metadata.startDate}T00:00:00`);
                                    bookingEnd = new Date(`${metadata.endDate || metadata.startDate}T23:59:59`);
                                }

                                if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
                                    throw new Error('Invalid date/time values');
                                }

                                updateQuery = `
                                    UPDATE bookings 
                                    SET booking_start = $1,
                                        booking_end = $2,
                                        total_price = total_price + $3,
                                        status = 'active',
                                        updated_at = CURRENT_TIMESTAMP
                                    WHERE id = $4`;
                                queryParams = [bookingStart, bookingEnd, parseFloat(metadata.amount), metadata.booking_id];
                            } catch (error) {
                                console.error('Error processing dates:', error);
                                throw new Error('Failed to process booking dates');
                            }
                        } else {
                            updateQuery = `
                                UPDATE bookings 
                                SET total_price = total_price + $1,
                                    status = 'active',
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = $2`;
                            queryParams = [parseFloat(metadata.amount), metadata.booking_id];
                        }

                        await client.query(updateQuery, queryParams);

                        // Record additional payment
                        await client.query(
                            `INSERT INTO payments 
                            (user_id, booking_id, stripe_payment_id, amount, currency, status, payment_type)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                            [
                                metadata.userId,
                                metadata.booking_id,
                                paymentIntent.id,
                                parseFloat(metadata.amount),
                                paymentIntent.currency,
                                'succeeded',
                                'additional_charge'
                            ]
                        );

                        console.log('Successfully processed update payment');
                    } else {
                        // Handle initial booking payment
                        console.log('Processing initial booking payment');
                        let bookingStart, bookingEnd;
                        
                        if (metadata.priceType === 'hour') {
                            bookingStart = new Date(`${metadata.startDate}T${metadata.startTime}`);
                            bookingEnd = new Date(`${metadata.startDate}T${metadata.endTime}`);
                        } else {
                            bookingStart = new Date(`${metadata.startDate}T00:00:00`);
                            bookingEnd = new Date(`${metadata.endDate}T23:59:59`);
                        }

                        const bookingResult = await client.query(
                            `INSERT INTO bookings 
                            (user_id, listing_id, booking_start, booking_end, 
                             total_price, status, payment_status)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING id`,
                            [
                                metadata.userId,
                                metadata.listing_id,
                                bookingStart,
                                bookingEnd,
                                parseFloat(metadata.amount),
                                'active',
                                'paid'
                            ]
                        );

                        const bookingId = bookingResult.rows[0].id;

                        await client.query(
                            `INSERT INTO payments 
                            (user_id, booking_id, stripe_payment_id, amount, currency, status, payment_type)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                            [
                                metadata.userId,
                                bookingId,
                                paymentIntent.id,
                                parseFloat(metadata.amount),
                                paymentIntent.currency,
                                'succeeded',
                                'payment'
                            ]
                        );

                        console.log('Successfully processed initial booking payment');
                    }
                    break;

                case 'charge.refunded':
                    const refund = event.data.object;
                    const refundMetadata = refund.metadata;
                    console.log('Processing refund:', refundMetadata);

                    if (refundMetadata.refundType === 'cancellation') {
                        await client.query(
                            `UPDATE bookings 
                             SET status = 'cancelled',
                                 cancelled_at = CURRENT_TIMESTAMP,
                                 refund_amount = $1
                             WHERE id = $2`,
                            [parseFloat(refundMetadata.amount), refundMetadata.bookingId]
                        );
                        console.log('Successfully processed cancellation refund');
                    }
                    break;

                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }

            await client.query('COMMIT');
            console.log(`Webhook processed successfully: ${event.type}`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Transaction failed:', err);
            throw err;
        } finally {
            client.release();
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook error: ${error.message}`);
    }
};

const processBookingRefund = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { bookingId } = req.params;
        const userId = req.user.userId;

        // Check booking status and get payment info
        const bookingResult = await client.query(
            `SELECT b.*, p.stripe_payment_id, p.id as payment_id, p.currency
             FROM bookings b 
             JOIN payments p ON b.id = p.booking_id 
             WHERE b.id = $1 
             AND b.user_id = $2 
             AND p.payment_type = 'payment'`,
            [bookingId, userId]
        );

        if (bookingResult.rows.length === 0) {
            throw new Error('Booking not found or unauthorized');
        }

        const booking = bookingResult.rows[0];

        // Check if booking is already cancelled and refunded
        if (booking.status === 'cancelled' && booking.refund_amount > 0) {
            return res.status(400).json({ 
                message: 'This booking has already been cancelled and refunded' 
            });
        }

        // Check if the booking is active
        if (booking.status !== 'active') {
            return res.status(400).json({ 
                message: 'Only active bookings can be cancelled and refunded' 
            });
        }

        // Calculate refund amount
        const now = new Date();
        const refundAmount = calculateRefundAmount(booking, now);

        if (refundAmount <= 0) {
            return res.status(400).json({ message: 'No refund available for this cancellation' });
        }

        // Process refund through Stripe
        const refund = await stripe.refunds.create({
            payment_intent: booking.stripe_payment_id,
            amount: Math.round(refundAmount * 100),
            metadata: {
                userId: String(userId),
                bookingId: String(bookingId),
                refundType: 'cancellation',
                amount: String(refundAmount),
                originalPaymentId: String(booking.payment_id)
            }
        });

        // Record refund payment
        await client.query(
            `INSERT INTO payments 
            (user_id, booking_id, stripe_payment_id, amount, currency, status, payment_type, original_payment_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                userId,
                bookingId,
                refund.id,
                refundAmount,
                booking.currency,
                'succeeded',
                'refund',
                booking.payment_id
            ]
        );

        // Update booking status and refund amount in a single query
        await client.query(
            `UPDATE bookings 
             SET status = 'cancelled', 
                 cancelled_at = $1, 
                 refund_amount = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [now, refundAmount, bookingId]
        );

        await client.query('COMMIT');
        res.json({ 
            message: 'Booking cancelled and refund processed successfully', 
            refundAmount,
            refundId: refund.id
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing refund:', error);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
};
const processPartialRefund = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { bookingId, refundAmount, newStartDate, newEndDate } = req.body;
        const userId = req.user.userId;

        const paymentResult = await client.query(
            `SELECT p.* 
             FROM payments p
             JOIN bookings b ON p.booking_id = b.id
             WHERE b.id = $1 AND b.user_id = $2 AND p.payment_type = 'payment'`,
            [bookingId, userId]
        );

        if (paymentResult.rows.length === 0) {
            throw new Error('Original payment not found or unauthorized');
        }

        const originalPayment = paymentResult.rows[0];

        const refund = await stripe.refunds.create({
            payment_intent: originalPayment.stripe_payment_id,
            amount: Math.round(refundAmount * 100),
            metadata: {
                userId: String(userId),
                bookingId: String(bookingId),
                refundType: 'partial',
                amount: String(refundAmount),
                originalPaymentId: String(originalPayment.id)
            }
        });

        await client.query(
            `INSERT INTO payments 
            (user_id, booking_id, stripe_payment_id, amount, currency, status, payment_type, original_payment_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                userId,
                bookingId,
                refund.id,
                refundAmount,
                originalPayment.currency,
                'succeeded',
                'refund',
                originalPayment.id
            ]
        );

        // Update booking if new dates are provided
        if (newStartDate && newEndDate) {
            // Validate dates before updating
            const startDateObj = new Date(newStartDate);
            const endDateObj = new Date(newEndDate);
            
            if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                throw new Error('Invalid date format provided');
            }

            await client.query(
                `UPDATE bookings 
                 SET booking_start = $1,
                     booking_end = $2,
                     total_price = total_price - $3,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                [startDateObj, endDateObj, refundAmount, bookingId]
            );
        }

        await client.query('COMMIT');
        res.json({ 
            message: 'Partial refund processed successfully',
            refundId: refund.id,
            refundAmount
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing partial refund:', error);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
};

module.exports = {
    createPaymentIntent,
    handleWebhook,
    processBookingRefund,
    createUpdatePaymentIntent,
    processPartialRefund
};