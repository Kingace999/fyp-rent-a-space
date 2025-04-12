import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Users, Heart, Eye, Clock, DollarSign, X, Star} from 'lucide-react';
import './Dashboard.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // Added import for auth context
import ActivitiesDropdown from './ActivitiesDropdown';
import Header from '../Headers/Header';
import ReviewStars from '../Reviews/ReviewStars'; 

const Dashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
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
  
  // Add auth context
  const { isAuthenticated, currentUser, accessToken } = useAuth();
  const navigate = useNavigate();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const ITEMS_PER_PAGE = 9; // Adjust as needed

  // Updated fetchListings function for pagination
  const fetchListings = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      
      // Create URL with query parameters for filtering
      
      let url = `${process.env.REACT_APP_API_URL}/listings?page=${pageNum}&limit=${ITEMS_PER_PAGE}`;

      // Add filter parameters if they exist
      if (filters.spaceType) {
        url += `&spaceType=${filters.spaceType}`;
      }
      
      if (filters.maxPrice) {
        url += `&maxPrice=${filters.maxPrice}`;
      }
      
      const response = await axios.get(url);
      
      // Handle response data format
      if (Array.isArray(response.data)) {
        // Old API format (array of listings)
        setListings(response.data);
        setFilteredListings(response.data);
        setTotalPages(Math.ceil(response.data.length / ITEMS_PER_PAGE));
      } else {
        // New API format (object with listings and pagination metadata)
        setListings(response.data.listings || []);
        setFilteredListings(response.data.listings || []);
        setTotalPages(response.data.totalPages || 1);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching listings:', error);
      setIsLoading(false);
    }
  };

  // Updated useEffect for authentication and data loading
  useEffect(() => {
    // If not authenticated, ProtectedRoute will handle redirection
    if (!isAuthenticated) {
      return;
    }

    const fetchUserData = async () => {
      try {
        // Use the currentUser from auth context instead of making a separate API call
        if (currentUser) {
          setUserData(currentUser);
        } else {
          // If currentUser isn't set yet in auth context (rare case), fetch it
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/user/profile`, {

            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          setUserData(response.data);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
    fetchListings(currentPage);
  }, [navigate, currentPage, isAuthenticated, currentUser, accessToken]);

  // FIX 1: Added dependency on filters to ensure refetching when filters change
  useEffect(() => {
    fetchListings(currentPage);
  }, [filters.spaceType, filters.maxPrice, currentPage]);

  // FIX 2: Add new effect to watch for date/endDate changes and trigger data reload
  useEffect(() => {
    if (filters.durationType === 'daily' && filters.date && filters.endDate) {
      fetchListings(currentPage);
    } else if (filters.durationType === 'hourly' && filters.date) {
      fetchListings(currentPage);
    }
  }, [filters.date, filters.endDate, filters.durationType]);

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

  useEffect(() => {
    const fetchReviewsData = async () => {
      if (!filteredListings.length) return;
      
      try {
        // Create a new array to hold the updated listings
        const updatedListings = [];
        let hasChanges = false;
        
        // Process each listing
        for (const listing of filteredListings) {
          const listingCopy = { ...listing };
          
          // Only fetch reviews if they haven't been fetched yet
          if (listingCopy.averageRating === undefined) {
            try {
              const response = await axios.get(`${process.env.REACT_APP_API_URL}/reviews/listing/${listingCopy.id}`);

              
              if (response.data) {
                const avgRating = parseFloat(response.data.averageRating);
                listingCopy.averageRating = isNaN(avgRating) ? 0 : avgRating;
                listingCopy.reviewCount = Number(response.data.totalReviews) || 0;
                hasChanges = true;
                

              }
            } catch (error) {
              console.error(`Error fetching reviews for listing ${listingCopy.id}:`, error);
              listingCopy.averageRating = 0;
              listingCopy.reviewCount = 0;
              hasChanges = true;
            }
          }
          
          updatedListings.push(listingCopy);
        }
        
        // Only update state if changes were made
        if (hasChanges) {
          setFilteredListings(updatedListings);
        }
        
        setReviewsLoaded(true);
      } catch (error) {
        console.error('Error fetching reviews data:', error);
      }
    };
  
    if (!reviewsLoaded) {
      fetchReviewsData();
    }
  }, [reviewsLoaded, filteredListings.length]); // Changed dependency array
  // Add this useEffect to reset reviewsLoaded when filtered listings change
  useEffect(() => {
    setReviewsLoaded(false);
  }, [searchTerm, filters]);
  // Add this function to your component
useEffect(() => {
  // Check if we have listings but no reviews yet
  if (filteredListings.length > 0 && !filteredListings.some(listing => listing.averageRating !== undefined)) {
    setReviewsLoaded(false);
  }
}, [filteredListings]);
// Only run when the number of filtered listings changes
  const handleFilterChange = (filterName, value) => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
    
    // FIX 3: Handle date-related filter changes appropriately
    if (filterName === 'endDate' && filters.durationType === 'daily') {
      // When setting end date in daily mode, make sure both dates are set
      setFilters(prev => ({
        ...prev,
        [filterName]: value
      }));
      // Only trigger a new search if both dates are filled
      if (filters.date && value) {
        fetchListings(1);
      }
    } else {
      // Standard filter update for other filters
      setFilters(prev => ({
        ...prev,
        [filterName]: value
      }));
    }
  };

  // FIX 4: Improved handleDurationTypeChange to properly reset and manage state
  const handleDurationTypeChange = (durationType) => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
    
    // Clear form fields based on the selected mode before setting the new type
    if (durationType === 'daily') {
      // When switching to daily mode, clear time fields
      setFilters(prev => ({
        ...prev,
        durationType,
        startTime: '',
        endTime: '',
        // Keep date if it was set, as it will be used as the start date
      }));
    } else {
      // When switching to hourly mode, clear endDate
      setFilters(prev => ({
        ...prev,
        durationType,
        endDate: '',
        // Keep date if it was set
        // Keep time fields if they were set
      }));
    }
    
    // Force a re-fetch of the listings with the updated filter
    fetchListings(1);
  };

  const toggleFavorite = (spaceId) => {
    setFavorites((prev) =>
      prev.includes(spaceId)
        ? prev.filter((id) => id !== spaceId)
        : [...prev, spaceId]
    );
  };

  // Function to handle page changes
  const handlePageChange = (pageNum) => {
    setCurrentPage(pageNum);
    // fetchListings is called via useEffect when currentPage changes
    window.scrollTo(0, 0); // Scroll to top when changing pages
  };

  // Pagination component
  const Pagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return (
      <div className="pagination">
        <button 
          className="pagination-btn" 
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
        >
          Previous
        </button>
        
        {startPage > 1 && (
          <>
            <button className="pagination-btn" onClick={() => handlePageChange(1)}>1</button>
            {startPage > 2 && <span className="pagination-ellipsis">...</span>}
          </>
        )}
        
        {pageNumbers.map(num => (
          <button
            key={num}
            className={`pagination-btn ${currentPage === num ? 'active' : ''}`}
            onClick={() => handlePageChange(num)}
            disabled={isLoading}
          >
            {num}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
            <button className="pagination-btn" onClick={() => handlePageChange(totalPages)} disabled={isLoading}>
              {totalPages}
            </button>
          </>
        )}
        
        <button 
          className="pagination-btn" 
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
        >
          Next
        </button>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <Header />

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
                    onClick={() => handleDurationTypeChange('hourly')}
                  >
                    <Clock size={16} />
                    Hourly
                  </button>
                  <button
                    className={`toggle-btn ${filters.durationType === 'daily' ? 'active' : ''}`}
                    onClick={() => handleDurationTypeChange('daily')}
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

      {isLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading spaces...</p>
        </div>
      ) : (
        <>
          <div className="results-grid">
            {filteredListings.length > 0 ? (
              filteredListings.map((listing) => (
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
                        e.stopPropagation();
                        toggleFavorite(listing.id);
                      }}
                    >
                      <Heart size={16} />
                    </button>
                    <button 
                      className="quick-view-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                  <img 
                    src={listing.images && listing.images[0] ? `${process.env.REACT_APP_API_URL}${listing.images[0]}` : '/placeholder.jpg'}

                    alt={listing.title} 
                    className="space-image" 
                  />
                  <div className="space-details">
                  <h3>{listing.title}</h3>
<div className="simple-rating">
  <Star className="rating-star" size={14} />
  <span className="rating-number">
    {listing.averageRating ? listing.averageRating.toFixed(1) : '0.0'}
  </span>
  <span className="review-count">
    ({listing.reviewCount || 0} reviews)
  </span>
</div>
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
  {listing.amenities && listing.amenities.length > 0 ? (
    // Always show exactly 3 amenities, no "more" indicator
    Array(3).fill().map((_, idx) => {
      if (idx < listing.amenities.length) {
        // Show actual amenity if it exists
        return <span key={`amenity-${idx}`} className="amenity-tag">{listing.amenities[idx]}</span>;
      } else {
        // Show empty placeholder if fewer than 3 amenities
        return <span key={`empty-${idx}`} className="amenity-tag empty"></span>;
      }
    })
  ) : (
    // If no amenities, show 3 empty placeholders
    Array(3).fill().map((_, idx) => (
      <span key={`empty-${idx}`} className="amenity-tag empty"></span>
    ))
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
              ))
            ) : (
              <div className="no-results">
                <p>No spaces match your search criteria. Try adjusting your filters.</p>
              </div>
            )}
          </div>
          
          {filteredListings.length > 0 && totalPages > 1 && (
            <Pagination />
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;