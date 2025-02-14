const express = require('express');
const { 
    createListing, 
    getAllListings, 
    getUserListings,
    deleteListing,     
    updateListing,
    getListing 
} = require('../controllers/listingsController');
const authenticateToken = require('../middleware/authenticateToken');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Handle multer errors
const handleUpload = (req, res, next) => {
    upload.array('images', 5)(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};

router.post('/', authenticateToken, handleUpload, createListing);
router.get('/', getAllListings);
router.get('/user', authenticateToken, getUserListings);
router.delete('/:id', authenticateToken, deleteListing);
router.put('/:id', authenticateToken, handleUpload, updateListing);
router.get('/:id', authenticateToken, getListing); 

module.exports = router;