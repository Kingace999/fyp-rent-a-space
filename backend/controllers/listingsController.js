const pool = require('../config/db');

const createListing = async (req, res) => {
    try {
        const {
            title, description, type, customType, price, priceType, 
            capacity, location, latitude, longitude, startDate, endDate,
            available_start_time, available_end_time
        } = req.body;

        const parseJSONField = (field) => {
            try {
                return Array.isArray(field) ? field : JSON.parse(field || '[]');
            } catch (e) {
                return [];
            }
        };
          
        const amenities = parseJSONField(req.body.amenities);
        const customAmenities = parseJSONField(req.body.customAmenities);
        
        if (!Array.isArray(amenities) || !Array.isArray(customAmenities)) {
            return res.status(400).json({ message: "Invalid amenities format" });
        }
        console.log('Received amenities:', amenities);
        console.log('Received customAmenities:', customAmenities);

        if (!title || !description || !type || !price || !location || !latitude || !longitude) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        if (!Array.isArray(amenities) || !Array.isArray(customAmenities)) {
            console.log('Received amenities:', amenities);
            console.log('Received customAmenities:', customAmenities);
            return res.status(400).json({ message: "Invalid amenities format" });
        }

        if (!['hour', 'day'].includes(priceType)) {
            return res.status(400).json({ message: "Invalid price type" });
        }

        const parsedPrice = parseFloat(price);
        const parsedCapacity = parseInt(capacity);

        if (parsedPrice <= 0 || parsedCapacity <= 0) {
            return res.status(400).json({ message: "Price and capacity must be positive" });
        }

        const userId = req.user.userId;
        const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        const result = await pool.query(
            `INSERT INTO listings 
            (user_id, title, description, type, custom_type, price, price_type,
             capacity, location, latitude, longitude, amenities, custom_amenities,
             start_date, end_date, available_start_time, available_end_time, images)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
                    $13, $14, $15, $16, $17, $18)
            RETURNING *`,
            [
                userId, title, description, type, customType || null, 
                parsedPrice, priceType, parsedCapacity, location, latitude, longitude,
                amenities, customAmenities, startDate, endDate,
                available_start_time, available_end_time, imageUrls
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
            SELECT * FROM listings
            ORDER BY created_at DESC;
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