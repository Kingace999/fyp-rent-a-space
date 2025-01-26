import React, { useState } from 'react';
import './LeaveReviewForm.css';
import ReviewStars from './ReviewStars';
import { X, AlertCircle, Loader2, Star } from 'lucide-react';

const LeaveReviewForm = ({ 
  isOpen, 
  onClose, 
  listingName, 
  listingId, 
  bookingId,
  existingReview 
}) => {
  const [rating, setRating] = useState(existingReview ? existingReview.rating : 5);
  const [review, setReview] = useState(existingReview ? existingReview.comment : '');
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [charCount, setCharCount] = useState(existingReview ? existingReview.comment.length : 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTextChange = (e) => {
    const text = e.target.value;
    setReview(text);
    setCharCount(text.length);
    if (error && text.length >= 10) {
      setError('');
    }
  };

  const validateForm = () => {
    if (rating === 0) {
      setError('Please select a rating for your experience');
      return false;
    }
    if (review.length < 10) {
      setError('Please write at least 10 characters in your review');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      setShowConfirm(true);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:5000/reviews/${existingReview.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete review');
      }

      onClose();
    } catch (error) {
      setError(error.message || 'Failed to delete review');
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const confirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:5000/reviews', {
        method: existingReview ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_id: listingId,
          booking_id: bookingId,
          rating,
          comment: review,
          review_id: existingReview?.id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit review');
      }

      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
      setError(error.message || 'Failed to submit review. Please try again.');
      setShowConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showDeleteConfirm) {
    return (
      <div className="modal-overlay">
        <div className="modal-content confirmation-modal">
          <h2>Delete Review?</h2>
          <p>
            Are you sure you want to delete this review? 
            This action cannot be undone.
          </p>
          <div className="modal-buttons">
            <button
              className="button secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isSubmitting}
            >
              Keep Review
            </button>
            <button
              className="button danger"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Review'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="modal-overlay">
        <div className="modal-content confirmation-modal">
          <h2>{existingReview ? 'Save Changes?' : 'Submit Review?'}</h2>
          <p>
            {existingReview 
              ? 'Are you sure you want to update your review? Your changes will be visible to others.' 
              : 'Thank you for sharing your experience! Ready to submit your review?'}
          </p>
          <div className="modal-buttons">
            <button
              className="button secondary"
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting}
            >
              Review Again
            </button>
            <button
              className="button primary"
              onClick={confirmSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {existingReview ? 'Saving...' : 'Submitting...'}
                </>
              ) : (
                existingReview ? 'Save Changes' : 'Submit Review'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content review-form">
        <div className="modal-header">
          <div>
            <h2>{existingReview ? 'Edit Your Review' : 'Share Your Experience'}</h2>
            <p className="text-gray-600 text-sm mt-1">{listingName}</p>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close form"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body">
          <div className="rating-container">
            <label>
              <Star className="h-5 w-5 inline-block mr-2 text-yellow-500" />
              Rating
            </label>
            <ReviewStars
              rating={rating}
              editable={true}
              onChange={setRating}
              size="large"
            />
          </div>

          <div className="review-input-container">
            <textarea
              value={review}
              onChange={handleTextChange}
              placeholder="Tell us what you liked, what could be improved, or what others should know about your stay..."
              className="review-textarea"
              aria-label="Review text"
            />

            <div className="char-counter">
              {charCount} character{charCount !== 1 ? 's' : ''} 
              {charCount < 10 && ' (minimum 10)'}
            </div>

            {error && (
              <div className="error-message" role="alert">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="button secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          {existingReview && (
            <button
              className="button danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Review
            </button>
          )}
          <button
            className="button primary"
            onClick={handleSubmit}
          >
            {existingReview ? 'Save Changes' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveReviewForm;