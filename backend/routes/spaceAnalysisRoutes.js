const express = require('express');
const { analyzeSpace } = require('../controllers/spaceAnalysisController');
const authenticateToken = require('../middleware/authenticateToken');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Handle single image upload for analysis
router.post('/analyze', authenticateToken, upload.single('image'), analyzeSpace);

module.exports = router;