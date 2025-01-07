import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const EditListingPage = () => {
  const { listingId } = useParams();
  const [formData, setFormData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchListing = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`http://localhost:5000/listings/${listingId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setFormData(response.data);
      } catch (error) {
        console.error('Error fetching listing:', error);
      }
    };

    fetchListing();
  }, [listingId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      await axios.put(`http://localhost:5000/listings/${listingId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      navigate('/my-listings');
    } catch (error) {
      console.error('Error updating listing:', error);
    }
  };

  if (!formData) {
    return <p>Loading...</p>;
  }

  return (
    <div className="edit-listing-page">
      <h1>Edit Listing</h1>
      <form onSubmit={handleFormSubmit}>
        <label>
          Title:
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
          />
        </label>
        <label>
          Description:
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
          />
        </label>
        <label>
          Price:
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
          />
        </label>
        <label>
          Capacity:
          <input
            type="number"
            name="capacity"
            value={formData.capacity}
            onChange={handleInputChange}
          />
        </label>
        <button type="submit">Save Changes</button>
        <button type="button" onClick={() => navigate('/my-listings')}>
          Cancel
        </button>
      </form>
    </div>
  );
};

export default EditListingPage;
