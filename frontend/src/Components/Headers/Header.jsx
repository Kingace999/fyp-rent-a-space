import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // Add this import
import ActivitiesDropdown from '../Dashboard/ActivitiesDropdown';
import NotificationBell from '../Notifications/NotificationBell';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const { logout } = useAuth(); // Add this line to use the auth context

  const handleLogout = async () => {
    await logout(); // Use the logout function from auth context
    // No need to navigate as the logout function will redirect
  };

  return (
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
            } else if (option === 'messages') { 
              navigate('/messages');
            }
          }}
        />
        <button
          className="logout-btn"
          onClick={handleLogout}
        >
          Logout
        </button>
      </nav>
    </header>
  );
};

export default Header;