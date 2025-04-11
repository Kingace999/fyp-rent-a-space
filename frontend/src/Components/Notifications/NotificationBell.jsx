import React, { useState, useEffect, useRef } from 'react';
import { Bell, BookOpen, Calendar, CreditCard, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext'; // Added auth context import
import './NotificationBell.css';

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const { isAuthenticated, accessToken } = useAuth(); // Use auth context

  const getIcon = (type) => {
    switch (type) {
      case 'booking_new':
      case 'booking_cancelled':
      case 'booking_modified':
      case 'booking_upcoming':
        return <Calendar className="notification-icon booking-icon" />;
      case 'payment_success':
      case 'payment_failed':
      case 'payment_refund':
        return <CreditCard className="notification-icon payment-icon" />;
      case 'review_new':
      case 'review_reminder':
        return <BookOpen className="notification-icon review-icon" />;
      case 'message_new': // Added this case for message_new notifications
        return <MessageSquare className="notification-icon message-icon" />;
      case 'message': // Keep original case for backward compatibility
        return <MessageSquare className="notification-icon message-icon" />;
      default:
        return <Bell className="notification-icon default-icon" />;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const fetchUnreadCount = async () => {
    if (!isAuthenticated || !accessToken) return;
    
    try {
      const response = await axios.get('http://localhost:5000/notifications/unread', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchRecentNotifications = async () => {
    if (!isAuthenticated || !accessToken) return;
    
    try {
      const response = await axios.get('http://localhost:5000/notifications?limit=3', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      setRecentNotifications(response.data);
    } catch (error) {
      console.error('Error fetching recent notifications:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, accessToken]);

  const handleBellClick = async () => {
    await fetchRecentNotifications();
    setShowDropdown(!showDropdown);
  };

  const handleNotificationClick = (notification) => {
    console.log('Notification clicked:', notification);
    
    // Updated to check for message_new instead of message
    if (notification.type === 'message_new') {
      console.log('Message notification detected');
      try {
        navigate('/messages'); // Simplified navigation
        console.log('Navigation completed');
      } catch (error) {
        console.error('Navigation error:', error);
      }
      setShowDropdown(false);
      return;
    }
    
    if (notification.related_id) {
      switch(notification.type) {
        case 'review_new':
        case 'review_reminder':
          navigate(`/listing/${notification.related_id}`);
          break;
        case 'booking_new':
        case 'booking_cancelled':
        case 'booking_modified':
        case 'booking_upcoming':
        case 'payment_success':
        case 'payment_refund':
          navigate('/my-bookings');
          break;
        default:
          break;
      }
    }
    setShowDropdown(false);
  };

  return (
    <div className="notification-bell-wrapper">
      <div 
        className="notification-bell-container"
        onClick={handleBellClick}
      >
        <Bell className="notification-bell-icon" />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </div>

      {showDropdown && (
        <div ref={dropdownRef} className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h3>Recent Notifications</h3>
            <button onClick={() => navigate('/notifications')}>
              View All
            </button>
          </div>
          <div className="notification-dropdown-content">
            {recentNotifications.length > 0 ? (
              recentNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`dropdown-notification-item ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon-container">
                    {getIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">
                      {formatTime(notification.created_at)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-notifications">No recent notifications</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;