const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const authenticateToken = require('../middleware/authenticateToken'); // Middleware for authentication

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'fyp_rent_a_space',
    password: 'kingace999',
    port: 5432,
});

// GET: Fetch user profile
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = await pool.query('SELECT id, name, email, location, phone, address, bio, hobbies, created_at FROM users WHERE id = $1', [req.user.userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// PUT: Update user profile
router.put('/', authenticateToken, async (req, res) => {
    const { name, location, phone, address, bio, hobbies } = req.body;
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
});

module.exports = router;