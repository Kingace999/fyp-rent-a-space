import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginSignup from './Components/LoginSignup/LoginSignup';
import Dashboard from './Components/Dashboard/Dashboard';
import Profile from './Components/Profile/Profile';
import RentOutSpace from './Components/RentOutSpace/RentOutSpace'; 

const App = () => {
  const [message, setMessage] = useState('');

  // Fetch the message from backend (keeps the connection)
  useEffect(() => {
    axios
      .get('http://localhost:5000') // Backend endpoint
      .then(response => setMessage(response.data.message)) // Store message from backend
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  return (
    <Router>
      <Routes>
        {/* Route for Login/Signup */}
        <Route path="/" element={<LoginSignup />} />
        {/* Route for Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Route for Profile */}
        <Route path="/profile" element={<Profile />} />
        {/* Route for Rent Out a Space */}
        <Route path="/rent-out-space" element={<RentOutSpace />} />
      </Routes>
    </Router>
  );
};

export default App;
