import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Users, Heart, Eye, Sun, Home } from 'lucide-react';
import './Dashboard.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    spaceType: '',
    minCapacity: 0,
    maxPrice: 100,
    amenities: [],
    location: '',
    rentalType: 'all',
    date: '',
    startTime: '',
    endTime: '',
  });
  const [favorites, setFavorites] = useState([]);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/'); // Redirect to login if no token
      return;
    }

    const fetchUserData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/auth/user/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setUserData(response.data);
      } catch (error) {
        console.error('Error fetching user data:', error);
        localStorage.clear();
        navigate('/');
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  const toggleFavorite = (spaceId) => {
    setFavorites((prev) =>
      prev.includes(spaceId)
        ? prev.filter((id) => id !== spaceId)
        : [...prev, spaceId]
    );
  };

  const filteredSpaces = []; // Example: Replace with user-specific spaces fetched via API

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="logo">Rent-a-Space</div>
        <nav>
          <button
            className="become-host"
            onClick={() => navigate('/rent-out-space')} // Navigate to the Rent Out a Space page
          >
            Rent out a space
          </button>
          <button
            className="profile-btn"
            onClick={() => navigate('/profile')} // Navigate to the Profile page
          >
            Profile
          </button>
          <a href="#" className="my-bookings">My Bookings</a>
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

      <div className="search-container">
        <div className="search-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search spaces by location or type"
            className="search-input"
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>

        <div className="filters-section">
          <div className="filter-row">
            <div className="filter-group">
              <select
                className="filter-select"
                value={filters.spaceType}
                onChange={(e) => handleFilterChange('spaceType', e.target.value)}
              >
                <option value="">All Space Types</option>
                <option value="Garage">Garage</option>
                <option value="Garden">Garden</option>
                <option value="Room">Room</option>
              </select>

              <div className="rental-type-toggle">
                <button
                  className={`toggle-btn ${filters.rentalType === 'indoor' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('rentalType', 'indoor')}
                >
                  <Home size={16} />
                  Indoor
                </button>
                <button
                  className={`toggle-btn ${filters.rentalType === 'outdoor' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('rentalType', 'outdoor')}
                >
                  <Sun size={16} />
                  Outdoor
                </button>
                <button
                  className={`toggle-btn ${filters.rentalType === 'all' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('rentalType', 'all')}
                >
                  All
                </button>
              </div>
            </div>

            <div className="datetime-group">
              <div className="date-filter">
                <Calendar className="filter-icon" size={20} />
                <input
                  type="date"
                  className="date-input"
                  value={filters.date}
                  onChange={(e) => handleFilterChange('date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="time-filter">
                <input
                  type="time"
                  value={filters.startTime}
                  onChange={(e) => handleFilterChange('startTime', e.target.value)}
                  className="time-input"
                />
                <span>to</span>
                <input
                  type="time"
                  value={filters.endTime}
                  onChange={(e) => handleFilterChange('endTime', e.target.value)}
                  className="time-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="results-grid">
        {filteredSpaces.map((space) => (
          <div key={space.id} className="space-card">
            <div className="space-card-overlay">
              <button
                className={`favorite-btn ${favorites.includes(space.id) ? 'favorited' : ''}`}
                onClick={() => toggleFavorite(space.id)}
              >
                <Heart size={16} />
              </button>
              <button className="quick-view-btn">
                <Eye size={16} />
              </button>
            </div>
            <img src={space.imageUrl} alt={space.title} className="space-image" />
            <div className="space-details">
              <h3>{space.title}</h3>
              <p>{space.location}</p>
              <div className="space-meta">
                <span>{space.capacity} people</span>
                <span>${space.hourlyRate}/hr</span>
              </div>
              <div>
                {space.amenities.map((amenity) => (
                  <span key={amenity} className="amenity-tag">{amenity}</span>
                ))}
              </div>
              {space.hostVerified && (
                <div className="verification-badge">
                  <span>Verified Host</span>
                </div>
              )}
              <button className="book-button">Book Now</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
