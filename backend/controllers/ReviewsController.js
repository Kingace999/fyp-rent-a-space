const pool = require('../config/db');
const { createNotification } = require('../controllers/notificationsController');


const createReview = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId;
        const { listing_id, booking_id, rating, comment } = req.body;

        // Validate required fields
        if (!listing_id || !booking_id || !rating || !comment) {
            return res.status(400).json({
                message: 'Missing required fields'
            });
        }

        // Validate rating range
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                message: 'Rating must be between 1 and 5'
            });
        }

        // Validate comment length
        if (comment.trim().length < 10) {
            return res.status(400).json({
                message: 'Review comment must be at least 10 characters long'
            });
        }

        await client.query('BEGIN');

        // Get listing details first
        const listingDetails = await client.query(
            `SELECT l.*, u.name as host_name, u.id as host_id
             FROM listings l 
             JOIN users u ON l.user_id = u.id 
             WHERE l.id = $1`,
            [listing_id]
        );

        if (listingDetails.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                message: 'Listing not found'
            });
        }

        const listing = listingDetails.rows[0];

        // Check if booking exists and is completed
        const bookingCheck = await client.query(
            `SELECT * FROM bookings 
             WHERE id = $1 AND user_id = $2 AND status = 'completed'`,
            [booking_id, userId]
        );

        if (bookingCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'Review can only be left for completed bookings'
            });
        }

        // Check if review already exists
        const existingReview = await client.query(
            'SELECT * FROM reviews WHERE booking_id = $1',
            [booking_id]
        );

        if (existingReview.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'A review has already been submitted for this booking'
            });
        }

        // Create the review
        const reviewResult = await client.query(
            `INSERT INTO reviews 
             (user_id, listing_id, booking_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, listing_id, booking_id, rating, comment]
        );

        // Get reviewer's name
        const reviewerDetails = await client.query(
            'SELECT name FROM users WHERE id = $1',
            [userId]
        );

        const reviewerName = reviewerDetails.rows[0]?.name || 'A user';

        // Create notification for the host
        try {
            await createNotification(
                'review_new',  // Using the correct type from your check constraint
                listing.host_id,
                `${reviewerName} left a ${rating}-star review for your space "${listing.title}"`,
                listing_id,
                'New Review Received'
            );
        } catch (notificationError) {
            console.error('Error creating notification:', notificationError);
            // Log the full error for debugging
            console.error('Full notification error:', notificationError);
        }

        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Review created successfully',
            review: reviewResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating review:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    } finally {
        client.release();
    }
};

const getListingReviews = async (req, res) => {
    try {
        const { listing_id } = req.params;
        const { timeFilter = 'all', sortOrder = 'created_at DESC', page = 1, limit = 5 } = req.query;
        const offset = (page - 1) * limit;
        const [column, order] = sortOrder.split(' ');

        let timeCondition = '';
        switch(timeFilter) {
            case 'last_6_months':
                timeCondition = "AND r.created_at >= NOW() - INTERVAL '6 months'";
                break;
            case 'last_year':
                timeCondition = "AND r.created_at >= NOW() - INTERVAL '1 year'";
                break;
            default:
                timeCondition = '';
        }

        // Get total count
        const countQuery = `
            SELECT COUNT(*) 
            FROM reviews r 
            WHERE r.listing_id = $1 ${timeCondition}
        `;
        const totalCount = await pool.query(countQuery, [listing_id]);

        // Get paginated reviews
        const query = `
            SELECT r.*, 
                u.name AS username,
                ROUND(AVG(r2.rating), 1) AS average_rating,
                COUNT(r2.id) AS total_reviews
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN reviews r2 ON r.listing_id = r2.listing_id
            WHERE r.listing_id = $1
            ${timeCondition}
            GROUP BY r.id, u.name
            ORDER BY r.${column} ${order}
            LIMIT $2 OFFSET $3
        `;

        const reviews = await pool.query(query, [listing_id, limit, offset]);

        res.status(200).json({
            reviews: reviews.rows,
            averageRating: reviews.rows[0]?.average_rating || 0,
            totalReviews: parseInt(totalCount.rows[0].count),
            hasMore: reviews.rows.length === parseInt(limit)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
const getUserReviews = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const reviews = await pool.query(
            `SELECT r.* 
             FROM reviews r
             WHERE r.user_id = $1`,
            [userId]
        );

        res.status(200).json(reviews.rows);
    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
const updateReview = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId;
        const { listing_id, booking_id, rating, comment, review_id } = req.body;

        if (!review_id || !rating || !comment) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        if (comment.trim().length < 10) {
            return res.status(400).json({ message: 'Review comment must be at least 10 characters' });
        }

        await client.query('BEGIN');

        const reviewCheck = await client.query(
            'SELECT * FROM reviews WHERE id = $1 AND user_id = $2',
            [review_id, userId]
        );

        if (reviewCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Review not found or unauthorized' });
        }

        const result = await client.query(
            `UPDATE reviews 
             SET rating = $1, comment = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND user_id = $4
             RETURNING *`,
            [rating, comment, review_id, userId]
        );

        await client.query('COMMIT');
        res.status(200).json({
            message: 'Review updated successfully',
            review: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating review:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        client.release();
    }
};
const deleteReview = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId;
        const { reviewId } = req.params;

        await client.query('BEGIN');

        const reviewCheck = await client.query(
            'SELECT * FROM reviews WHERE id = $1 AND user_id = $2',
            [reviewId, userId]
        );

        if (reviewCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Review not found or unauthorized' });
        }

        await client.query(
            'DELETE FROM reviews WHERE id = $1 AND user_id = $2',
            [reviewId, userId]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Review deleted successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting review:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};
module.exports = {
    createReview,
    getListingReviews,
    getUserReviews,
    updateReview,
    deleteReview
};