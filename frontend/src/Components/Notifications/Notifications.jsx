import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BookOpen, Calendar, CreditCard, MessageSquare, X } from 'lucide-react';
import axios from 'axios';
import ActivitiesDropdown from '../Dashboard/ActivitiesDropdown';
import NotificationBell from './NotificationBell';
import './Notifications.css';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/notifications', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await axios.put(`http://localhost:5000/notifications/${id}/read`, null, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put('http://localhost:5000/notifications/mark-all-read', null, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const dismissNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await axios.delete(`http://localhost:5000/notifications/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    console.log('Notification clicked:', notification);
    
    if (!notification.is_read) {
      await markAsRead(new Event('click'), notification.id);
    }
  
    // Updated to check for message_new instead of message
    if (notification.type === 'message_new') {
      console.log('Message notification detected');
      try {
        navigate('/messages'); // Simplified navigation
        console.log('Navigation completed');
      } catch (error) {
        console.error('Navigation error:', error);
      }
      return;
    }
    
    if (notification.related_id) {
      switch(notification.type) {
        case 'review_new':
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
  };

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

  const filteredNotifications = activeFilter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <div className="notifications-page">
      <header className="dashboard-header">
        <div className="logo" onClick={() => navigate('/dashboard')}>
          Rent-a-Space
        </div>
        <nav>
          <button className="become-host" onClick={() => navigate('/rent-out-space')}>
            Rent out a space
          </button>
          <button className="profile-btn" onClick={() => navigate('/profile')}>
            Profile
          </button>
          <NotificationBell />
          <ActivitiesDropdown
            onSelect={(option) => {
              if (option === 'listings') {
                navigate('/my-listings');
              } else if (option === 'bookings') {
                navigate('/my-bookings');
              } else if (option === 'notifications') {
                navigate('/notifications');
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

      <div className="notifications-container">
        <div className="notifications-header">
          <h2>Notifications</h2>
          <button 
            className="mark-all-read-btn"
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        </div>
        
        <div className="notification-filters">
          <button 
            className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${activeFilter === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unread')}
          >
            Unread
          </button>
        </div>

        <div className="notifications-list">
          {loading ? (
            <div className="loading-state">
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-icon-container">
                  {getIcon(notification.type)}
                </div>
                
                <div className="notification-content">
                  <p className="notification-message">{notification.message}</p>
                  <p className="notification-time">
                    {formatTime(notification.created_at)}
                  </p>
                </div>

                <div className="notification-actions" onClick={e => e.stopPropagation()}>
                  {!notification.is_read && (
                    <button
                      onClick={(e) => markAsRead(e, notification.id)}
                      className="mark-read-btn"
                    >
                      Mark as read
                    </button>
                  )}
                  <button 
                    className="dismiss-btn"
                    onClick={(e) => dismissNotification(e, notification.id)}
                  >
                    <X />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-notifications">
              <p>No notifications to show</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;