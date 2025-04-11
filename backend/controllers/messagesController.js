const pool = require('../config/db');
const { createNotification } = require('./notificationsController');

const sendMessage = async (req, res) => {
    const client = await pool.connect();
    try {
        const senderId = req.user.userId;
        const { receiverId, content, listingId, bookingId } = req.body;

        if (!receiverId || !content) {
            return res.status(400).json({
                message: 'Receiver ID and content are required'
            });
        }

        // New: User Existence Check
        const userCheck = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [receiverId]
        );
        if (userCheck.rows.length === 0) {
            return res.status(400).json({
                message: 'Receiver user does not exist'
            });
        }

        // New: Message Length Validation
        if (content.length > 5000) {
            return res.status(400).json({
                message: 'Message exceeds maximum length of 5000 characters'
            });
        }

        // New: Simple XSS Prevention
        const sanitizedContent = content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');

        // Begin transaction
        await client.query('BEGIN');

        // Verify listing or booking exists and user has permission
        if (listingId) {
            const listingCheck = await client.query(
                'SELECT user_id FROM listings WHERE id = $1',
                [listingId]
            );
            if (listingCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Listing not found' });
            }
        }

        if (bookingId) {
            const bookingCheck = await client.query(
                `SELECT b.*, l.user_id as host_id 
                 FROM bookings b 
                 JOIN listings l ON b.listing_id = l.id 
                 WHERE b.id = $1 AND (b.user_id = $2 OR l.user_id = $2)`,
                [bookingId, senderId]
            );
            if (bookingCheck.rows.length === 0) {
                return res.status(404).json({ 
                    message: 'Booking not found or unauthorized' 
                });
            }
        }

        // Get sender's name for notification
        const senderResult = await client.query(
            'SELECT name FROM users WHERE id = $1',
            [senderId]
        );

        // Insert message with context using sanitizedContent
        const result = await client.query(
            `INSERT INTO messages 
             (sender_id, receiver_id, content, listing_id, booking_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [senderId, receiverId, sanitizedContent, listingId || null, bookingId || null]
        );

        // Create notification with context
        let notificationMessage = `New message from ${senderResult.rows[0].name}`;
        if (listingId || bookingId) {
            const contextQuery = listingId 
                ? 'SELECT title FROM listings WHERE id = $1'
                : 'SELECT l.title FROM bookings b JOIN listings l ON b.listing_id = l.id WHERE b.id = $1';
            const contextResult = await client.query(contextQuery, [listingId || bookingId]);
            if (contextResult.rows.length > 0) {
                notificationMessage += ` regarding ${contextResult.rows[0].title}`;
            }
        }

        await createNotification(
            'message_new',
            receiverId,
            notificationMessage,
            result.rows[0].id,
            'New Message'
        );

        await client.query('COMMIT');
        res.status(201).json({
            message: 'Message sent successfully',
            data: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending message:', error);
        
        // More specific error handling
        if (error.code === '23503') {  // Foreign key violation
            return res.status(400).json({ message: 'Invalid receiver or context' });
        }
        
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};


const getConversation = async (req, res) => {
    try {
        const userId = parseInt(req.user.userId);
        const { receiverId } = req.params;

        const result = await pool.query(
            `SELECT 
                m.id,
                m.sender_id::integer as sender_id,
                m.receiver_id::integer as receiver_id,
                m.content,
                m.is_read,
                m.created_at,
                m.listing_id,
                m.booking_id,
                u_sender.name as sender_name,
                u_sender.profile_image_url as sender_image,
                l.title as listing_title
             FROM messages m
             JOIN users u_sender ON m.sender_id = u_sender.id
             LEFT JOIN listings l ON m.listing_id = l.id
             WHERE (m.sender_id = $1 AND m.receiver_id = $2::integer)
                OR (m.sender_id = $2::integer AND m.receiver_id = $1)
             ORDER BY m.created_at ASC`,
            [userId, receiverId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



const getUserConversations = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `WITH LastMessages AS (
                SELECT DISTINCT ON (
                    CASE 
                        WHEN sender_id = $1 THEN receiver_id 
                        ELSE sender_id 
                    END
                ) 
                    m.*,
                    CASE 
                        WHEN sender_id = $1 THEN receiver_id 
                        ELSE sender_id 
                    END as other_user_id,
                    l.title as listing_title,
                    l.id as listing_id,
                    b.id as booking_id,
                    b.status as booking_status
                FROM messages m
                LEFT JOIN listings l ON m.listing_id = l.id
                LEFT JOIN bookings b ON m.booking_id = b.id
                WHERE m.sender_id = $1 OR m.receiver_id = $1
                ORDER BY other_user_id, m.created_at DESC
            )
            SELECT 
                lm.*,
                u.name as other_user_name,
                u.profile_image_url as other_user_image
            FROM LastMessages lm
            JOIN users u ON u.id = lm.other_user_id
            ORDER BY lm.created_at DESC`,
            [userId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching user conversations:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const markMessageAsRead = async (req, res) => {  
    try {
        const userId = parseInt(req.user.userId);
        const { otherUserId } = req.params;

        const result = await pool.query(
            `UPDATE messages 
             SET is_read = true
             WHERE receiver_id = $1 
             AND sender_id = $2::integer
             AND is_read = false
             RETURNING id`,
            [userId, otherUserId]
        );

        res.status(200).json({
            message: 'Messages marked as read',
            updatedIds: result.rows.map(row => row.id)
        });
    } catch (error) {
        console.error('Error marking conversation as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const initiateListingConversation = async (req, res) => {
    const client = await pool.connect();
    try {
        const senderId = req.user.userId;
        const { listingId } = req.body;
        
        // Get listing details including owner
        const listingResult = await client.query(
            `SELECT l.*, u.name as host_name 
             FROM listings l
             JOIN users u ON l.user_id = u.id
             WHERE l.id = $1`,
            [listingId]
        );
        
        if (listingResult.rows.length === 0) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        const listing = listingResult.rows[0];
        
        // Prevent messaging yourself
        if (listing.user_id === senderId) {
            return res.status(400).json({ 
                message: 'Cannot message your own listing' 
            });
        }

        // Check if conversation already exists
        const existingConversation = await client.query(
            `SELECT m.* 
             FROM messages m
             WHERE (m.sender_id = $1 AND m.receiver_id = $2)
                OR (m.sender_id = $2 AND m.receiver_id = $1)
             ORDER BY m.created_at DESC
             LIMIT 1`,
            [senderId, listing.user_id]
        );
        
        res.status(200).json({
            receiverId: listing.user_id,
            listingId: listing.id,
            hostName: listing.host_name,
            existingConversation: existingConversation.rows.length > 0,
            conversationId: existingConversation.rows[0]?.id
        });
        
    } catch (error) {
        console.error('Error initiating listing conversation:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

const initiateBookingConversation = async (req, res) => {
    const client = await pool.connect();
    try {
        const senderId = req.user.userId;
        const { bookingId } = req.body;
        
        // Get booking and listing details
        const bookingResult = await client.query(
            `SELECT b.*, l.user_id as host_id, l.title, u.name as host_name
             FROM bookings b
             JOIN listings l ON b.listing_id = l.id
             JOIN users u ON l.user_id = u.id
             WHERE b.id = $1 AND (b.user_id = $2 OR l.user_id = $2)`,
            [bookingId, senderId]
        );
        
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ 
                message: 'Booking not found or unauthorized' 
            });
        }

        const booking = bookingResult.rows[0];
        const receiverId = senderId === booking.user_id 
            ? booking.host_id 
            : booking.user_id;
        
        res.status(200).json({
            receiverId,
            bookingId: booking.id,
            listingId: booking.listing_id,
            otherPartyName: booking.host_name,
            listingTitle: booking.title
        });
        
    } catch (error) {
        console.error('Error initiating booking conversation:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

module.exports = {
    sendMessage,
    getConversation,
    getUserConversations,
    markMessageAsRead,
    initiateListingConversation,
    initiateBookingConversation
};