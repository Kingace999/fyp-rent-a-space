import React, { useState } from 'react';
import { Search, MapPin, Calendar, Users, Heart, Eye, Sun, Home } from 'lucide-react';
import './Dashboard.css';  // Add this at the top of your React file
const spacesData = [
  {
    id: 1,
    title: 'Cozy Garage Studio',
    location: 'Downtown, San Francisco',
    type: 'Garage',
    spaceType: 'indoor',
    capacity: 4,
    hourlyRate: 25,
    imageUrl: '/api/placeholder/300/200',
    amenities: ['WiFi', 'Parking', 'Whiteboard'],
    hostVerified: true
  },
  {
    id: 2,
    title: 'Sunny Garden Workshop',
    location: 'Sunset District, San Francisco',
    type: 'Garden',
    spaceType: 'outdoor',
    capacity: 6,
    hourlyRate: 35,
    imageUrl: '/api/placeholder/300/200',
    amenities: ['Outdoor', 'Shade', 'Tables'],
    hostVerified: false
  }
];

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
    endTime: ''
  });
  const [favorites, setFavorites] = useState([]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const toggleFavorite = (spaceId) => {
    setFavorites(prev => 
      prev.includes(spaceId) 
        ? prev.filter(id => id !== spaceId)
        : [...prev, spaceId]
    );
  };

  const filteredSpaces = spacesData.filter(space => 
    space.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filters.spaceType ? space.type === filters.spaceType : true) &&
    (filters.rentalType === 'all' || space.spaceType === filters.rentalType) &&
    space.capacity >= filters.minCapacity &&
    space.hourlyRate <= filters.maxPrice &&
    (filters.amenities.length === 0 || 
      filters.amenities.every(amenity => space.amenities.includes(amenity)))
  );

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="logo">Rent-a-Space</div>
        <nav>
          <a href="#" className="become-host">Rent out a space</a>
          <a href="#" className="my-bookings">My Bookings</a>
          <a href="#" className="profile">Profile</a>
          <button className="login-btn">Login / Sign Up</button>
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

          <div className="filter-row">
            <div className="filter-group">
              <Users className="filter-icon" size={20} />
              <input 
                type="number" 
                placeholder="Min Capacity"
                value={filters.minCapacity}
                onChange={(e) => handleFilterChange('minCapacity', Number(e.target.value))}
                min="0"
                className="filter-select"
              />
            </div>

            <div className="filter-group">
              <MapPin className="filter-icon" size={20} />
              <input 
                type="range" 
                min="0" 
                max="100"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', Number(e.target.value))}
                className="filter-select"
              />
              <span>${filters.maxPrice}/hr</span>
            </div>
          </div>

          <div className="amenities-filter">
            <label>Amenities:</label>
            <div className="amenities-checkboxes">
              {['WiFi', 'Parking', 'Whiteboard', 'Tables'].map(amenity => (
                <label key={amenity} className="amenity-checkbox">
                  <input 
                    type="checkbox" 
                    value={amenity}
                    checked={filters.amenities.includes(amenity)}
                    onChange={(e) => {
                      const updatedAmenities = e.target.checked 
                        ? [...filters.amenities, amenity]
                        : filters.amenities.filter(a => a !== amenity);
                      handleFilterChange('amenities', updatedAmenities);
                    }}
                  />
                  {amenity}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="results-grid">
        {filteredSpaces.map(space => (
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
                {space.amenities.map(amenity => (
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