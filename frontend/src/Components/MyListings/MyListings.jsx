import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Users, Clock, X, Loader2 } from 'lucide-react';
import './MyListings.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // Added auth context import
import ActivitiesDropdown from '../Dashboard/ActivitiesDropdown';
import Header from '../Headers/Header';
import ManageGuests from './manageGuests';

const MyListings = () => {
  const navigate = useNavigate();
  const { isAuthenticated, accessToken } = useAuth(); // Use auth context
  
  // Constants
  const spaceTypes = [
    'Garage',
    'Garden',
    'Room',
    'Office Space',
    'Storage',
    'Event Space',
    'Workshop',
    'Studio',
    'Other'
  ];

  const amenitiesList = [
    'WiFi',
    'Parking',
    'Tables',
    'Whiteboards',
    'Air Conditioning',
    'Heating',
    'Security',
    'Bathroom',
    'Other'
  ];

  // State
  const [userListings, setUserListings] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentListing, setCurrentListing] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCustomAmenity, setNewCustomAmenity] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newImages, setNewImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [listingToDelete, setListingToDelete] = useState(null);
  const [showGuestsModal, setShowGuestsModal] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState(null);

  // Fetch user listings
  const fetchUserListings = async () => {
    if (!isAuthenticated || !accessToken) return;

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/listings/user`, {

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setUserListings(response.data);
    } catch (error) {
      console.error('Error fetching user listings:', error);
      if (error.response?.status === 401) {
        // Let the auth context handle this situation
        navigate('/');
      }
    }
  };

  useEffect(() => {
    fetchUserListings();
  }, [navigate, isAuthenticated, accessToken]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
  
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (currentListing) {
      // Ensure end_date is not before start_date
      if (currentListing.start_date && currentListing.end_date) {
        if (new Date(currentListing.end_date) < new Date(currentListing.start_date)) {
          setCurrentListing(prev => ({
            ...prev,
            end_date: currentListing.start_date
          }));
        }
      }
    }
  }, [currentListing?.start_date]);

  const validateForm = () => {
    const required = [
      'title', 'description', 'type', 'price',
      'location', 'latitude', 'longitude'
    ];

    const missing = required.filter(field => !currentListing[field]);

    if (missing.length > 0) {
      setMessage({
        type: 'error',
        text: `Missing required fields: ${missing.join(', ')}`
      });
      return false;
    }

    if (parseFloat(currentListing.price) <= 0) {
      setMessage({
        type: 'error',
        text: 'Price must be greater than 0'
      });
      return false;
    }

    if (parseInt(currentListing.capacity) <= 0) {
      setMessage({
        type: 'error',
        text: 'Capacity must be greater than 0'
      });
      return false;
    }

    return true;
  };
  // Location search functionality
  const searchAddress = async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}&country=GB&proximity=-0.09,51.505`
      );
      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  // Image handling functions
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const existingImagesCount = currentListing?.images?.length || 0;
    const totalImages = existingImagesCount + newImages.length + files.length;
    
    if (totalImages > 5) {
      setMessage({ type: 'error', text: 'Maximum 5 images allowed' });
      return;
    }

    const uploadedImages = files.map(file => {
      file.preview = URL.createObjectURL(file);
      return file;
    });

    setNewImages(prev => [...prev, ...uploadedImages]);
  };

  const removeNewImage = (index) => {
    URL.revokeObjectURL(newImages[index].preview);
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imagePath) => {
    setCurrentListing(prev => ({
      ...prev,
      images: prev.images.filter(img => img !== imagePath)
    }));
    setImagesToDelete(prev => [...prev, imagePath]);
  };

  const handleSuggestionClick = (suggestion) => {
    const [lng, lat] = suggestion.center;
    setCurrentListing(prev => ({
      ...prev,
      location: suggestion.place_name,
      latitude: lat.toString(),
      longitude: lng.toString()
    }));
    setShowSuggestions(false);
  };

  const handleDeleteClick = (listingId) => {
    setListingToDelete(listingId);
    setShowDeleteModal(true);
  };
  
  const handleConfirmDelete = async () => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/listings/${listingToDelete}`, {

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      setMessage({ type: 'success', text: 'Listing deleted successfully!' });
      fetchUserListings();
      setShowDeleteModal(false);
      setListingToDelete(null);
    } catch (error) {
      console.error('Error deleting listing:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete listing. Please try again.'
      });
      if (error.response?.status === 401) {
        navigate('/');
      }
    }
  };

  const handleEditClick = (listing) => {
    const safeJSONParse = (str) => {
      try {
        return Array.isArray(str) ? str : JSON.parse(str || '[]');
      } catch (e) {
        return [];
      }
    };
  
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    };
  
    const formatTime = (timeString) => {
      if (!timeString) return ''; // Return empty if time is not set
  
      try {
        // If time contains both date and time, extract the time portion
        if (timeString.includes('T')) {
          return timeString.split('T')[1].slice(0, 5); // Format as HH:mm
        }
        // If it's already in HH:mm:ss format
        if (timeString.includes(':')) {
          return timeString.slice(0, 5); // Ensure HH:mm
        }
        return timeString; // Return as is if already in correct format
      } catch (error) {
        console.error('Error formatting time:', error);
        return ''; // Return empty string if any error occurs
      }
    };
  
    const processedListing = {
      ...listing,
      priceType: listing.price_type || 'hour',
      customType: listing.custom_type || null,
      amenities: safeJSONParse(listing.amenities),
      customAmenities: safeJSONParse(listing.custom_amenities),
      start_date: formatDate(listing.start_date),
      end_date: formatDate(listing.end_date),
      available_start_time: formatTime(listing.available_start_time),
      available_end_time: formatTime(listing.available_end_time),
    };
  

  
    setCurrentListing(processedListing);
    setShowEditModal(true);
    setNewImages([]);
    setImagesToDelete([]);
  };
  

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'location') {
      searchAddress(value);
    }
  
    setCurrentListing(prev => {
      const updates = { ...prev };
  
      switch (name) {
        case 'price':
          updates[name] = parseFloat(value) || 0;
          break;
        case 'capacity':
          updates[name] = parseInt(value) || 1;
          break;
        case 'priceType':
          updates.priceType = value || 'hour';
          break;
        case 'custom_type':
          updates.customType = value || null;
          break;
        case 'start_date':
        case 'end_date':
        case 'available_start_time':
        case 'available_end_time':
          updates[name] = value || '';
          break;
        default:
          updates[name] = value;
      }
  
      return updates;
    });
  };
  const handleAmenitiesChange = (e) => {
    const { value, checked } = e.target;
    if (!currentListing) return;
    
    setCurrentListing(prev => ({
      ...prev,
      amenities: checked
        ? [...(prev.amenities || []), value]
        : (prev.amenities || []).filter(amenity => amenity !== value)
    }));
  };

  const handleCustomAmenityAdd = () => {
    if (!newCustomAmenity.trim() || !currentListing) return;
    
    setCurrentListing(prev => ({
      ...prev,
      customAmenities: [...(prev.customAmenities || []), newCustomAmenity.trim()]
    }));
    setNewCustomAmenity('');
  };

  const removeCustomAmenity = (indexToRemove) => {
    setCurrentListing(prev => ({
      ...prev,
      customAmenities: prev.customAmenities.filter((_, index) => index !== indexToRemove)
    }));
  };

const handleManageGuestsClick = (listingId) => {
    setSelectedListingId(listingId);
    setShowGuestsModal(true);
  };

// Update the handleSave function in MyListings.jsx

// Update the formData section in handleSave function
// Update the formData section in handleSave function
const handleSave = async () => {
  if (!validateForm()) {
    return;
  }
  
  setIsSubmitting(true);
  if (!currentListing || !accessToken) return;

  try {
    const formData = new FormData();
    
    // Required fields
    formData.append('title', currentListing.title);
    formData.append('description', currentListing.description);
    formData.append('type', currentListing.type);
    formData.append('price', currentListing.price);
    formData.append('priceType', currentListing.priceType);
    formData.append('capacity', currentListing.capacity);
    formData.append('location', currentListing.location);
    formData.append('latitude', currentListing.latitude);
    formData.append('longitude', currentListing.longitude);
    
    // Optional custom type
    formData.append('customType', currentListing.customType);
    
    // Dates and times
    formData.append('startDate', currentListing.start_date);
    formData.append('endDate', currentListing.end_date);
    formData.append('available_start_time', currentListing.available_start_time);
    formData.append('available_end_time', currentListing.available_end_time);

    // Amenities
    formData.append('amenities', JSON.stringify(currentListing.amenities || []));
    formData.append('customAmenities', JSON.stringify(currentListing.customAmenities || []));

    // Existing Images
    if (currentListing.images?.length > 0) {
      formData.append('existingImages', JSON.stringify(currentListing.images));
    }

    // New Images
    if (newImages.length > 0) {
      newImages.forEach(image => {
        formData.append('images', image);
      });
    }

    // Images to Delete
    if (imagesToDelete.length > 0) {
      formData.append('imagesToDelete', JSON.stringify(imagesToDelete));
    }

    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/listings/${currentListing.id}`,
    
      formData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    setUserListings(prevListings => 
      prevListings.map(listing => 
        listing.id === currentListing.id ? response.data.listing : listing
      )
    );

    setShowEditModal(false);
    setMessage({ type: 'success', text: 'Listing updated successfully!' });
    
    // Clean up image previews
    newImages.forEach(image => URL.revokeObjectURL(image.preview));
    setNewImages([]);
    setImagesToDelete([]);
    
    await fetchUserListings();

  } catch (error) {
    console.error('Error updating listing:', error);
    setMessage({
      type: 'error',
      text: error.response?.data?.message || 'Failed to update listing. Please try again.'
    });
    
    if (error.response?.status === 401) {
      navigate('/');
    }
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="my-listings">
      <Header />

      <div className="listings-container">
        <h1>My Listings</h1>
        
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {userListings.length === 0 ? (
          <div className="no-listings">
            <p>You haven't added any listings yet.</p>
            <button className="add-listing-btn" onClick={() => navigate('/rent-out-space')}>
              Add Your First Listing
            </button>
          </div>
        ) : (
          <div className="listings-grid">
            {userListings.map((listing) => (
              <div key={listing.id} className="listing-card">
                <img
                  src={listing.images && listing.images[0] ? `${process.env.REACT_APP_API_URL}${listing.images[0]}` : '/placeholder.jpg'}

                  alt={listing.title}
                  className="listing-image"
                />
                <div className="listing-details">
                  <h3>{listing.title}</h3>
                  <p className="location">
                    <MapPin size={16} />
                    {listing.location}
                  </p>
                  <div className="listing-meta">
                    <span>
                      <Users size={16} />
                      {listing.capacity} people
                    </span>
                    <span className="price">
                      ${listing.price}/{listing.priceType}
                    </span>
                  </div>
                  <div className="availability-info">
                    <Calendar size={16} />
                    <span>
                      Available: {new Date(listing.start_date).toLocaleDateString()} -{' '}
                      {new Date(listing.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="time-info">
                    <Clock size={16} />
                    <span>
                      {listing.available_start_time} - {listing.available_end_time}
                    </span>
                  </div>
                  <div className="action-buttons">
  <button
    className="edit-button"
    onClick={() => handleEditClick(listing)}
  >
    Edit
  </button>
  <button
    className="manage-guests-button"
    onClick={() => handleManageGuestsClick(listing.id)}
  >
    Manage Guests
  </button>
  <button
    className="delete-button"
    onClick={() => handleDeleteClick(listing.id)}
  >
    Delete
  </button>
</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showDeleteModal && (
  <div className="delete-modal-overlay">
    <div className="delete-modal">
      <div className="delete-modal-content">
        <button 
          className="close-button" 
          onClick={() => {
            setShowDeleteModal(false);
            setListingToDelete(null);
          }}
        >
          <X size={24} />
        </button>
        <h2>Delete Listing</h2>
        <p>Are you sure you want to delete this listing? This action cannot be undone.</p>
        <div className="delete-modal-buttons">
          <button 
            className="cancel-button"
            onClick={() => {
              setShowDeleteModal(false);
              setListingToDelete(null);
            }}
          >
            Cancel
          </button>
          <button 
            className="confirm-delete-button"
            onClick={() => handleConfirmDelete()}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {showEditModal && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <div className="edit-modal-header">
              <h2>Edit Listing</h2>
              <button className="close-button" onClick={() => setShowEditModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="edit-modal-content">
              {/* Basic Information */}
              <div className="modal-section">
                <h3>Basic Information</h3>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    name="title"
                    value={currentListing?.title || ''}
                    onChange={handleInputChange}
                    className="modal-input"
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={currentListing?.description || ''}
                    onChange={handleInputChange}
                    className="modal-textarea"
                    rows="4"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      name="type"
                      value={currentListing?.type || ''}
                      onChange={handleInputChange}
                      className="modal-select"
                    >
                      {spaceTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Price</label>
                    <div className="price-input-group">
                      <input
                        type="number"
                        name="price"
                        value={currentListing?.price || ''}
                        onChange={handleInputChange}
                        className="modal-input"
                        min="0"
                        step="0.01"
                      />
                      <select
                        name="priceType"
                        value={currentListing?.priceType || 'hour'}
                        onChange={handleInputChange}
                        className="modal-select"
                      >
                        <option value="hour">per hour</option>
                        <option value="day">per day</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Capacity</label>
                    <input
                      type="number"
                      name="capacity"
                      value={currentListing?.capacity || ''}
                      onChange={handleInputChange}
                      className="modal-input"
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="modal-section">
                <h3>Amenities</h3>
                <div className="amenities-grid">
                  {amenitiesList.filter(amenity => amenity !== 'Other').map((amenity) => (
                    <label key={amenity} className="amenity-item">
                      <input
                        type="checkbox"
                        value={amenity}
                        checked={currentListing?.amenities?.includes(amenity)}
                        onChange={handleAmenitiesChange}
                      />
                      <span>{amenity}</span>
                    </label>
                  ))}
                </div>
                
                <div className="custom-amenities">
                  <div className="custom-amenity-input">
                    <input
                      type="text"
                      value={newCustomAmenity}
                      onChange={(e) => setNewCustomAmenity(e.target.value)}
                      placeholder="Add custom amenity"
                      className="modal-input"
                    />
                    <button 
                      type="button"
                      onClick={handleCustomAmenityAdd}
                      className="add-amenity-btn"
                      disabled={!newCustomAmenity.trim()}
                    >
                      Add
                    </button>
                  </div>
                  {currentListing?.customAmenities?.length > 0 && (
                    <div className="custom-amenities-list">
                      {currentListing.customAmenities.map((amenity, index) => (
                        <div key={index} className="custom-amenity-tag">
                          {amenity}
                          <button
                            type="button"
                            onClick={() => removeCustomAmenity(index)}
                            className="remove-amenity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Availability */}
              <div className="modal-section">
                <h3>Availability</h3>
                <div className="date-inputs">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      name="start_date"
                      value={currentListing?.start_date || ''}
                      onChange={handleInputChange}
                      className="modal-input"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="form-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      name="end_date"
                      value={currentListing?.end_date || ''}
                      onChange={handleInputChange}
                      className="modal-input"
                      min={currentListing?.start_date || new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="form-group">
                    <label>Available Times</label>
                    <div className="time-inputs">
                      <input
                        type="time"
                        name="available_start_time"
                        value={currentListing?.available_start_time || ''}
                        onChange={handleInputChange}
                        className="modal-input"
                      />
                      <span>to</span>
                      <input
                        type="time"
                        name="available_end_time"
                        value={currentListing?.available_end_time || ''}
                        onChange={handleInputChange}
                        className="modal-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="modal-section">
                <h3>Location</h3>
                <div className="form-group">
                  <label>Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="location"
                      value={currentListing?.location || ''}
                      onChange={handleInputChange}
                      className="modal-input"
                      placeholder="Start typing to search for an address"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        {suggestions.map(suggestion => (
                          <div
                            key={suggestion.id}
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion.place_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Photos Section */}
              <div className="modal-section">
                <h3>Photos</h3>
                <div className="form-group">
                  {/* Existing Images */}
                  {currentListing?.images?.length > 0 && (
                    <div className="existing-images mb-4">
                      <h4 className="text-sm font-medium mb-2">Current Images</h4>
                      <div className="image-preview-container">
                        {currentListing.images.map((imagePath, index) => (
                          <div key={index} className="image-preview relative flex items-center bg-gray-50 p-2 rounded">
                            <img
                              src={`${process.env.REACT_APP_API_URL}${listing.images[0]}`}

                              alt={`Listing ${index + 1}`}
                              style={{ maxWidth: '100px', maxHeight: '100px', width: 'auto', height: 'auto' }}
                              className="object-contain rounded"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(imagePath)}
                              className="remove-image absolute top-1 right-1"
                              disabled={isSubmitting}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload New Images */}
                  <div className={`upload-container ${isSubmitting ? 'disabled' : ''}`}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="file-input"
                      disabled={isSubmitting}
                    />
                    <div className="upload-text">
                      Click to upload images (max 5 total)
                    </div>
                  </div>

                  {/* New Images Preview */}
                  {newImages.length > 0 && (
                    <div className="image-preview-container mt-4">
                      <h4 className="text-sm font-medium mb-2">New Images</h4>
                      {newImages.map((image, index) => (
                        <div key={index} className="image-preview relative flex items-center bg-gray-50 p-2 rounded">
                          <img
                            src={image.preview}
                            alt={`Preview ${index + 1}`}
                            style={{ maxWidth: '100px', maxHeight: '100px', width: 'auto', height: 'auto' }}
                            className="object-contain rounded"
                          />
                          <button
                            type="button"
                            onClick={() => removeNewImage(index)}
                            className="remove-image absolute top-1 right-1"
                            disabled={isSubmitting}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  className="save-button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div> 
        </div>
        
      )}
      {showGuestsModal && (
  <ManageGuests
    listingId={selectedListingId}
    isOpen={showGuestsModal}
    onClose={() => setShowGuestsModal(false)}
  />
)}
    </div>
  );
};

export default MyListings;