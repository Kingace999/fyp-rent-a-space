import React, { useState } from 'react';
import { Camera, Edit, MapPin, Calendar, Phone, Mail, Home, Save, X } from 'lucide-react';
import './Profile.css';

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: "Sarah Johnson",
    location: "San Francisco, CA",
    joined: "January 2024",
    phone: "+1 (555) 123-4567",
    email: "sarah.j@example.com",
    address: "123 Market Street, San Francisco, CA 94105",
    bio: "Passionate about traveling and meeting new people. Love exploring unique spaces and creating memorable experiences.",
    hobbies: [
      "Playing Guitar",
      "Reading",
      "Painting",
      "Coding",
      "Traveling"
    ]
  });

  const handleInputChange = (e, field) => {
    setUserData({
      ...userData,
      [field]: e.target.value
    });
  };

  const handleSave = () => {
    // Here you would typically make an API call to save the changes
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Reset any unsaved changes
    setIsEditing(false);
  };

  return (
    <div className="profile-container">
      <div className="profile-wrapper">
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
                    value={userData.name}
                    onChange={(e) => handleInputChange(e, 'name')}
                    className="edit-input text-2xl"
                  />
                ) : (
                  <h1>{userData.name}</h1>
                )}
                <div className="location-info">
                  <MapPin className="h-4 w-4" />
                  {isEditing ? (
                    <input
                      type="text"
                      value={userData.location}
                      onChange={(e) => handleInputChange(e, 'location')}
                      className="edit-input"
                    />
                  ) : (
                    <span>{userData.location}</span>
                  )}
                </div>
                <div className="join-date">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {userData.joined}</span>
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

        <div className="contact-card">
          <h2>Contact Information</h2>
          <div className="contact-info">
            <div className="contact-item">
              <Phone className="h-4 w-4" />
              {isEditing ? (
                <input
                  type="tel"
                  value={userData.phone}
                  onChange={(e) => handleInputChange(e, 'phone')}
                  className="edit-input"
                />
              ) : (
                <span>{userData.phone}</span>
              )}
            </div>
            <div className="contact-item">
              <Mail className="h-4 w-4" />
              {isEditing ? (
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => handleInputChange(e, 'email')}
                  className="edit-input"
                />
              ) : (
                <span>{userData.email}</span>
              )}
            </div>
            <div className="contact-item">
              <Home className="h-4 w-4" />
              {isEditing ? (
                <input
                  type="text"
                  value={userData.address}
                  onChange={(e) => handleInputChange(e, 'address')}
                  className="edit-input"
                />
              ) : (
                <span>{userData.address}</span>
              )}
            </div>
          </div>
        </div>

        <div className="about-card">
          <h2>About</h2>
          {isEditing ? (
            <textarea
              value={userData.bio}
              onChange={(e) => handleInputChange(e, 'bio')}
              className="edit-textarea"
              rows="4"
            />
          ) : (
            <p>{userData.bio}</p>
          )}
        </div>

        <div className="about-card">
          <h2>Hobbies & Interests</h2>
          {isEditing ? (
            <textarea
              value={userData.hobbies.join(", ")}
              onChange={(e) => handleInputChange(e, 'hobbies')}
              className="edit-textarea"
              placeholder="Enter hobbies separated by commas"
              rows="2"
            />
          ) : (
            <p>{userData.hobbies.join(", ")}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;