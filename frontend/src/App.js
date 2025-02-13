import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginSignup from './Components/LoginSignup/LoginSignup';
import Dashboard from './Components/Dashboard/Dashboard';
import Profile from './Components/Profile/Profile';
import RentOutSpace from './Components/RentOutSpace/RentOutSpace';
import MyListings from './Components/MyListings/MyListings';
import ListingDetails from './Components/ListingDetails/ListingDetails';
import MyBookings from './Components/MyBookings/MyBookings';
import Notifications from './Components/Notifications/Notifications'; // Import Notifications

const App = () => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios
      .get('http://localhost:5000')
      .then(response => setMessage(response.data.message))
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginSignup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/rent-out-space" element={<RentOutSpace />} />
        <Route path="/my-listings" element={<MyListings />} />
        <Route path="/listing/:id" element={<ListingDetails />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/notifications" element={<Notifications />} /> 
      </Routes>
    </Router>
  );
};

export default App;
