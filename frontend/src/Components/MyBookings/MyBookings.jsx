import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, DollarSign, X } from 'lucide-react';
import axios from 'axios';
import ActivitiesDropdown from '../Dashboard/ActivitiesDropdown';
import './MyBookings.css';
import { BookingDetails, CancelBookingDialog } from './BookingModals';
import UpdateBookingButton from './UpdateBookingButton';
import LeaveReviewForm from '../Reviews/LeaveReviewForm';

const MyBookings = () => {
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

  // Initial bookings fetch
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchBookings = async () => {
      try {
        const response = await axios.get('http://localhost:5000/bookings/user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBookings(response.data);
        setFilteredBookings(response.data);
      } catch (err) {
        console.error('Error fetching bookings:', err);
        setError('Failed to load bookings.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [navigate]);

  // New effect for fetching user reviews
  useEffect(() => {
    const fetchUserReviews = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get('http://localhost:5000/reviews/user', {
          headers: { Authorization: `Bearer ${token}` }
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
  }, []);

  // Effect for fetching listing details
  useEffect(() => {
    const fetchListingDetails = async (listingId) => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`http://localhost:5000/listings/${listingId}`, {
          headers: { Authorization: `Bearer ${token}` }
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
  }, [bookings]);

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

  const handleCancelBooking = async (bookingId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: 'cancelled' } 
            : booking
        )
      );
      setShowCancelDialog(false);
      setBookingToCancel(null);
    } catch (err) {
      console.error('Error cancelling booking:', err);
      setError('Failed to cancel booking.');
    }
  };

  const handleBookingUpdate = async (updatedBooking) => {
    try {
      const response = await axios.get('http://localhost:5000/bookings/user', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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

  const refreshData = async () => {
    const token = localStorage.getItem('token');
    try {
      // Refresh bookings
      const bookingsResponse = await axios.get('http://localhost:5000/bookings/user', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(bookingsResponse.data);

      // Refresh reviews
      const reviewsResponse = await axios.get('http://localhost:5000/reviews/user', {
        headers: { Authorization: `Bearer ${token}` }
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

  return (
    <div className="my-bookings">
      {/* Header */}
      <header className="dashboard-header">
        <div className="logo" onClick={() => navigate('/dashboard')}>
          Rent-a-Space
        </div>
        <nav>
          <button
            className="become-host"
            onClick={() => navigate('/rent-out-space')}
          >
            Rent out a space
          </button>
          <button className="profile-btn" onClick={() => navigate('/profile')}>
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
            className="logout-btn"
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }}
          >
            Logout
          </button>
        </nav>
      </header>

      {/* Search and Filter Section */}
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

      {/* Bookings section with updated review button logic */}
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
          filteredBookings.map((booking) => (
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
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </p>
                <div className="actions">
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
                      <button onClick={() => handleCancelClick(booking)}>
                        Cancel Booking
                      </button>
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
          ))
        )}
      </div>

      {/* Modal Components */}
      {selectedBooking && (
        <BookingDetails
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}

      {showCancelDialog && bookingToCancel && (
        <CancelBookingDialog
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
            refreshData(); // Refresh both bookings and reviews after submission
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