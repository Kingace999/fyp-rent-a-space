import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import './RentOutSpace.css'
const RentOutSpace = () => {
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
    },
  });
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState(null);
  const [showCustomType, setShowCustomType] = useState(false);
  const [newCustomAmenity, setNewCustomAmenity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

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
    if (files.length > 5) {
      setMessage({ type: 'error', text: 'Maximum 5 images allowed' });
      return;
    }
    setImages((prev) => [...prev, ...files].slice(0, 5));
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(spaceDetails).forEach(key => {
      if (key === 'availability') {
        newErrors.startDate = validateField('startDate', spaceDetails.availability.startDate);
        newErrors.endDate = validateField('endDate', spaceDetails.availability.endDate);
      } else if (key !== 'amenities' && key !== 'customAmenities') {
        newErrors[key] = validateField(key, spaceDetails[key]);
      }
    });

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setMessage({ type: 'error', text: 'Please fix the errors before submitting' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const finalSpaceType = spaceDetails.type === 'Other' ? spaceDetails.customType : spaceDetails.type;
      const finalAmenities = [...spaceDetails.amenities, ...spaceDetails.customAmenities];
      console.log('Space Details:', { ...spaceDetails, type: finalSpaceType, amenities: finalAmenities });
      console.log('Uploaded Images:', images);
      
      setMessage({ type: 'success', text: 'Listing submitted successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to submit listing. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
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
        <div className="form-section">
          <h2>Location</h2>
          <div className="form-group">
            <label>Address:</label>
            <input
              type="text"
              name="location"
              placeholder="Enter the full address"
              value={spaceDetails.location}
              onChange={handleInputChange}
              className={getInputClassName('location')}
              disabled={isSubmitting}
              required
            />
            {errors.location && 
              <span className="text-red-500 text-sm mt-1">{errors.location}</span>}
          </div>
        </div>

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
            {images.length > 0 && (
              <div className="image-preview-container">
                {images.map((image, index) => (
                  <div key={index} className="image-preview">
                    <span>{image.name}</span>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="remove-image"
                      disabled={isSubmitting}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
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
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="cancel-button"
            disabled={isSubmitting}
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
    </div>
  );
};

export default RentOutSpace;