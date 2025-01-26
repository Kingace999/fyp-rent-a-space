import React, { useState, useEffect } from 'react';
import './ReviewsList.css';
import { X, Loader2 } from 'lucide-react';
import ReviewStars from './ReviewStars';

const ReviewSkeleton = () => (
  <div className="review-item" aria-hidden="true">
    <div className="review-header">
      <div className="animate-pulse bg-gray-200 h-4 w-24 rounded"/>
      <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"/>
    </div>
    <div className="animate-pulse bg-gray-200 h-4 w-20 rounded my-2"/>
    <div className="animate-pulse bg-gray-200 h-16 w-full rounded mt-3"/>
  </div>
);

const ReviewsList = ({ isOpen, onClose, listingId }) => {
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    timeFilter: 'all',
    sortOrder: 'created_at DESC'
  });

  useEffect(() => {
    if (isOpen && listingId) {
      setPage(1);
      setHasMore(true);
      setError(null);
      setReviews([]);
      fetchReviews(1, true);
    }
  }, [isOpen, listingId, filters]);

  const fetchReviews = async (pageNum, reset = false) => {
    try {
      reset ? setLoading(true) : setLoadingMore(true);
      const queryParams = new URLSearchParams({
        ...filters,
        page: pageNum,
        limit: 5
      });
      
      const response = await fetch(`http://localhost:5000/reviews/listing/${listingId}?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await response.json();
      
      if (data.reviews) {
        setReviews(prev => reset ? data.reviews : [...prev, ...data.reviews]);
        setAverageRating(Number(data.averageRating) || 0);
        setHasMore(data.hasMore);
      }
    } catch (err) {
      setError('Failed to load reviews. Please try again later.');
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReviews(nextPage);
  };

  const handleFilterChange = (type, value) => {
    setPage(1);
    setFilters(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="reviews-modal" onClick={e => e.stopPropagation()}>
        <div className="reviews-header">
          <div className="reviews-title-section">
            <h2 className="reviews-title">Reviews</h2>
            {!loading && !error && reviews.length > 0 && (
              <div className="average-rating">
                <div className="stars-display">
                  <ReviewStars rating={averageRating} editable={false} size="medium" />
                </div>
                <span className="rating-text">{averageRating.toFixed(1)} out of 5</span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="close-button"
            aria-label="Close reviews"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="filter-controls">
          <select 
            value={filters.timeFilter} 
            onChange={(e) => handleFilterChange('timeFilter', e.target.value)}
            className="time-select"
            aria-label="Filter by time"
          >
            <option value="all">All Time</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="last_year">Last Year</option>
          </select>

          <select 
            value={filters.sortOrder} 
            onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            className="sort-select"
            aria-label="Sort reviews"
          >
            <option value="created_at DESC">Latest Reviews</option>
            <option value="created_at ASC">Earliest Reviews</option>
            <option value="rating DESC">Highest Rated</option>
            <option value="rating ASC">Lowest Rated</option>
          </select>
        </div>

        <div className="reviews-container">
          {loading ? (
            <div className="loading-state" role="status">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span>Loading reviews...</span>
            </div>
          ) : error ? (
            <div className="error-state" role="alert">
              <p>{error}</p>
            </div>
          ) : reviews.length > 0 ? (
            <>
              {reviews.map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-header">
                    <span className="review-user">{review.username}</span>
                    <span className="review-date">{formatDate(review.created_at)}</span>
                  </div>
                  <div className="stars-display">
                    <ReviewStars rating={review.rating} editable={false} size="small" />
                  </div>
                  <p className="review-comment">{review.comment}</p>
                </div>
              ))}
              {hasMore && (
                <button 
                  onClick={handleLoadMore}
                  className="load-more-button"
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                      Loading more...
                    </>
                  ) : (
                    'Load More Reviews'
                  )}
                </button>
              )}
            </>
          ) : (
            <p className="no-reviews">No reviews yet for this listing.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewsList;