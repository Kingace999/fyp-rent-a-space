const pool = require('../config/db');

// Get current user's profile
const getCurrentUserProfile = async (req, res) => {
    try {
        const user = await pool.query(
            'SELECT id, name, email, location, phone, address, bio, hobbies, created_at, profile_image_url FROM users WHERE id = $1',
            [req.user.userId]
        );
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get another user's profile (public info only)
const getUserProfile = async (req, res) => {
    try {
        // Only return public information about the user
        const user = await pool.query(
            'SELECT id, name, location, bio, hobbies, profile_image_url FROM users WHERE id = $1',
            [req.params.userId]
        );
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update user profile
// Update user profile
const updateUserProfile = async (req, res) => {
    const { name, location, phone, address, bio, hobbies } = req.body;
    
    // Input validation
    if (name && name.length > 100) {
        return res.status(400).json({ message: 'Name cannot exceed 100 characters' });
    }
    if (location && location.length > 255) {
        return res.status(400).json({ message: 'Location cannot exceed 255 characters' });
    }
    if (phone && phone.length > 20) {
        return res.status(400).json({ message: 'Phone number cannot exceed 20 characters' });
    }
    // Address, bio, and hobbies are TEXT types which can handle large inputs
    
    try {
        const updatedUser = await pool.query(
            `UPDATE users SET name = $1, location = $2, phone = $3, address = $4, bio = $5, hobbies = $6 WHERE id = $7 RETURNING *`,
            [name, location, phone, address, bio, hobbies, req.user.userId]
        );
        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'Profile updated successfully', user: updatedUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Upload profile image
const uploadProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        
        const updatedUser = await pool.query(
            'UPDATE users SET profile_image_url = $1 WHERE id = $2 RETURNING profile_image_url',
            [imageUrl, req.user.userId]
        );

        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Profile image uploaded successfully',
            imageUrl: updatedUser.rows[0].profile_image_url
        });
    } catch (err) {
        console.error('Error uploading image:', err);
        res.status(500).json({ message: 'Error uploading image' });
    }
};

module.exports = {
    getCurrentUserProfile,
    getUserProfile,
    updateUserProfile,
    uploadProfileImage
};