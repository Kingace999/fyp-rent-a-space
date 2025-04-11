// middleware/authenticateToken.js
const { verifyAccessToken } = require('../services/tokenService');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract the token from the header
  
  if (!token) {
    return res.status(401).json({ 
      status: 'error',
      message: 'Access Token Required',
      code: 'AUTH_TOKEN_REQUIRED'
    });
  }
  
  const user = verifyAccessToken(token);
  if (!user) {
    return res.status(403).json({ 
      status: 'error',
      message: 'Invalid or Expired Token',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
  
  req.user = user; // Attach the user object to the request
  next(); // Pass control to the next middleware or route handler
};

module.exports = authenticateToken;