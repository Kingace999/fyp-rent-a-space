import React, { useState } from 'react';
import './ReviewStars.css';

const ReviewStars = ({ 
  rating, 
  editable = false, 
  onChange,
  size = 'medium'
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  const totalStars = 5;

  const handleMouseEnter = (index) => {
    if (editable) {
      setHoverRating(index);
    }
  };

  const handleMouseLeave = () => {
    if (editable) {
      setHoverRating(0);
    }
  };

  const handleClick = (index) => {
    if (editable && onChange) {
      onChange(index);
    }
  };

  const renderStar = (index) => {
    const filled = index <= (hoverRating || rating);
    
    return (
      <svg
        key={index}
        className={`star ${editable ? 'interactive' : ''} ${size} ${filled ? 'filled' : ''}`}
        viewBox="0 0 24 24"
        onMouseEnter={() => handleMouseEnter(index)}
        onMouseLeave={handleMouseLeave}
        onClick={() => handleClick(index)}
      >
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
    );
  };

  return (
    <div className="stars-container" role="group" aria-label="Rating stars">
      {[...Array(totalStars)].map((_, index) => renderStar(index + 1))}
      {editable && (
        <span className="rating-tooltip">
          {hoverRating ? `Rate ${hoverRating} stars` : `Current rating: ${rating} stars`}
        </span>
      )}
    </div>
  );
};

export default ReviewStars;