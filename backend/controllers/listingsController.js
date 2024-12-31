const pool = require('../config/db');

const createListing = async (req, res) => {
    try {
        const {
            title, description, type, customType, price, priceType, 
            capacity, location, latitude, longitude,
            amenities = [], customAmenities = [], startDate, endDate
        } = req.body;

        // Input validation
        if (!title || !description || !type || !price || !priceType || 
            !capacity || !location || !latitude || !longitude || !startDate || !endDate) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        if (!Array.isArray(amenities) || !Array.isArray(customAmenities)) {
            return res.status(400).json({ message: "Invalid amenities format" });
        }

        if (!['hour', 'day'].includes(priceType)) {
            return res.status(400).json({ message: "Invalid price type" });
        }

        if (price <= 0 || capacity <= 0) {
            return res.status(400).json({ message: "Price and capacity must be positive" });
        }

        const userId = req.user.userId;
        const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        const result = await pool.query(
            `INSERT INTO listings 
            (user_id, title, description, type, custom_type, price, price_type,
             capacity, location, latitude, longitude, amenities, custom_amenities,
             start_date, end_date, images)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
                    $13, $14, $15, $16)
            RETURNING *`,
            [
                userId, title, description, type, customType || null, 
                price, priceType, capacity, location, latitude, longitude,
                amenities, customAmenities,
                startDate, endDate, imageUrls
            ]
        );

        res.status(201).json({ listing: result.rows[0] });
    } catch (err) {
        console.error("Error creating listing:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

const getAllListings = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, u.username 
            FROM listings l
            JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC;
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
const getUserListings = async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query(
            'SELECT * FROM listings WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching user listings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createListing, getAllListings, getUserListings };