import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import './manageGuests.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // Added auth context import

const ManageGuests = ({ listingId, isOpen, onClose }) => {
  const navigate = useNavigate();
  const { isAuthenticated, accessToken } = useAuth(); // Use auth context
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only fetch data when the modal is open and we have a listing ID
    if (isOpen && listingId && isAuthenticated) {
      fetchBookings();
    }
  }, [isOpen, listingId, isAuthenticated, accessToken]);

  const fetchBookings = async () => {
    if (!isAuthenticated || !accessToken) return;
    
    setLoading(true);
    
    try {
      const response = await axios.get(`http://localhost:5000/bookings/listing/${listingId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setBookings(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to load bookings. Please try again.');
      
      if (error.response?.status === 401) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const viewUserProfile = (userId) => {
    // Navigate to your existing profile page with the user ID
    navigate(`/profile/${userId}`);
  };

  if (!isOpen) return null;

  return (
    <div className="manage-guests-overlay">
      <div className="manage-guests-modal">
        <div className="manage-guests-header">
          <h2>Manage Guests</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="manage-guests-content">
          {loading ? (
            <div className="loading-message">Loading bookings...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : bookings.length === 0 ? (
            <div className="no-bookings-message">
              <p>No bookings found for this listing.</p>
            </div>
          ) : (
            <div className="bookings-list">
              {bookings.map((booking, index) => (
                <div key={booking.id || index} className="booking-item">
                  <div className="booking-details">
                    <div className="booking-header">
                      <h3>Booking by {booking.name}</h3>
                    </div>
                    <div className="booking-time">
                      <p>
                        <strong>Start:</strong> {new Date(booking.booking_start).toLocaleString()}
                      </p>
                      <p>
                        <strong>End:</strong> {new Date(booking.booking_end).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="booking-actions">
                    <button
                      className="view-profile-button"
                      onClick={() => viewUserProfile(booking.user_id)}
                    >
                      <User size={16} />
                      View Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageGuests;