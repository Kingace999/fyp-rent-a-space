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
    try {
        const userId = req.user.userId;
        const result = await pool.query(
            `SELECT b.*, l.title, l.location, l.images
             FROM bookings b
             JOIN listings l ON b.listing_id = l.id
             WHERE b.user_id = $1
             ORDER BY b.booking_start DESC`,
            [userId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getListingBookings = async (req, res) => {
    try {
        const { listing_id } = req.params;
        const result = await pool.query(
            `SELECT b.booking_start, b.booking_end
             FROM bookings b
             WHERE b.listing_id = $1
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
    try {
        const bookingId = req.params.id;
        const userId = req.user.userId;

        // Check if booking exists and belongs to user
        const booking = await pool.query(
            'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
            [bookingId, userId]
        );

        if (booking.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found or unauthorized' });
        }

        await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
        res.status(200).json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createBooking,
    getUserBookings,
    getListingBookings,
    deleteBooking
};