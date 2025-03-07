import React from 'react';
import { X } from 'lucide-react';
import './AnalysisResultModal.css';

const AnalysisResultModal = ({ isOpen, onClose, analysis }) => {
  if (!isOpen) return null;

  // Prevent event propagation when clicking on the modal
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  // If analysis is still loading
  if (!analysis) {
    return (
      <div className="analysis-modal-overlay" onClick={onClose}>
        <div className="analysis-modal" onClick={handleModalClick}>
          <div className="analysis-modal-header">
            <h2>Analyzing your space...</h2>
            <button className="close-modal-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="analysis-modal-content loading">
            <div className="analysis-loading-spinner"></div>
            <p>Our AI is analyzing your space. This will just take a moment...</p>
          </div>
        </div>
      </div>
    );
  }

  // Format the score as a percentage
  const overallScore = analysis.score;
  const scoreColor = getScoreColor(overallScore);

  return (
    <div className="analysis-modal-overlay" onClick={onClose}>
      <div className="analysis-modal" onClick={handleModalClick}>
        <div className="analysis-modal-header">
          <h2>Space Analysis Results</h2>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="analysis-modal-content">
          <div className="score-section">
            <div 
              className="overall-score" 
              style={{ backgroundColor: scoreColor }}
            >
              <span>{overallScore}%</span>
              <p>Space Optimization Score</p>
            </div>
            
            <div className="score-breakdown">
              <div className="score-category">
                <h4>Lighting</h4>
                <div className="score-bar-container">
                  <div 
                    className="score-bar" 
                    style={{ 
                      width: `${analysis.details.lighting.score}%`,
                      backgroundColor: getScoreColor(analysis.details.lighting.score)
                    }}
                  ></div>
                </div>
                <p>{analysis.details.lighting.assessment}</p>
              </div>
              
              <div className="score-category">
                <h4>Organization</h4>
                <div className="score-bar-container">
                  <div 
                    className="score-bar" 
                    style={{ 
                      width: `${analysis.details.clutter.score}%`,
                      backgroundColor: getScoreColor(analysis.details.clutter.score)
                    }}
                  ></div>
                </div>
                <p>{analysis.details.clutter.assessment}</p>
              </div>
              
              <div className="score-category">
                <h4>Space Usage</h4>
                <div className="score-bar-container">
                  <div 
                    className="score-bar" 
                    style={{ 
                      width: `${analysis.details.spaceUsage.score}%`,
                      backgroundColor: getScoreColor(analysis.details.spaceUsage.score)
                    }}
                  ></div>
                </div>
                <p>{analysis.details.spaceUsage.assessment}</p>
              </div>
            </div>
          </div>

          <div className="recommendations-section">
            <h3>Personalized Recommendations</h3>
            <ul>
              {analysis.recommendations.map((recommendation, index) => (
                <li key={index}>{recommendation}</li>
              ))}
            </ul>
          </div>

          {analysis.detectedObjects && analysis.detectedObjects.length > 0 && (
            <div className="detected-items-section">
              <h3>What We Detected</h3>
              <div className="detected-items">
                {analysis.detectedObjects.slice(0, 6).map((object, index) => (
                  <div key={index} className="detected-item">
                    <span className="detected-name">{object.name}</span>
                    <span className="detected-confidence">{Math.round(object.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="action-section">
            <p className="help-text">
              Using these recommendations can help improve your space's appeal and potentially increase bookings!
            </p>
            <button className="apply-recommendations-btn" onClick={onClose}>
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to get color based on score
function getScoreColor(score) {
  if (score >= 80) return '#2ecc71'; // Green for high scores
  if (score >= 60) return '#f39c12'; // Orange for medium scores
  return '#e74c3c'; // Red for low scores
}

export default AnalysisResultModal;