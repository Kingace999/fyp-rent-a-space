const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'verysecretkey'; // Use environment variable for security

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract the token from the header

    if (!token) return res.status(401).json({ message: 'Access Token Required' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or Expired Token' });
        req.user = user; // Attach the user object to the request
        next(); // Pass control to the next middleware or route handler
    });
};

module.exports = authenticateToken;
