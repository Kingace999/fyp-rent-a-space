const vision = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');

// Initialize Vision API client
let client;
try {
  // Try to parse the credentials as JSON
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  client = new vision.ImageAnnotatorClient({ credentials });
  console.log('Successfully initialized Vision client with JSON credentials');
} catch (error) {
  console.error('Error parsing credentials:', error);
  // Fallback to file path approach (for local development)
  client = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
  console.log('Initialized Vision client with credential file path');
}

// Controller function to analyze space images
const analyzeSpace = async (req, res) => {
    try {
        // Check if there's an image file in the request
        if (!req.file) {
            return res.status(400).json({ message: 'No image provided' });
        }

        const imagePath = path.join(__dirname, '..', req.file.path);
        
        // Debug information


        
        // Make separate API calls for each feature
        const [labelResponse] = await client.labelDetection(imagePath);
        const [imagePropertiesResponse] = await client.imageProperties(imagePath);
        const [objectResponse] = await client.objectLocalization(imagePath);
        const [textResponse] = await client.documentTextDetection(imagePath);

        // Extract data from the Vision API responses
        const labels = labelResponse.labelAnnotations || [];
        const imageProperties = imagePropertiesResponse.imagePropertiesAnnotation || {};
        const objects = objectResponse.localizedObjectAnnotations || [];
        const textDetections = textResponse.textAnnotations || [];

        // Log detected labels and objects for debugging


        
        // Analyze lighting using dominant colors and brightness
        const dominantColors = imageProperties.dominantColors?.colors || [];
        const lightingScore = analyzeLighting(dominantColors);
        const lightingAssessment = getLightingAssessment(lightingScore);
        
        // Analyze clutter based on objects and labels
        const clutterScore = analyzeClutter(objects, labels, textDetections, imageProperties);
        const clutterAssessment = getClutterAssessment(clutterScore);
        
        // Analyze space usage based on furniture placement
        const spaceUsageScore = analyzeSpaceUsage(objects, imageProperties, labels);
        const spaceUsageAssessment = getSpaceUsageAssessment(spaceUsageScore);
        
        // Calculate overall optimization score
        const overallScore = calculateOverallScore(lightingScore, clutterScore, spaceUsageScore);
        
        // Generate personalized recommendations
        const recommendations = generateRecommendations(
            lightingScore, 
            clutterScore, 
            spaceUsageScore, 
            labels, 
            objects
        );

        // Prepare enhanced response with detailed analysis
        const analysis = {
            score: overallScore,
            details: {
                lighting: {
                    assessment: lightingAssessment,
                    score: lightingScore
                },
                clutter: {
                    assessment: clutterAssessment,
                    score: clutterScore
                },
                spaceUsage: {
                    assessment: spaceUsageAssessment,
                    score: spaceUsageScore
                }
            },
            recommendations: recommendations,
            detectedObjects: objects.map(object => ({
                name: object.name,
                confidence: Math.round(object.score * 100) / 100
            })),
            detectedLabels: labels.slice(0, 8).map(label => ({
                name: label.description,
                confidence: Math.round(label.score * 100) / 100
            }))
        };

        res.status(200).json(analysis);
    } catch (error) {
        console.error('Error analyzing space:', error);
        res.status(500).json({ 
            message: 'Failed to analyze space', 
            error: error.message 
        });
    }
};

// Function to analyze lighting based on dominant colors
function analyzeLighting(dominantColors) {
    if (!dominantColors.length) return 50; // Default middle value
    
    // Calculate brightness and warmth from color properties
    let totalBrightness = 0;
    let totalWarmth = 0;
    let totalWeight = 0;
    
    dominantColors.forEach(color => {
        const rgb = color.color || {};
        const r = rgb.red || 0;
        const g = rgb.green || 0;
        const b = rgb.blue || 0;
        const pixelFraction = color.pixelFraction || 0;
        
        // Calculate perceived brightness (0-100)
        // Using the formula: 0.299R + 0.587G + 0.114B
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 2.55;
        
        // Calculate color warmth (higher values for warmer colors)
        // Simple warmth calculation: ratio of red to blue
        const warmth = r > b ? (r - b) / 2.55 : 0;
        
        totalBrightness += brightness * pixelFraction;
        totalWarmth += warmth * pixelFraction;
        totalWeight += pixelFraction;
    });
    
    // Normalize to get weighted average
    const avgBrightness = totalWeight > 0 ? totalBrightness / totalWeight : 50;
    const avgWarmth = totalWeight > 0 ? totalWarmth / totalWeight : 0;
    
    // Final lighting score combines brightness and warmth
    // Optimal lighting: bright but not too bright, with some warmth
    const optimalBrightness = 70; // Target brightness level
    const optimalWarmth = 20;     // Target warmth level
    
    const brightnessFactor = 100 - Math.min(100, Math.abs(avgBrightness - optimalBrightness) * 2);
    const warmthFactor = 100 - Math.min(100, Math.abs(avgWarmth - optimalWarmth) * 2);
    
    // Weighted combination (brightness more important than warmth)
    return Math.round(brightnessFactor * 0.7 + warmthFactor * 0.3);
}

