import React, { useState, useEffect, useRef } from 'react';
import { Camera, Edit, MapPin, Calendar, Phone, Mail, Home, Save, X } from 'lucide-react';
import './Profile.css';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import Header from '../Headers/Header';

const Profile = () => {
  const { userId } = useParams(); // Get userId from URL parameter
  const [isEditing, setIsEditing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const [userData, setUserData] = useState({
    name: "",
    location: "",
    joined: "",
    phone: "",
    email: "",
    address: "",
    bio: "",
    hobbies: [],
    profile_image_url: ""
  });
  const [isOwnProfile, setIsOwnProfile] = useState(true);

  const BACKEND_URL = 'http://localhost:5000';

  // Fetch profile data from the backend
  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('token');
      try {
        let endpoint = 'http://localhost:5000/profile';
        
        // If userId is in URL params, fetch that specific user profile
        if (userId) {
          endpoint = `http://localhost:5000/profile/${userId}`;
          setIsOwnProfile(false);
        } else {
          setIsOwnProfile(true);
        }
        
        const response = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Transform the data to ensure hobbies is always an array
        const hobbies = response.data.hobbies 
          ? (typeof response.data.hobbies === 'string' 
              ? response.data.hobbies.split(',').map(hobby => hobby.trim())
              : response.data.hobbies)
          : [];

        setUserData({
          ...response.data,
          hobbies: hobbies,
          joined: response.data.created_at ? new Date(response.data.created_at).toLocaleDateString() : "Unknown Date"
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchUserProfile();
  }, [userId]); // Re-run effect when userId changes

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please select a valid image file (JPEG, JPG, or PNG)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('token');
    try {
      const response = await axios.post(
        'http://localhost:5000/profile/upload-image',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setUserData(prev => ({
        ...prev,
        profile_image_url: response.data.imageUrl
      }));
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadError('Failed to upload image. Please try again.');
    }
  };

  // Handle input changes for editing
  const handleInputChange = (e, field) => {
    if (field === 'hobbies') {
      // Split the comma-separated string into an array
      const hobbiesArray = e.target.value.split(',').map(hobby => hobby.trim());
      setUserData({
        ...userData,
        hobbies: hobbiesArray
      });
    } else {
      setUserData({
        ...userData,
        [field]: e.target.value
      });
    }
  };

  // Save updated profile data
  const handleSave = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.put(
        'http://localhost:5000/profile',
        {
          name: userData.name || '',
          location: userData.location || '',
          phone: userData.phone || '',
          address: userData.address || '',
          bio: userData.bio || '',
          hobbies: Array.isArray(userData.hobbies) ? userData.hobbies.join(", ") : ''
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log("Profile updated successfully:", response.data);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  // Cancel editing without saving
  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <div className="dashboard"> {/* Changed from profile-container to dashboard for consistency */}
      <Header /> {/* Added Header component */}
      
      <div className="profile-wrapper">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-image-container">
            <div className="profile-image">
              <img 
                src={userData.profile_image_url ? `${BACKEND_URL}${userData.profile_image_url}` : "/api/placeholder/128/128"} 
                alt="Profile" 
                className="profile-img"
              />
            </div>
            {isOwnProfile && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/jpeg,image/jpg,image/png"
                  style={{ display: 'none' }}
                />
                <button 
                  className="camera-button"
                  onClick={() => fileInputRef.current.click()}
                >
                  <Camera className="h-4 w-4" />
                </button>
                {uploadError && (
                  <div className="error-message">{uploadError}</div>
                )}
              </>
            )}
          </div>
          
          <div className="profile-info">
            <div className="profile-info-header">
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={userData.name || ''}
                    onChange={(e) => handleInputChange(e, 'name')}
                    className="edit-input text-2xl"
                  />
                ) : (
                  <h1>{userData.name || 'No Name Set'}</h1>
                )}
                <div className="location-info">
                  <MapPin className="h-4 w-4" />
                  {isEditing ? (
                    <input
                      type="text"
                      value={userData.location || ''}
                      onChange={(e) => handleInputChange(e, 'location')}
                      className="edit-input"
                    />
                  ) : (
                    <span>{userData.location || 'No Location Set'}</span>
                  )}
                </div>
                {userData.joined && (
                  <div className="join-date">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {userData.joined || 'Unknown Date'}</span>
                  </div>
                )}
              </div>
              {isOwnProfile && (
                <div className="edit-buttons">
                  {isEditing ? (
                    <>
                      <button className="save-button" onClick={handleSave}>
                        <Save className="h-4 w-4" />
                        Save
                      </button>
                      <button className="cancel-button" onClick={handleCancel}>
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="edit-button" onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4" />
                      Edit Profile
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        {isOwnProfile ? (
          <div className="contact-card">
            <h2>Contact Information</h2>
            <div className="contact-info">
              <div className="contact-item">
                <Phone className="h-4 w-4" />
                {isEditing ? (
                  <input
                    type="tel"
                    value={userData.phone || ''}
                    onChange={(e) => handleInputChange(e, 'phone')}
                    className="edit-input"
                  />
                ) : (
                  <span>{userData.phone || 'No Phone Set'}</span>
                )}
              </div>
              <div className="contact-item">
                <Mail className="h-4 w-4" />
                <span>{userData.email || 'No Email Set'}</span>
              </div>
              <div className="contact-item">
                <Home className="h-4 w-4" />
                {isEditing ? (
                  <input
                    type="text"
                    value={userData.address || ''}
                    onChange={(e) => handleInputChange(e, 'address')}
                    className="edit-input"
                  />
                ) : (
                  <span>{userData.address || 'No Address Set'}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="contact-card">
            <h2>Contact Information</h2>
            <p className="privacy-notice">This user's contact information is private</p>
          </div>
        )}

        {/* About Section */}
        <div className="about-card">
          <h2>About</h2>
          {isEditing && isOwnProfile ? (
            <textarea
              value={userData.bio || ''}
              onChange={(e) => handleInputChange(e, 'bio')}
              className="edit-textarea"
              rows="4"
              placeholder="Tell us about yourself..."
            />
          ) : (
            <p>{userData.bio || 'No bio available'}</p>
          )}
        </div>

        {/* Hobbies Section */}
        <div className="about-card">
          <h2>Hobbies & Interests</h2>
          {isEditing && isOwnProfile ? (
            <textarea
              value={Array.isArray(userData.hobbies) ? userData.hobbies.join(", ") : ''}
              onChange={(e) => handleInputChange(e, 'hobbies')}
              className="edit-textarea"
              placeholder="Enter hobbies separated by commas"
              rows="2"
            />
          ) : (
            <p>{Array.isArray(userData.hobbies) && userData.hobbies.length > 0 
                ? userData.hobbies.join(", ") 
                : 'No hobbies listed'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;