const pool = require('../config/db');

// Get all notifications for a user
const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.userId;
        const limit = req.query.limit || 10;
        const offset = req.query.offset || 0;

        const result = await pool.query(
            `SELECT * FROM notifications 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get unread notifications count
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT COUNT(*) FROM notifications 
             WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        res.status(200).json({ 
            count: parseInt(result.rows[0].count) 
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark a notification as read
const markAsRead = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId;
        const notificationId = req.params.id;

        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE notifications 
             SET is_read = true, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [notificationId, userId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                message: 'Notification not found' 
            });
        }

        await client.query('COMMIT');
        res.status(200).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId;

        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE notifications 
             SET is_read = true, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = $1 AND is_read = false 
             RETURNING *`,
            [userId]
        );

        await client.query('COMMIT');
        res.status(200).json(result.rows);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// Delete a notification
const deleteNotification = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId;
        const notificationId = req.params.id;

        await client.query('BEGIN');

        const result = await client.query(
            `DELETE FROM notifications 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [notificationId, userId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                message: 'Notification not found' 
            });
        }

        await client.query('COMMIT');
        res.status(200).json({ 
            message: 'Notification deleted successfully' 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// Create a notification (internal function)
const createNotification = async (type, userId, message, relatedId = null, title) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO notifications 
             (type, user_id, message, related_id, title) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [type, userId, message, relatedId, title]
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating notification:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification
};