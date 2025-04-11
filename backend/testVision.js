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



        if (!result.labelAnnotations || result.labelAnnotations.length === 0) {

            return;
        }


        result.labelAnnotations.forEach(label => {

        });

    } catch (error) {
        console.error('Error testing Google Vision API:', error);
    }
}

// Run the test function
testVisionAPI();
