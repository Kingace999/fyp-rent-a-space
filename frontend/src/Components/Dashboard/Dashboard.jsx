import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Users, Heart, Eye, Clock, DollarSign, X } from 'lucide-react';
import './Dashboard.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ActivitiesDropdown from './ActivitiesDropdown';

const Dashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [filters, setFilters] = useState({
    spaceType: '',
    minCapacity: 0,
    maxPrice: 100,
    amenities: [],
    location: '',
    durationType: 'hourly',
    date: '',
    endDate: '',
    startTime: '',
    endTime: '',
  });
  const [favorites, setFavorites] = useState([]);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  const fetchListings = async () => {
    try {
      const response = await axios.get('http://localhost:5000/listings');
      setListings(response.data);
      setFilteredListings(response.data);
    } catch (error) {
      console.error('Error fetching listings:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/');
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
    fetchListings();
  }, [navigate]);

  const isTimeInRange = (startTime, endTime, availableStartTime, availableEndTime) => {
    if (!startTime || !endTime || !availableStartTime || !availableEndTime) return true;
    
    const convertTimeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
  
    const requestedStart = convertTimeToMinutes(startTime);
    const requestedEnd = convertTimeToMinutes(endTime);
    const availableStart = convertTimeToMinutes(availableStartTime);
    const availableEnd = convertTimeToMinutes(availableEndTime);
  
    const requestedSpansMidnight = requestedEnd < requestedStart;
    const availableSpansMidnight = availableEnd < availableStart;
  
    if (!requestedSpansMidnight && !availableSpansMidnight) {
      return requestedStart >= availableStart && requestedEnd <= availableEnd;
    } else if (requestedSpansMidnight && availableSpansMidnight) {
      return (requestedStart >= availableStart) || (requestedEnd <= availableEnd);
    } else if (requestedSpansMidnight) {
      return false;
    } else {
      return requestedStart >= availableStart || requestedEnd <= availableEnd;
    }
  };
  
  const isAvailableAtDateTime = (listing) => {
    if (!filters.date && !filters.startTime && !filters.endTime) {
      return true;
    }
  
    if (!listing.start_date || !listing.end_date) {
      return false;
    }
  
    if (filters.date) {
      const selectedDate = new Date(filters.date);
      const listingStartDate = new Date(listing.start_date);
      const listingEndDate = new Date(listing.end_date);
      
      selectedDate.setHours(0, 0, 0, 0);
      listingStartDate.setHours(0, 0, 0, 0);
      listingEndDate.setHours(0, 0, 0, 0);
  
      if (selectedDate < listingStartDate || selectedDate > listingEndDate) {
        return false;
      }
    }
  
    if (filters.startTime && filters.endTime) {
      return isTimeInRange(
        filters.startTime,
        filters.endTime,
        listing.available_start_time,
        listing.available_end_time
      );
    }
  
    return true;
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const filtered = listings.filter(listing => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          listing.title.toLowerCase().includes(searchLower) ||
          listing.location.toLowerCase().includes(searchLower) ||
          listing.type.toLowerCase().includes(searchLower) ||
          (listing.amenities && listing.amenities.some(amenity => 
            amenity.toLowerCase().includes(searchLower)
          ));
        const matchesType = !filters.spaceType || listing.type === filters.spaceType;
        const matchesDateTime = isAvailableAtDateTime(listing);
        const matchesPrice = listing.price <= filters.maxPrice;
        
        return matchesSearch && matchesType && matchesDateTime && matchesPrice;
      });
      
      setFilteredListings(filtered);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filters, listings]);

  const handleSearch = (e) => {
    setIsSearching(true);
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="logo">Rent-a-Space</div>
        <nav>
          <button
            className="become-host"
            onClick={() => navigate('/rent-out-space')}
          >
            Rent out a space
          </button>
          <button
            className="profile-btn"
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
    } else if (option === 'notifications') {
      navigate('/notifications'); // This ensures navigation works for notifications
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

      <div className="search-container">
        <div className="search-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search spaces by location, type, or amenities..."
            className="search-input"
            value={searchTerm}
            onChange={handleSearch}
            aria-label="Search spaces"
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

        <div className="filters-section">
          <div className="filter-row">
            <div className="filter-group">
              <div className="filter-item">
                <label>Space Type</label>
                <select
                  className="filter-select"
                  value={filters.spaceType}
                  onChange={(e) => handleFilterChange('spaceType', e.target.value)}
                >
                  <option value="">All Space Types</option>
                  <option value="Garage">Garage</option>
                  <option value="Garden">Garden</option>
                  <option value="Room">Room</option>
                  <option value="Office Space">Office Space</option>
                  <option value="Storage">Storage</option>
                  <option value="Event Space">Event Space</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Studio">Studio</option>
                </select>
              </div>

              <div className="filter-item">
                <label>Price Range</label>
                <div className="price-range">
                  <DollarSign size={16} className="price-icon" />
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="10"
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', parseInt(e.target.value))}
                  />
                  <div className="price-input-wrapper">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={filters.maxPrice}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (value >= 0 && value <= 1000) {
                          handleFilterChange('maxPrice', value);
                        }
                      }}
                      className="price-input"
                    />
                  </div>
                </div>
              </div>

              <div className="duration-selector">
                <div className="duration-toggle">
                  <button
                    className={`toggle-btn ${filters.durationType !== 'daily' ? 'active' : ''}`}
                    onClick={() => {
                      handleFilterChange('durationType', 'hourly');
                      handleFilterChange('endDate', '');
                    }}
                  >
                    <Clock size={16} />
                    Hourly
                  </button>
                  <button
                    className={`toggle-btn ${filters.durationType === 'daily' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('durationType', 'daily')}
                  >
                    <Calendar size={16} />
                    Daily
                  </button>
                </div>

                {filters.durationType === 'daily' ? (
                  <div className="date-range-filter">
                    <div className="date-input-group">
                      <input
                        type="date"
                        className="date-input"
                        value={filters.date}
                        onChange={(e) => handleFilterChange('date', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        placeholder="Start Date"
                      />
                      <span>to</span>
                      <input
                        type="date"
                        className="date-input"
                        value={filters.endDate || ''}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        min={filters.date || new Date().toISOString().split('T')[0]}
                        placeholder="End Date"
                      />
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="results-grid">
        {filteredListings.map((listing) => (
          <div 
          key={listing.id} 
          className="space-card"
          onClick={() => navigate(`/listing/${listing.id}`)}
          style={{ cursor: 'pointer' }}
        >
            <div className="space-card-overlay">
              <button
                className={`favorite-btn ${favorites.includes(listing.id) ? 'favorited' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();  // Add this
                  toggleFavorite(listing.id);
                }}
              >
                <Heart size={16} />
              </button>
              <button className="quick-view-btn"
              onClick={(e) => e.stopPropagation()}>
                <Eye size={16} />
              </button>
            </div>
            <img 
              src={listing.images && listing.images[0] ? `http://localhost:5000${listing.images[0]}` : '/placeholder.jpg'} 
              alt={listing.title} 
              className="space-image" 
            />
            <div className="space-details">
              <h3>{listing.title}</h3>
              <p className="location">
                <MapPin size={16} />
                {listing.location}
              </p>
              <div className="space-meta">
                <span>
                  <Users size={16} />
                  {listing.capacity} people
                </span>
                <span className="price">${listing.price}/{listing.price_type}</span>
              </div>
              <div className="amenities-list">
                {listing.amenities && listing.amenities.slice(0, 3).map((amenity) => (
                  <span key={amenity} className="amenity-tag">{amenity}</span>
                ))}
                {listing.amenities && listing.amenities.length > 3 && (
                  <span className="amenity-tag more">+{listing.amenities.length - 3} more</span>
                )}
              </div>
              <p className="description">{listing.description.substring(0, 100)}...</p>
              <div className="availability-info">
                <Calendar size={16} />
                <span>Available: {new Date(listing.start_date).toLocaleDateString()} - {new Date(listing.end_date).toLocaleDateString()}</span>
              </div>
              <div className="time-info">
                <Clock size={16} />
                <span>{listing.available_start_time} - {listing.available_end_time}</span>
              </div>
              <button className="book-button">Book Now</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;