require('dotenv').config();
const vision = require('@google-cloud/vision');
const path = require('path');

// Initialize Google Vision Client
const client = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Function to Test Vision API
async function testVisionAPI() {
    try {
        // Path to your specific image inside backend/uploads
        const filePath = path.join(__dirname, 'uploads', '1735742255607-pexels-jvdm-1457842.jpg');

        // Call API with local image file
        const [result] = await client.labelDetection(filePath);

        console.log("Raw API Response:", JSON.stringify(result, null, 2));

        if (!result.labelAnnotations || result.labelAnnotations.length === 0) {
            console.log('No labels detected.');
            return;
        }

        console.log('Detected Labels:');
        result.labelAnnotations.forEach(label => {
            console.log(`- ${label.description} (Confidence: ${label.score.toFixed(2)})`);
        });

    } catch (error) {
        console.error('Error testing Google Vision API:', error);
    }
}

// Run the test function
testVisionAPI();
