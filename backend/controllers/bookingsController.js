const pool = require('../config/db');

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

            // Insert booking
            const result = await client.query(
                `INSERT INTO bookings 
                 (user_id, listing_id, booking_start, booking_end, total_price)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [userId, listing_id, bookingStart, bookingEnd, total]
            );

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
        
        // First, update any bookings that should be completed
        await client.query(
            `UPDATE bookings 
             SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = $1 
             AND status = 'active' 
             AND booking_end < CURRENT_TIMESTAMP`,
            [userId]
        );

        // Then fetch all bookings with their listing details
        const result = await client.query(
            `SELECT b.*, l.title, l.location, l.images
             FROM bookings b
             JOIN listings l ON b.listing_id = l.id
             WHERE b.user_id = $1
             ORDER BY b.created_at DESC`,
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
            `SELECT b.booking_start, b.booking_end
             FROM bookings b
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


module.exports = {
    createBooking,
    getUserBookings,
    getListingBookings,
    deleteBooking,
    updateBooking
};