import React, { useState, useEffect } from 'react';
import { Camera, Edit, MapPin, Calendar, Phone, Mail, Home, Save, X } from 'lucide-react';
import './Profile.css';
import axios from 'axios';

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: "",
    location: "",
    joined: "",
    phone: "",
    email: "",
    address: "",
    bio: "",
    hobbies: [] // Initialize as empty array
  });

  // Fetch profile data from the backend
  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get('http://localhost:5000/profile', {
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
          joined: new Date(response.data.created_at).toLocaleDateString() || "Unknown Date"
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchUserProfile();
  }, []);

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
    <div className="profile-container">
      <div className="profile-wrapper">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-image-container">
            <div className="profile-image">
              <img src="/api/placeholder/128/128" alt="Profile" />
            </div>
            <button className="camera-button">
              <Camera className="h-4 w-4" />
            </button>
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
                <div className="join-date">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {userData.joined || 'Unknown Date'}</span>
                </div>
              </div>
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
            </div>
          </div>
        </div>

        {/* Contact Information */}
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

        {/* About Section */}
        <div className="about-card">
          <h2>About</h2>
          {isEditing ? (
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
          {isEditing ? (
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