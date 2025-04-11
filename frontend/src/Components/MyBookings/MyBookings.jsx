import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, DollarSign, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext'; // Added auth context import
import ActivitiesDropdown from '../Dashboard/ActivitiesDropdown';
import './MyBookings.css';
import { BookingDetails, CancelBookingDialog } from './BookingModals';
import UpdateBookingButton from './UpdateBookingButton';
import LeaveReviewForm from '../Reviews/LeaveReviewForm';
import PaginationControls from './PaginationControls';
import Header from '../Headers/Header';
import MessageButton from './MessageButton';
import { bookingAPI } from '../../services/api'; // Import API service if you have it



const MyBookings = () => {
  // Add auth context
  const { isAuthenticated, accessToken } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortCriteria, setSortCriteria] = useState('newest');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState({});
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedListingForReview, setSelectedListingForReview] = useState(null);
  const [userReviews, setUserReviews] = useState({}); // New state for tracking user reviews
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [bookingsPerPage] = useState(6);

  // Initial bookings fetch - Updated to use auth context
  useEffect(() => {
    // If not authenticated, ProtectedRoute will handle redirection
    if (!isAuthenticated) {
      return;
    }

    const fetchBookings = async () => {
      try {

        
        // Use the API service if available
        let response;
        try {
          // Try to use the API service first
          response = await bookingAPI.getBookings('?include_payments=true');
        } catch {
          // Fall back to direct axios call with accessToken
          response = await axios.get('http://localhost:5000/bookings/user?include_payments=true', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
        

        setBookings(response.data);
        setFilteredBookings(response.data);
      } catch (err) {
        console.error('Error details:', err.response?.data || err.message);
        setError('Failed to load bookings.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [navigate, isAuthenticated, accessToken]);

  // New effect for fetching user reviews - Updated to use auth context
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    
    const fetchUserReviews = async () => {
      try {
        const response = await axios.get('http://localhost:5000/reviews/user', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        // Convert array of reviews to object for easier lookup
        const reviewsMap = {};
        response.data.forEach(review => {
          reviewsMap[review.listing_id] = review;
        });
        setUserReviews(reviewsMap);
      } catch (err) {
        console.error('Error fetching user reviews:', err);
      }
    };

    fetchUserReviews();
  }, [isAuthenticated, accessToken]);

  // Effect for fetching listing details - Updated to use auth context
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    
    const fetchListingDetails = async (listingId) => {
      try {
        const response = await axios.get(`http://localhost:5000/listings/${listingId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        setListings(prev => ({
          ...prev,
          [listingId]: response.data
        }));
      } catch (err) {
        console.error('Error fetching listing details:', err);
      }
    };

    bookings.forEach(booking => {
      if (!listings[booking.listing_id]) {
        fetchListingDetails(booking.listing_id);
      }
    });
  }, [bookings, isAuthenticated, accessToken]);

  // Filtering and sorting effect (unchanged)
  useEffect(() => {
    let filtered = [...bookings];

    if (searchTerm) {
      filtered = filtered.filter(
        (booking) =>
          booking.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      switch (dateFilter) {
        case 'upcoming':
          filtered = filtered.filter(
            (booking) => new Date(booking.booking_start) > now
          );
          break;
        case 'past':
          filtered = filtered.filter(
            (booking) => new Date(booking.booking_end) < now
          );
          break;
        default:
          break;
      }
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((booking) => {
        if (statusFilter === 'active') {
          return booking.status === 'active' && new Date(booking.booking_end) > new Date();
        }
        return booking.status === statusFilter;
      });
    }

    switch (sortCriteria) {
      case 'newest':
        filtered.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        break;
      case 'oldest':
        filtered.sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        break;
      case 'price-high':
        filtered.sort((a, b) => b.total_price - a.total_price);
        break;
      case 'price-low':
        filtered.sort((a, b) => a.total_price - b.total_price);
        break;
      default:
        break;
    }

    setFilteredBookings(filtered);
  }, [bookings, searchTerm, dateFilter, statusFilter, sortCriteria]);


useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, statusFilter, sortCriteria]);  

// Updated cancel booking function to use auth context
const handleCancelBooking = async (bookingId) => {
  try {
      // Start cancellation
      const response = await axios.post(
          `http://localhost:5000/payments/refund/${bookingId}`,
          {},
          {
              headers: { Authorization: `Bearer ${accessToken}` }
          }
      );

      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max

      // Poll for status change
      const checkStatus = async () => {
          try {
              const statusResponse = await axios.get(
                  `http://localhost:5000/bookings/${bookingId}`,
                  {
                      headers: { Authorization: `Bearer ${accessToken}` }
                  }
              );
              
              if (statusResponse.data.status === 'cancelled') {
                  setBookings(prev => prev.map(booking => 
                      booking.id === bookingId ? statusResponse.data : booking
                  ));
                  setShowCancelDialog(false);
                  setBookingToCancel(null);
              } else if (statusResponse.data.status === 'pending_cancellation') {
                  attempts++;
                  if (attempts < maxAttempts) {
                      setTimeout(checkStatus, 1000); // Poll every second
                  } else {
                      setError('Cancellation is taking longer than expected. Please check your bookings later.');
                      setShowCancelDialog(false);
                      setBookingToCancel(null);
                  }
              }
          } catch (error) {
              console.error('Error checking status:', error);
              setError('Failed to check cancellation status.');
          }
      };
      
      checkStatus();
  } catch (error) {
      console.error('Error processing refund:', error);
      setError('Cancellation failed. Please try again.');
  }
};

  // Updated to use auth context
  const handleBookingUpdate = async (updatedBooking) => {
    try {
      const response = await axios.get('http://localhost:5000/bookings/user', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setBookings(response.data);
    } catch (err) {
      console.error('Error refreshing bookings:', err);
      setError('Failed to refresh bookings after update.');
    }
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
  };

  const handleCancelClick = (booking) => {
    setBookingToCancel(booking);
    setShowCancelDialog(true);
  };

  // Updated review handlers
  const handleLeaveReview = (booking) => {
    setSelectedListingForReview({
      ...booking,
      existingReview: userReviews[booking.listing_id]
    });
    setShowReviewForm(true);
  };

  const handleEditReview = (booking, existingReview) => {
    setSelectedListingForReview({
      ...booking,
      existingReview
    });
    setShowReviewForm(true);
  };

  // Updated to use auth context
  const refreshData = async () => {
    try {
      // Refresh bookings
      const bookingsResponse = await axios.get('http://localhost:5000/bookings/user?include_payments=true', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setBookings(bookingsResponse.data);

      // Refresh reviews
      const reviewsResponse = await axios.get('http://localhost:5000/reviews/user', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const reviewsMap = {};
      reviewsResponse.data.forEach(review => {
        reviewsMap[review.listing_id] = review;
      });
      setUserReviews(reviewsMap);
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data.');
    }
  };
  const indexOfLastBooking = currentPage * bookingsPerPage;
  const indexOfFirstBooking = indexOfLastBooking - bookingsPerPage;
  const currentBookings = filteredBookings.slice(indexOfFirstBooking, indexOfLastBooking);
  const totalPages = Math.ceil(filteredBookings.length / bookingsPerPage);

  return (
    <div className="my-bookings">
      {/* Header - Unchanged */}
      <Header />

      {/* Search and Filter Section - Unchanged */}
      <div className="search-filters">
        <div className="search-bar">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search by title or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="clear-search"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="filters">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">All Dates</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="pending_cancellation">Cancellation in Progress</option>
          </select>
          <select
            value={sortCriteria}
            onChange={(e) => setSortCriteria(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
          </select>
        </div>
      </div>

      {/* Bookings section - Modified with pagination */}
      <div className="bookings-container">
        {loading ? (
          <p>Loading bookings...</p>
        ) : filteredBookings.length === 0 ? (
          <div className="no-results">
            <p>No bookings found matching your criteria.</p>
            <button onClick={() => navigate('/dashboard')} className="browse-btn">
              Browse Spaces
            </button>
          </div>
        ) : (
          <>
            {currentBookings.map((booking) => (
              <div key={booking.id} className="booking-card">
                <div className="booking-image">
                  <img
                    src={
                      booking.images && booking.images[0]
                        ? `http://localhost:5000${booking.images[0]}`
                        : '/default-space.jpg'
                    }
                    alt={booking.title}
                  />
                </div>
                <div className="booking-details">
                  <h3>{booking.title}</h3>
                  <p><MapPin size={16} /> {booking.location}</p>
                  <p>
                    <Calendar size={16} /> Start:{' '}
                    {new Date(booking.booking_start).toLocaleString()}
                  </p>
                  <p>
                    <Calendar size={16} /> End:{' '}
                    {new Date(booking.booking_end).toLocaleString()}
                  </p>
                  <p>
                    <DollarSign size={16} />{' '}
                    {booking.total_price.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    })}
                  </p>
                  <p className="booking-status">
                    Status:{' '}
                    <span className={`status-indicator ${booking.status}`}>
                      {booking.status === 'pending_cancellation'
                        ? 'Cancellation in Progress'
                        : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </p>
                  <div className="actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
    <button onClick={() => handleViewDetails(booking)}>
        View Details
    </button>
    {booking.status === 'active' &&
        new Date(booking.booking_end) > new Date() &&
        listings[booking.listing_id] && (
            <>
                <UpdateBookingButton
                    booking={booking}
                    listing={listings[booking.listing_id]}
                    onUpdate={handleBookingUpdate}
                />
                <button 
                    className="cancel-button"
                    onClick={() => handleCancelClick(booking)}
                >
                    Cancel Booking
                </button>
                <MessageButton booking={booking} />
            </>
        )}
    {booking.status === 'completed' && (
        <button
            className="review-btn"
            onClick={() => {
                if (userReviews[booking.listing_id]) {
                    handleEditReview(booking, userReviews[booking.listing_id]);
                } else {
                    handleLeaveReview(booking);
                }
            }}
        >
            {userReviews[booking.listing_id] ? 'Edit Review' : 'Leave Review'}
        </button>
    )}
</div>
                </div>
              </div>
            ))}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Modal Components - Unchanged */}
      {selectedBooking && (
        <BookingDetails
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}

      {showCancelDialog && bookingToCancel && (
        <CancelBookingDialog
          booking={bookingToCancel}
          onConfirm={() => handleCancelBooking(bookingToCancel.id)}
          onClose={() => {
            setShowCancelDialog(false);
            setBookingToCancel(null);
          }}
        />
      )}

      {showReviewForm && selectedListingForReview && (
        <LeaveReviewForm
          isOpen={showReviewForm}
          onClose={() => {
            setShowReviewForm(false);
            setSelectedListingForReview(null);
            refreshData();
          }}
          listingName={selectedListingForReview.title}
          listingId={selectedListingForReview.listing_id}
          bookingId={selectedListingForReview.id}
          existingReview={selectedListingForReview.existingReview}
        />
      )}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
};

export default MyBookings;