// Function to analyze clutter based on objects detected - GENERALIZED VERSION
function analyzeClutter(objects, labels, textDetections, imageProperties) {
    // Lists for keyword detection
    const clutterKeywords = [
        'mess', 'messy', 'clutter', 'debris', 'trash', 'waste', 
        'disorder', 'disorganized', 'chaotic', 'scattered', 'papers',
        'dirty', 'untidy', 'crowded', 'littered', 'junk', 'garbage'
    ];
    
    const cleanlinesKeywords = [
        'clean', 'tidy', 'organized', 'neat', 'immaculate', 'spotless',
        'orderly', 'pristine', 'maintained', 'polished', 'minimalist'
    ];
    
    const modernDesignKeywords = [
        'modern', 'contemporary', 'design', 'interior design', 'styled',
        'decor', 'decoration', 'furnished', 'furniture', 'sleek', 'minimal'
    ];
    
    // Check for relevant labels
    const clutterLabels = labels.filter(label => 
        clutterKeywords.some(keyword => 
            label.description.toLowerCase().includes(keyword)
        )
    );
    
    const cleanlinessLabels = labels.filter(label => 
        cleanlinesKeywords.some(keyword => 
            label.description.toLowerCase().includes(keyword)
        )
    );
    
    const modernDesignLabels = labels.filter(label => 
        modernDesignKeywords.some(keyword => 
            label.description.toLowerCase().includes(keyword)
        )
    );
    
    // Detect text - may indicate papers/documents
    const hasSignificantText = textDetections.length > 3;
    
    // Count furniture vs small items
    const furnitureTypes = ['chair', 'table', 'couch', 'sofa', 'bed', 'desk', 'shelf', 'cabinet', 'wardrobe'];
    const smallItemTypes = [
        'book', 'vase', 'cup', 'bottle', 'box', 'plant', 'toy', 
        'device', 'electronics', 'paper', 'document', 'folder'
    ];
    
    let furnitureCount = 0;
    let smallItemCount = 0;
    
    objects.forEach(obj => {
        const name = obj.name.toLowerCase();
        if (furnitureTypes.some(type => name.includes(type))) {
            furnitureCount++;
        } else if (smallItemTypes.some(type => name.includes(type))) {
            smallItemCount++;
        }
    });
    
    // Calculate base clutter score - start with neutral position
    let baseClutterScore = 70;
    
    // Apply adjustments based on detected signals
    
    // 1. Explicit clutter/cleanliness labels
    if (clutterLabels.length > 0) {
        baseClutterScore -= clutterLabels.length * 10; // Reduce score for clutter indicators
    }
    
    if (cleanlinessLabels.length > 0) {
        baseClutterScore += cleanlinessLabels.length * 8; // Increase score for cleanliness
    }
    
    // 2. Modern design indicators often suggest intentional organization
    if (modernDesignLabels.length >= 3) {
        baseClutterScore += 10; // Bonus for well-designed spaces
    }
    
    // 3. Text detection - may indicate papers/documents
    if (hasSignificantText) {
        baseClutterScore -= 10; // Small penalty for possible paper clutter
    }
    
    // 4. Object count signals
    if (smallItemCount > 0) {
        // More small items generally means more clutter, but with a reasonable limit
        baseClutterScore -= Math.min(20, smallItemCount * 3);
    }
    
    // 5. Furniture to small item ratio
    if (furnitureCount > 0 && smallItemCount > 0) {
        const ratio = smallItemCount / furnitureCount;
        if (ratio > 3) {
            baseClutterScore -= Math.min(15, (ratio - 3) * 3); // Penalty for too many small items
        }
    }
    
    // 6. Recognize spaces with significant furniture as likely organized
    if (furnitureCount >= 3 && smallItemCount <= 5 && !clutterLabels.length) {
        baseClutterScore += 10; // Likely an intentionally designed space
    }
    
    // 7. Detect extreme cases
    
    // Severe clutter indicators
    const hasSevereClutter = clutterLabels.length >= 2 && (smallItemCount > 10 || hasSignificantText);
    if (hasSevereClutter) {
        baseClutterScore = Math.min(baseClutterScore, 30); // Cap for severely cluttered spaces
    }
    
    // Very clean/organized indicators
    const isVeryOrganized = cleanlinessLabels.length >= 2 && modernDesignLabels.length >= 2 && smallItemCount <= 3;
    if (isVeryOrganized) {
        baseClutterScore = Math.max(baseClutterScore, 85); // Minimum for very organized spaces
    }
    
    // 8. Final adjustments and caps
    
    // Don't give perfect scores without strong evidence
    if (baseClutterScore > 90 && cleanlinessLabels.length < 3) {
        baseClutterScore = 90;
    }
    
    // Don't give extremely low scores without strong evidence
    if (baseClutterScore < 20 && clutterLabels.length < 2) {
        baseClutterScore = 20;
    }
    
    // Final score range
    return Math.max(15, Math.min(95, baseClutterScore));
}

