// src/components/Notifications/Notifications.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ActivitiesDropdown from '../Dashboard/ActivitiesDropdown';
import './Notifications.css';

const Notifications = () => {
  const navigate = useNavigate();

  return (
    <div className="notifications-page">
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

      {/* Notifications Section */}
      <div className="notifications-container">
        <h2>Notifications</h2>
        <p>This page will display all user notifications.</p>
      </div>
    </div>
  );
};

export default Notifications;
