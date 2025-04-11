import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Users, 
  Calendar, 
  Clock, 
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Star
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; // Add this import
import './ListingDetails.css';
import ActivitiesDropdown from '../Dashboard/ActivitiesDropdown';
import BookingForm from './BookingForm';
import ReviewsList from '../Reviews/ReviewsList'; 
import Header from '../Headers/Header';
import MessageHostButton from './MessageHostButton';

const ListingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth(); // Add this line to use auth context
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0); 
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  useEffect(() => {
    const fetchListingDetails = async () => {
      try {
        // First fetch listing details - Use accessToken from auth context
        const listingResponse = await fetch(`http://localhost:5000/listings/${id}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
  
        if (!listingResponse.ok) {
          throw new Error('Failed to fetch listing');
        }
  
        const listingData = await listingResponse.json();
        setListing(listingData);
  
        // Then fetch reviews data
        try {
          const reviewsResponse = await fetch(`http://localhost:5000/reviews/listing/${id}`);
          if (reviewsResponse.ok) {
            const reviewsData = await reviewsResponse.json();
            setAverageRating(Number(reviewsData.averageRating) || 0);
            setTotalReviews(Number(reviewsData.totalReviews) || 0);
          }
        } catch (reviewError) {
          console.error('Error fetching reviews:', reviewError);
          setAverageRating(0);
          setTotalReviews(0);
        }
  
        setLoading(false);
      } catch (error) {
        console.error('Error in fetchListingDetails:', error);
        setError('Failed to load listing details');
        setLoading(false);
      }
    };
  
    if (accessToken) {
      fetchListingDetails();
    }
  }, [id, accessToken]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === (listing?.images?.length - 1) ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? (listing?.images?.length - 1) : prev - 1
    );
  };

  // Remove the handleLogout function as it's now handled by the Header component

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <div className="error-message">{error}</div>
    </div>
  );

  if (!listing) return (
    <div className="not-found-container">
      <div className="not-found-message">Listing not found</div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="content-wrapper">
      <Header />

      {/* Main Content */}
      <main className="main-content">
        {/* Full-width Image Carousel */}
        <div className="image-carousel">
          {listing?.images && listing.images.length > 0 ? (
            <>
              <img
                src={`http://localhost:5000${listing.images[currentImageIndex]}`}
                alt={`${listing.title} - ${currentImageIndex + 1}`}
                className="carousel-image"
              />
              {listing.images.length > 1 && (
                <>
                  <button onClick={prevImage} className="carousel-button prev">
                    <ChevronLeft className="carousel-icon" />
                  </button>
                  <button onClick={nextImage} className="carousel-button next">
                    <ChevronRight className="carousel-icon" />
                  </button>
                  <div className="carousel-dots">
                    {listing.images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`carousel-dot ${index === currentImageIndex ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="no-image">No images available</div>
          )}
        </div>

        <div className="listing-container">
          <button onClick={() => navigate(-1)} className="back-button">
            <ArrowLeft className="back-icon" />
            Back to Search
          </button>

          <div className="listing-content-grid">
            {/* Main Content */}
            <div className="listing-main">
            <div className="listing-header">
                <h1 className="listing-title">{listing.title}</h1>
                <div className="listing-subtitle">
                <div className="host-info">
  {listing.owner_name && (
    <p className="listing-owner">Listed by {listing.owner_name}</p>
  )}
  <MessageHostButton 
    listingId={id}
    listingTitle={listing.title}
    hostId={listing.user_id}
  />
</div>
                <div className="rating-reviews">
  <div className="rating-display">
    <Star className="rating-star" />
    <span className="rating-number">
      {typeof averageRating === 'number' ? averageRating.toFixed(1) : '0.0'}
    </span>
  </div>
  <button 
    onClick={() => setIsReviewsModalOpen(true)}
    className="see-reviews-button"
  >
    {totalReviews > 0 ? `See ${totalReviews} Reviews` : 'No Reviews Yet'}
  </button>
</div>
                </div>
              </div>

              <div className="listing-meta">
                <div className="meta-item">
                  <MapPin className="meta-icon" />
                  <span>{listing.location}</span>
                </div>
                <div className="meta-item">
                  <Users className="meta-icon" />
                  <span>{listing.capacity} people</span>
                </div>
                <div className="meta-item">
                  <Clock className="meta-icon" />
                  <span>{listing.available_start_time} - {listing.available_end_time}</span>
                </div>
              </div>

              <div className="section">
                <h2 className="section-title">Description</h2>
                <p className="description-text">{listing.description}</p>
              </div>

              <div className="section">
                <h2 className="section-title">Amenities</h2>
                <div className="amenities-grid">
                  {listing.amenities?.map((amenity) => (
                    <span key={amenity} className="amenity-tag">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="listing-sidebar">
              <BookingForm 
                listing={listing}
                onSubmit={(bookingDetails) => {
                  console.log('Booking submitted:', bookingDetails);
                  // Handle booking submission here
                }}
              />
            </div>
          </div>
        </div>
      </main>
      </div>

      {/* Reviews Modal */}
      <ReviewsList 
        isOpen={isReviewsModalOpen}
        onClose={() => setIsReviewsModalOpen(false)}
        listingId={id}
      />
    </div>
  );
};

export default ListingDetails;