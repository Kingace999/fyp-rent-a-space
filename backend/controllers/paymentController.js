const Stripe = require('stripe');
const pool = require('../config/db');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { createNotification } = require('../controllers/notificationsController');

const getChargeDetails = async (paymentIntentId) => {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        // Wait for charges to be available
        let attempts = 0;
        while (attempts < 3) {
            if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0]) {
                const charge = paymentIntent.charges.data[0];
                return {
                    chargeId: charge.id,
                    amount: charge.amount / 100,
                    amountRefunded: charge.amount_refunded / 100,
                    amountRefundable: (charge.amount - charge.amount_refunded) / 100
                };
            }
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            // Retry fetching payment intent
            const updatedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (updatedPaymentIntent.charges && updatedPaymentIntent.charges.data && updatedPaymentIntent.charges.data[0]) {
                const charge = updatedPaymentIntent.charges.data[0];
                return {
                    chargeId: charge.id,
                    amount: charge.amount / 100,
                    amountRefunded: charge.amount_refunded / 100,
                    amountRefundable: (charge.amount - charge.amount_refunded) / 100
                };
            }
        }
        throw new Error('Could not find charge details after multiple attempts');
    } catch (error) {
        console.error('Error in getChargeDetails:', error);
        return null;
    }
};

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
        if (listing_id && (!Number.isInteger(Number(listing_id)) || Number(listing_id) <= 0)) {
            return res.status(400).json({ message: 'Invalid listing ID format' });
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
                    console.log('Processing payment_intent.succeeded webhook');
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

                    // Get charge details for the payment intent
                    const chargeDetails = await getChargeDetails(paymentIntent.id);
                    console.log('Charge details:', chargeDetails);

                    if (metadata.payment_purpose === 'update_additional') {
                        console.log('Processing update additional payment');
                        if (!metadata.booking_id || !metadata.amount) {
                            console.error('MISSING REQUIRED METADATA:', {
                                booking_id: metadata.booking_id,
                                amount: metadata.amount
                            });
                            throw new Error('Missing required metadata for update payment');
                        }

                        let bookingStart, bookingEnd;
                        let updateQuery, queryParams;

                        try {
                            console.log('Processing dates with metadata:', {
                                startDate: metadata.startDate,
                                endDate: metadata.endDate,
                                startTime: metadata.startTime,
                                endTime: metadata.endTime,
                                priceType: metadata.priceType
                            });

                            if (metadata.priceType === 'hour' && metadata.startTime && metadata.endTime) {
                                bookingStart = new Date(`${metadata.startDate}T${metadata.startTime}`);
                                bookingEnd = new Date(`${metadata.startDate}T${metadata.endTime}`);
                                
                                console.log('Hourly booking times:', {
                                    start: bookingStart.toISOString(),
                                    end: bookingEnd.toISOString()
                                });
                            } else {
                                bookingStart = new Date(`${metadata.startDate}T00:00:00`);
                                bookingEnd = new Date(`${metadata.endDate || metadata.startDate}T23:59:59`);
                            }

                            if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
                                console.error('Invalid date/time values:', {
                                    bookingStart,
                                    bookingEnd,
                                    metadata
                                });
                                throw new Error('Invalid date/time values');
                            }

                            updateQuery = `
                                UPDATE bookings 
                                SET booking_start = $1,
                                    booking_end = $2,
                                    total_price = total_price + $3,
                                    status = 'active',
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = $4 
                                RETURNING *`;
                            queryParams = [bookingStart, bookingEnd, parseFloat(metadata.amount), metadata.booking_id];

                            const updateResult = await client.query(updateQuery, queryParams);
                            console.log('Booking update result:', updateResult.rows[0]);

                            // Record additional payment with charge_id
                            await client.query(
                                `INSERT INTO payments 
                                (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, payment_type)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                                RETURNING *`,
                                [
                                    metadata.userId,
                                    metadata.booking_id,
                                    paymentIntent.id,
                                    paymentIntent.latest_charge,
                                    parseFloat(metadata.amount),
                                    paymentIntent.currency,
                                    'succeeded',
                                    'additional_charge'
                                ]
                            );

                            try {
                                const listingDetails = await client.query(
                                    'SELECT title FROM listings WHERE id = (SELECT listing_id FROM bookings WHERE id = $1)',
                                    [metadata.booking_id]
                                );
                        
                                await createNotification(
                                    'booking_modified',
                                    metadata.userId,
                                    `Your booking for "${listingDetails.rows[0].title}" has been updated with additional payment of $${metadata.amount}`,
                                    metadata.booking_id,
                                    'Booking Updated'
                                );
                            } catch (notificationError) {
                                console.error('Error creating update notification:', notificationError);
                            }
                            try {
                                const bookingDetails = await client.query(
                                    `SELECT l.user_id as host_id, l.title, u.name as guest_name 
                                     FROM bookings b
                                     JOIN listings l ON b.listing_id = l.id 
                                     JOIN users u ON b.user_id = u.id
                                     WHERE b.id = $1`,
                                    [metadata.booking_id]
                                );
                            
                                await createNotification(
                                    'booking_modified',
                                    bookingDetails.rows[0].host_id,
                                    `${bookingDetails.rows[0].guest_name} has modified their booking for "${bookingDetails.rows[0].title}" with additional payment of $${metadata.amount}`,
                                    metadata.booking_id,
                                    'Booking Modified'
                                );
                            } catch (notificationError) {
                                console.error('Error creating host notification:', notificationError);
                            }

                            console.log('Successfully processed update payment');

                        } catch (error) {
                            console.error('Error processing booking update:', error);
                            throw new Error('Failed to process booking update: ' + error.message);
                        }
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

                        // Insert payment record with latest_charge
                        await client.query(
                            `INSERT INTO payments 
                            (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, payment_type)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                            [
                                metadata.userId,
                                bookingId,
                                paymentIntent.id,
                                paymentIntent.latest_charge,
                                parseFloat(metadata.amount),
                                paymentIntent.currency,
                                'succeeded',
                                'payment'
                            ]
                        );

                        console.log('Successfully processed initial booking payment');

                        await createNotification(
                            'payment_success',
                            metadata.userId,
                            `Payment of $${metadata.amount} was successful for your booking`,
                            bookingId,
                            'Payment Confirmation'
                            
                        );
                        try {
                            // Get host and guest details
                            const bookingDetails = await client.query(
                                `SELECT l.user_id as host_id, l.title, u.name as guest_name 
                                 FROM bookings b
                                 JOIN listings l ON b.listing_id = l.id 
                                 JOIN users u ON b.user_id = u.id
                                 WHERE b.id = $1`,
                                [bookingId]
                            );
                        
                            // Notify host about the new booking
                            await createNotification(
                                'booking_new',
                                bookingDetails.rows[0].host_id,
                                `${bookingDetails.rows[0].guest_name} has booked "${bookingDetails.rows[0].title}" for $${metadata.amount}`,
                                bookingId,
                                'New Booking'
                            );
                        } catch (notificationError) {
                            console.error('Error creating host notification:', notificationError);
                        }
                    }
                    break;

                    case 'charge.refunded':
                        const charge = event.data.object;
                        console.log('Processing charge.refunded webhook:', {
                            chargeId: charge.id,
                            paymentIntentId: charge.payment_intent
                        });
                    
                        // Get the refund information
                        const refunds = await stripe.refunds.list({
                            payment_intent: charge.payment_intent,
                            limit: 1
                        });
                        
                        if (refunds.data.length > 0) {
                            const refund = refunds.data[0];
                            const refundMetadata = refund.metadata;
                            
                            // Check if this refund has already been processed
                            const existingRefund = await client.query(
                                `SELECT id FROM payments 
                                 WHERE stripe_payment_id = $1 
                                 AND payment_type = 'refund'`,
                                [refund.id]
                            );
                    
                            if (existingRefund.rows.length > 0) {
                                console.log('Refund already processed:', refund.id);
                                break;
                            }
                    
                            console.log('Processing refund with metadata:', refundMetadata);
                    
                            if (refund.status === 'succeeded' && refundMetadata.refundType === 'cancellation') {
                                // First get the original payment
                                const originalPayment = await client.query(
                                    `SELECT id FROM payments 
                                     WHERE stripe_payment_id = $1 
                                     AND payment_type IN ('payment', 'additional_charge')`,
                                    [charge.payment_intent]
                                );
                    
                                if (originalPayment.rows.length > 0) {
                                    // Record the refund with original_payment_id and stripe_charge_id
                                    await client.query(
                                        `INSERT INTO payments 
                                        (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, 
                                         payment_type, original_payment_id)
                                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                                        [
                                            refundMetadata.userId,
                                            refundMetadata.bookingId,
                                            refund.id,
                                            charge.id,  // Use charge.id directly
                                            parseFloat(refundMetadata.amount),
                                            'usd',
                                            'succeeded',
                                            'refund',
                                            originalPayment.rows[0].id
                                        ]
                                    );
                                }
                    
                                await client.query(
                                    `UPDATE bookings 
                                     SET status = 'cancelled',
                                         cancelled_at = CURRENT_TIMESTAMP,
                                         refund_amount = $1
                                     WHERE id = $2 AND status = 'pending_cancellation'`,
                                    [parseFloat(refundMetadata.amount), refundMetadata.bookingId]
                                );

                                await createNotification(
                                    'payment_refund',
                                    refundMetadata.userId,
                                    `Refund of $${refundMetadata.amount} has been processed for your booking`,
                                    refundMetadata.bookingId,
                                    'Refund Processed'
                                );
                                
                                console.log('Successfully processed cancellation refund');
                            }
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
        console.log('Starting refund process for booking:', req.params.bookingId);
        await client.query('BEGIN');
        
        const { bookingId } = req.params;
        const userId = req.user.userId;

        console.log('User ID:', userId, 'Booking ID:', bookingId);

        // First check if we can get the booking
        const bookingCheck = await client.query(
            `SELECT * FROM bookings WHERE id = $1 AND user_id = $2`,
            [bookingId, userId]
        );

        console.log('Initial booking check:', bookingCheck.rows);

        if (bookingCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const booking = bookingCheck.rows[0];

        // Check if booking can be cancelled
        if (booking.status === 'cancelled' || booking.status === 'pending_cancellation') {
            return res.status(409).json({ message: 'Booking is already cancelled or a cancellation is in progress' });
        }

        // Get all payments and their current refund status
        const paymentsResult = await client.query(
            `WITH RECURSIVE payment_refunds AS (
                SELECT 
                    p.id,
                    p.stripe_payment_id,
                    p.amount as original_amount,
                    p.payment_type,
                    p.created_at,
                    COALESCE((
                        SELECT SUM(r.amount)
                        FROM payments r
                        WHERE r.original_payment_id = p.id
                        AND r.payment_type = 'refund'
                        AND r.status = 'succeeded'
                    ), 0) as refunded_amount
                FROM payments p
                WHERE p.booking_id = $1
                AND p.user_id = $2
                AND p.payment_type IN ('payment', 'additional_charge')
                AND p.status = 'succeeded'
            )
            SELECT 
                id as payment_id,
                stripe_payment_id,
                original_amount,
                refunded_amount,
                (original_amount - refunded_amount) as refundable_amount,
                payment_type
            FROM payment_refunds
            WHERE (original_amount - refunded_amount) > 0
            ORDER BY created_at ASC`,
            [bookingId, userId]
        );

        console.log('Payment results:', paymentsResult.rows);

        if (paymentsResult.rows.length === 0) {
            throw new Error('No refundable payments found');
        }

        // Mark as pending cancellation
        await client.query(
            `UPDATE bookings 
             SET status = 'pending_cancellation',
             updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2`,
            [bookingId, userId]
        );

        const refundIds = [];
        let totalRefundAmount = 0;

        // Process each payment that has a remaining refundable amount
        for (const payment of paymentsResult.rows) {
            try {
                // Get charge details from Stripe
                const chargeDetails = await getChargeDetails(payment.stripe_payment_id);
                console.log('Stripe charge details:', chargeDetails);
        
                // Use database amount if Stripe details are not available
                const refundableAmount = chargeDetails ? chargeDetails.amountRefundable : parseFloat(payment.refundable_amount);
        
                console.log('Amount comparison:', {
                    dbAmount: payment.refundable_amount,
                    stripeAvailable: chargeDetails ? chargeDetails.amountRefundable : 'Not available',
                    finalRefundAmount: refundableAmount,
                    paymentType: payment.payment_type,
                    paymentId: payment.payment_id
                });
        
                if (refundableAmount <= 0) {
                    console.log(`Skipping payment ${payment.payment_id} - no refundable amount`);
                    continue;
                }
        
                // Create refund using verified amount
                const refund = await stripe.refunds.create({
                    payment_intent: payment.stripe_payment_id,
                    amount: Math.round(refundableAmount * 100),
                    metadata: {
                        userId: String(userId),
                        bookingId: String(bookingId),
                        refundType: 'cancellation',
                        amount: String(refundableAmount),
                        paymentId: String(payment.payment_id)
                    }
                });
        
                console.log('Refund created:', refund.id);
        
                // Record the refund in database with both original_payment_id and stripe_charge_id
                const refundRecord = await client.query(
                    `INSERT INTO payments 
                    (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, 
                     payment_type, original_payment_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING id`,
                    [
                        userId,
                        bookingId,
                        refund.id,
                        chargeDetails ? chargeDetails.chargeId : refund.charge,  // Use refund.charge as fallback
                        refundableAmount,
                        'usd',
                        'succeeded',
                        'refund',
                        payment.payment_id
                    ]
                );
        
                refundIds.push(refund.id);
                totalRefundAmount += refundableAmount;
        
                console.log(`Refund recorded for payment ${payment.payment_id}:`, {
                    refundId: refund.id,
                    amount: refundableAmount,
                    originalPaymentId: payment.payment_id,
                    chargeId: chargeDetails ? chargeDetails.chargeId : refund.charge
                });
        
            } catch (refundError) {
                console.error(`Error processing refund for payment ${payment.payment_id}:`, refundError);
                throw refundError;
            }
        }

        // Update booking status and refund amount
        await client.query(
            `UPDATE bookings 
             SET status = 'cancelled',
             cancelled_at = CURRENT_TIMESTAMP,
             refund_amount = COALESCE(refund_amount, 0) + $1,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [totalRefundAmount, bookingId]
        );

        try {
            const listingDetails = await client.query(
                'SELECT title FROM listings WHERE id = (SELECT listing_id FROM bookings WHERE id = $1)',
                [bookingId]
            );
        
            await createNotification(
                'payment_refund',
                userId,
                `Full refund of $${totalRefundAmount} processed for your booking of "${listingDetails.rows[0].title}"`,
                bookingId,
                'Refund Processed'
            );
        } catch (notificationError) {
            console.error('Error creating refund notification:', notificationError);
        }
        try {
            const bookingDetails = await client.query(
                `SELECT l.user_id as host_id, l.title, u.name as guest_name 
                 FROM bookings b
                 JOIN listings l ON b.listing_id = l.id 
                 JOIN users u ON b.user_id = u.id
                 WHERE b.id = $1`,
                [bookingId]
            );
        
            // Notify host about the cancellation
            await createNotification(
                'booking_cancelled',
                bookingDetails.rows[0].host_id,
                `${bookingDetails.rows[0].guest_name} has cancelled their booking for "${bookingDetails.rows[0].title}" (refund amount: $${totalRefundAmount})`,
                bookingId,
                'Booking Cancelled'
            );
        } catch (notificationError) {
            console.error('Error creating host notification:', notificationError);
        }
        

        await client.query('COMMIT');
        
        console.log('Refund process completed successfully:', {
            bookingId,
            totalRefundAmount,
            refundIds
        });

        res.json({
            message: 'Refund processed successfully',
            totalRefundAmount,
            refundIds
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Detailed refund error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            message: error.message,
            error: error.type === 'StripeInvalidRequestError' ? error.raw.message : error.message
        });
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

        // Get latest unrefunded payment
        const paymentResult = await client.query(
            `SELECT p.* 
             FROM payments p
             JOIN bookings b ON p.booking_id = b.id
             WHERE b.id = $1 
             AND b.user_id = $2 
             AND p.payment_type IN ('payment', 'additional_charge')
             AND p.created_at > COALESCE(
                 (SELECT MAX(created_at) 
                  FROM payments 
                  WHERE booking_id = $1 
                  AND payment_type = 'refund'),
                 '1970-01-01'
             )
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [bookingId, userId]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ message: 'No unrefunded payment found' });
        }

        const latestPayment = paymentResult.rows[0];

        // Get charge details from Stripe
        const chargeDetails = await getChargeDetails(latestPayment.stripe_payment_id);
        console.log('Stripe charge details:', chargeDetails);

        // Use database amount if Stripe details are not available
        const availableAmount = chargeDetails ? chargeDetails.amountRefundable : parseFloat(latestPayment.amount);

        console.log('Amount comparison:', {
            dbAmount: latestPayment.amount,
            stripeAvailable: chargeDetails ? chargeDetails.amountRefundable : 'Not available',
            finalAvailableAmount: availableAmount,
            requestedRefundAmount: refundAmount
        });

        // Verify refund amount against available amount
        if (refundAmount > availableAmount) {
            throw new Error(`Cannot refund more than available amount: ${availableAmount}`);
        }

        // Create refund using verified amount
        const refund = await stripe.refunds.create({
            payment_intent: latestPayment.stripe_payment_id,
            amount: Math.round(refundAmount * 100),
            metadata: {
                userId: String(userId),
                bookingId: String(bookingId),
                refundType: 'partial',
                amount: String(refundAmount)
            }
        });

        // Record the refund with both original_payment_id and stripe_charge_id
        await client.query(
            `INSERT INTO payments 
            (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, 
             payment_type, original_payment_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                userId,
                bookingId,
                refund.id,
                chargeDetails ? chargeDetails.chargeId : refund.charge,
                refundAmount,
                latestPayment.currency,
                'succeeded',
                'refund',
                latestPayment.id
            ]
        );

        if (newStartDate && newEndDate) {
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

        try {
            const listingDetails = await client.query(
                'SELECT title FROM listings WHERE id = (SELECT listing_id FROM bookings WHERE id = $1)',
                [bookingId]
            );
        
            await createNotification(
                'payment_refund',
                userId,
                `Partial refund of $${refundAmount} processed for your booking of "${listingDetails.rows[0].title}"`,
                bookingId,
                'Partial Refund Processed'
            );
        } catch (notificationError) {
            console.error('Error creating refund notification:', notificationError);
        }

        await client.query('COMMIT');
        
        console.log('Partial refund processed successfully:', {
            refundId: refund.id,
            amount: refundAmount,
            chargeId: chargeDetails ? chargeDetails.chargeId : refund.charge
        });

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