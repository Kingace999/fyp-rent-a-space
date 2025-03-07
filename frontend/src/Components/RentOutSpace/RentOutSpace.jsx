import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import './RentOutSpace.css'
import LocationPicker from './LocationPicker';
import DocumentVerificationModal from '../Verification/DocumentVerificationModal';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AnalyzeSpaceButton from './AnalyzeSpaceButton';
import AnalysisResultModal from './AnalysisResultModal';

const RentOutSpace = () => {
  const navigate = useNavigate();
  const [spaceDetails, setSpaceDetails] = useState({
    title: '',
    description: '',
    type: '',
    customType: '',
    price: '',
    priceType: 'hour',
    capacity: '',
    amenities: [],
    customAmenities: [],
    location: '',
    availability: {
      startDate: '',
      endDate: '',
      available_start_time: '',
      available_end_time: ''
    },
    coordinates: {
      latitude: 51.505, // default coordinates
      longitude: -0.09
    },
    isVerified: false // New verification status field
  });
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState(null);
  const [showCustomType, setShowCustomType] = useState(false);
  const [newCustomAmenity, setNewCustomAmenity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  
  // New state for verification modal
  const [showVerificationModal, setShowVerificationModal] = useState(false);

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

  const validateField = (name, value) => {
    switch (name) {
      case 'title':
        return value.length === 0 
          ? 'Title is required'
          : value.length > 100 
          ? 'Title must be less than 100 characters'
          : '';
      case 'description':
        return value.length === 0 
          ? 'Description is required'
          : value.length > 1000 
          ? 'Description must be less than 1000 characters'
          : '';
      case 'price':
        return value === '' 
          ? 'Price is required'
          : isNaN(value) || parseFloat(value) <= 0 
          ? 'Price must be a positive number'
          : '';
      case 'capacity':
        return value === '' 
          ? 'Capacity is required'
          : isNaN(value) || parseInt(value) <= 0 
          ? 'Capacity must be a positive number'
          : '';
      case 'location':
        return value.length === 0 
          ? 'Location is required'
          : '';
      case 'type':
        return value.length === 0 
          ? 'Space type is required'
          : '';
      case 'customType':
        return showCustomType && value.length === 0 
          ? 'Custom type is required'
          : '';
      case 'startDate':
        return value.length === 0 
          ? 'Start date is required'
          : '';
      case 'endDate':
        const start = new Date(spaceDetails.availability.startDate);
        const end = new Date(value);
        return value.length === 0 
          ? 'End date is required'
          : start > end 
          ? 'End date must be after start date'
          : '';
      default:
        return '';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSpaceDetails((prev) => ({ ...prev, [name]: value }));
    
    // Real-time validation
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const handleTypeChange = (e) => {
    const value = e.target.value;
    setShowCustomType(value === 'Other');
    setSpaceDetails((prev) => ({
      ...prev,
      type: value,
      customType: value === 'Other' ? prev.customType : ''
    }));
    
    const error = validateField('type', value);
    setErrors(prev => ({
      ...prev,
      type: error
    }));
  };

  const handleAmenitiesChange = (e) => {
    const { value, checked } = e.target;
    if (value === 'Other') return;
    
    setSpaceDetails((prev) => ({
      ...prev,
      amenities: checked
        ? [...prev.amenities, value]
        : prev.amenities.filter((amenity) => amenity !== value),
    }));
  };

  const handleCustomAmenityAdd = (e) => {
    e.preventDefault();
    if (newCustomAmenity.trim()) {
      setSpaceDetails((prev) => ({
        ...prev,
        customAmenities: [...prev.customAmenities, newCustomAmenity.trim()]
      }));
      setNewCustomAmenity('');
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setSpaceDetails((prev) => ({
      ...prev,
      availability: { ...prev.availability, [name]: value },
    }));
    
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const removeCustomAmenity = (indexToRemove) => {
    setSpaceDetails((prev) => ({
      ...prev,
      customAmenities: prev.customAmenities.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const totalImages = images.length + files.length;
    
    if (totalImages > 5) {
      setMessage({ type: 'error', text: 'Maximum 5 images allowed' });
      return;
    }
  
    const newImages = files.map(file => {
      file.preview = URL.createObjectURL(file);
      return file;
    });
  
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(images[index].preview);
    setImages(images.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate required fields
    if (!spaceDetails.title?.trim()) newErrors.title = 'Title is required';
    if (!spaceDetails.description?.trim()) newErrors.description = 'Description is required';
    if (!spaceDetails.type) newErrors.type = 'Space type is required';
    if (spaceDetails.type === 'Other' && !spaceDetails.customType?.trim()) {
      newErrors.customType = 'Custom type is required when "Other" is selected';
    }
    if (!spaceDetails.price || parseFloat(spaceDetails.price) <= 0) {
      newErrors.price = 'Valid price is required';
    }
    if (!spaceDetails.capacity || parseInt(spaceDetails.capacity) <= 0) {
      newErrors.capacity = 'Valid capacity is required';
    }
    if (!spaceDetails.location?.trim()) newErrors.location = 'Location is required';
    if (!spaceDetails.availability.startDate) newErrors.startDate = 'Start date is required';
    if (!spaceDetails.availability.endDate) newErrors.endDate = 'End date is required';
  
    // Additional validations
    if (spaceDetails.availability.startDate && spaceDetails.availability.endDate) {
      const start = new Date(spaceDetails.availability.startDate);
      const end = new Date(spaceDetails.availability.endDate);
      if (end < start) {
        newErrors.endDate = 'End date must be after start date';
      }
    }
  
    // Update errors state
    setErrors(newErrors);
  
    // Show message if there are errors
    if (Object.keys(newErrors).length > 0) {
      const missingFields = Object.keys(newErrors).join(', ');
      setMessage({
        type: 'error',
        text: `Please fix the following fields: ${missingFields}`
      });
      return false;
    }
  
    return true;
  };

  // Modified handleSubmit to include verification step
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const coordinates = {
      latitude: spaceDetails.coordinates.latitude.toString(),
      longitude: spaceDetails.coordinates.longitude.toString()
    };

    if (!coordinates.latitude || !coordinates.longitude) {
      setMessage({ type: 'error', text: 'Please select a location on the map' });
      return;
    }

    // Show verification modal instead of submitting directly
    setShowVerificationModal(true);
  };

  // New function to handle the actual form submission after verification
  const submitFormAfterVerification = async () => {
    setIsSubmitting(true);

    const coordinates = {
      latitude: spaceDetails.coordinates.latitude.toString(),
      longitude: spaceDetails.coordinates.longitude.toString()
    };

    const requestData = {
      title: spaceDetails.title,
      description: spaceDetails.description,
      type: spaceDetails.type,
      customType: spaceDetails.customType,
      price: spaceDetails.price,
      priceType: spaceDetails.priceType,
      capacity: spaceDetails.capacity,
      location: spaceDetails.location,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      startDate: spaceDetails.availability.startDate,
      endDate: spaceDetails.availability.endDate,
      available_start_time: spaceDetails.availability.available_start_time, 
      available_end_time: spaceDetails.availability.available_end_time,   
      amenities: spaceDetails.amenities,
      customAmenities: spaceDetails.customAmenities,
      is_verified: true // Add the verification status
    };

    const formData = new FormData();
    Object.entries(requestData).forEach(([key, value]) => {
      if (key === 'amenities' || key === 'customAmenities') {
        formData.append(key, JSON.stringify(Array.isArray(value) ? value : []));
      } else {
        formData.append(key, value);
      }
    });

    if (images && images.length > 0) {
      images.forEach((image) => {
        formData.append('images', image);
      });
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setMessage({ type: 'error', text: 'Authentication token not found. Please log in again.' });
        setIsSubmitting(false);
        return;
      }

      const response = await axios.post('http://localhost:5000/listings', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage({ type: 'success', text: 'Listing created successfully!' });
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) {
      console.error('Error submitting form:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to create listing. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for verification completion
  const handleVerificationComplete = (success) => {
    if (success) {
      setSpaceDetails(prev => ({ ...prev, isVerified: true }));
      setShowVerificationModal(false);
      submitFormAfterVerification();
    } else {
      setShowVerificationModal(false);
      setMessage({ type: 'error', text: 'Verification failed. Please try again.' });
    }
  };
  const handleAnalysisComplete = (analysis) => {
    setCurrentAnalysis(analysis);
  };
  
  const closeAnalysisModal = () => {
    setAnalysisModalOpen(false);
    setCurrentAnalysis(null);
  };
  
  const openAnalysisModal = () => {
    setAnalysisModalOpen(true);
  };

  const getInputClassName = (fieldName) => {
    return `${errors[fieldName] ? 'border-red-500' : ''} ${isSubmitting ? 'opacity-50' : ''}`;
  };

  return (
    <div className="rent-out-space">
      <h1>Rent Out Your Space</h1>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rent-out-form">
        {/* Space Information */}
        <div className="form-section">
          <h2>Basic Information</h2>
          <div className="form-group">
            <label>Title:</label>
            <input
              type="text"
              name="title"
              placeholder="Enter the title of your space"
              value={spaceDetails.title}
              onChange={handleInputChange}
              className={getInputClassName('title')}
              disabled={isSubmitting}
              required
            />
            {errors.title && <span className="text-red-500 text-sm mt-1">{errors.title}</span>}
          </div>
          
          <div className="form-group">
            <label>Description:</label>
            <textarea
              name="description"
              placeholder="Describe your space, including unique features"
              value={spaceDetails.description}
              onChange={handleInputChange}
              className={getInputClassName('description')}
              disabled={isSubmitting}
              rows="4"
              required
            ></textarea>
            {errors.description && 
              <span className="text-red-500 text-sm mt-1">{errors.description}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Type:</label>
              <select
                name="type"
                value={spaceDetails.type}
                onChange={handleTypeChange}
                className={getInputClassName('type')}
                disabled={isSubmitting}
                required
              >
                <option value="">Select Space Type</option>
                {spaceTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.type && <span className="text-red-500 text-sm mt-1">{errors.type}</span>}
              
              {showCustomType && (
                <div className="mt-2">
                  <input
                    type="text"
                    name="customType"
                    placeholder="Enter space type"
                    value={spaceDetails.customType}
                    onChange={handleInputChange}
                    className={`custom-input ${getInputClassName('customType')}`}
                    disabled={isSubmitting}
                    required
                  />
                  {errors.customType && 
                    <span className="text-red-500 text-sm mt-1">{errors.customType}</span>}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Price:</label>
              <div className="price-input-group">
                <input
                  type="number"
                  name="price"
                  placeholder="Enter price"
                  value={spaceDetails.price}
                  onChange={handleInputChange}
                  className={getInputClassName('price')}
                  disabled={isSubmitting}
                  min="0"
                  step="0.01"
                  required
                />
                <select
                  name="priceType"
                  value={spaceDetails.priceType}
                  onChange={handleInputChange}
                  className="price-type-select"
                  disabled={isSubmitting}
                >
                  <option value="hour">per hour</option>
                  <option value="day">per day</option>
                </select>
              </div>
              {errors.price && <span className="text-red-500 text-sm mt-1">{errors.price}</span>}
            </div>

            <div className="form-group">
              <label>Capacity:</label>
              <input
                type="number"
                name="capacity"
                placeholder="Maximum number of people"
                value={spaceDetails.capacity}
                onChange={handleInputChange}
                className={getInputClassName('capacity')}
                disabled={isSubmitting}
                min="1"
                required
              />
              {errors.capacity && 
                <span className="text-red-500 text-sm mt-1">{errors.capacity}</span>}
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="form-section">
          <h2>Amenities</h2>
          <div className="amenities-grid">
            {amenitiesList.filter(amenity => amenity !== 'Other').map((amenity) => (
              <label key={amenity} className="amenity-item">
                <input
                  type="checkbox"
                  value={amenity}
                  checked={spaceDetails.amenities.includes(amenity)}
                  onChange={handleAmenitiesChange}
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
              <button 
                type="button"
                onClick={handleCustomAmenityAdd}
                className="add-amenity-btn"
                disabled={isSubmitting || !newCustomAmenity.trim()}
              >
                Add
              </button>
            </div>
            {spaceDetails.customAmenities.length > 0 && (
              <div className="custom-amenities-list">
                {spaceDetails.customAmenities.map((amenity, index) => (
                  <div key={index} className="custom-amenity-tag">
                    {amenity}
                    <button
                      type="button"
                      onClick={() => removeCustomAmenity(index)}
                      className="remove-amenity"
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

       
        {/* Location */}
        <LocationPicker 
          spaceDetails={spaceDetails}
          setSpaceDetails={setSpaceDetails}
          isSubmitting={isSubmitting}
          errors={errors}
        />


        {/* Photo Upload */}
        <div className="form-section">
          <h2>Photos</h2>
          <div className="form-group">
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
                Click to upload images (max 5)
              </div>
            </div>
            {/* Replace this section in your RentOutSpace.jsx file */}
            {images.length > 0 && (
  <div className="image-preview-container">
    <div className="image-previews-grid">
      {images.map((image, index) => (
        <div key={index} className="image-preview-wrapper">
          <div className="image-preview relative flex items-center justify-center bg-gray-50 p-3 rounded">
            <img 
              src={image.preview} 
              alt={`Preview ${index + 1}`} 
              style={{ maxWidth: '100%', maxHeight: '150px', width: 'auto', height: 'auto' }}
              className="object-contain rounded"
            />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="remove-image absolute top-2 right-2"
              disabled={isSubmitting}
            >
              <X size={16} />
            </button>
          </div>
          
          {/* Pass the handlers to the button */}
          <AnalyzeSpaceButton 
            imageIndex={index} 
            image={image} 
            onAnalysisStart={() => {
              setAnalysisLoading(true);
              openAnalysisModal();
            }}
            onAnalysisComplete={handleAnalysisComplete}
            onAnalysisError={() => setAnalysisLoading(false)}
          />
        </div>
      ))}
    </div>
  </div>
)}
          </div>
        </div>

        {/* Availability section with validation */}
        <div className="form-section">
          <h2>Availability</h2>
          <div className="date-inputs">
            <div className="form-group">
              <label>Start Date:</label>
              <input
                type="date"
                name="startDate"
                value={spaceDetails.availability.startDate}
                onChange={handleDateChange}
                className={getInputClassName('startDate')}
                disabled={isSubmitting}
                required
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.startDate && 
                <span className="text-red-500 text-sm mt-1">{errors.startDate}</span>}
            </div>

            <div className="form-group">
              <label>End Date:</label>
              <input
                type="date"
                name="endDate"
                value={spaceDetails.availability.endDate}
                onChange={handleDateChange}
                className={getInputClassName('endDate')}
                disabled={isSubmitting}
                required
                min={spaceDetails.availability.startDate || 
                     new Date().toISOString().split('T')[0]}
              />
              {errors.endDate && 
                <span className="text-red-500 text-sm mt-1">{errors.endDate}</span>}
            </div>

            <div className="form-group">
              <label>Available Times:</label>
              <div className="time-inputs">
                <input
                  type="time"
                  name="available_start_time"
                  value={spaceDetails.availability.available_start_time}
                  onChange={handleDateChange}
                  className={getInputClassName('available_start_time')}
                  disabled={isSubmitting}
                  required
                />
                <span>to</span>
                <input
                  type="time"
                  name="available_end_time"
                  value={spaceDetails.availability.available_end_time}
                  onChange={handleDateChange}
                  className={getInputClassName('available_end_time')}
                  disabled={isSubmitting}
                  required
                />
                {errors.availableTime && 
                  <span className="text-red-500 text-sm mt-1">{errors.availableTime}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="cancel-button"
            disabled={isSubmitting}
            onClick={() => navigate('/dashboard')}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className={`submit-button flex items-center justify-center gap-2 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Submitting...
              </>
            ) : (
              'List Space'
            )}
          </button>
        </div>
      </form>

      {/* Document verification modal */}
      <DocumentVerificationModal 
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onVerificationComplete={handleVerificationComplete}
      />
      <AnalysisResultModal
        isOpen={analysisModalOpen}
        onClose={closeAnalysisModal}
        analysis={currentAnalysis}
      />
    </div>
  );
};

export default RentOutSpace;