// Function to analyze space usage - GENERALIZED VERSION
function analyzeSpaceUsage(objects, imageProperties, labels) {
    // Default for empty spaces
    if (objects.length === 0) return 50;
    
    // Calculate furniture information
    const furnitureTypes = ['chair', 'table', 'couch', 'sofa', 'bed', 'desk', 'shelf', 'cabinet', 'wardrobe', 'dining'];
    
    let totalFurnitureArea = 0;
    let furnitureCount = 0;
    
    // Calculate furniture coverage
    objects.forEach(obj => {
        const name = obj.name.toLowerCase();
        
        if (furnitureTypes.some(type => name.includes(type))) {
            furnitureCount++;
            
            // Calculate area if bounding polygon available
            if (obj.boundingPoly && obj.boundingPoly.normalizedVertices) {
                const vertices = obj.boundingPoly.normalizedVertices;
                if (vertices.length >= 4) {
                    const width = Math.abs(vertices[1].x - vertices[0].x);
                    const height = Math.abs(vertices[2].y - vertices[1].y);
                    totalFurnitureArea += width * height;
                }
            }
        }
    });
    
    // Check for interior design indicators
    const interiorDesignKeywords = ['interior design', 'decor', 'decoration', 'designed', 'furnished'];
    const hasInteriorDesignIndicators = labels.some(label => 
        interiorDesignKeywords.some(keyword => 
            label.description.toLowerCase().includes(keyword)
        )
    );
    
    // Calculate space usage score based on furniture coverage
    // Ideal coverage is around 30-40% of the visible area
    const idealCoverage = 0.35;
    const coverageScore = 100 - Math.min(100, Math.abs(totalFurnitureArea - idealCoverage) * 150);
    
    // Factor in furniture variety (more diverse furniture types = better space usage)
    const furnitureVariety = new Set(
        objects
            .filter(obj => furnitureTypes.some(type => obj.name.toLowerCase().includes(type)))
            .map(obj => obj.name)
    ).size;
    
    const varietyScore = Math.min(100, furnitureVariety * 15);
    
    // Bonus for professional interior design
    const designBonus = hasInteriorDesignIndicators ? 10 : 0;
    
    // Calculate final score with weighted components
    let finalScore = (coverageScore * 0.5) + (varietyScore * 0.4) + designBonus;
    
    // Adjust for edge cases
    
    // If furniture detected but very little variety, likely poor usage
    if (furnitureCount > 0 && furnitureVariety === 1) {
        finalScore = Math.min(finalScore, 60); // Cap score for spaces with only one type of furniture
    }
    
    // If no furniture detected but objects exist, assume poor space usage
    if (furnitureCount === 0 && objects.length > 0) {
        finalScore = Math.min(finalScore, 40);
    }
    
    // Ensure score is in range
    return Math.round(Math.max(20, Math.min(95, finalScore)));
}

// Calculate overall optimization score
function calculateOverallScore(lightingScore, clutterScore, spaceUsageScore) {
    // Weight the factors based on importance
    const weights = {
        lighting: 0.35,
        clutter: 0.3,
        spaceUsage: 0.35
    };
    
    // Calculate weighted average
    const score = (
        lightingScore * weights.lighting +
        clutterScore * weights.clutter +
        spaceUsageScore * weights.spaceUsage
    );
    
    // Round to integer
    return Math.round(score);
}

// Get text description based on lighting score
function getLightingAssessment(score) {
    if (score >= 85) return 'Excellent lighting';
    if (score >= 70) return 'Well lit';
    if (score >= 50) return 'Adequately lit';
    if (score >= 30) return 'Somewhat dim';
    return 'Poorly lit';
}

