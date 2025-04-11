// services/tokenService.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Use environment variables for security
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

// Generate tokens
const generateTokens = async (userId) => {
  const accessToken = jwt.sign({ userId }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  
  // Store refresh token in database with expiry date
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7); // 7 days from now
  
  try {
    // First, invalidate any existing refresh tokens for this user
    await pool.query('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1', [userId]);
    
    // Then store the new refresh token
    await pool.query(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [refreshToken, userId, expiryDate]
    );
  } catch (error) {
    console.error('Error storing refresh token:', error);
    throw new Error('Failed to generate authentication tokens');
  }
  
  return { accessToken, refreshToken };
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
};

// Refresh access token using a valid refresh token
const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    
    // Check if token exists in database and is not revoked
    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND is_revoked = false AND expires_at > NOW()',
      [refreshToken, decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Generate a new access token
    const accessToken = jwt.sign({ userId: decoded.userId }, ACCESS_TOKEN_SECRET, { 
      expiresIn: ACCESS_TOKEN_EXPIRY 
    });
    
    return accessToken;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
};

// Revoke a refresh token (for logout)
const revokeRefreshToken = async (refreshToken) => {
  try {
    await pool.query('UPDATE refresh_tokens SET is_revoked = true WHERE token = $1', [refreshToken]);
    return true;
  } catch (error) {
    console.error('Error revoking token:', error);
    return false;
  }
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  refreshAccessToken,
  revokeRefreshToken
};