const pool = require('../config/db');

const createListing = async (req, res) => {
    try {
        const {
            title, description, type, customType, price, priceType, 
            capacity, location, latitude, longitude, startDate, endDate,
            available_start_time, available_end_time, is_verified
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

        // Default to false if not provided for backward compatibility
        const isVerified = is_verified === 'true' || is_verified === true;

        const result = await pool.query(
            `INSERT INTO listings 
            (user_id, title, description, type, custom_type, price, price_type,
             capacity, location, latitude, longitude, amenities, custom_amenities,
             start_date, end_date, available_start_time, available_end_time, images, is_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
                    $13, $14, $15, $16, $17, $18, $19)
            RETURNING *`,
            [
                userId, title, description, type, customType || null, 
                parsedPrice, priceType, parsedCapacity, location, latitude, longitude,
                amenities, customAmenities, startDate, endDate,
                available_start_time, available_end_time, imageUrls, isVerified
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
        // Get pagination parameters from query string
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;
        
        // Build filter conditions based on query parameters
        const filterConditions = [];
        const filterValues = [];
        let paramCount = 1;
        
        // Filter by space type if provided
        if (req.query.spaceType) {
            filterConditions.push(`type = $${paramCount}`);
            filterValues.push(req.query.spaceType);
            paramCount++;
        }
        
        // Filter by price range if provided
        if (req.query.maxPrice) {
            filterConditions.push(`price <= $${paramCount}`);
            filterValues.push(parseFloat(req.query.maxPrice));
            paramCount++;
        }
        
        // Build the WHERE clause if there are any filters
        const whereClause = filterConditions.length > 0 
            ? `WHERE ${filterConditions.join(' AND ')}` 
            : '';
        
        // Get total count for pagination metadata
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM listings 
            ${whereClause}
        `;
        
        const countResult = await pool.query(countQuery, filterValues);
        const total = parseInt(countResult.rows[0].total);
        
        // Fetch the listings with pagination
        const listingsQuery = `
            SELECT * 
            FROM listings 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        
        const result = await pool.query(
            listingsQuery, 
            [...filterValues, limit, skip]
        );
        
        // Return data with pagination metadata
        res.status(200).json({
            listings: result.rows,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + result.rows.length < total
        });
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
const deleteListing = async (req, res) => {
    try {
        const listingId = req.params.id;
        const userId = req.user.userId;

        // Check if listing exists and belongs to user
        const listing = await pool.query(
            'SELECT * FROM listings WHERE id = $1 AND user_id = $2',
            [listingId, userId]
        );

        if (listing.rows.length === 0) {
            return res.status(404).json({ message: 'Listing not found or unauthorized' });
        }

        await pool.query('DELETE FROM listings WHERE id = $1', [listingId]);
        res.status(200).json({ message: 'Listing deleted successfully' });
    } catch (error) {
        console.error('Error deleting listing:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateListing = async (req, res) => {
    try {
      const listingId = req.params.id;
      const userId = req.user.userId;
      const {
        title, description, type, customType, price, priceType,
        capacity, location, latitude, longitude, startDate, endDate,
        available_start_time, available_end_time
      } = req.body;
  
      // Check if listing exists and belongs to user
      const existingListing = await pool.query(
        'SELECT * FROM listings WHERE id = $1 AND user_id = $2',
        [listingId, userId]
      );
  
      if (existingListing.rows.length === 0) {
        return res.status(404).json({ message: 'Listing not found or unauthorized' });
      }
  
      const parseJSONField = (field) => {
        try {
          return Array.isArray(field) ? field : JSON.parse(field || '[]');
        } catch (e) {
          return [];
        }
      };
  
      const amenities = parseJSONField(req.body.amenities);
      const customAmenities = parseJSONField(req.body.customAmenities);
      const existingImages = parseJSONField(req.body.existingImages); // Existing images
      const imagesToDelete = parseJSONField(req.body.imagesToDelete); // Images to delete
  
      // Validate required fields
      if (!title || !description || !type || !price || !location || !latitude || !longitude) {
        return res.status(400).json({ message: "Missing required fields" });
      }
  
      const parsedPrice = parseFloat(price);
      const parsedCapacity = parseInt(capacity);
  
      if (parsedPrice <= 0 || parsedCapacity <= 0) {
        return res.status(400).json({ message: "Price and capacity must be positive" });
      }
  
      // Handle images
      let imageUrls = existingImages; // Start with existing images
      if (imagesToDelete.length > 0) {
        imageUrls = imageUrls.filter(img => !imagesToDelete.includes(img)); // Remove deleted images
      }
      if (req.files?.length > 0) {
        const uploadedImages = req.files.map(file => `/uploads/${file.filename}`);
        imageUrls = [...imageUrls, ...uploadedImages]; // Add new images
      }
  
      const result = await pool.query(
        `UPDATE listings 
        SET title = $1, description = $2, type = $3, custom_type = $4,
            price = $5, price_type = $6, capacity = $7, location = $8,
            latitude = $9, longitude = $10, amenities = $11, custom_amenities = $12,
            start_date = $13, end_date = $14, available_start_time = $15,
            available_end_time = $16, images = $17
        WHERE id = $18 AND user_id = $19
        RETURNING *`,
        [
          title, description, type, customType || null,
          parsedPrice, priceType, parsedCapacity, location,
          latitude, longitude, amenities, customAmenities,
          startDate, endDate, available_start_time, available_end_time,
          imageUrls, listingId, userId
        ]
      );
  
      res.status(200).json({ listing: result.rows[0] });
    } catch (error) {
      console.error('Error updating listing:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };

  const getListing = async (req, res) => {
    try {
        const listingId = req.params.id;
        const userId = req.user.userId; // Available from the auth middleware
        
        const result = await pool.query(
            `SELECT l.*, u.name as owner_name
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.id = $1`,
            [listingId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching listing:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

  

module.exports = { createListing, getAllListings, getUserListings, deleteListing, updateListing, getListing };