// Get text description based on clutter score
function getClutterAssessment(score) {
    if (score >= 85) return 'Very organized';
    if (score >= 70) return 'Minimal clutter';
    if (score >= 50) return 'Moderate clutter';
    if (score >= 30) return 'Somewhat cluttered';
    return 'Very cluttered';
}

// Get text description based on space usage score
function getSpaceUsageAssessment(score) {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Adequate';
    if (score >= 30) return 'Could be improved';
    return 'Poor';
}

// Generate specific recommendations based on analysis
function generateRecommendations(lightingScore, clutterScore, spaceUsageScore, labels, objects) {
    const recommendations = [];
    
    // Detect space type
    const isLivingRoom = labels.some(l => 
        l.description.toLowerCase().includes('living room') || 
        l.description.toLowerCase().includes('lounge')
    );
    
    const isBedroom = labels.some(l => l.description.toLowerCase().includes('bedroom'));
    const isKitchen = labels.some(l => l.description.toLowerCase().includes('kitchen'));
    const isDiningRoom = labels.some(l => l.description.toLowerCase().includes('dining'));
    const isOffice = labels.some(l => l.description.toLowerCase().includes('office'));
    
    // Detect extreme conditions
    const isExtremelyCluttered = clutterScore < 25;
    const isExtremelyWellOrganized = clutterScore > 85;
    
    // TIER 1: Handle severe clutter (highest priority)
    if (isExtremelyCluttered) {
        recommendations.push('Clear away clutter and debris from floors and surfaces');
        recommendations.push('Consider a thorough cleaning and organization session');
        recommendations.push('Use storage solutions to organize loose items');
    }
    
    // TIER 2: Handle lighting issues
    if (lightingScore < 40) {
        recommendations.push('Increase lighting significantly with additional light fixtures');
        recommendations.push('Consider brighter bulbs or removing light-blocking obstacles');
    } else if (lightingScore < 65) {
        recommendations.push('Add more lighting to brighten the space');
        recommendations.push('Consider using lighter colors or mirrors to reflect light');
    }
    
    // TIER 3: Handle space usage issues
    if (spaceUsageScore < 40) {
        recommendations.push('Reconsider the furniture layout to improve functionality');
        recommendations.push('Choose furniture that better fits the scale of your space');
    } else if (spaceUsageScore < 65) {
        recommendations.push('Make small adjustments to furniture placement for better flow');
    }
    
    // TIER 4: Handle moderate clutter
    if (clutterScore >= 25 && clutterScore < 50) {
        recommendations.push('Reduce visible items and create more open space');
        recommendations.push('Organize papers and small items in appropriate storage');
    } else if (clutterScore >= 50 && clutterScore < 70) {
        recommendations.push('Group similar items together for a more organized appearance');
    }
    
    // TIER 5: Room-specific recommendations
    if (isLivingRoom) {
        if (!hasObjectType(objects, ['sofa', 'couch']) && recommendations.length < 5) {
            recommendations.push('Add comfortable seating options for a more inviting living space');
        }
    }
    
    if (isBedroom && recommendations.length < 5) {
        if (!hasObjectType(objects, ['bed'])) {
            recommendations.push('Ensure the bed is the focal point of the bedroom');
        }
    }
    
    if (isKitchen && recommendations.length < 5) {
        recommendations.push('Keep countertops clear for food preparation');
    }
    
    if (isOffice && recommendations.length < 5) {
        recommendations.push('Arrange your workspace to maximize productivity and comfort');
    }
    
    // TIER 6: Enhancement recommendations for well-organized spaces
    if (isExtremelyWellOrganized && recommendations.length < 3) {
        recommendations.push('Consider adding personal touches to make the space feel more lived-in');
        recommendations.push('Add plants to improve air quality and add visual interest');
        recommendations.push('Consider accent pieces to add character to your well-organized space');
    }
    
    // TIER 7: Generic recommendations if needed
    if (recommendations.length < 3) {
        recommendations.push('Use mirrors to create the illusion of more space and reflect light');
        recommendations.push('Add textiles like rugs or curtains to improve acoustics and comfort');
        recommendations.push('Incorporate plants to improve air quality and add visual interest');
    }
    
    // Limit to at most 5 recommendations
    return recommendations.slice(0, 5);
}

// Helper function to check if any objects of specific types are present
function hasObjectType(objects, types) {
    return objects.some(obj => 
        types.some(type => obj.name.toLowerCase().includes(type))
    );
}

module.exports = { analyzeSpace };