const express = require('express');
const {
    createReview,
    getListingReviews,
    getUserReviews,
    updateReview,
    deleteReview
} = require('../controllers/ReviewsController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.post('/', authenticateToken, createReview);
router.get('/listing/:listing_id', getListingReviews);
router.get('/user', authenticateToken, getUserReviews);
router.put('/', authenticateToken, updateReview);
router.delete('/:reviewId', authenticateToken, deleteReview);

module.exports = router;