// controllers/authController.js
const bcrypt = require('bcrypt');
const validator = require('validator');
const pool = require('../config/db');
const { generateTokens, refreshAccessToken, revokeRefreshToken } = require('../services/tokenService');

// User signup with validation
const signup = async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        status: 'error',
        message: 'All fields are required' 
      });
    }
    
    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid email format' 
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // Add new password validation checks
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Password must contain at least one uppercase letter'
      });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Password must contain at least one number'
      });
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(password)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Password must contain at least one special character'
      });
    }
    
    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Email already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(newUser.rows[0].id);
    
    // set HTTP-only cookie with refresh token
    
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false, 
        sameSite: 'lax', 
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    
    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      accessToken,
      user: {
        id: newUser.rows[0].id,
        name: newUser.rows[0].name,
        email: newUser.rows[0].email,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// User login
const login = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Email and password are required'
      });
    }
    
    // Find user
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.rows[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid email or password'
      });
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.rows[0].id);
    
    // Set HTTP-only cookie with refresh token
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false, // Set to false for local development over HTTP
        sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      accessToken,
      user: {
        id: user.rows[0].id,
        name: user.rows[0].name,
        email: user.rows[0].email,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Refresh access token
// Refresh access token
const refresh = async (req, res) => {
    try {

      
      // Try to get refresh token from cookie, then from request body
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      
      if (!refreshToken) {
        return res.status(401).json({ 
          status: 'error',
          message: 'Refresh token required'
        });
      }
      
      // Generate new access token
      const accessToken = await refreshAccessToken(refreshToken);
      
      if (!accessToken) {
        return res.status(403).json({ 
          status: 'error',
          message: 'Invalid or expired refresh token'
        });
      }
      
      res.json({
        status: 'success',
        accessToken
      });
    } catch (error) {
      console.error('Refresh error:', error.message);
      res.status(500).json({ 
        status: 'error',
        message: 'Internal server error'
      });
    }
  };


const logout = async (req, res) => {
    try {
      // Try to get refresh token from cookie, then from request body
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      



      
      if (refreshToken) {
        // Revoke the refresh token
        await revokeRefreshToken(refreshToken);
      }
      
      // Clear the refresh token cookie regardless
      res.clearCookie('refreshToken');
      
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error.message);
      res.status(500).json({ 
        status: 'error',
        message: 'Internal server error'
      });
    }
  };
// Get user profile (keep your existing implementation)
const getUserProfile = async (req, res) => {
  try {
    const user = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.userId]);
    if (user.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  signup,
  login,
  refresh,
  logout,
  getUserProfile
};