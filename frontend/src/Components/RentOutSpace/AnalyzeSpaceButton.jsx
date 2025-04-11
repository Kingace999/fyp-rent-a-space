import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; // Added auth context import
import './AnalyzeSpaceButton.css';
import axios from 'axios';

// Now we receive props from the parent component instead of managing the modal ourselves
const AnalyzeSpaceButton = ({ 
  imageIndex, 
  image, 
  onAnalysisStart, 
  onAnalysisComplete, 
  onAnalysisError 
}) => {
  const { isAuthenticated, accessToken } = useAuth(); // Use auth context
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeClick = async () => {
    if (!image) {
      console.error('No image provided for analysis');
      alert('No image to analyze');
      return;
    }

    if (!isAuthenticated || !accessToken) {
      console.error('Authentication token not found');
      alert('Authentication token not found. Please log in again.');
      return;
    }

    try {
      setIsAnalyzing(true);
      
      // Notify parent to show loading state of modal
      if (onAnalysisStart) onAnalysisStart();

      // Create form data for the image
      const formData = new FormData();
      formData.append('image', image);

      // Make request to the backend API
      const response = await axios.post('http://localhost:5000/space-analysis/analyze', formData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Pass the analysis result to the parent component
      if (onAnalysisComplete) onAnalysisComplete(response.data);
    } catch (err) {
      console.error('Error analyzing space:', err);
      alert(err.response?.data?.message || 'Failed to analyze image. Please try again.');
      
      // Notify parent of error
      if (onAnalysisError) onAnalysisError();
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="analyze-button-container">
      <button
        type="button"
        onClick={handleAnalyzeClick}
        className={`analyze-space-button ${isAnalyzing ? 'analyzing' : ''}`}
        title="Get AI-powered suggestions to improve your space"
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="analyze-icon-spinner" size={18} />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Sparkles className="analyze-icon" size={18} />
            <span>Analyze My Space</span>
          </>
        )}
      </button>
    </div>
  );
};

export default AnalyzeSpaceButton;