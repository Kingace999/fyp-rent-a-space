const pool = require('../config/db');
const { createNotification } = require('../controllers/notificationsController');


const createBooking = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { 
            listing_id,
            startDate, 
            endDate, 
            startTime, 
            endTime, 
            total,
            priceType
        } = req.body;

        // Validate required fields
        if (!listing_id || !startDate || !total || !priceType) {
            return res.status(400).json({
                message: 'Missing required fields'
            });
        }

        let bookingStart, bookingEnd;
        
        if (priceType === 'hour') {
            if (!startTime || !endTime) {
                return res.status(400).json({
                    message: 'Start time and end time are required for hourly bookings'
                });
            }

            // Parse the date string
            const baseDate = new Date(startDate);
            if (isNaN(baseDate.getTime())) {
                return res.status(400).json({
                    message: 'Invalid date format'
                });
            }

            // Parse start time
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            bookingStart = new Date(baseDate);
            bookingStart.setHours(startHours, startMinutes, 0, 0);

            // Parse end time
            const [endHours, endMinutes] = endTime.split(':').map(Number);
            bookingEnd = new Date(baseDate);
            bookingEnd.setHours(endHours, endMinutes, 0, 0);

        } else {
            // For daily bookings
            if (!endDate) {
                return res.status(400).json({
                    message: 'End date is required for daily bookings'
                });
            }

            bookingStart = new Date(startDate);
            bookingStart.setHours(0, 0, 0, 0);
            
            bookingEnd = new Date(endDate);
            bookingEnd.setHours(23, 59, 59, 999);
        }

        // Validate the dates
        if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
            return res.status(400).json({
                message: 'Invalid date/time format'
            });
        }

        // Check if end time is after start time
        if (bookingEnd <= bookingStart) {
            return res.status(400).json({
                message: 'End time must be after start time'
            });
        }

        // Check for existing bookings in the same time period
        
        const conflictCheck = await pool.query(
            `SELECT id FROM bookings 
             WHERE listing_id = $1 
             AND booking_start < $3 
             AND booking_end > $2`,
            [listing_id, bookingStart, bookingEnd]
        );

        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({
                message: 'This time period is already booked'
            });
        }

        // Begin transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const listingDetails = await client.query(
                'SELECT title, user_id FROM listings WHERE id = $1',
                [listing_id]
            );

            // Insert booking
            const result = await client.query(
                `INSERT INTO bookings 
                 (user_id, listing_id, booking_start, booking_end, total_price)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [userId, listing_id, bookingStart, bookingEnd, total]
            );
            await createNotification(
                'booking_new',
                listingDetails.rows[0].user_id,  // Send to host
                `New booking request for "${listingDetails.rows[0].title}" on ${new Date(bookingStart).toLocaleDateString()}`,
                result.rows[0].id
            );

            // Schedule upcoming booking notification for the user
            const bookingStart24HoursAway = new Date(bookingStart.getTime() - (24 * 60 * 60 * 1000));
            if (bookingStart24HoursAway > new Date()) {
                setTimeout(async () => {
                    await createNotification(
                        'booking_upcoming',
                        userId,
                        `Reminder: Your booking for "${listingDetails.rows[0].title}" is tomorrow`,
                        result.rows[0].id
                    );
                }, bookingStart24HoursAway.getTime() - Date.now());
            }
            const oneWeekAway = new Date(bookingStart.getTime() - (7 * 24 * 60 * 60 * 1000));
if (oneWeekAway > new Date()) {
    setTimeout(async () => {
        await createNotification(
            'booking_upcoming',
            userId,
            `Your booking for "${listingDetails.rows[0].title}" starts in one week (${new Date(bookingStart).toLocaleDateString()})`,
            result.rows[0].id,
            'Upcoming Booking'
        );
    }, oneWeekAway.getTime() - Date.now());
}

            try {
                const userDetails = await client.query(
                    `SELECT u.name FROM users u WHERE u.id = $1`,
                    [userId]
                );
            
                await createNotification(
                    'booking_new',
                    listingDetails.rows[0].user_id,  // Send to host
                    `${userDetails.rows[0].name} has made a new booking for "${listingDetails.rows[0].title}"`,
                    result.rows[0].id,
                    'New Booking'
                );
            } catch (notificationError) {
                console.error('Error creating host notification:', notificationError);
            }

            await client.query('COMMIT');
            res.status(201).json({ 
                message: 'Booking created successfully',
                booking: result.rows[0] 
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
};

const getUserBookings = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId;
        


        // Update completed bookings
        await client.query(
            `UPDATE bookings 
             SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = $1 
             AND status = 'active' 
             AND booking_end < CURRENT_TIMESTAMP`,
            [userId]
        );

        // Modified query with better handling of listing data
        const result = await client.query(
            `WITH user_bookings AS (
                SELECT b.*, 
                    COALESCE(
                        (SELECT SUM(CASE 
                            WHEN payment_type IN ('payment', 'additional_charge') THEN amount 
                            WHEN payment_type = 'refund' THEN -amount 
                        END) FROM payments WHERE booking_id = b.id), 
                        0
                    ) as net_paid
                FROM bookings b
                WHERE b.user_id = $1
            )
            SELECT 
                ub.*,
                l.title,
                l.location,
                l.images
            FROM user_bookings ub
            LEFT JOIN listings l ON ub.listing_id = l.id
            ORDER BY ub.created_at DESC`,
            [userId]
        );




        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

const getListingBookings = async (req, res) => {
    try {
        const { listing_id } = req.params;
        const result = await pool.query(
            `SELECT b.id, b.user_id, b.booking_start, b.booking_end, u.name
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             WHERE b.listing_id = $1
             AND b.status = 'active'
             AND b.booking_end > NOW()
             ORDER BY b.booking_start`,
            [listing_id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching listing bookings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteBooking = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const bookingId = req.params.id;
        const userId = req.user.userId;

        // Check if booking exists and get its current status
        const bookingResult = await client.query(
            'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
            [bookingId, userId]
        );

        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ 
                message: 'Booking not found or unauthorized' 
            });
        }

        const booking = bookingResult.rows[0];
        
        // Check if booking is already cancelled
        if (booking.status === 'cancelled') {
            return res.status(400).json({ 
                message: 'Booking is already cancelled' 
            });
        }

        // Update the booking status to cancelled
        await client.query(
            `UPDATE bookings 
             SET status = $1, 
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND user_id = $3`,
            ['cancelled', bookingId, userId]
        );

        await createNotification(
            'booking_cancelled',
            booking.user_id,
            `Your booking for ${booking.title} has been cancelled`,
            bookingId
        );

        try {
            const bookingDetails = await client.query(
                `SELECT l.user_id as host_id, l.title, u.name as guest_name 
                 FROM bookings b
                 JOIN listings l ON b.listing_id = l.id 
                 JOIN users u ON b.user_id = u.id
                 WHERE b.id = $1`,
                [bookingId]
            );
        
            await createNotification(
                'booking_cancelled',
                bookingDetails.rows[0].host_id,
                `${bookingDetails.rows[0].guest_name} has cancelled their booking for "${bookingDetails.rows[0].title}"`,
                bookingId,
                'Booking Cancelled'
            );
        } catch (notificationError) {
            console.error('Error creating host notification:', notificationError);
        }

        await client.query('COMMIT');
        res.status(200).json({ 
            message: 'Booking cancelled successfully',
            bookingId: bookingId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error cancelling booking:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};
const updateBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.user.userId;
        const { booking_start, booking_end } = req.body;

        // Validate required fields
        if (!booking_start || !booking_end) {
            return res.status(400).json({
                message: 'Both start and end times are required'
            });
        }

        // Convert strings to Date objects and handle timezone
        const bookingStart = new Date(booking_start);
        const bookingEnd = new Date(booking_end);

        // Set timezone to UTC explicitly
        const utcBookingStart = new Date(Date.UTC(
            bookingStart.getUTCFullYear(),
            bookingStart.getUTCMonth(),
            bookingStart.getUTCDate(),
            bookingStart.getUTCHours(),
            bookingStart.getUTCMinutes(),
            0,
            0
        ));

        const utcBookingEnd = new Date(Date.UTC(
            bookingEnd.getUTCFullYear(),
            bookingEnd.getUTCMonth(),
            bookingEnd.getUTCDate(),
            bookingEnd.getUTCHours(),
            bookingEnd.getUTCMinutes(),
            0,
            0
        ));

        // Validate the dates
        if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
            return res.status(400).json({
                message: 'Invalid date/time format'
            });
        }

        // Check if end time is after start time
        if (bookingEnd <= bookingStart) {
            return res.status(400).json({
                message: 'End time must be after start time'
            });
        }

        // Begin transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if booking exists and belongs to user, and get listing details including available times
            const existingBooking = await client.query(
                `SELECT b.*, 
                        l.price_type, 
                        l.price, 
                        l.available_start_time, 
                        l.available_end_time,
                        l.start_date,
                        l.end_date
                FROM bookings b 
                JOIN listings l ON b.listing_id = l.id 
                WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'active'`,
                [bookingId, userId]
            );

            if (existingBooking.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    message: 'Booking not found, unauthorized, or not active' 
                });
            }

            const listing = existingBooking.rows[0];

            // Validate against listing's available dates
            const listingStartDate = new Date(listing.start_date);
            const listingEndDate = new Date(listing.end_date);
            
            if (utcBookingStart < listingStartDate || utcBookingEnd > listingEndDate) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: 'Booking dates are outside of listing\'s available date range'
                });
            }

            // For hourly bookings, validate against available hours
            if (listing.price_type === 'hour') {
                const [availStartHour, availStartMin] = listing.available_start_time.split(':').map(Number);
                const [availEndHour, availEndMin] = listing.available_end_time.split(':').map(Number);
                
                const bookingStartHour = utcBookingStart.getUTCHours();
                const bookingStartMin = utcBookingStart.getUTCMinutes();
                const bookingEndHour = utcBookingEnd.getUTCHours();
                const bookingEndMin = utcBookingEnd.getUTCMinutes();

                const availStartMinutes = availStartHour * 60 + availStartMin;
                const availEndMinutes = availEndHour * 60 + availEndMin;
                const bookingStartMinutes = bookingStartHour * 60 + bookingStartMin;
                const bookingEndMinutes = bookingEndHour * 60 + bookingEndMin;

                if (bookingStartMinutes < availStartMinutes || bookingEndMinutes > availEndMinutes) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `Booking times must be between ${listing.available_start_time} and ${listing.available_end_time}`
                    });
                }
            }

            // Check for conflicting bookings (excluding the current booking)
            const conflictCheck = await client.query(
                `SELECT id FROM bookings 
                 WHERE listing_id = $1 
                 AND id != $2
                 AND status = 'active'
                 AND booking_start < $4 
                 AND booking_end > $3`,
                [listing.listing_id, bookingId, bookingStart, bookingEnd]
            );

            if (conflictCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    message: 'This time period is already booked'
                });
            }

            // Calculate new total price based on duration and price type
            let totalPrice;
            if (listing.price_type === 'hour') {
                const hours = Math.ceil((bookingEnd - bookingStart) / (1000 * 60 * 60));
                totalPrice = hours * listing.price;
            } else {
                const days = Math.ceil((bookingEnd - bookingStart) / (1000 * 60 * 60 * 24));
                totalPrice = days * listing.price;
            }

            // Update the booking
            const result = await client.query(
                `UPDATE bookings 
                 SET booking_start = $1 AT TIME ZONE 'UTC', 
                     booking_end = $2 AT TIME ZONE 'UTC', 
                     total_price = $3,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4 AND user_id = $5 AND status = 'active'
                 RETURNING *`,
                [utcBookingStart, utcBookingEnd, totalPrice, bookingId, userId]
            );

            await createNotification(
                'booking_modified',
                userId,
                `Your booking for ${listing.title} has been updated to ${new Date(utcBookingStart).toLocaleDateString()}`,
                bookingId
            );

            try {
                const guestDetails = await client.query(
                    `SELECT u.name as guest_name 
                     FROM users u 
                     WHERE u.id = $1`,
                    [userId]
                );
            
                await createNotification(
                    'booking_modified',
                    listing.user_id,  // host's ID
                    `${guestDetails.rows[0].guest_name} has modified their booking for "${listing.title}"`,
                    bookingId,
                    'Booking Modified'
                );
            } catch (notificationError) {
                console.error('Error creating host notification:', notificationError);
            }

            await client.query('COMMIT');
            res.status(200).json({
                message: 'Booking updated successfully',
                booking: result.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
};

const getBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT b.*, 
                (SELECT SUM(CASE 
                    WHEN payment_type IN ('payment', 'additional_charge') THEN amount 
                    WHEN payment_type = 'refund' THEN -amount 
                END) FROM payments WHERE booking_id = b.id) as net_paid
             FROM bookings b
             WHERE b.id = $1 AND b.user_id = $2`,
            [bookingId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
module.exports = {
    createBooking,
    getUserBookings,
    getListingBookings,
    deleteBooking,
    updateBooking,
    getBooking
};