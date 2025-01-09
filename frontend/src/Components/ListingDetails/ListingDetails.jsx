import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Users, Calendar, Clock, DollarSign,ChevronLeft,ChevronRight,ArrowLeft} from 'lucide-react';
import './ListingDetails.css';
import ActivitiesDropdown from '../Dashboard/ActivitiesDropdown';
import BookingForm from './BookingForm';


const ListingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  useEffect(() => {
    const fetchListingDetails = async () => {
      try {
        const response = await fetch(`http://localhost:5000/listings/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch');
        }
        const data = await response.json();
        setListing(data);
        setLoading(false);
      } catch (error) {
        setError('Failed to load listing details');
        setLoading(false);
      }
    };

    fetchListingDetails();
  }, [id]);

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

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

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
      {/* Navigation Header */}
      <header className="nav-header">
        <div className="nav-content">
          <div className="logo" onClick={() => navigate('/dashboard')}>
            Rent-a-Space
          </div>

          <nav className="nav-menu">
            <button 
              className="rent-button"
              onClick={() => navigate('/rent-out-space')}
            >
              Rent out a space
            </button>

            <button 
              className="profile-button"
              onClick={() => navigate('/profile')}
            >
              Profile
            </button>

            <ActivitiesDropdown 
              onSelect={(option) => {
                if (option === 'listings') {
                  navigate('/my-listings');
                } else if (option === 'bookings') {
                  navigate('/my-bookings');
                }
              }} 
            />

            <button 
              className="logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

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
                {listing.owner_name && (
                  <p className="listing-owner">Listed by {listing.owner_name}</p>
                )}
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
  );
};

export default ListingDetails;